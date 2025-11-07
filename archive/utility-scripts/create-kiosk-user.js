const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function createKioskUser() {
  try {
    // Connect to MongoDB - use theater_canteen_db database
    await mongoose.connect('mongodb://localhost:27017/theater_canteen_db', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('📊 Connected to MongoDB');
    console.log('🔍 Checking for existing kioas user...');
    
    // Check if user already exists
    const existingDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 'users.username': 'kioas' });
    
    if (existingDoc) {
      console.log('✅ User "kioas" already exists in theater:', existingDoc.theaterId);
      process.exit(0);
      return;
    }

    // Get any theater (remove isActive filter)
    const theater = await mongoose.connection.db.collection('theaters')
      .findOne({});
    
    if (!theater) {
      console.log('❌ No theater found. Please create a theater first.');
      process.exit(1);
      return;
    }

    console.log('🎭 Using theater:', theater.name, '(', theater._id, ')');

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create new user object
    const newUser = {
      _id: new mongoose.Types.ObjectId(),
      username: 'kioas',
      password: hashedPassword,
      pin: '1111',
      fullName: 'Kiosk Admin',
      firstName: 'Kiosk',
      lastName: 'Admin',
      email: 'kioas@theater.com',
      phoneNumber: '1234567890',
      role: 'theater_admin', // Set as admin role
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Check if theater users document exists for this theater
    let theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ theaterId: theater._id });

    if (theaterUsersDoc) {
      // Update existing document - add user to array
      console.log('📝 Adding user to existing theater users document...');
      
      await mongoose.connection.db.collection('theaterusers').updateOne(
        { theaterId: theater._id },
        { 
          $push: { users: newUser },
          $set: { updatedAt: new Date() }
        }
      );
    } else {
      // Create new document
      console.log('📝 Creating new theater users document...');
      
      theaterUsersDoc = {
        _id: new mongoose.Types.ObjectId(),
        theaterId: theater._id,
        users: [newUser],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await mongoose.connection.db.collection('theaterusers').insertOne(theaterUsersDoc);
    }

    console.log('\n✅ Kiosk user created successfully!');
    console.log('=====================================');
    console.log('Username: kioas');
    console.log('Password: admin123');
    console.log('PIN: 1111');
    console.log('Role: theater_admin');
    console.log('Theater:', theater.name);
    console.log('Theater ID:', theater._id);
    console.log('=====================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating kiosk user:', error);
    process.exit(1);
  }
}

// Run the function
createKioskUser();
