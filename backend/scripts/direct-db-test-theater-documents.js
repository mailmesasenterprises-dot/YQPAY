/**
 * Direct Database Test: Create Theater with Documents
 * 
 * This script directly tests theater creation with documents in the database,
 * bypassing authentication for testing purposes.
 */

const mongoose = require('mongoose');
const Theater = require('../models/Theater');
const { uploadFiles } = require('../utils/gcsUploadUtil');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/test';

// Test data
const testTheater = {
  name: `Test Theater ${Date.now()}`,
  username: `test_theater_${Date.now()}`,
  password: 'TestPassword123!',
  email: `test_${Date.now()}@example.com`,
  phone: '9876543210',
  address: {
    street: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    pincode: '123456'
  },
  location: {
    city: 'Test City',
    state: 'Test State',
    country: 'India'
  },
  ownerDetails: {
    name: 'Test Owner',
    contactNumber: '9876543210',
    personalAddress: 'Test Personal Address'
  },
  agreementDetails: {
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  },
  socialMedia: {
    facebook: null,
    instagram: null,
    twitter: null,
    youtube: null,
    website: null
  },
  gstNumber: '29ABCDE1234F1Z5',
  fssaiNumber: '12345678901234',
  settings: {
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    language: 'en'
  },
  branding: {
    primaryColor: '#6B0E9B',
    secondaryColor: '#F3F4F6'
  },
  isActive: true,
  status: 'active'
};

/**
 * Create dummy file buffers for testing
 */
function createDummyFiles() {
  // Create a simple 1x1 PNG image in base64
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const buffer = Buffer.from(pngBase64, 'base64');
  
  const documentTypes = [
    'theaterPhoto',
    'logo',
    'aadharCard',
    'panCard',
    'gstCertificate',
    'fssaiCertificate',
    'agreementCopy'
  ];
  
  const files = [];
  documentTypes.forEach(docType => {
    files.push({
      fieldname: docType,
      originalname: `${docType}.png`,
      mimetype: 'image/png',
      buffer: buffer,
      size: buffer.length
    });
  });
  
  return files;
}

/**
 * Test theater creation with documents
 */
