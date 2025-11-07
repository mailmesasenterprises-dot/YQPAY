const mongoose = require('mongoose');
const PageAccessArray = require('./models/PageAccessArray');

async function verifyMigration() {
  try {
    await mongoose.connect('mongodb://localhost:27017/theater_canteen_db');
    console.log('✅ Connected to database\n');
    
    const doc = await PageAccessArray.findOne({ theater: '68f8837a541316c6ad54b79f' }).populate('theater', 'name');
    
    if (doc) {
      console.log('Theater:', doc.theater?.name);
      console.log('Total Pages:', doc.metadata?.totalPages);
      console.log('Active Pages:', doc.metadata?.activePages);
      console.log('\nFirst 10 pages:');
      doc.pageAccessList.slice(0, 10).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.pageName} (${p.page}) - Active: ${p.isActive}`);
      });
    } else {
      console.log('❌ No data found for theater');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyMigration();
