const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  const theaterId = new mongoose.Types.ObjectId('68f8837a541316c6ad54b79f');
  const roleId = new mongoose.Types.ObjectId('690495e034bc016a11ab5834'); // Kioas role
  
  console.log('\n🔧 Updating Kioas role permissions...');
  console.log('Adding access to Theater Dashboard and other essential pages\n');
  
  // Update the role to grant access to essential pages
  const result = await mongoose.connection.db.collection('roles')
    .updateOne(
      { 
        theater: theaterId,
        'roleList._id': roleId
      },
      { 
        $set: { 
          'roleList.$[role].permissions.$[perm1].hasAccess': true,
          'roleList.$[role].updatedAt': new Date()
        }
      },
      {
        arrayFilters: [
          { 'role._id': roleId },
          { 'perm1.page': 'TheaterDashboardWithId' }
        ]
      }
    );
  
  console.log('Dashboard access result:', result.modifiedCount > 0 ? '✅ Updated' : '⚠️ No change');
  
  // Also add access to Theater Order Interface
  const result2 = await mongoose.connection.db.collection('roles')
    .updateOne(
      { 
        theater: theaterId,
        'roleList._id': roleId
      },
      { 
        $set: { 
          'roleList.$[role].permissions.$[perm2].hasAccess': true
        }
      },
      {
        arrayFilters: [
          { 'role._id': roleId },
          { 'perm2.page': 'TheaterOrderInterface' }
        ]
      }
    );
  
  console.log('Order Interface access result:', result2.modifiedCount > 0 ? '✅ Updated' : '⚠️ No change');
  
  // Also add access to Product List
  const result3 = await mongoose.connection.db.collection('roles')
    .updateOne(
      { 
        theater: theaterId,
        'roleList._id': roleId
      },
      { 
        $set: { 
          'roleList.$[role].permissions.$[perm3].hasAccess': true
        }
      },
      {
        arrayFilters: [
          { 'role._id': roleId },
          { 'perm3.page': 'TheaterProductList' }
        ]
      }
    );
  
  console.log('Product List access result:', result3.modifiedCount > 0 ? '✅ Updated' : '⚠️ No change');
  
  // Verify the changes
  const rolesDoc = await mongoose.connection.db.collection('roles')
    .findOne({ theater: theaterId });
  
  const roleInfo = rolesDoc.roleList.find(r => r._id.toString() === roleId.toString());
  const accessible = roleInfo.permissions.filter(p => p.hasAccess === true);
  
  console.log('\n📋 Updated Accessible Pages:', accessible.length);
  accessible.forEach((perm, index) => {
    console.log(`${index + 1}. ${perm.page} (${perm.pageName || 'No name'})`);
  });
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
