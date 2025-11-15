/**
 * Test Script: Create Theater with Documents
 * 
 * This script tests the theater creation with document uploads to GCS
 * and verifies that documents are saved to the database correctly.
 */

const mongoose = require('mongoose');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:8080';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

// Test data
const testTheater = {
  name: 'Test Theater Document Upload',
  username: `test_theater_${Date.now()}`,
  password: 'TestPassword123!',
  email: `test_${Date.now()}@example.com`,
  phone: '9876543210',
  street: '123 Test Street',
  city: 'Test City',
  state: 'Test State',
  pincode: '123456',
  ownerName: 'Test Owner',
  ownerContactNumber: '9876543210',
  personalAddress: 'Test Personal Address',
  agreementStartDate: new Date().toISOString(),
  agreementEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  gstNumber: '29ABCDE1234F1Z5',
  fssaiNumber: '12345678901234'
};

let authToken = null;
let createdTheaterId = null;

/**
 * Create a dummy image file for testing
 */
function createDummyImage(filename) {
  // Create a simple 1x1 PNG image in base64
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const buffer = Buffer.from(pngBase64, 'base64');
  const filePath = path.join(__dirname, '..', 'temp', filename);
  
  // Ensure temp directory exists
  const tempDir = path.dirname(filePath);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Login as super admin to get auth token
 */
async function loginAsAdmin() {
  try {
    console.log('🔐 Logging in as super admin...');
    
    // Get credentials from environment variables or use defaults
    const adminUsername = process.env.ADMIN_USERNAME || process.argv[2] || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || process.argv[3] || 'admin123';
    
    console.log(`   Username: ${adminUsername}`);
    
    // Try provided credentials first
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        username: adminUsername,
        password: adminPassword
      });
      
      if (response.data && response.data.token) {
        authToken = response.data.token;
        console.log('✅ Logged in successfully');
        return true;
      }
    } catch (err) {
      if (err.response && err.response.status === 401) {
        console.error('❌ Authentication failed: Invalid credentials');
      } else {
        console.error('❌ Login error:', err.message);
      }
    }
    
    // If provided credentials failed, try common admin credentials
    console.log('   Trying common admin credentials...');
    const adminCredentials = [
      { username: 'admin', password: 'admin123' },
      { username: 'super_admin', password: 'admin123' },
      { username: 'admin', password: 'Admin@123' },
      { username: 'superadmin', password: 'admin123' }
    ];
    
    for (const cred of adminCredentials) {
      if (cred.username === adminUsername && cred.password === adminPassword) {
        continue; // Already tried
      }
      try {
        const response = await axios.post(`${API_URL}/api/auth/login`, {
          username: cred.username,
          password: cred.password
        });
        
        if (response.data && response.data.token) {
          authToken = response.data.token;
          console.log(`✅ Logged in successfully with username: ${cred.username}`);
          return true;
        }
      } catch (err) {
        // Try next credentials
        continue;
      }
    }
    
    console.error('\n❌ Failed to login with any admin credentials');
    console.log('ℹ️  Usage:');
    console.log('   node scripts/test-theater-documents.js [username] [password]');
    console.log('   OR');
    console.log('   ADMIN_USERNAME=your_username ADMIN_PASSWORD=your_password node scripts/test-theater-documents.js');
    console.log('\n   Example:');
    console.log('   node scripts/test-theater-documents.js admin admin123');
    return false;
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return false;
  }
}

/**
 * Create theater with documents
 */
