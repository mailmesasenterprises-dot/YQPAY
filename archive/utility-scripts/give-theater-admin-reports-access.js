const mongoose = require('mongoose');
require('dotenv').config();

/**
 * ✅ Give Theater Admin role access to TheaterReports page
 */
async function giveTheaterAdminReportsAccess() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find Theater Admin role for the specific theater
    const theaterId = '68ed25e6962cb3e997acc163'; // YQ PAY NOW theater

    const theaterAdminRole = await db.collection('roles').findOne({
      theater: new mongoose.Types.ObjectId(theaterId),
      name: 'Theater Admin'
    });

    if (!theaterAdminRole) {
      console.log('❌ Theater Admin role not found');
      await mongoose.connection.close();
      return;
    }

    console.log('✅ Found Theater Admin role:', theaterAdminRole.name);

    // Check if TheaterReports permission already exists
    const hasReportsPermission = theaterAdminRole.permissions?.some(
      p => p.page === 'TheaterReports'
    );

    if (hasReportsPermission) {
      console.log('⚠️  Theater Admin already has TheaterReports permission');
      
      // Show current permissions
      console.log('\nCurrent permissions:');
      theaterAdminRole.permissions.forEach((p, index) => {
        console.log(`${index + 1}. ${p.page}: ${p.hasAccess ? '✅' : '❌'}`);
      });

      await mongoose.connection.close();
      return;
    }

    // Add TheaterReports permission
    const result = await db.collection('roles').updateOne(
      { _id: theaterAdminRole._id },
      {
        $push: {
          permissions: {
            page: 'TheaterReports',
            hasAccess: true
          }
        },
        $set: {
          updatedAt: new Date()
        }
      }
    );

    console.log('✅ Added TheaterReports permission to Theater Admin');
    console.log('Modified count:', result.modifiedCount);

    // Verify the update
    const updatedRole = await db.collection('roles').findOne({
      _id: theaterAdminRole._id
    });

    console.log('\n✅ Updated permissions:');
    updatedRole.permissions.forEach((p, index) => {
      console.log(`${index + 1}. ${p.page}: ${p.hasAccess ? '✅' : '❌'}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error giving Theater Admin reports access:', error);
    process.exit(1);
  }
}

giveTheaterAdminReportsAccess();
