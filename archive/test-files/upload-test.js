// 🔧 DIAGNOSTIC TEST - Run this in browser console to test upload

async function testImageUpload() {
  console.log('🧪 TESTING IMAGE UPLOAD FROM BROWSER...');
  
  try {
    // Check if auth token exists
    const authToken = localStorage.getItem('authToken');
    console.log('🔐 Auth token exists:', authToken ? 'YES' : 'NO');
    console.log('🔐 Token preview:', authToken ? authToken.substring(0, 20) + '...' : 'NONE');
    
    // Create a tiny test image
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 1, 1);
    
    // Convert to blob
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    console.log('📷 Test image created:', blob.size, 'bytes');
    
    // Test upload
    const formData = new FormData();
    formData.append('image', blob, 'test-image.png');
    formData.append('folderType', 'menu');
    formData.append('folderSubtype', 'items');
    formData.append('uploadType', 'menu-item');
    
    console.log('📤 Starting upload test...');
    
    const response = await fetch('/api/upload/image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response ok:', response.ok);
    
    const responseText = await response.text();
    console.log('📄 Raw response:', responseText);
    
    try {
      const data = JSON.parse(responseText);
      console.log('📦 Parsed response:', data);
      
      if (data.success) {
        console.log('✅ Upload successful!');
        console.log('🔗 Public URL:', data.data?.data?.publicUrl);
      } else {
        console.log('❌ Upload failed:', data.message);
      }
    } catch (parseError) {
      console.log('❌ Failed to parse JSON response:', parseError.message);
    }
    
  } catch (error) {
    console.error('💥 Upload test failed:', error);
  }
}

// Run the test
testImageUpload();