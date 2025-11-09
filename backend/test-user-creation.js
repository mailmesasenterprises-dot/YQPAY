require('dotenv').config();
const mongoose = require('mongoose');
const TheaterUserArray = require('./models/TheaterUserArray');
const bcrypt = require('bcryptjs');

async function testUserCreation() {
  try {
    console.log('🔧 Testing user creation...\n');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Test data - Guru Cinemas
    const guruTheaterId = '69104a90c923f409f6d7ba20';
    const testUserData = {
      theaterId: guruTheaterId,
      username: 'testuser',
      email: 'test@test.com',
      password: 'password123',
      fullName: 'Test User',
      phoneNumber: '1234567890',
      pin: '1234',
      role: '691049ff22d0e0dbd90b50f1' // gurumanager role ID from earlier check
    };
    
    console.log('📝 Test user data:');
    console.log(JSON.stringify(testUserData, null, 2));
    console.log();
    
    // Step 1: Find or create users document
    console.log('1️⃣  Finding/creating users document...');
    let usersDoc = await TheaterUserArray.findOrCreateByTheater(guruTheaterId);
    console.log('✅ Users document:', usersDoc._id);
    console.log('   Current users count:', usersDoc.users.length);
    console.log();
    
    // Step 2: Hash password
    console.log('2️⃣  Hashing password...');
    const hashedPassword = await bcrypt.hash(testUserData.password, 10);
    console.log('✅ Password hashed');
    console.log();
    
    // Step 3: Add user
    console.log('3️⃣  Adding user...');
    try {
      const newUser = await usersDoc.addUser({
        username: testUserData.username,
        email: testUserData.email,
        password: hashedPassword,
        fullName: testUserData.fullName,
        phoneNumber: testUserData.phoneNumber,
        pin: testUserData.pin,
        role: testUserData.role,
        permissions: {},
        isActive: true,
        isEmailVerified: false,
        profileImage: null,
        createdBy: null
      });
      
      console.log('✅ User added successfully!');
      console.log('   User ID:', newUser._id);
      console.log('   Username:', newUser.username);
      console.log('   Role:', newUser.role);
      console.log();
      
      // Step 4: Verify
      console.log('4️⃣  Verifying...');
      const verified = await TheaterUserArray.findOne({ theaterId: guruTheaterId });
      console.log('✅ Total users now:', verified.users.length);
      
    } catch (addError) {
      console.error('❌ Error adding user:', addError.message);
      console.error('   Error stack:', addError.stack);
      
      // Check for specific validation errors
      if (addError.name === 'ValidationError') {
        console.error('\n📋 Validation errors:');
        Object.keys(addError.errors).forEach(key => {
          console.error(`   ${key}: ${addError.errors[key].message}`);
        });
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testUserCreation();
