const { Storage } = require('@google-cloud/storage');
const path = require('path');
const mongoose = require('mongoose');

/**
 * GCS Upload Utility
 * Handles file uploads to Google Cloud Storage
 */

let storageClient = null;
let bucketName = null;
const USE_MOCK_MODE = process.env.GCS_MOCK_MODE === 'true' || false; // Check env variable
/**
 * Initialize GCS client with settings from database
 */
async function initializeGCS() {
  if (USE_MOCK_MODE) {
    return { mock: true };
  }
  
  try {
    // Get GCS settings from database
    const db = mongoose.connection.db;
    const settings = await db.collection('settings').find({ category: 'gcs' }).toArray();
    
    if (!settings || settings.length === 0) {
      console.warn('⚠️  GCS settings not found in database');
      return null;
    }

    // Extract settings
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.key] = setting.value;
    });

    const projectId = settingsMap.projectId;
    const clientEmail = settingsMap.clientEmail;
    const privateKey = settingsMap.privateKey ? settingsMap.privateKey.replace(/\\n/g, '\n') : null;
    bucketName = settingsMap.bucketName || 'theater-canteen-uploads';

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('⚠️  GCS credentials incomplete');
      return null;
    }

    // Initialize Storage client
    storageClient = new Storage({
      projectId: projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey
      }
    });
    return storageClient;

  } catch (error) {
    console.error('❌ Failed to initialize GCS:', error.message);
    return null;
  }
}

/**
 * Upload a single file to GCS
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} filename - Original filename
 * @param {string} folder - Folder path in bucket (e.g., 'theaters/photos')
 * @param {string} mimetype - File mimetype
 * @returns {Promise<string>} Public URL of uploaded file
 */
async function uploadFile(fileBuffer, filename, folder, mimetype) {
  try {

    // Initialize GCS if not already done
    if (!storageClient && !USE_MOCK_MODE) {
      await initializeGCS();
    }

    if (!storageClient && !USE_MOCK_MODE) {
      throw new Error('GCS client not initialized');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    const uniqueFilename = `${name}-${timestamp}${ext}`;
    const destination = `${folder}/${uniqueFilename}`;

    // Mock mode - return base64 data URL (same as gcsUpload.js for consistency)
    if (USE_MOCK_MODE) {
      console.log('🎭 MOCK MODE (gcsUploadUtil): Using base64 data URL for', filename);
      const base64Data = fileBuffer.toString('base64');
      const dataUrl = `data:${mimetype};base64,${base64Data}`;
      console.log('✅ Base64 data URL created (length:', dataUrl.length, ')');
      return dataUrl;
    }

    const bucket = storageClient.bucket(bucketName);
    
    // Create file reference
    const file = bucket.file(destination);
    // Upload file (removed public:true to work with Public Access Prevention)
    await file.save(fileBuffer, {
      metadata: {
        contentType: mimetype,
        metadata: {
          originalName: filename,
          uploadedAt: new Date().toISOString()
        }
      },
      validation: 'md5'
    });

    // Generate signed URL (works even with Public Access Prevention)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '12-31-2099' // Long-term access
    });

    return url;

  } catch (error) {
    console.error('❌ File upload error:', error.message);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Upload multiple files to GCS
 * @param {Array} files - Array of file objects from multer
 * @param {string} folder - Folder path in bucket
 * @returns {Promise<Object>} Map of field names to public URLs
 */
async function uploadFiles(files, folder) {
  try {
    const uploadPromises = files.map(file => 
      uploadFile(file.buffer, file.originalname, folder, file.mimetype)
        .then(url => ({ field: file.fieldname, url }))
    );

    const results = await Promise.all(uploadPromises);
    
    // Convert array to object
    const urlMap = {};
    results.forEach(result => {
      urlMap[result.field] = result.url;
    });

    return urlMap;

  } catch (error) {
    console.error('❌ Multiple files upload error:', error.message);
    throw new Error(`Failed to upload files: ${error.message}`);
  }
}

/**
 * Delete a file from GCS
 * @param {string} fileUrl - Public URL of the file to delete
 * @returns {Promise<boolean>} Success status
 */
async function deleteFile(fileUrl) {
  try {
    // Mock mode - just log and return success
    if (USE_MOCK_MODE) {
      return true;
    }

    // Initialize GCS if not already done
    if (!storageClient) {
      await initializeGCS();
    }

    if (!storageClient || !fileUrl) {
      return false;
    }

    const bucket = storageClient.bucket(bucketName);
    
    // Extract file path from URL
    // URL format: https://storage.googleapis.com/bucket-name/path/to/file
    const urlParts = fileUrl.split('/');
    const bucketIndex = urlParts.findIndex(part => part === bucketName);
    if (bucketIndex === -1) {
      console.warn('⚠️  Invalid GCS URL format');
      return false;
    }

    const filePath = urlParts.slice(bucketIndex + 1).join('/').split('?')[0]; // Remove query params

    const file = bucket.file(filePath);
    await file.delete();
    return true;

  } catch (error) {
    console.error('❌ File deletion error:', error.message);
    return false;
  }
}

/**
 * Delete multiple files from GCS
 * @param {Array<string>} fileUrls - Array of file URLs to delete
 * @returns {Promise<number>} Number of files successfully deleted
 */
async function deleteFiles(fileUrls) {
  try {
    const deletePromises = fileUrls.map(url => deleteFile(url));
    const results = await Promise.all(deletePromises);
    const successCount = results.filter(result => result === true).length;
    return successCount;

  } catch (error) {
    console.error('❌ Multiple files deletion error:', error.message);
    return 0;
  }
}

/**
 * Check if GCS is configured and accessible
 * @returns {Promise<boolean>} True if GCS is ready
 */
async function isGCSReady() {
  try {
    if (!storageClient) {
      await initializeGCS();
    }
    return storageClient !== null;
  } catch (error) {
    return false;
  }
}

module.exports = {
  initializeGCS,
  uploadFile,
  uploadFiles,
  deleteFile,
  deleteFiles,
  isGCSReady
};
