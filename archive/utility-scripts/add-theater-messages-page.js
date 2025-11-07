const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PageAccessArray = require('./models/PageAccessArray');

async function addTheaterMessagesPage() {
  try {
    console.log('🔧 MongoDB URI:', process.env.MONGODB_URI ? 'Found' : 'Not found');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');
    console.log('📂 Database name:', mongoose.connection.name);

    // Get all page access documents
    const pageAccessDocs = await PageAccessArray.find({});
    console.log(`📄 Found ${pageAccessDocs.length} page access documents`);

    // New page to add
    const newPage = {
      page: 'TheaterMessages',
      pageName: 'TheaterMessages',
      displayName: 'Messages',
      route: '/theater-messages/:theaterId',
      category: 'admin',  // Using 'admin' as closest category
      description: 'Theater messaging with Super Admin',
      icon: 'messages',
      showInMenu: true,
      showInSidebar: true,
      isActive: true,
      requiredRoles: ['theater_admin', 'theater_staff'],
      menuOrder: 50
    };

    let updatedCount = 0;

    for (const doc of pageAccessDocs) {
      // Check if TheaterMessages already exists
      const pageExists = doc.pageAccessList.some(page => page.page === 'TheaterMessages');
      
      if (!pageExists) {
        doc.pageAccessList.push(newPage);
        await doc.save();
        updatedCount++;
        console.log(`✅ Added TheaterMessages to theater: ${doc.theater}`);
      } else {
        console.log(`⏭️  TheaterMessages already exists for theater: ${doc.theater}`);
      }
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} theater(s)`);
    console.log(`📊 Total theaters: ${pageAccessDocs.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addTheaterMessagesPage();
