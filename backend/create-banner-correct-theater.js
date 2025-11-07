// Create banner document for the correct theater ID from the URL
const mongoose = require('mongoose');
require('dotenv').config();

const Banner = require('./models/Banner');

// Small placeholder banner image (1x1 purple PNG)
const PLACEHOLDER_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC';

async function createBannerForCorrectTheater() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const correctTheaterId = '68ff8837a541316c6ad54b79f'; // From URL in browser
    console.log('🎯 Creating banner for theater:', correctTheaterId);

    // Check if already exists
    let bannerDoc = await Banner.findOne({ theater: correctTheaterId });

    if (bannerDoc) {
      console.log('✅ Banner document already exists');
      console.log('📦 Current banners:', bannerDoc.bannerList.length);
    } else {
      console.log('📝 Creating new banner document');
      bannerDoc = new Banner({
        theater: correctTheaterId,
        bannerList: [{
          imageUrl: PLACEHOLDER_IMG,
          isActive: true,
          sortOrder: 0
        }],
        isActive: true
      });
      await bannerDoc.save();
      console.log('✅ Created banner document with 1 placeholder banner');
    }

    console.log('\n🔄 Refresh the browser page now!');

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createBannerForCorrectTheater();
