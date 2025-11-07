const mongoose = require('mongoose');

// Clean up test data and set a working default logo
async function setupWorkingDefaultLogo() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // First, clear any test data
    console.log('🧹 Clearing test data...');
    await db.collection('settings').deleteOne({ type: 'general' });
    
    // Use a known working logo URL (the default React logo that should exist)
    // This is a publicly accessible logo that should work for testing
    const workingLogoUrl = 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg';
    
    console.log('📤 Setting up working default logo URL:', workingLogoUrl);
    const result = await db.collection('settings').findOneAndUpdate(
      { type: 'general' },
      {
        $set: {
          'generalConfig': {
            qrCodeUrl: workingLogoUrl,
            applicationName: 'YQPayNow - Theater Canteen',
            logoUrl: '',
            environment: 'development',
            defaultCurrency: 'INR',
            timezone: 'Asia/Kolkata',
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '12hour',
            languageRegion: 'en-IN',
            currency: 'INR',
            currencySymbol: '₹',
            primaryColor: '#8B5CF6',
            secondaryColor: '#6366F1',
            taxRate: 18,
            serviceChargeRate: 0
          },
          lastUpdated: new Date()
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    console.log('✅ Settings updated successfully');
    
    // Test fetching it back
    const { getDefaultLogoUrl } = require('./utils/singleQRGenerator');
    const fetchedUrl = await getDefaultLogoUrl();
    
    console.log('🔍 Verification:');
    console.log('  Fetched URL:', fetchedUrl);
    console.log('  Expected URL:', workingLogoUrl);
    console.log('  Match:', fetchedUrl === workingLogoUrl ? '✅ YES' : '❌ NO');

    // Test if this URL is accessible
    console.log('🌐 Testing URL accessibility...');
    const axios = require('axios');
    try {
      const response = await axios.head(workingLogoUrl, { timeout: 10000 });
      console.log('✅ URL is accessible! Status:', response.status);
      console.log('📄 Content-Type:', response.headers['content-type']);
    } catch (error) {
      console.log('❌ URL not accessible:', error.message);
    }

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Disconnected from MongoDB');
    process.exit(0);
  }
}

setupWorkingDefaultLogo();