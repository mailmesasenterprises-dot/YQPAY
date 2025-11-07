const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/theater_canteen_db';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

async function createAdminUser() {
  try {
    const User = require('./models/User');
    
    // Check if admin111 already exists
    const existingAdmin = await User.findOne({ username: 'admin111' });
    if (existingAdmin) {
      console.log('✅ Admin111 user already exists');
      console.log(`   ID: ${existingAdmin._id}`);
      console.log(`   Role: ${existingAdmin.role}`);
      return;
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('admin111', 12);
    
    // Create new admin user
    const adminUser = new User({
      username: 'admin111',
      password: hashedPassword,
      role: 'super_admin',
      theaterId: null,
      phone: '+1234567890', // Unique phone to avoid duplicate key error
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@yqpaynow.com',
      isActive: true,
      createdAt: new Date(),
      lastLogin: null
    });
    
    await adminUser.save();
    
    console.log('🎉 Admin user created successfully!');
    console.log(`   ID: ${adminUser._id}`);
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Active: ${adminUser.isActive}`);
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    mongoose.connection.close();
  }
}

createAdminUser();