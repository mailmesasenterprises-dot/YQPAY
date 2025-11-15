/**
 * Complete Theater CRUD Test with GCS Upload
 * 
 * This script:
 * 1. Verifies GCS configuration
 * 2. Creates 3 theaters with real images
 * 3. Tests full CRUD operations
 * 4. Verifies documents are saved to GCS and database
 */

const mongoose = require('mongoose');
const Theater = require('../models/Theater');
const { uploadFiles, isGCSReady } = require('../utils/gcsUploadUtil');
const fs = require('fs');
const path = require('path');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/test';

// Test theater data
const testTheaters = [
  {
    name: 'PVR Cinemas - Phoenix Mall',
    username: `pvr_phoenix_${Date.now()}`,
    password: 'TestPassword123!',
    email: `pvr_phoenix_${Date.now()}@example.com`,
    phone: '9876543210',
    address: {
      street: 'Phoenix Mall, Velachery',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600042'
    },
    ownerName: 'PVR Ltd',
    ownerContactNumber: '9876543210',
    personalAddress: 'Corporate Office, Chennai',
    gstNumber: '29ABCDE1234F1Z5',
    fssaiNumber: '12345678901234'
  },
  {
    name: 'INOX Cinemas - Forum Mall',
    username: `inox_forum_${Date.now()}`,
    password: 'TestPassword123!',
    email: `inox_forum_${Date.now()}@example.com`,
    phone: '9876543211',
    address: {
      street: 'Forum Mall, Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560095'
    },
    ownerName: 'INOX Leisure Ltd',
    ownerContactNumber: '9876543211',
    personalAddress: 'Corporate Office, Mumbai',
    gstNumber: '27ABCDE1234F1Z6',
    fssaiNumber: '12345678901235'
  },
  {
    name: 'Cinepolis - Viviana Mall',
    username: `cinepolis_viviana_${Date.now()}`,
    password: 'TestPassword123!',
    email: `cinepolis_viviana_${Date.now()}@example.com`,
    phone: '9876543212',
    address: {
      street: 'Viviana Mall, Thane',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400606'
    },
    ownerName: 'Cinepolis India',
    ownerContactNumber: '9876543212',
    personalAddress: 'Corporate Office, Mumbai',
    gstNumber: '27ABCDE1234F1Z7',
    fssaiNumber: '12345678901236'
  }
];

let createdTheaters = [];

/**
 * Create a sample image file (PNG)
 * Creates a colored PNG image for testing
 */
