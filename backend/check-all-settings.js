const mongoose = require('mongoose');
const Settings = require('./models/Settings');

async function checkAllSettings() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/cinema-app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Get all settings
    const settings = await Settings.findOne({});
    
    if (!settings) {
      console.log('❌ No settings found at all');
      return;
    }

    console.log('📋 Settings structure:');
    console.log(JSON.stringify(settings, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Disconnected from MongoDB');
  }
}

checkAllSettings();