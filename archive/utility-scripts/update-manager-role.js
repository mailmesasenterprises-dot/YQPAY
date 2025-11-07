/**
 * Update manager user's role to the correct Theater Admin role
 */

const mongoose = require('mongoose');
const mongodbConfig = require('./config/mongodb.json');

async function updateManagerRole() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(mongodbConfig.uri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Find the manager user
    const usersDoc = await db.collection('theaterusers').findOne({
      'users.username': 'manager'
    });
    
    if (!usersDoc) {
      console.log('❌ Manager user not found');
      return;
    }
    
    const managerIndex = usersDoc.users.findIndex(u => u.username === 'manager');
    const manager = usersDoc.users[managerIndex];
    
    console.log('\n✅ Found manager user:');
    console.log('   - Current Role ID:', manager.role);
    console.log('   - Theater ID:', usersDoc.theaterId);
    
    // Find the Theater Admin role for this theater
    const rolesDoc = await db.collection('roles').findOne({
      theater: usersDoc.theaterId
    });
    
    if (!rolesDoc || !rolesDoc.roleList || rolesDoc.roleList.length === 0) {
      console.log('❌ No roles found for this theater');
      return;
    }
    
    const theaterAdminRole = rolesDoc.roleList.find(r => r.name === 'Theater Admin');
    
    if (!theaterAdminRole) {
      console.log('❌ Theater Admin role not found');
      return;
    }
    
    console.log('\n✅ Found Theater Admin role:');
    console.log('   - New Role ID:', theaterAdminRole._id);
    console.log('   - Permissions:', theaterAdminRole.permissions?.length || 0);
    
    // Update the manager's role
    console.log('\n🔄 Updating manager role...');
    const result = await db.collection('theaterusers').updateOne(
      {
        theaterId: usersDoc.theaterId,
        'users._id': manager._id
      },
      {
        $set: {
          'users.$.role': theaterAdminRole._id,
          'users.$.updatedAt': new Date()
        }
      }
    );
    
    console.log('✅ Update result:', result.modifiedCount, 'document(s) modified');
    
    if (result.modifiedCount > 0) {
      console.log('\n🎉 SUCCESS! Manager role updated to Theater Admin');
      console.log('   - Old Role ID:', manager.role);
      console.log('   - New Role ID:', theaterAdminRole._id);
      console.log('   - Permissions available:', theaterAdminRole.permissions?.length || 0);
      console.log('\n✅ Now log out and log in again to see the sidebar items!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

updateManagerRole()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