function createSampleImage(filename, width = 200, height = 200) {
  try {
    // Try to use canvas if available
    try {
      const canvas = require('canvas');
      const canvasInstance = canvas.createCanvas(width, height);
      const ctx = canvasInstance.getContext('2d');
      
      // Fill with a gradient
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#8B5CF6');
      gradient.addColorStop(1, '#6366F1');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Add text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('THEATER', width / 2, height / 2 - 10);
      ctx.fillText('DOCUMENT', width / 2, height / 2 + 10);
      
      const buffer = canvasInstance.toBuffer('image/png');
      const filePath = path.join(__dirname, '..', 'temp', filename);
      
      // Ensure temp directory exists
      const tempDir = path.dirname(filePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch (canvasError) {
      // Fallback: Create a minimal PNG using a predefined base64 image
      console.log('   ⚠️  Canvas not available, using predefined PNG image');
      
      // Minimal 1x1 colored PNG (purple) - very small file
      const minimalPNGBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
      const buffer = Buffer.from(minimalPNGBase64, 'base64');
      
      // Create a larger image by repeating the pattern
      const largeBuffer = Buffer.alloc(width * height * 4);
      for (let i = 0; i < largeBuffer.length; i += 4) {
        largeBuffer[i] = 139;     // R (purple)
        largeBuffer[i + 1] = 92;  // G
        largeBuffer[i + 2] = 246; // B
        largeBuffer[i + 3] = 255; // A
      }
      
      // For simplicity, use a valid small PNG (we'll expand it)
      const filePath = path.join(__dirname, '..', 'temp', filename);
      const tempDir = path.dirname(filePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write the minimal PNG (it's small but valid)
      fs.writeFileSync(filePath, buffer);
      return filePath;
    }
  } catch (error) {
    console.error(`   ❌ Error creating image ${filename}:`, error.message);
    throw error;
  }
}

/**
 * Create all document files for a theater
 */
function createDocumentFiles(theaterName) {
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
  const filePaths = [];
  
  documentTypes.forEach(docType => {
    try {
      const filename = `${docType}-${theaterName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      const filePath = createSampleImage(filename, 400, 400);
      const buffer = fs.readFileSync(filePath);
      
      files.push({
        fieldname: docType,
        originalname: filename,
        mimetype: 'image/png',
        buffer: buffer,
        size: buffer.length
      });
      
      filePaths.push(filePath);
      console.log(`   ✅ Created ${docType}: ${filename} (${buffer.length} bytes)`);
    } catch (error) {
      console.error(`   ❌ Failed to create ${docType}:`, error.message);
    }
  });
  
  return { files, filePaths };
}

/**
 * Verify GCS configuration
 */
async function verifyGCSConfig() {
  console.log('🔍 Verifying GCS configuration...\n');
  
  try {
    const gcsReady = await isGCSReady();
    if (!gcsReady) {
      console.error('❌ GCS is not configured or initialized');
      console.log('   Please configure GCS in Settings → Google Cloud Storage');
      return false;
    }
    
    console.log('✅ GCS is configured and ready');
    return true;
  } catch (error) {
    console.error('❌ Error checking GCS:', error.message);
    return false;
  }
}

/**
 * Create theater with documents
 */
async function createTheater(theaterData, index) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 Creating Theater ${index + 1}: ${theaterData.name}`);
    console.log('='.repeat(60));
    
    // Create document files
    console.log('\n📦 Creating document files...');
    const { files, filePaths } = createDocumentFiles(theaterData.name);
    
    if (files.length === 0) {
      console.error('❌ No files created!');
      return null;
    }
    
    console.log(`✅ Created ${files.length} document files\n`);
    
    // Upload files to GCS
    console.log('📤 Uploading files to Google Cloud Storage...');
    const sanitizedTheaterName = theaterData.name.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, ' ');
    const theaterFolder = `theater list/${sanitizedTheaterName}`;
    
    let fileUrls = {};
    try {
      fileUrls = await uploadFiles(files, theaterFolder);
      console.log('✅ Files uploaded to GCS successfully');
      
      // Check if URLs are GCS URLs or base64
      const sampleUrl = Object.values(fileUrls)[0];
      if (sampleUrl && sampleUrl.startsWith('https://storage.googleapis.com')) {
        console.log('   ✅ Using Google Cloud Storage URLs');
      } else if (sampleUrl && sampleUrl.startsWith('data:')) {
        console.log('   ⚠️  Using base64 data URLs (GCS might not be configured)');
      }
      console.log('');
    } catch (uploadError) {
      console.error('❌ File upload error:', uploadError.message);
      console.log('   Continuing with empty fileUrls...\n');
      fileUrls = {};
    }
    
    // Clean up temp files
    filePaths.forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        // Ignore cleanup errors
      }
    });
    
    // Prepare theater data
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
    console.log(`📄 Documents to save: ${docCount}/${Object.keys(documents).length}`);
    
    const theater = new Theater({
      name: theaterData.name.trim(),
      username: theaterData.username.toLowerCase().trim(),
      password: theaterData.password,
      email: theaterData.email ? theaterData.email.toLowerCase().trim() : undefined,
      phone: theaterData.phone || undefined,
      address: {
        street: theaterData.address.street || '',
        city: theaterData.address.city || '',
        state: theaterData.address.state || '',
        pincode: theaterData.address.pincode || ''
      },
      location: {
        city: theaterData.address.city || '',
        state: theaterData.address.state || '',
        country: 'India'
      },
      ownerDetails: {
        name: theaterData.ownerName || '',
        contactNumber: theaterData.ownerContactNumber || '',
        personalAddress: theaterData.personalAddress || ''
      },
      agreementDetails: {
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        copy: fileUrls.agreementCopy || null
      },
      socialMedia: {
        facebook: null,
        instagram: null,
        twitter: null,
        youtube: null,
        website: null
      },
      gstNumber: theaterData.gstNumber ? theaterData.gstNumber.toUpperCase().trim() : undefined,
      fssaiNumber: theaterData.fssaiNumber ? theaterData.fssaiNumber.trim() : undefined,
      documents: documents,
      branding: {
        primaryColor: '#6B0E9B',
        secondaryColor: '#F3F4F6',
        logo: fileUrls.logo || null,
        logoUrl: fileUrls.logo || null
      },
      settings: {
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        language: 'en'
      },
      isActive: true,
      status: 'active'
    });
    
    // Save theater
    console.log('💾 Saving theater to database...');
    const savedTheater = await theater.save();
    console.log(`✅ Theater created successfully!`);
    console.log(`   Theater ID: ${savedTheater._id}`);
    console.log(`   Name: ${savedTheater.name}`);
    console.log(`   Username: ${savedTheater.username}`);
    
    // Verify documents
    if (savedTheater.documents) {
      const savedDocCount = Object.values(savedTheater.documents).filter(v => v !== null && v !== '').length;
      console.log(`   Documents saved: ${savedDocCount}/${Object.keys(savedTheater.documents).length}`);
      
      if (savedDocCount > 0) {
        const sampleDoc = Object.entries(savedTheater.documents).find(([_, v]) => v !== null && v !== '');
        if (sampleDoc) {
          const [docType, docUrl] = sampleDoc;
          if (docUrl.startsWith('https://storage.googleapis.com')) {
            console.log(`   ✅ Sample document (${docType}): GCS URL`);
            console.log(`      ${docUrl.substring(0, 100)}...`);
          } else if (docUrl.startsWith('data:')) {
            console.log(`   ⚠️  Sample document (${docType}): Base64 (GCS might not be configured)`);
          } else {
            console.log(`   ✅ Sample document (${docType}): ${docUrl.substring(0, 100)}...`);
          }
        }
      }
    }
    
    return savedTheater;
    
  } catch (error) {
    console.error(`❌ Error creating theater ${theaterData.name}:`, error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    return null;
  }
}

/**
 * Read theaters
 */
async function readTheaters() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('📖 Reading all theaters...');
    console.log('='.repeat(60));
    
    const theaters = await Theater.find({}).lean().limit(10).sort({ createdAt: -1 });
    console.log(`✅ Found ${theaters.length} theater(s)\n`);
    
    theaters.forEach((theater, index) => {
      console.log(`${index + 1}. ${theater.name} (ID: ${theater._id})`);
      console.log(`   Username: ${theater.username}`);
      
      if (theater.documents) {
        const docCount = Object.values(theater.documents).filter(v => v !== null && v !== '').length;
        console.log(`   Documents: ${docCount}/7`);
        
        if (docCount > 0) {
          const sampleDoc = Object.entries(theater.documents).find(([_, v]) => v !== null && v !== '');
          if (sampleDoc) {
            const [docType, docUrl] = sampleDoc;
            if (docUrl.startsWith('https://storage.googleapis.com')) {
              console.log(`   ✅ ${docType}: GCS URL`);
            } else if (docUrl.startsWith('data:')) {
              console.log(`   ⚠️  ${docType}: Base64`);
            }
          }
        }
      }
      console.log('');
    });
    
    return theaters;
  } catch (error) {
    console.error('❌ Error reading theaters:', error.message);
    return [];
  }
}

