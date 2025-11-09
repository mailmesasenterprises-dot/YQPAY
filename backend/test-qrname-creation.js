require('dotenv').config();
const mongoose = require('mongoose');
const QRCodeName = require('./models/QRCodeNameArray');

async function testQRNameCreation() {
  try {
    console.log('🔧 Testing QR name creation...\n');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Test data - Guru Cinemas
    const guruTheaterId = '69104a90c923f409f6d7ba20';
    const testQRData = {
      qrName: 'Test QR',
      seatClass: 'TEST-CLASS',
      description: 'Test QR code name'
    };
    
    console.log('📝 Test QR data:');
    console.log(JSON.stringify(testQRData, null, 2));
    console.log();
    
    // Step 1: Find or create QR names document
    console.log('1️⃣  Finding/creating QR names document...');
    let qrNamesDoc = await QRCodeName.findOrCreateByTheater(guruTheaterId);
    console.log('✅ QR names document:', qrNamesDoc._id);
    console.log('   Theater ID:', qrNamesDoc.theater);
    console.log('   Current QR names count:', qrNamesDoc.qrNameList.length);
    console.log();
    
    // Step 2: Check if already exists
    console.log('2️⃣  Checking for existing QR name...');
    const existingQR = qrNamesDoc.qrNameList.find(qr => 
      qr.qrName.toLowerCase() === testQRData.qrName.toLowerCase() && qr.isActive
    );
    
    if (existingQR) {
      console.log('⚠️  QR name already exists, skipping creation');
      console.log('   Existing QR ID:', existingQR._id);
    } else {
      console.log('✅ QR name does not exist, proceeding with creation');
      console.log();
      
      // Step 3: Add QR name
      console.log('3️⃣  Adding QR name...');
      try {
        await qrNamesDoc.addQRName(testQRData);
        
        console.log('✅ QR name added successfully!');
        console.log('   Total QR names now:', qrNamesDoc.qrNameList.length);
        console.log('   Active QR names:', qrNamesDoc.metadata.activeQRNames);
        console.log();
        
        // Step 4: Verify
        console.log('4️⃣  Verifying...');
        const verified = await QRCodeName.findOne({ theater: guruTheaterId });
        console.log('✅ Verification successful');
        console.log('   Total QR names:', verified.qrNameList.length);
        console.log('   Metadata:', JSON.stringify(verified.metadata, null, 2));
        
        // Show latest QR name
        const latestQR = verified.qrNameList[verified.qrNameList.length - 1];
        console.log('\n📋 Latest QR name:');
        console.log('   ID:', latestQR._id);
        console.log('   Name:', latestQR.qrName);
        console.log('   Seat Class:', latestQR.seatClass);
        console.log('   Description:', latestQR.description);
        console.log('   Is Active:', latestQR.isActive);
        
      } catch (addError) {
        console.error('❌ Error adding QR name:', addError.message);
        console.error('   Error stack:', addError.stack);
        
        // Check for specific validation errors
        if (addError.name === 'ValidationError') {
          console.error('\n📋 Validation errors:');
          Object.keys(addError.errors).forEach(key => {
            console.error(`   ${key}: ${addError.errors[key].message}`);
          });
        }
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testQRNameCreation();
