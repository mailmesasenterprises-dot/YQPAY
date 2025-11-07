const mongoose = require('mongoose');
const Theater = require('./models/Theater');

async function listTheaters() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/yqpaynow');
    console.log('✅ Connected to MongoDB');
    
    const theaters = await Theater.find({}).select('_id name location').limit(10);
    
    console.log('\n🏢 Theaters in database:');
    theaters.forEach((theater, index) => {
      console.log(`${index + 1}. ${theater._id} - ${theater.name} (${theater.location || 'No location'})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listTheaters();
