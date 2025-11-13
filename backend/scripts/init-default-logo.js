/**
 * Script to initialize default QR logo in settings
 * Run this script once to set a default logo for all QR codes
 */

const mongoose = require('mongoose');
require('dotenv').config();

const DEFAULT_LOGO_URL = '/images/logo.jpg'; // Change this to your default logo path or URL

async function initializeDefaultLogo() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Update or create the general settings with default logo
    // This logo is used for QR codes when "Default Logo" is selected
    // Same as Super Admin -> Settings -> General -> Application Logo
    const result = await db.collection('settings').findOneAndUpdate(
      { type: 'general' },
      {
        $set: {
          'generalConfig.logoUrl': DEFAULT_LOGO_URL,
          lastUpdated: new Date()
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    console.log('✅ Default logo initialized successfully');
    console.log('📋 Logo URL:', DEFAULT_LOGO_URL);
    console.log('📄 Settings document:', JSON.stringify(result, null, 2));

    // Close connection
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
initializeDefaultLogo();
