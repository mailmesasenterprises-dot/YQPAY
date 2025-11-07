const mongoose = require('mongoose');
require('dotenv').config();

const Category = require('./models/Category');

async function migrateCategories() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');

    const theaterId = '68f8837a541316c6ad54b79f';
    const kioskTypeId = '68fcb9f88402d0c4cc1c1d28'; // Testing kiosk type

    // Find the category document for this theater
    const categoryDoc = await Category.findOne({ theater: theaterId });
    
    if (!categoryDoc) {
      console.log('❌ No category document found for theater');
      process.exit(0);
    }

    console.log(`📋 Found ${categoryDoc.categoryList.length} categories`);

    // Update all categories that don't have a kioskTypeId
    let updatedCount = 0;
    categoryDoc.categoryList.forEach(category => {
      if (!category.kioskTypeId) {
        category.kioskTypeId = kioskTypeId;
        category.updatedAt = new Date();
        updatedCount++;
        console.log(`  ✓ Updated: ${category.categoryName}`);
      }
    });

    if (updatedCount > 0) {
      await categoryDoc.save();
      console.log(`\n✅ Migration complete! Updated ${updatedCount} categories`);
    } else {
      console.log('\n✅ All categories already have kiosk types assigned');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

migrateCategories();