async function testTheaterCreation() {
  try {
    console.log('🧪 Direct Database Test: Theater Documents\n');
    console.log('='.repeat(60));
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Step 1: Create dummy files
    console.log('📦 Creating dummy files for testing...');
    const files = createDummyFiles();
    console.log(`✅ Created ${files.length} dummy files\n`);
    
    // Step 2: Upload files to GCS (or use mock mode if GCS not configured)
    console.log('📤 Uploading files to Google Cloud Storage...');
    
    // Check if GCS is configured or should use mock mode
    const useMockMode = process.env.GCS_MOCK_MODE === 'true';
    if (useMockMode) {
      console.log('ℹ️  Using GCS Mock Mode (base64 data URLs will be used)');
      process.env.GCS_MOCK_MODE = 'true'; // Ensure mock mode is enabled
    }
    
    const sanitizedTheaterName = testTheater.name.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, ' ');
    const theaterFolder = `theater list/${sanitizedTheaterName}`;
    console.log(`   Upload folder: ${theaterFolder}`);
    
    let fileUrls = {};
    try {
      fileUrls = await uploadFiles(files, theaterFolder);
      console.log('✅ Files uploaded successfully');
      console.log('   Uploaded URLs:', JSON.stringify(Object.keys(fileUrls), null, 2));
      const sampleUrl = Object.values(fileUrls)[0];
      if (sampleUrl) {
        if (sampleUrl.startsWith('data:')) {
          console.log(`   Sample URL: Base64 data URL (${sampleUrl.length} chars) ✅`);
        } else if (sampleUrl.startsWith('https://storage.googleapis.com')) {
          console.log(`   Sample URL: GCS URL ✅ (${sampleUrl.substring(0, 100)}...)`);
        } else {
          console.log(`   Sample URL: ${sampleUrl.substring(0, 100)}...`);
        }
      }
      console.log('');
    } catch (uploadError) {
      console.error('❌ File upload error:', uploadError.message);
      
      // If GCS not configured, enable mock mode and retry
      if (uploadError.message.includes('GCS client not initialized') || 
          uploadError.message.includes('credentials incomplete')) {
        console.log('ℹ️  GCS not configured. Enabling mock mode and retrying...');
        process.env.GCS_MOCK_MODE = 'true';
        
        try {
          // Reset the gcsUploadUtil module to pick up mock mode
          delete require.cache[require.resolve('../utils/gcsUploadUtil')];
          const { uploadFiles: uploadFilesMock } = require('../utils/gcsUploadUtil');
          fileUrls = await uploadFilesMock(files, theaterFolder);
          console.log('✅ Files uploaded using mock mode (base64 data URLs)');
          console.log('   Uploaded URLs:', JSON.stringify(Object.keys(fileUrls), null, 2));
          const sampleUrl = Object.values(fileUrls)[0];
          if (sampleUrl) {
            console.log(`   Sample URL: Base64 data URL (${sampleUrl.length} chars) ✅`);
          }
          console.log('');
        } catch (retryError) {
          console.error('❌ Retry failed:', retryError.message);
          console.log('ℹ️  Continuing test with empty fileUrls...\n');
          fileUrls = {};
        }
      } else {
        console.log('ℹ️  Continuing test with empty fileUrls...\n');
        fileUrls = {};
      }
    }
    
    // Step 3: Prepare documents
    console.log('📄 Preparing documents object...');
    const documents = {
      theaterPhoto: fileUrls.theaterPhoto || null,
      logo: fileUrls.logo || null,
      aadharCard: fileUrls.aadharCard || null,
      panCard: fileUrls.panCard || null,
      gstCertificate: fileUrls.gstCertificate || null,
      fssaiCertificate: fileUrls.fssaiCertificate || null,
      agreementCopy: fileUrls.agreementCopy || null
    };
    
    const docCount = Object.values(documents).filter(v => v !== null && v !== undefined && v !== '').length;
    console.log(`   Documents to save: ${docCount}/${Object.keys(documents).length}`);
    console.log('');
    
    // Step 4: Create theater with documents
    console.log('💾 Creating theater in database...');
    const theaterData = {
      ...testTheater,
      documents: documents,
      agreementDetails: {
        ...testTheater.agreementDetails,
        copy: fileUrls.agreementCopy || null
      },
      branding: {
        ...testTheater.branding,
        logo: fileUrls.logo || null,
        logoUrl: fileUrls.logo || null
      }
    };
    
    const theater = new Theater(theaterData);
    const savedTheater = await theater.save();
    console.log(`✅ Theater created successfully!`);
    console.log(`   Theater ID: ${savedTheater._id}`);
    console.log(`   Theater name: ${savedTheater.name}`);
    console.log(`   Username: ${savedTheater.username}`);
    console.log('');
    
    // Step 5: Verify documents were saved
    console.log('🔍 Verifying documents were saved...');
    if (!savedTheater.documents) {
      console.error('❌ Documents field is missing from saved theater!');
      return false;
    }
    
    const savedDocuments = savedTheater.documents;
    const documentTypes = [
      'theaterPhoto',
      'logo',
      'aadharCard',
      'panCard',
      'gstCertificate',
      'fssaiCertificate',
      'agreementCopy'
    ];
    
    let savedDocCount = 0;
    console.log('   📄 Checking saved documents:');
    documentTypes.forEach(docType => {
      const docUrl = savedDocuments[docType];
      if (docUrl && docUrl !== null && docUrl !== '') {
        console.log(`      ✅ ${docType}: SAVED`);
        console.log(`         URL: ${docUrl.substring(0, 100)}${docUrl.length > 100 ? '...' : ''}`);
        if (docUrl.startsWith('https://storage.googleapis.com') || docUrl.includes('googleapis.com')) {
          console.log('         Type: Google Cloud Storage ✅');
        } else if (docUrl.startsWith('data:')) {
          console.log('         Type: Base64 Data URL ⚠️');
        }
        savedDocCount++;
      } else {
        console.log(`      ❌ ${docType}: NOT SAVED`);
      }
    });
    
    console.log('');
    console.log(`📊 Summary: ${savedDocCount}/${documentTypes.length} documents saved`);
    
    // Step 6: Verify by fetching from database
    console.log('\n🔍 Verifying by fetching from database...');
    const fetchedTheater = await Theater.findById(savedTheater._id).lean();
    if (!fetchedTheater) {
      console.error('❌ Theater not found in database!');
      return false;
    }
    
    if (!fetchedTheater.documents) {
      console.error('❌ Documents field is missing from fetched theater!');
      return false;
    }
    
    let fetchedDocCount = 0;
    documentTypes.forEach(docType => {
      if (fetchedTheater.documents[docType] && fetchedTheater.documents[docType] !== null && fetchedTheater.documents[docType] !== '') {
        fetchedDocCount++;
      }
    });
    
    console.log(`✅ Verification: ${fetchedDocCount}/${documentTypes.length} documents found in database`);
    
    // Final result
    console.log('\n' + '='.repeat(60));
    if (savedDocCount > 0 && savedDocCount === fetchedDocCount) {
      console.log('✅ TEST PASSED: Documents were saved correctly!');
      console.log(`   ${savedDocCount} documents successfully saved and verified`);
      return true;
    } else if (savedDocCount > 0) {
      console.log('⚠️  TEST PARTIAL: Some documents were saved but count mismatch');
      console.log(`   Saved: ${savedDocCount}, Fetched: ${fetchedDocCount}`);
      return false;
    } else {
      console.log('❌ TEST FAILED: No documents were saved');
      console.log('   Check GCS configuration and file upload process');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the test
if (require.main === module) {
  testTheaterCreation().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { testTheaterCreation };

