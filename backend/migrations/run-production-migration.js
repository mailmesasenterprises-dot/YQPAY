// Production migration script
const mongoose = require('mongoose');
const TheaterUserMigration = require('./theater-user-migration');
require('dotenv').config();
async function runProduction() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater_canteen_db');
    // Create migration instance
    const migration = new TheaterUserMigration();

    // Run migration with backup
    const result = await migration.migrate({
      createBackup: true,
      dryRun: false
    });

    if (result.success) {
      // Verify migration
      const verification = await migration.verifyMigration();
      
      if (verification.integrityCheck) {
      } else {
      }

    } else {
    }

  } catch (error) {
    console.error('❌ Production migration failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

// Run production migration
runProduction();