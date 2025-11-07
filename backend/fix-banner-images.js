// Script to fix the existing banner with a placeholder base64 image
const mongoose = require('mongoose');
require('dotenv').config();

const Banner = require('./models/Banner');

// Small 1x1 purple placeholder PNG as base64
const PLACEHOLDER_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

async function fixBanner() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const theaterId = '68f8837a541316c6ad54b79f';
    const bannerDoc = await Banner.findOne({ theater: theaterId });

    if (!bannerDoc) {
      console.log('❌ No banner document found');
      return;
    }

    console.log(`📦 Found ${bannerDoc.bannerList.length} banners`);

    // Update all banners to use placeholder
    bannerDoc.bannerList.forEach((banner, idx) => {
      const oldUrl = banner.imageUrl;
      banner.imageUrl = PLACEHOLDER_BASE64;
      console.log(`\n  Banner ${idx + 1}:`);
      console.log('  - Old URL:', oldUrl.substring(0, 50) + '...');
      console.log('  - New URL: [Base64 placeholder data URL]');
    });

    await bannerDoc.save();
    console.log('\n✅ Banners updated with placeholder images!');
    console.log('🔄 Refresh the page in your browser to see the change.');

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixBanner();