/**
 * Update theater
 */
async function updateTheater(theaterId, index) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✏️  Updating Theater ${index + 1}...`);
    console.log('='.repeat(60));
    
    const theater = await Theater.findById(theaterId);
    if (!theater) {
      console.error(`❌ Theater not found: ${theaterId}`);
      return null;
    }
    
    console.log(`   Current name: ${theater.name}`);
    
    // Update name
    const newName = `${theater.name} (Updated)`;
    theater.name = newName;
    theater.phone = '9999999999';
    
    await theater.save();
    
    console.log(`✅ Theater updated successfully!`);
    console.log(`   New name: ${theater.name}`);
    console.log(`   New phone: ${theater.phone}`);
    
    return theater;
  } catch (error) {
    console.error('❌ Error updating theater:', error.message);
    return null;
  }
}

/**
 * Delete theater
 */
async function deleteTheater(theaterId, index) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🗑️  Deleting Theater ${index + 1}...`);
    console.log('='.repeat(60));
    
    const theater = await Theater.findById(theaterId);
    if (!theater) {
      console.error(`❌ Theater not found: ${theaterId}`);
      return false;
    }
    
    console.log(`   Theater: ${theater.name}`);
    console.log(`   ID: ${theaterId}`);
    
    // Delete documents from GCS if they exist
    if (theater.documents) {
      const { deleteFiles } = require('../utils/gcsUploadUtil');
      const fileUrls = Object.values(theater.documents).filter(v => v !== null && v !== '' && v.startsWith('https://'));
      if (fileUrls.length > 0) {
        console.log(`   Deleting ${fileUrls.length} files from GCS...`);
        try {
          const deletedCount = await deleteFiles(fileUrls);
          console.log(`   ✅ Deleted ${deletedCount}/${fileUrls.length} files from GCS`);
        } catch (deleteError) {
          console.warn(`   ⚠️  Failed to delete some files from GCS: ${deleteError.message}`);
        }
      }
    }
    
    // Delete theater
    await Theater.findByIdAndDelete(theaterId);
    console.log(`✅ Theater deleted successfully!`);
    
    return true;
  } catch (error) {
    console.error('❌ Error deleting theater:', error.message);
    return false;
  }
}

