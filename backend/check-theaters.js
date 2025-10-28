const mongoose = require('mongoose');
require('dotenv').config();

async function checkTheaters() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');

    // Check theaters collection
    const theaterCount = await mongoose.connection.db.collection('theaters').countDocuments();
    console.log(`\n📊 Documents in 'theaters' collection: ${theaterCount}`);

    if (theaterCount > 0) {
      const theaters = await mongoose.connection.db.collection('theaters').find({}).toArray();
      console.log('\n🎭 Theaters:');
      theaters.forEach(theater => {
        console.log(`  - ${theater.name} (ID: ${theater._id})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTheaters();
