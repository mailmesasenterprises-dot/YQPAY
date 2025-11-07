// Quick script to check banner data in MongoDB
const mongoose = require('mongoose');
require('dotenv').config();

const Banner = require('./models/Banner');

async function checkBanners() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const banners = await Banner.find({});
    console.log(`📊 Found ${banners.length} banner documents\n`);

    for (const doc of banners) {
      console.log('🎯 Theater ID:', doc.theater);
      console.log('📦 Banner List:', doc.bannerList.length, 'banners');
      
      doc.bannerList.forEach((banner, idx) => {
        console.log(`\n  Banner ${idx + 1}:`);
        console.log('  - ID:', banner._id);
        console.log('  - Active:', banner.isActive);
        console.log('  - Image URL type:', typeof banner.imageUrl);
        console.log('  - Image URL length:', banner.imageUrl?.length || 0);
        console.log('  - Image URL starts with:', banner.imageUrl?.substring(0, 50));
      });
      console.log('\n' + '='.repeat(60) + '\n');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkBanners();