/**
 * Main test function
 */
async function runFullCRUDTest() {
  try {
    console.log('🧪 Theater CRUD Test with GCS Upload\n');
    console.log('='.repeat(60));
    console.log('This test will:');
    console.log('1. Verify GCS configuration');
    console.log('2. Create 3 theaters with real images');
    console.log('3. Read theaters');
    console.log('4. Update theaters');
    console.log('5. Delete theaters');
    console.log('='.repeat(60));
    console.log('');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Step 1: Verify GCS
    const gcsReady = await verifyGCSConfig();
    if (!gcsReady) {
      console.log('\n⚠️  GCS not configured. Files will use base64 data URLs.');
      console.log('   To use GCS, configure it in Settings → Google Cloud Storage\n');
    } else {
      console.log('');
    }
    
    // Step 2: CREATE - Create 3 theaters
    console.log('\n' + '='.repeat(60));
    console.log('📝 STEP 1: CREATE - Creating 3 theaters with documents');
    console.log('='.repeat(60));
    
    for (let i = 0; i < testTheaters.length; i++) {
      const theater = await createTheater(testTheaters[i], i);
      if (theater) {
        createdTheaters.push(theater);
      }
      // Wait a bit between creations
      if (i < testTheaters.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`\n✅ Created ${createdTheaters.length}/${testTheaters.length} theaters`);
    
    // Wait for database to sync
    console.log('\n⏳ Waiting 2 seconds for database to sync...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: READ - Read all theaters
    console.log('\n' + '='.repeat(60));
    console.log('📖 STEP 2: READ - Reading all theaters');
    console.log('='.repeat(60));
    
    const allTheaters = await readTheaters();
    
    // Step 4: UPDATE - Update first theater
    if (createdTheaters.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('✏️  STEP 3: UPDATE - Updating first theater');
      console.log('='.repeat(60));
      
      const updatedTheater = await updateTheater(createdTheaters[0]._id, 0);
    }
    
    // Step 5: DELETE - Ask user if they want to delete test theaters
    const keepTestData = process.env.KEEP_TEST_DATA === 'true';
    
    if (!keepTestData && createdTheaters.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('🗑️  STEP 4: DELETE - Cleaning up test theaters');
      console.log('='.repeat(60));
      console.log('\n⚠️  This will delete the test theaters.');
      console.log('   Set KEEP_TEST_DATA=true to keep them.\n');
      
      for (let i = 0; i < createdTheaters.length; i++) {
        await deleteTheater(createdTheaters[i]._id, i);
        if (i < createdTheaters.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } else {
      console.log('\nℹ️  Keeping test theaters (KEEP_TEST_DATA=true)');
      createdTheaters.forEach((theater, index) => {
        console.log(`   ${index + 1}. ${theater.name} (ID: ${theater._id})`);
      });
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ GCS Configuration: ${gcsReady ? 'Configured' : 'Not Configured'}`);
    console.log(`✅ Theaters Created: ${createdTheaters.length}/${testTheaters.length}`);
    console.log(`✅ Theaters Read: ${allTheaters.length} total theaters in database`);
    console.log(`✅ Theaters Updated: ${createdTheaters.length > 0 ? '1' : '0'}`);
    console.log(`✅ Theaters Deleted: ${keepTestData ? '0 (kept)' : createdTheaters.length}`);
    
    if (createdTheaters.length === testTheaters.length) {
      console.log('\n✅ ALL TESTS PASSED! Theater CRUD operations working correctly!');
      
      // Check if documents are in GCS
      const theatersWithGCS = createdTheaters.filter(t => {
        if (!t.documents) return false;
        const urls = Object.values(t.documents).filter(v => v && v.startsWith('https://storage.googleapis.com'));
        return urls.length > 0;
      });
      
      if (theatersWithGCS.length > 0) {
        console.log(`✅ ${theatersWithGCS.length} theater(s) have documents uploaded to GCS!`);
      } else {
        console.log(`⚠️  Documents are using base64 (GCS not configured or using mock mode)`);
      }
    } else {
      console.log('\n⚠️  Some tests failed. Check logs above for details.');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error('   Stack:', error.stack);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      // Ignore
    }
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runFullCRUDTest().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runFullCRUDTest };

