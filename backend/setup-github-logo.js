const mongoose = require('mongoose');

// Set up a definitely working default logo
async function setupDefinitelyWorkingLogo() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Use a simple, definitely accessible logo (GitHub's logo from their API)
    const workingLogoUrl = 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
    
    console.log('📤 Setting up definitely working default logo URL:', workingLogoUrl);
    const result = await db.collection('settings').findOneAndUpdate(
      { type: 'general' },
      {
        $set: {
          'generalConfig.qrCodeUrl': workingLogoUrl,
          lastUpdated: new Date()
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    console.log('✅ Settings updated successfully');
    
    // Test if this URL is accessible
    console.log('🌐 Testing URL accessibility...');
    const axios = require('axios');
    try {
      const response = await axios.head(workingLogoUrl, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'YQPayNow-QR-Generator/1.0'
        }
      });
      console.log('✅ URL is accessible! Status:', response.status);
      console.log('📄 Content-Type:', response.headers['content-type']);
      
      // Test actual download
      const downloadResponse = await axios.get(workingLogoUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'YQPayNow-QR-Generator/1.0'
        }
      });
      console.log('✅ Logo downloaded successfully! Size:', downloadResponse.data.byteLength, 'bytes');
      
    } catch (error) {
      console.log('❌ URL not accessible:', error.message);
      
      // Fallback to a simple base64 image for testing
      console.log('🔄 Using fallback approach - creating a simple test image...');
      
      // Create a simple test image data URL
      const simpleImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      await db.collection('settings').findOneAndUpdate(
        { type: 'general' },
        {
          $set: {
            'generalConfig.qrCodeUrl': simpleImageDataUrl,
            lastUpdated: new Date()
          }
        },
        {
          upsert: true,
          returnDocument: 'after'
        }
      );
      
      console.log('✅ Fallback image set up');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Disconnected from MongoDB');
    process.exit(0);
  }
}

setupDefinitelyWorkingLogo();