async function createTheaterWithDocuments() {
  try {
    console.log('\n📤 Creating theater with documents...');
    console.log('   Theater name:', testTheater.name);
    
    // Create form data
    const formData = new FormData();
    
    // Add theater fields
    Object.keys(testTheater).forEach(key => {
      if (testTheater[key] !== undefined && testTheater[key] !== null) {
        formData.append(key, testTheater[key]);
      }
    });
    
    // Create dummy files for each document type
    const documentTypes = [
      'theaterPhoto',
      'logo',
      'aadharCard',
      'panCard',
      'gstCertificate',
      'fssaiCertificate',
      'agreementCopy'
    ];
    
    const createdFiles = [];
    for (const docType of documentTypes) {
      const filename = `${docType}.png`;
      const filePath = createDummyImage(filename);
      formData.append(docType, fs.createReadStream(filePath), {
        filename: filename,
        contentType: 'image/png'
      });
      createdFiles.push(filePath);
      console.log(`   ✅ Added ${docType}: ${filename}`);
    }
    
    // Make API request
    console.log('\n🚀 Sending POST request to /api/theaters...');
    const response = await axios.post(`${API_URL}/api/theaters`, formData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    if (response.data && response.data.success) {
      createdTheaterId = response.data.data.id;
      console.log('✅ Theater created successfully!');
      console.log('   Theater ID:', createdTheaterId);
      console.log('   Documents in response:', JSON.stringify(response.data.data.documents, null, 2));
      
      // Clean up temp files
      createdFiles.forEach(file => {
        try {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        } catch (err) {
          // Ignore cleanup errors
        }
      });
      
      return response.data.data;
    } else {
      console.error('❌ Theater creation failed:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating theater:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

/**
 * Verify documents in database
 */
async function verifyDocumentsInDatabase() {
  try {
    console.log('\n🔍 Verifying documents in database...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get Theater model
    const Theater = require('../models/Theater');
    
    // Find the created theater
    const theater = await Theater.findById(createdTheaterId).lean();
    
    if (!theater) {
      console.error('❌ Theater not found in database!');
      return false;
    }
    
    console.log('✅ Theater found in database');
    console.log('   Theater ID:', theater._id);
    console.log('   Theater name:', theater.name);
    
    // Check documents
    if (!theater.documents) {
      console.error('❌ Documents field is missing from theater!');
      return false;
    }
    
    console.log('\n📄 Documents in database:');
    const documents = theater.documents;
    let docCount = 0;
    
    const docTypes = [
      'theaterPhoto',
      'logo',
      'aadharCard',
      'panCard',
      'gstCertificate',
      'fssaiCertificate',
      'agreementCopy'
    ];
    
    docTypes.forEach(docType => {
      const docUrl = documents[docType];
      if (docUrl && docUrl !== null && docUrl !== '') {
        console.log(`   ✅ ${docType}: ${docUrl.substring(0, 100)}...`);
        docCount++;
      } else {
        console.log(`   ❌ ${docType}: NOT SAVED (null or empty)`);
      }
    });
    
    console.log(`\n📊 Summary: ${docCount}/${docTypes.length} documents saved`);
    
    if (docCount === docTypes.length) {
      console.log('✅ SUCCESS: All documents were saved correctly!');
      return true;
    } else {
      console.error('❌ FAILURE: Some documents were not saved!');
      return false;
    }
  } catch (error) {
    console.error('❌ Error verifying documents:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

/**
 * Clean up test theater
 */
async function cleanup() {
  if (createdTheaterId && authToken) {
    try {
      console.log('\n🧹 Cleaning up test theater...');
      await axios.delete(`${API_URL}/api/theaters/${createdTheaterId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      console.log('✅ Test theater deleted');
    } catch (error) {
      console.warn('⚠️  Failed to delete test theater:', error.message);
    }
  }
}

/**
 * Main test function
 */
async function runTest() {
  console.log('🧪 Theater Document Upload Test\n');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Login
    const loggedIn = await loginAsAdmin();
    if (!loggedIn) {
      console.error('\n❌ Test failed: Could not login');
      process.exit(1);
    }
    
    // Step 2: Create theater with documents
    const createdTheater = await createTheaterWithDocuments();
    if (!createdTheater) {
      console.error('\n❌ Test failed: Could not create theater');
      process.exit(1);
    }
    
    // Wait a bit for database to sync
    console.log('\n⏳ Waiting 2 seconds for database to sync...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Verify documents in database
    const verified = await verifyDocumentsInDatabase();
    
    // Step 4: Cleanup
    const keepTestData = process.env.KEEP_TEST_DATA === 'true';
    if (!keepTestData) {
      await cleanup();
    } else {
      console.log('\nℹ️  Keeping test theater (KEEP_TEST_DATA=true)');
      console.log('   Theater ID:', createdTheaterId);
    }
    
    // Final result
    console.log('\n' + '='.repeat(60));
    if (verified) {
      console.log('✅ TEST PASSED: All documents were saved correctly!');
      process.exit(0);
    } else {
      console.log('❌ TEST FAILED: Documents were not saved correctly');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error('   Stack:', error.stack);
    await cleanup();
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runTest();
}

module.exports = { runTest };

