const mongoose = require('mongoose');
require('dotenv').config();

/**
 * ✅ Assign user-specific data access to theater users
 * This determines what each user can see in their reports
 */
async function assignUserDataAccess() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    const theaterId = '68ed25e6962cb3e997acc163'; // YQ PAY NOW

    // Get all users for this theater
    const users = await db.collection('theaterusers').find({
      theater: new mongoose.Types.ObjectId(theaterId),
      isActive: true
    }).toArray();

    console.log(`\n📊 Found ${users.length} active users in theater\n`);

    // Get Theater Admin role
    const theaterAdminRole = await db.collection('roles').findOne({
      theater: new mongoose.Types.ObjectId(theaterId),
      name: 'Theater Admin'
    });

    // Get all categories for this theater (for assigning to Balance users)
    const categories = await db.collection('categories').find({
      theater: new mongoose.Types.ObjectId(theaterId)
    }).toArray();

    console.log(`📦 Found ${categories.length} categories:\n`);
    categories.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat.name} (ID: ${cat._id})`);
    });
    console.log('');

    // Process each user
    for (const user of users) {
      const role = await db.collection('roles').findOne({
        _id: new mongoose.Types.ObjectId(user.role)
      });

      console.log(`\n👤 Processing user: ${user.username} (${role?.name || 'No Role'})`);

      // Theater Admin - Full access (no restrictions)
      if (role && (role.isDefault === true || role.name === 'Theater Admin')) {
        console.log('   ✅ Theater Admin - No data access restrictions needed');
        
        // Remove any existing dataAccess field (full access by default)
        await db.collection('theaterusers').updateOne(
          { _id: user._id },
          {
            $unset: { dataAccess: '' }
          }
        );
        
        continue;
      }

      // Other roles - Assign specific categories for testing
      // In real scenario, admin would assign these via UI
      
      if (!user.dataAccess || Object.keys(user.dataAccess).length === 0) {
        console.log('   ⚠️  No data access assigned');
        console.log('   ℹ️  To assign categories, use the following example:\n');
        console.log('   Example assignment:');
        console.log('   {');
        console.log('     assignedCategories: [ObjectId("category1"), ObjectId("category2")],');
        console.log('     assignedSections: ["Counter 1", "Counter 2"],');
        console.log('     accessStartDate: new Date("2025-01-01"),');
        console.log('     accessEndDate: new Date("2025-12-31")');
        console.log('   }');
        console.log('');
        console.log('   💡 Would you like to assign all categories to this user? (This is for testing)');
        
        // For TESTING: Assign all categories to this user
        // In production, admin would select specific categories
        const assignedCategories = categories.map(cat => cat._id);
        
        await db.collection('theaterusers').updateOne(
          { _id: user._id },
          {
            $set: {
              dataAccess: {
                assignedCategories: assignedCategories,
                assignedSections: [], // Empty = all sections
                accessStartDate: new Date('2025-01-01'),
                accessEndDate: new Date('2025-12-31'),
                trackByProcessor: false, // Set to true to track by who processed the order
                assignedBy: 'admin',
                assignedAt: new Date()
              },
              updatedAt: new Date()
            }
          }
        );
        
        console.log(`   ✅ Assigned ALL ${assignedCategories.length} categories for testing`);
      } else {
        console.log('   ✅ Already has data access assigned:');
        console.log(`      - Categories: ${user.dataAccess.assignedCategories?.length || 0}`);
        console.log(`      - Sections: ${user.dataAccess.assignedSections?.length || 0}`);
        console.log(`      - Date range: ${user.dataAccess.accessStartDate || 'N/A'} to ${user.dataAccess.accessEndDate || 'N/A'}`);
      }
    }

    console.log('\n\n📋 Summary:');
    console.log('─'.repeat(60));
    
    const updatedUsers = await db.collection('theaterusers').find({
      theater: new mongoose.Types.ObjectId(theaterId),
      isActive: true
    }).toArray();

    for (const user of updatedUsers) {
      const role = await db.collection('roles').findOne({
        _id: new mongoose.Types.ObjectId(user.role)
      });

      console.log(`\n👤 ${user.username} (${role?.name || 'No Role'})`);
      
      if (!user.dataAccess) {
        console.log('   📊 Access: FULL (Theater Admin)');
      } else {
        console.log('   📊 Access: USER-SPECIFIC');
        console.log(`      - ${user.dataAccess.assignedCategories?.length || 0} assigned categories`);
        console.log(`      - ${user.dataAccess.assignedSections?.length || 0} assigned sections`);
        console.log(`      - Date range: ${new Date(user.dataAccess.accessStartDate).toLocaleDateString()} to ${new Date(user.dataAccess.accessEndDate).toLocaleDateString()}`);
      }
    }

    console.log('\n\n✅ User data access assignment complete!');
    console.log('\n💡 To customize assignments:');
    console.log('   1. Open this script and modify the assignedCategories array');
    console.log('   2. Or assign categories via Admin UI (to be built)');
    console.log('   3. Each user should have their own unique set of categories');

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error assigning user data access:', error);
    process.exit(1);
  }
}

assignUserDataAccess();
