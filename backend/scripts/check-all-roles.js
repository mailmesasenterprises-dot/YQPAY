const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  const theaterId = new mongoose.Types.ObjectId('68f8837a541316c6ad54b79f');
  
  // Check all roles for this theater
  console.log('\n🔍 Searching for roles...\n');
  
  const allRoles = await mongoose.connection.db.collection('roles').find({}).toArray();
  console.log(`Total role documents: ${allRoles.length}\n`);
  
  allRoles.forEach((doc, index) => {
    console.log(`Document ${index + 1}:`);
    console.log('Theater ID:', doc.theater || doc.theaterId);
    console.log('Roles in list:', doc.roleList ? doc.roleList.length : 0);
    
    if (doc.roleList && doc.roleList.length > 0) {
      doc.roleList.forEach((role, i) => {
        console.log(`  ${i + 1}. ${role.name} (ID: ${role._id}, Active: ${role.isActive})`);
      });
    }
    console.log('---');
  });
  
  // Try to find specifically for our theater
  const theaterRoles = await mongoose.connection.db.collection('roles')
    .findOne({ theater: theaterId });
  
  if (theaterRoles) {
    console.log('\n✅ Found roles for theater 68f8837a541316c6ad54b79f');
  } else {
    console.log('\n❌ No roles found for theater 68f8837a541316c6ad54b79f');
    
    // Try with theaterId field name
    const theaterRoles2 = await mongoose.connection.db.collection('roles')
      .findOne({ theaterId: theaterId });
    
    if (theaterRoles2) {
      console.log('✅ Found roles with theaterId field');
    }
  }
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
