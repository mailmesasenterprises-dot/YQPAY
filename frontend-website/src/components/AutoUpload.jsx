import React, { useState } from 'react';
import config from '../config';

// Debug: Check if config is loaded properly

// Early validation of config
if (!config) {
  }
if (!config?.api) {
  }
if (!config?.api?.baseUrl) {
  }

/**
 * Smart AutoUpload Component
 * Automatically determines folder structure based on upload type
 */
const AutoUpload = ({ 
  uploadType, 
  onSuccess, 
  onError,
  maxSize = 30 * 1024 * 1024, // 30MB default
  acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'],
  label = 'Upload File',
  className = '',
  style = {}
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Smart folder mapping based on upload type
  const getFolderMapping = (type) => {
    const mappings = {
      // Settings related uploads
      'logo': { folderType: 'settings', folderSubtype: 'logos' },
      'qr-code': { folderType: 'settings', folderSubtype: 'qr-codes' },
      'favicon': { folderType: 'settings', folderSubtype: 'logos' },
      
      // Menu related uploads
      'menu-item': { folderType: 'menu', folderSubtype: 'items' },
      'food-item': { folderType: 'menu', folderSubtype: 'items' },
      'beverage': { folderType: 'menu', folderSubtype: 'items' },
      
      // Promotion related uploads
      'banner': { folderType: 'promotions', folderSubtype: 'banners' },
      'promotion': { folderType: 'promotions', folderSubtype: 'banners' },
      'advertisement': { folderType: 'promotions', folderSubtype: 'banners' },
      'offer': { folderType: 'promotions', folderSubtype: 'banners' },
      
      // Theater related uploads
      'theater-image': { folderType: 'theater', folderSubtype: 'images' },
      'hall-photo': { folderType: 'theater', folderSubtype: 'images' },
      'seating-chart': { folderType: 'theater', folderSubtype: 'images' },
      
      // Default fallback
      'default': { folderType: 'default', folderSubtype: 'images' }
    };

    return mappings[type] || mappings['default'];
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      const allowedTypes = acceptedTypes.join(', ').replace(/image\//g, '');
      onError && onError(`Please upload a valid image file (${allowedTypes.toUpperCase()})`);
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      onError && onError(`File size should be less than ${maxSizeMB}MB`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('image', file);
      
      // Smart folder detection
      const folderMapping = getFolderMapping(uploadType);
      formData.append('folderType', folderMapping.folderType);
      formData.append('folderSubtype', folderMapping.folderSubtype);
      
      // Add upload context for better organization
      formData.append('uploadType', uploadType);
      formData.append('uploadContext', `${folderMapping.folderType}/${folderMapping.folderSubtype}`);

      // Get baseUrl with proper error handling and fallback
      let baseUrl;
      if (config && config.api && config.api.baseUrl) {
        baseUrl = config.api.baseUrl;
      } else {

        // Fallback to common development URLs
        const fallbackUrls = [
          'http://localhost:5000/api',
          '/api' // relative URL fallback
        ];
        
        baseUrl = fallbackUrls[0]; // Use first fallback
  }
      

      // Try GCS upload first, fallback to local if GCS is not configured
      let response = await fetch(`${baseUrl}/upload/image`, {
        method: 'POST',
        body: formData
      });

      // If GCS upload fails, try local upload as fallback
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Create new FormData for local upload
        const localFormData = new FormData();
        localFormData.append('image', file);
        localFormData.append('folderType', folderMapping.folderType);
        localFormData.append('folderSubtype', folderMapping.folderSubtype);
        localFormData.append('uploadType', uploadType);
        

        response = await fetch(`${baseUrl}/upload-local/image`, {
          method: 'POST',
          body: localFormData
        });
        
  }

      if (response.ok) {
        const result = await response.json();

        // Extract URL from response - handle both GCS and local responses
        const signedUrl = result.data?.data?.publicUrl || result.data?.publicUrl || result.publicUrl;
        
        if (!signedUrl) {

          throw new Error('Upload successful but no URL returned');
        }

        setUploadProgress(100);
        
        // Call success callback with enriched data
        onSuccess && onSuccess({
          ...result,
          uploadType,
          folderPath: `${folderMapping.folderType}/${folderMapping.folderSubtype}`,
          signedUrl,
          file: {
            name: file.name,
            size: file.size,
            type: file.type
          }
        });
  } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }
  } catch (error) {

      onError && onError(error.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const folderInfo = getFolderMapping(uploadType);

  return (
    <div className={`auto-upload-container ${className}`} style={style}>
      <div className="upload-info">
        <label>{label}</label>
        <small style={{ color: '#666', fontSize: '12px', display: 'block' }}>
          Will be saved to: <strong>{folderInfo.folderType}/{folderInfo.folderSubtype}/</strong>
        </small>
      </div>
      
      <input
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleFileUpload}
        disabled={uploading}
        style={{
          marginTop: '5px',
          padding: '8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          width: '100%'
        }}
      />
      
      {uploading && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Uploading to {folderInfo.folderType}/{folderInfo.folderSubtype}/...
          </div>
          <div style={{
            width: '100%',
            height: '4px',
            backgroundColor: '#f0f0f0',
            borderRadius: '2px',
            marginTop: '5px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${uploadProgress}%`,
              height: '100%',
              backgroundColor: '#8B5CF6',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoUpload;