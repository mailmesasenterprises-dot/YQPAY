// Demo script to show theater user migration process
const mongoose = require('mongoose');
require('dotenv').config();
async function runDemo() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater_canteen_db');
    // Import models
    const TheaterUserModel = require('../models/TheaterUserModel');
    const TheaterUserArray = require('../models/TheaterUserArray');
    const Theater = require('../models/Theater');
    // Count current individual users
    const totalUsers = await TheaterUserModel.countDocuments();
    // Count current array documents
    const arrayDocs = await TheaterUserArray.countDocuments();
    // Get theater breakdown
    const theaters = await Theater.find({}, 'name location').lean();
    for (const theater of theaters) {
      const userCount = await TheaterUserModel.countDocuments({ theater: theater._id });

    }
    const sampleUser = await TheaterUserModel.findOne({}).lean();
    if (sampleUser) {

    }





  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the demo
runDemo();