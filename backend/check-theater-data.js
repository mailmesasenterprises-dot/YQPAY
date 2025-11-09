const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/yqpaynow').then(async () => {
  console.log('✅ Connected to MongoDB\n');
  
  const db = mongoose.connection.db;
  
  // Find all theaters
  const theaters = await db.collection('theaters').find({}).toArray();
  
  console.log(`📋 Total Theaters Found: ${theaters.length}\n`);
  for (const theater of theaters) {
    console.log(`\n🎭 Theater: ${theater.name}`);
    console.log(`   ID: ${theater._id}`);
    console.log(`   Owner: ${theater.owner}`);
    console.log(`   Status: ${theater.status || 'N/A'}`);
    console.log(`   Active: ${theater.isActive}`);
    
    const theaterId = theater._id.toString();
    
    // Check related data
    console.log('\n   📊 Related Data:');
    
    // Users
    const users = await db.collection('theaterusers').findOne({ theaterId: theaterId });
    console.log(`   👥 Users: ${users ? users.users.length : 0}`);
    
    // Roles
    const roles = await db.collection('roles').findOne({ theaterId: theaterId });
    console.log(`   🎭 Roles: ${roles ? roles.roles.length : 0}`);
    
    // Products
    const products = await db.collection('productlist').countDocuments({ theater: theater._id });
    console.log(`   🍿 Products: ${products}`);
    
    // Orders
    const orders = await db.collection('theaterorders').countDocuments({ theater: theater._id });
    console.log(`   📋 Orders: ${orders}`);
    
    // QR Codes
    const qrCodes = await db.collection('qrcodenames').countDocuments({ theater: theater._id });
    console.log(`   📱 QR Codes: ${qrCodes}`);
    
    // Settings
    const settings = await db.collection('settings').countDocuments({ theater: theater._id });
    console.log(`   ⚙️  Settings: ${settings}`);
    
    console.log('\n   📁 Documents:');
    if (theater.documents) {
      console.log(`   - Theater Photo: ${theater.documents.theaterPhoto ? '✅' : '❌'}`);
      console.log(`   - Logo: ${theater.documents.logo ? '✅' : '❌'}`);
      console.log(`   - Aadhar: ${theater.documents.aadharCard ? '✅' : '❌'}`);
      console.log(`   - PAN: ${theater.documents.panCard ? '✅' : '❌'}`);
      console.log(`   - GST: ${theater.documents.gstCertificate ? '✅' : '❌'}`);
      console.log(`   - FSSAI: ${theater.documents.fssaiCertificate ? '✅' : '❌'}`);
    }
  }
  
  console.log('\n✅ Analysis complete');
  process.exit(0);
}).catch(err => {
  console.log('❌ Error:', err.message);
  process.exit(1);
});
