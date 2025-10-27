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

async function createSabarishUser() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const TheaterUser = mongoose.model('TheaterUser', TheaterUserSchema, 'theaterusers');
    const Role = mongoose.model('Role', RoleSchema, 'roles');

    const THEATER_ID = '68f8837a541316c6ad54b79f';

    // 1. Create a restricted role with limited permissions
    console.log('📝 Creating restricted role...');
    const restrictedRole = await Role.create({
      name: 'Staff',
      theaterId: new mongoose.Types.ObjectId(THEATER_ID),
      permissions: [
        { pageName: 'Dashboard', route: `/theater-dashboard/${THEATER_ID}`, hasAccess: true },
        { pageName: 'Order Interface', route: `/theater-order/${THEATER_ID}`, hasAccess: true },
        { pageName: 'Order History', route: `/theater-order-history/${THEATER_ID}`, hasAccess: true },
        { pageName: 'Product Stock', route: `/theater-products/${THEATER_ID}`, hasAccess: false },
        { pageName: 'Add Product', route: `/theater-add-product/${THEATER_ID}`, hasAccess: false },
        { pageName: 'Product Type', route: `/theater-product-types/${THEATER_ID}`, hasAccess: false },
        { pageName: 'Categorie Type', route: `/theater-categories/${THEATER_ID}`, hasAccess: false },
        { pageName: 'Kiosk Type', route: `/theater-kiosk-types/${THEATER_ID}`, hasAccess: false },
        { pageName: 'Online POS', route: `/online-pos/${THEATER_ID}`, hasAccess: false },
        { pageName: 'Reports', route: `/theater-reports/${THEATER_ID}`, hasAccess: false },
        { pageName: 'Role Management', route: `/theater-roles/${THEATER_ID}`, hasAccess: false },
        { pageName: 'Role Access', route: `/theater-role-access/${THEATER_ID}`, hasAccess: false },
        { pageName: 'QR Code Names', route: `/theater-qr-code-names/${THEATER_ID}`, hasAccess: false },
        { pageName: 'Generate QR', route: `/theater-generate-qr/${THEATER_ID}`, hasAccess: false },
        { pageName: 'QR Management', route: `/theater-qr-management/${THEATER_ID}`, hasAccess: false },
        { pageName: 'Theater Users', route: `/theater-user-management/${THEATER_ID}`, hasAccess: false },
        { pageName: 'Settings', route: `/theater-settings/${THEATER_ID}`, hasAccess: false }
      ]
    });

    console.log('✅ Created role:', restrictedRole.name);
    console.log('   Role ID:', restrictedRole._id);
    console.log('   Allowed pages:', restrictedRole.permissions.filter(p => p.hasAccess).length);

    // 2. Create theater user "sabarish"
    console.log('\n📝 Creating theater user "sabarish"...');
    const sabarish = await TheaterUser.create({
      username: 'sabarish',
      password: 'admin123', // Plain text - will be hashed by backend on login
      pin: '1234',
      firstName: 'Sabarish',
      lastName: 'Kumar',
      email: 'sabarish@example.com',
      phone: '1234567890',
      assignedTheater: new mongoose.Types.ObjectId(THEATER_ID),
      role: restrictedRole._id,
      isActive: true
    });

    console.log('✅ Created user:', sabarish.username);
    console.log('   User ID:', sabarish._id);
    console.log('   Theater:', sabarish.assignedTheater);
    console.log('   Role:', sabarish.role);
    console.log('   PIN:', sabarish.pin);

    console.log('\n🎉 SUCCESS! User "sabarish" created with restricted permissions');
    console.log('\n📋 User should only see:');
    restrictedRole.permissions
      .filter(p => p.hasAccess)
      .forEach(p => console.log(`   ✅ ${p.pageName}`));

    console.log('\n🚫 User should NOT see:');
    restrictedRole.permissions
      .filter(p => !p.hasAccess)
      .forEach(p => console.log(`   ❌ ${p.pageName}`));

    console.log('\n📝 NOW: Log out and log in again with:');
    console.log('   Username: sabarish');
    console.log('   Password: admin123');
    console.log('   PIN: 1234');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

createSabarishUser();
