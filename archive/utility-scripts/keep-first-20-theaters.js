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

async function keepFirst20Theaters() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all theaters, sorted by creation date (oldest first)
    console.log('📊 Fetching all theaters...');
    const allTheaters = await Theater.find({}).sort({ createdAt: 1 });
    console.log(`📈 Total theaters found: ${allTheaters.length}`);

    if (allTheaters.length <= 20) {
      console.log('✅ You already have 20 or fewer theaters. No deletion needed.');
      return;
    }

    // Get the first 20 theaters
    const keepTheaters = allTheaters.slice(0, 20);
    const deleteTheaters = allTheaters.slice(20);

    console.log(`\n🎯 OPERATION PLAN:`);
    console.log(`📌 Keep first 20 theaters (${keepTheaters.length} theaters)`);
    console.log(`🗑️  Delete remaining theaters (${deleteTheaters.length} theaters)`);

    // Show the first 20 theaters we're keeping
    console.log('\n📋 THEATERS TO KEEP (First 20):');
    keepTheaters.forEach((theater, index) => {
      console.log(`${(index + 1).toString().padStart(2, ' ')}. ${theater.name} - ${theater.location}`);
    });

    // Show some of the theaters we're deleting
    console.log('\n🗑️  THEATERS TO DELETE (Sample of theaters being removed):');
    deleteTheaters.slice(0, 10).forEach((theater, index) => {
      console.log(`${(index + 21).toString().padStart(2, ' ')}. ${theater.name} - ${theater.location}`);
    });
    if (deleteTheaters.length > 10) {
      console.log(`    ... and ${deleteTheaters.length - 10} more theaters`);
    }

    // Get IDs of theaters to delete
    const deleteIds = deleteTheaters.map(theater => theater._id);

    console.log('\n⏳ Deleting excess theaters...');
    const deleteResult = await Theater.deleteMany({ _id: { $in: deleteIds } });
    
    console.log(`\n✅ OPERATION COMPLETED SUCCESSFULLY!`);
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} theaters`);
    console.log(`📌 Kept ${keepTheaters.length} theaters`);

    // Verify the final count
    const finalCount = await Theater.countDocuments();
    console.log(`📊 Final theater count: ${finalCount}`);

    if (finalCount === 20) {
      console.log('🎉 Perfect! Database now contains exactly 20 theaters');
    } else {
      console.log('⚠️  Warning: Final count is not 20. Please check the database.');
    }

  } catch (error) {
    console.error('❌ Error during operation:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
keepFirst20Theaters();