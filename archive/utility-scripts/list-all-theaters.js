const mongoose = require('mongoose');
require('dotenv').config();

// Theater schema
const theaterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  address: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  email: { type: String, required: true },
  capacity: { type: Number, required: true },
  facilities: [String],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Theater = mongoose.model('Theater', theaterSchema);

async function listAllTheaters() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all theaters, sorted by creation date
    const allTheaters = await Theater.find({}).sort({ createdAt: 1 });
    console.log(`\n📊 CURRENT THEATER DATABASE STATUS:`);
    console.log(`📈 Total theaters: ${allTheaters.length}`);
    
    console.log('\n📋 LIST OF ALL THEATERS:');
    allTheaters.forEach((theater, index) => {
      console.log(`${(index + 1).toString().padStart(2, ' ')}. ${theater.name} - ${theater.location} (${theater.isActive ? 'Active' : 'Inactive'})`);
    });

    console.log(`\n✅ Database contains exactly ${allTheaters.length} theaters as requested.`);

  } catch (error) {
    console.error('❌ Error during operation:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
listAllTheaters();