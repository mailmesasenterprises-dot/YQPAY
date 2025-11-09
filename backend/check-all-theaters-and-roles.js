/**
 * Check all theaters (including inactive) and their roles
 */

const mongoose = require('mongoose');
const Theater = require('./models/Theater');
const RoleArray = require('./models/RoleArray');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yqpaynow';

async function checkAllTheaters() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get ALL theaters (including inactive)
    const allTheaters = await Theater.find({}).lean();
    const activeTheaters = allTheaters.filter(t => t.isActive === true);
    const inactiveTheaters = allTheaters.filter(t => t.isActive !== true);
    
    console.log('📊 THEATER SUMMARY:');
    console.log(`   Total Theaters: ${allTheaters.length}`);
    console.log(`   Active: ${activeTheaters.length}`);
    console.log(`   Inactive: ${inactiveTheaters.length}\n`);
    
    if (allTheaters.length === 0) {
      console.log('ℹ️  No theaters found in database.');
      
      // Check for orphaned roles
      const allRoles = await RoleArray.find({}).lean();
      console.log(`\n🔍 Orphaned Roles Documents: ${allRoles.length}`);
      
      if (allRoles.length > 0) {
        console.log('\n⚠️  Found orphaned roles documents (theaters deleted but roles remain):');
        for (const rolesDoc of allRoles) {
          console.log(`\n   Theater ID: ${rolesDoc.theater || 'UNDEFINED'}`);
          console.log(`   Total Roles: ${rolesDoc.roleList?.length || 0}`);
          if (rolesDoc.roleList && rolesDoc.roleList.length > 0) {
            rolesDoc.roleList.forEach((role, index) => {
              console.log(`     ${index + 1}. ${role.name} (Default: ${role.isDefault ? 'Yes' : 'No'})`);
            });
          } else {
            console.log(`     (No roles in list)`);
          }
        }
      }
      
      await mongoose.disconnect();
      return;
    }
    
    console.log('='.repeat(70) + '\n');
    
    for (const theater of allTheaters) {
      console.log(`🎬 Theater: ${theater.name}`);
      console.log(`   ID: ${theater._id}`);
      console.log(`   Status: ${theater.isActive ? '✅ Active' : '❌ Inactive'}`);
      console.log(`   Created: ${theater.createdAt?.toLocaleString() || 'Unknown'}\n`);
      
      // Get roles for this theater
      const rolesDoc = await RoleArray.findOne({ theater: theater._id }).lean();
      
      if (!rolesDoc) {
        console.log('   ⚠️  NO ROLES DOCUMENT FOUND!\n');
        console.log('='.repeat(70) + '\n');
        continue;
      }
      
      console.log(`   📋 Roles Count: ${rolesDoc.roleList.length}`);
      
      if (rolesDoc.roleList.length === 0) {
        console.log('   ⚠️  No roles defined for this theater!\n');
      } else {
        console.log('');
        rolesDoc.roleList.forEach((role, index) => {
          console.log(`   ${index + 1}. ${role.name}`);
          console.log(`      • Default Role: ${role.isDefault ? '✅ Yes' : 'No'}`);
          console.log(`      • Active: ${role.isActive ? '✅ Yes' : '❌ No'}`);
          console.log(`      • Can Delete: ${role.canDelete ? 'Yes' : '❌ No'}`);
          console.log(`      • Can Edit: ${role.canEdit ? 'Yes' : '❌ No'}`);
          console.log(`      • Permissions: ${role.permissions?.length || 0} pages`);
          console.log('');
        });
      }
      
      // Check for missing default roles
      const hasTheaterAdmin = rolesDoc.roleList.some(r => r.name === 'Theater Admin' && r.isDefault);
      const hasKioskScreen = rolesDoc.roleList.some(r => r.name === 'Kiosk Screen' && r.isDefault);
      
      if (!hasTheaterAdmin || !hasKioskScreen) {
        console.log('   ⚠️  MISSING DEFAULT ROLES:');
        if (!hasTheaterAdmin) console.log('      ❌ Theater Admin');
        if (!hasKioskScreen) console.log('      ❌ Kiosk Screen');
        console.log('');
      }
      
      console.log('='.repeat(70) + '\n');
    }
    
    await mongoose.disconnect();
    console.log('✅ Check complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAllTheaters();
