const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkMessagesPage() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const pageAccess = await mongoose.connection.db.collection('pageaccesses').findOne({});
    
    if (pageAccess) {
      console.log('\n📋 Looking for Messages page...\n');
      
      const messagesPage = pageAccess.pageAccessList.find(p => 
        p.page === 'TheaterMessages' || p.pageName === 'Messages'
      );
      
      if (messagesPage) {
        console.log('✅ Found Messages page:');
        console.log(JSON.stringify(messagesPage, null, 2));
      } else {
        console.log('❌ Messages page NOT found in database');
        console.log('\n📄 All pages in database:');
        pageAccess.pageAccessList.forEach((page, index) => {
          console.log(`${index + 1}. ${page.page || page.pageName} - Active: ${page.isActive}`);
        });
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkMessagesPage();
