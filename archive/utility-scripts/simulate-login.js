const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function simulateLogin() {
  try {
    await mongoose.connect('mongodb://localhost:27017/theater_canteen_db');
    console.log('✅ Connected to MongoDB\n');
    
    // Step 1: Password validation (simulate login endpoint)
    console.log('STEP 1: Password Validation');
    console.log('====================================');
    
    const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 
        'users.username': 'kioas', 
        'users.isActive': true 
      });
    
    const theaterUser = theaterUsersDoc.users.find(
      u => u.username === 'kioas' && u.isActive === true
    );
    
    const passwordMatch = await bcrypt.compare('admin123', theaterUser.password);
    console.log('Password match:', passwordMatch);
    
    if (passwordMatch) {
      console.log('✅ Returns pendingAuth:');
      console.log({
        userId: theaterUser._id.toString(),
        username: theaterUser.username,
        theaterId: theaterUsersDoc.theaterId.toString()
      });
    }
    
    // Step 2: PIN validation
    console.log('\n\nSTEP 2: PIN Validation');
    console.log('====================================');
    
    const pin = '1111';
    console.log('PIN match:', theaterUser.pin === pin);
    
    if (theaterUser.pin === pin) {
      // Get role details
      let roleInfo = null;
      let userType = 'theater_user';
      let rolePermissions = [];
      
      if (theaterUser.role && mongoose.Types.ObjectId.isValid(theaterUser.role)) {
        const rolesDoc = await mongoose.connection.db.collection('roles')
          .findOne({
            theater: theaterUsersDoc.theaterId,
            'roleList._id': new mongoose.Types.ObjectId(theaterUser.role)
          });
        
        if (rolesDoc && rolesDoc.roleList) {
          roleInfo = rolesDoc.roleList.find(
            r => r._id.toString() === theaterUser.role.toString() && r.isActive
          );
          
          if (roleInfo) {
            if (roleInfo.name && roleInfo.name.toLowerCase().includes('admin')) {
              userType = 'theater_admin';
            }
            
            if (roleInfo.permissions && Array.isArray(roleInfo.permissions)) {
              rolePermissions = [{
                role: {
                  _id: roleInfo._id,
                  name: roleInfo.name,
                  description: roleInfo.description || ''
                },
                permissions: roleInfo.permissions.filter(p => p.hasAccess === true)
              }];
            }
          }
        }
      }
      
      console.log('✅ Authentication successful!');
      console.log('\nUser Type:', userType);
      console.log('Role:', roleInfo ? roleInfo.name : 'N/A');
      console.log('Permissions count:', rolePermissions.length > 0 ? rolePermissions[0].permissions.length : 0);
      
      if (rolePermissions.length > 0 && rolePermissions[0].permissions.length > 0) {
        console.log('\nFirst 5 accessible pages:');
        rolePermissions[0].permissions.slice(0, 5).forEach(p => {
          console.log(`  - ${p.pageName} (${p.page})`);
        });
        
        console.log('\nKiosk pages:');
        const kioskPages = rolePermissions[0].permissions.filter(p => 
          p.page.includes('Kiosk')
        );
        kioskPages.forEach(p => {
          console.log(`  - ${p.pageName} (${p.page}): ${p.hasAccess}`);
        });
      } else {
        console.log('\n❌ NO PERMISSIONS FOUND!');
      }
      
      console.log('\n\nResponse would include:');
      console.log('- rolePermissions:', rolePermissions.length > 0 ? 'YES' : 'NO');
      if (rolePermissions.length > 0) {
        console.log('- Permission count:', rolePermissions[0].permissions.length);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

simulateLogin();
