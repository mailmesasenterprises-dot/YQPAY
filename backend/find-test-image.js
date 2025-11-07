// Create a simple test image as data URL
const fs = require('fs');
const path = require('path');

// Let's check if there are any existing logo files
const logoDir = path.join(__dirname, 'category-images');

if (fs.existsSync(logoDir)) {
  console.log('📁 Found category-images directory');
  const files = fs.readdirSync(logoDir);
  console.log('📋 Files in category-images:', files);
  
  // Look for any image files
  const imageFiles = files.filter(file => 
    file.toLowerCase().endsWith('.jpg') || 
    file.toLowerCase().endsWith('.jpeg') || 
    file.toLowerCase().endsWith('.png')
  );
  
  if (imageFiles.length > 0) {
    console.log(`🖼️  Found ${imageFiles.length} image files`);
    
    // Use the first image file
    const imageFile = imageFiles[0];
    const imagePath = path.join(logoDir, imageFile);
    
    console.log(`📋 Using image: ${imagePath}`);
    
    // Read the image and convert to data URL
    const imageBuffer = fs.readFileSync(imagePath);
    const imageExt = path.extname(imageFile).toLowerCase();
    let mimeType = 'image/jpeg';
    
    if (imageExt === '.png') mimeType = 'image/png';
    else if (imageExt === '.jpg' || imageExt === '.jpeg') mimeType = 'image/jpeg';
    
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    console.log(`✅ Created data URL, length: ${dataUrl.length}`);
    console.log(`📋 First 100 chars: ${dataUrl.substring(0, 100)}...`);
    
    // Save to a test file
    fs.writeFileSync('test-working-dataurl.txt', dataUrl);
    console.log('✅ Saved working data URL to test-working-dataurl.txt');
    
  } else {
    console.log('❌ No image files found in category-images');
  }
} else {
  console.log('❌ No category-images directory found');
}

// Also check uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadsDir)) {
  console.log('\n📁 Found uploads directory');
  
  function findImagesInDir(dir, depth = 0) {
    if (depth > 3) return []; // Prevent infinite recursion
    
    const items = fs.readdirSync(dir);
    let images = [];
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        images = images.concat(findImagesInDir(itemPath, depth + 1));
      } else if (item.toLowerCase().match(/\.(jpg|jpeg|png)$/)) {
        images.push(itemPath);
      }
    }
    
    return images;
  }
  
  const uploadImages = findImagesInDir(uploadsDir);
  console.log(`🖼️  Found ${uploadImages.length} images in uploads directory`);
  
  if (uploadImages.length > 0) {
    uploadImages.slice(0, 5).forEach(img => {
      console.log(`  - ${img}`);
    });
  }
}