const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = 'mongodb://localhost:27017/yqpaynow';

const TheaterUserSchema = new mongoose.Schema({
  username: String,
  password: String,
  pin: String,
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  assignedTheater: { type: mongoose.Schema.Types.ObjectId, ref: 'Theater' },
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const AdminSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
  isSuperAdmin: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const RoleSchema = new mongoose.Schema({
  name: String,
  theaterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Theater' },
  permissions: [{
    pageName: String,
    route: String,
    hasAccess: Boolean
  }],
  createdAt: { type: Date, default: Date.now }
});

async function checkSabarish() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const TheaterUser = mongoose.model('TheaterUser', TheaterUserSchema, 'theaterusers');
    const Admin = mongoose.model('Admin', AdminSchema, 'admins');
    const Role = mongoose.model('Role', RoleSchema, 'roles');

    // 1. Check in theaterusers collection
    console.log('🔍 Checking theaterusers collection...');
    const theaterUser = await TheaterUser.findOne({ username: 'sabarish' }).populate('role');
    
    if (theaterUser) {
      console.log('✅ Found in theaterusers:');
      console.log('   Username:', theaterUser.username);
      console.log('   Theater ID:', theaterUser.assignedTheater);
      console.log('   Role ID:', theaterUser.role?._id);
      console.log('   Role Name:', theaterUser.role?.name);
      console.log('   PIN:', theaterUser.pin);
      console.log('   Is Active:', theaterUser.isActive);
      
      if (theaterUser.role) {
        console.log('\n📋 Role Permissions:');
        console.log(JSON.stringify(theaterUser.role.permissions, null, 2));
      }
    } else {
      console.log('❌ NOT found in theaterusers');
    }

    // 2. Check in admins collection
    console.log('\n🔍 Checking admins collection...');
    const admin = await Admin.findOne({ username: 'sabarish' });
    
    if (admin) {
      console.log('✅ Found in admins:');
      console.log('   Username:', admin.username);
      console.log('   Email:', admin.email);
      console.log('   Is Super Admin:', admin.isSuperAdmin);
    } else {
      console.log('❌ NOT found in admins');
    }

    // 3. Show all existing users
    console.log('\n📊 All Theater Users:');
    const allTheaterUsers = await TheaterUser.find({}).select('username firstName lastName assignedTheater role isActive');
    console.log(`   Total: ${allTheaterUsers.length}`);
    allTheaterUsers.forEach(u => {
      console.log(`   - ${u.username} (${u.firstName} ${u.lastName}) - Theater: ${u.assignedTheater} - Active: ${u.isActive}`);
    });

    console.log('\n📊 All Admins:');
    const allAdmins = await Admin.find({}).select('username email isSuperAdmin');
    console.log(`   Total: ${allAdmins.length}`);
    allAdmins.forEach(a => {
      console.log(`   - ${a.username} (${a.email}) - SuperAdmin: ${a.isSuperAdmin}`);
    });

    // 4. Create user if doesn't exist
    if (!theaterUser && !admin) {
      console.log('\n❓ User "sabarish" does not exist. Do you want to create?');
      console.log('   Option 1: Create as Super Admin');
      console.log('   Option 2: Create as Theater User with role');
      console.log('\n💡 Run create-sabarish-user.js to create the user');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkSabarish();
