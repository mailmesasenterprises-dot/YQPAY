const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkPageAccess() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const pageAccess = await mongoose.connection.db.collection('pageaccesses').findOne({});
    
    if (pageAccess) {
      console.log('\n📄 Theater ID:', pageAccess.theater);
      console.log('\n📋 All Pages in Page Access:');
      pageAccess.pageAccessList.forEach((page, index) => {
        console.log(`\n${index + 1}. ${page.pageName || page.page}`);
        console.log(`   Display: ${page.displayName}`);
        console.log(`   Route: ${page.route}`);
        console.log(`   Category: ${page.category}`);
        console.log(`   Show in Sidebar: ${page.showInSidebar}`);
        console.log(`   Active: ${page.isActive}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkPageAccess();
