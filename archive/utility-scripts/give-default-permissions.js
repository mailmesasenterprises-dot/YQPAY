const mongoose = require('mongoose');

// Direct MongoDB connection
mongoose.connect('mongodb://localhost:27017/yqpaynow', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('✅ Connected to MongoDB');

  try {
    // Get collections directly
    const usersCollection = mongoose.connection.collection('users');
    const theatersCollection = mongoose.connection.collection('theaters');
    const rolesCollection = mongoose.connection.collection('roles');
    const pagesCollection = mongoose.connection.collection('pages');
    const rolePermissionsCollection = mongoose.connection.collection('rolepermissions');

    // 1. Find amanager user
    const user = await usersCollection.findOne({ username: 'amanager' });
    if (!user) {
      console.log('❌ User amanager not found');
      process.exit(1);
    }
    console.log('✅ Found user:', user.username);

    // 2. Find theater
    const theater = await theatersCollection.findOne({ _id: user.theater });
    if (!theater) {
      console.log('❌ Theater not found');
      process.exit(1);
    }
    console.log('✅ Found theater:', theater.name);

    // 3. Find role
    const role = await rolesCollection.findOne({ 
      theater: theater._id,
      assignedTo: user._id 
    });
    if (!role) {
      console.log('❌ Role not found for user');
      process.exit(1);
    }
    console.log('✅ Found role:', role.name);

    // 4. Get all pages
    const allPages = await pagesCollection.find({}).toArray();
    console.log(`✅ Found ${allPages.length} pages`);

    // 5. Grant access to ALL pages
    console.log('\n📝 Granting access to all pages...');
    for (const page of allPages) {
      await rolePermissionsCollection.updateOne(
        { role: role._id, page: page._id },
        { 
          $set: { 
            hasAccess: true,
            role: role._id,
            page: page._id
          } 
        },
        { upsert: true }
      );
      console.log(`  ✅ ${page.pageName} (${page.page})`);
    }

    console.log('\n🎉 SUCCESS! All permissions granted to amanager');
    console.log('👉 Please logout and login again to see the changes');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
    process.exit(0);
  }
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});
