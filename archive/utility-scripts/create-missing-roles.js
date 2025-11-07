/**
 * Create default Theater Admin role for existing theaters
 */

const mongoose = require('mongoose');
const mongodbConfig = require('./config/mongodb.json');
const roleService = require('./services/roleService');

async function createMissingRoles() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(mongodbConfig.uri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Find all theaters
    const theaters = await db.collection('theaters').find({}).toArray();
    console.log(`\n📋 Found ${theaters.length} theaters`);
    
    for (const theater of theaters) {
      console.log(`\n🎭 Processing theater: ${theater.name} (${theater._id})`);
      
      // Check if roles document exists for this theater
      const rolesDoc = await db.collection('roles').findOne({
        theater: theater._id
      });
      
      if (rolesDoc) {
        console.log(`   ✅ Roles document exists (${rolesDoc.roleList?.length || 0} roles)`);
      } else {
        console.log(`   ⚠️  No roles document found - creating default role...`);
        
        try {
          // Create default Theater Admin role using the service
          const defaultRole = await roleService.createDefaultTheaterAdminRole(
            theater._id,
            theater.name
          );
          
          console.log(`   ✅ Default role created: ${defaultRole.name}`);
          console.log(`      - Role ID: ${defaultRole._id}`);
          console.log(`      - Permissions: ${defaultRole.permissions?.length || 0}`);
        } catch (error) {
          console.error(`   ❌ Failed to create role:`, error.message);
        }
      }
    }
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

createMissingRoles()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
