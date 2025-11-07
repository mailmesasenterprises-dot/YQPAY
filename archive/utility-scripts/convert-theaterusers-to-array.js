const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/theater_canteen_db')
  .then(() => {
    console.log('✅ Connected to MongoDB');
    convertTheaterUsersToArray();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

async function convertTheaterUsersToArray() {
  try {
    const db = mongoose.connection.db;
    
    console.log('\n🔄 CONVERTING theaterusers TO ARRAY FORMAT:\n');
    
    // Get the theater ID
    const theaters = await db.collection('theaters').find({}).toArray();
    if (theaters.length === 0) {
      console.log('❌ No theaters found!');
      process.exit(1);
    }
    
    const theaterId = theaters[0]._id;
    console.log(`Theater ID: ${theaterId}`);
    
    // Get all current users from theaterusers collection
    const currentUsers = await db.collection('theaterusers').find({}).toArray();
    console.log(`Current individual users: ${currentUsers.length}`);
    
    if (currentUsers.length > 0) {
      // Create backup first
      const backupFileName = `theaterusers_individual_backup_${Date.now()}.json`;
      const fs = require('fs');
      fs.writeFileSync(backupFileName, JSON.stringify(currentUsers, null, 2));
      console.log(`✅ Backup created: ${backupFileName}`);
      
      // Prepare users array from individual documents
      const usersArray = currentUsers.map(user => ({
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: user.isActive !== false,
        isEmailVerified: user.isEmailVerified || false,
        passwordHash: user.passwordHash,
        loginAttempts: user.loginAttempts || 0,
        lockUntil: user.lockUntil || null,
        lastLogin: user.lastLogin || null,
        createdAt: user.createdAt || new Date(),
        updatedAt: new Date()
      }));
      
      // Clear the collection
      await db.collection('theaterusers').deleteMany({});
      console.log('✅ Cleared individual user documents');
      
      // Insert the array-based document
      const arrayDocument = {
        theaterId: new mongoose.Types.ObjectId(theaterId),
        users: usersArray,
        totalUsers: usersArray.length,
        lastModified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const insertResult = await db.collection('theaterusers').insertOne(arrayDocument);
      console.log(`✅ Array document inserted with ID: ${insertResult.insertedId}`);
      
      // Verify the conversion
      const verifyDoc = await db.collection('theaterusers').findOne({});
      console.log(`\n✅ VERIFICATION:`);
      console.log(`   - Theater ID: ${verifyDoc.theaterId}`);
      console.log(`   - Users count: ${verifyDoc.users?.length || 0}`);
      console.log(`   - Total users field: ${verifyDoc.totalUsers}`);
      
      if (verifyDoc.users?.length > 0) {
        console.log(`   - Sample users: ${verifyDoc.users.slice(0,2).map(u => u.username).join(', ')}`);
      }
      
      // Remove the temporary theateruserarrays collection if it exists
      try {
        await db.collection('theateruserarrays').drop();
        console.log('✅ Removed temporary theateruserarrays collection');
      } catch (error) {
        console.log('📝 Note: theateruserarrays collection did not exist or already removed');
      }
    }
    
    console.log('\n🎉 SUCCESS: theaterusers collection converted to array format!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Conversion error:', error);
    process.exit(1);
  }
}