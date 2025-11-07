import React from 'react';
import config from '../config';
import AutoUpload from '../components/AutoUpload';

/**
 * Demo page showing the AutoUpload component with different upload types
 * This demonstrates how any new page can easily use organized uploads
 */
const UploadDemo = () => {
  const handleSuccess = (result) => {

    alert(`File uploaded successfully to: ${result.folderPath}`);
  };

  const handleError = (error) => {

    alert(`Upload failed: ${error}`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🚀 Smart AutoUpload Demo</h1>
      <p>This demo shows how the AutoUpload component automatically organizes files based on upload type.</p>
      
      <div style={{ display: 'grid', gap: '30px', marginTop: '30px' }}>
        
        {/* Settings Uploads */}
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
          <h3>📋 Settings Page Uploads</h3>
          <div style={{ display: 'grid', gap: '15px' }}>
            <AutoUpload
              uploadType="logo"
              label="Logo Upload"
              onSuccess={handleSuccess}
              onError={handleError}
            />
            <AutoUpload
              uploadType="qr-code"
              label="QR Code Upload"
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </div>
        </div>

        {/* Menu Uploads */}
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
          <h3>🍕 Menu Page Uploads</h3>
          <div style={{ display: 'grid', gap: '15px' }}>
            <AutoUpload
              uploadType="menu-item"
              label="Menu Item Image"
              onSuccess={handleSuccess}
              onError={handleError}
            />
            <AutoUpload
              uploadType="food-item"
              label="Food Item Photo"
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </div>
        </div>

        {/* Promotions Uploads */}
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
          <h3>📢 Promotions Page Uploads</h3>
          <div style={{ display: 'grid', gap: '15px' }}>
            <AutoUpload
              uploadType="banner"
              label="Promotion Banner"
              onSuccess={handleSuccess}
              onError={handleError}
            />
            <AutoUpload
              uploadType="offer"
              label="Special Offer Image"
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </div>
        </div>

        {/* Theater Uploads */}
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
          <h3>🎭 Theater Page Uploads</h3>
          <div style={{ display: 'grid', gap: '15px' }}>
            <AutoUpload
              uploadType="theater-image"
              label="Theater Photo"
              onSuccess={handleSuccess}
              onError={handleError}
            />
            <AutoUpload
              uploadType="hall-photo"
              label="Hall Photo"
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </div>
        </div>

      </div>

      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h3>📁 Automatic Folder Organization</h3>
        <pre style={{ fontSize: '14px', lineHeight: '1.6' }}>
{`theater-canteen-storage/
├── settings/
│   ├── logos/          ← logo, favicon uploads
│   └── qr-codes/       ← qr-code uploads
├── menu/
│   └── items/          ← menu-item, food-item, beverage uploads
├── promotions/
│   └── banners/        ← banner, promotion, offer uploads
└── theater/
    └── images/         ← theater-image, hall-photo uploads`}
        </pre>
        <p><strong>Benefits:</strong></p>
        <ul>
          <li>✅ Automatic folder organization based on upload type</li>
          <li>✅ No manual folder specification needed</li>
          <li>✅ Consistent file organization across all pages</li>
          <li>✅ Easy to add new upload types</li>
          <li>✅ Built-in validation and error handling</li>
        </ul>
      </div>
    </div>
  );
};

export default UploadDemo;