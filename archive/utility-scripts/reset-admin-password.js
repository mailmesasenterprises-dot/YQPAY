const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function resetAdminPassword() {
  try {
    await mongoose.connect('mongodb://localhost:27017/theater_canteen_db');
    console.log('✅ Connected to MongoDB\n');
    
    const email = 'admin@yqpaynow.com';
    const newPassword = 'admin123';
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the admin password
    const result = await mongoose.connection.db.collection('admins').updateOne(
      { email: email },
      { 
        $set: { 
          password: hashedPassword,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Admin password reset successfully!');
      console.log('=====================================');
      console.log('Email:', email);
      console.log('New Password:', newPassword);
      console.log('=====================================\n');
      console.log('You can now login with these credentials.');
    } else {
      console.log('❌ Admin user not found or password already set to this value.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetAdminPassword();
