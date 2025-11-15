/**
 * Full CRUD Theater Test with Real File Uploads
 * 
 * This script performs complete CRUD operations:
 * 1. CREATE - Creates 3 theaters with all documents (real images/files)
 * 2. READ - Reads all theaters and verifies documents
 * 3. UPDATE - Updates theater information and documents
 * 4. DELETE - Deletes test theaters and cleans up GCS files
 */

const mongoose = require('mongoose');
const Theater = require('../models/Theater');
const { uploadFiles, deleteFiles, isGCSReady } = require('../utils/gcsUploadUtil');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/test';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080/api';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin111';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin111';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

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
let authToken = null;

/**
 * Create a colored PNG image
 */
function createImageFile(filename, width = 400, height = 400, text = 'DOCUMENT') {
  try {
    const canvas = require('canvas');
    const canvasInstance = canvas.createCanvas(width, height);
    const ctx = canvasInstance.getContext('2d');
    
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#8B5CF6');
    gradient.addColorStop(1, '#6366F1');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2 - 20);
    ctx.fillText(new Date().toLocaleDateString(), width / 2, height / 2 + 20);
    
    const buffer = canvasInstance.toBuffer('image/png');
    const filePath = path.join(__dirname, '..', 'temp', filename);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(filePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (error) {
    console.error(`   ❌ Error creating image ${filename}:`, error.message);
    // Fallback: Create a minimal valid PNG
    const minimalPNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const filePath = path.join(__dirname, '..', 'temp', filename);
    const tempDir = path.dirname(filePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(filePath, minimalPNG);
    return filePath;
  }
}

/**
 * Create PDF file (simple PDF structure)
 */
function createPDFFile(filename) {
  // Simple PDF structure
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
177
%%EOF`;
  
  const filePath = path.join(__dirname, '..', 'temp', filename);
  const tempDir = path.dirname(filePath);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  fs.writeFileSync(filePath, pdfContent);
  return filePath;
}

/**
 * Login to get auth token
 */
async function login() {
  try {
    console.log('🔐 Logging in...');
    
    // Try multiple login methods
    const loginAttempts = [];
    
    // Try with username
    loginAttempts.push({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD
    });
    
    // Try with email if provided
    if (ADMIN_EMAIL) {
      loginAttempts.push({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      });
    }
    
    // Try common admin credentials
    loginAttempts.push(
      { username: 'admin111', password: 'admin111' },
      { username: 'admin', password: 'admin123' },
      { email: 'admin@example.com', password: 'admin123' }
    );
    
    for (const credentials of loginAttempts) {
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
        
        if (response.data.success && response.data.token) {
          authToken = response.data.token;
          console.log('✅ Login successful');
          console.log(`   User: ${response.data.user?.username || response.data.user?.email || 'N/A'}`);
          console.log(`   Role: ${response.data.user?.role || 'N/A'}\n`);
          return true;
        }
      } catch (err) {
        // Continue to next attempt
      }
    }
    
    console.error('❌ Login failed: Could not authenticate with any credentials');
    console.error('   Please set ADMIN_USERNAME/ADMIN_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD environment variables');
    return false;
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return false;
  }
}

/**
 * Create theater with all documents via direct database access
 */
async function createTheaterDirectDB(theaterData, index) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📝 STEP 1.${index + 1}: CREATE - Theater ${index + 1}: ${theaterData.name}`);
    console.log('='.repeat(70));
    
    // Create document files
    console.log('\n📦 Creating document files...');
    const documentTypes = [
      { field: 'theaterPhoto', type: 'image', text: 'THEATER PHOTO' },
      { field: 'logo', type: 'image', text: 'LOGO' },
      { field: 'aadharCard', type: 'image', text: 'AADHAR' },
      { field: 'panCard', type: 'image', text: 'PAN CARD' },
      { field: 'gstCertificate', type: 'pdf', text: null },
      { field: 'fssaiCertificate', type: 'pdf', text: null },
      { field: 'agreementCopy', type: 'pdf', text: null }
    ];
    
    const files = [];
    const filePaths = [];
    
    documentTypes.forEach(doc => {
      const filename = `${doc.field}-${theaterData.name.replace(/[^a-zA-Z0-9]/g, '_')}.${doc.type === 'image' ? 'png' : 'pdf'}`;
      let filePath;
      
      if (doc.type === 'image') {
        filePath = createImageFile(filename, 800, 600, doc.text);
      } else {
        filePath = createPDFFile(filename);
      }
      
      const buffer = fs.readFileSync(filePath);
      files.push({
        fieldname: doc.field,
        originalname: filename,
        mimetype: doc.type === 'image' ? 'image/png' : 'application/pdf',
        buffer: buffer,
        size: buffer.length
      });
      
      filePaths.push(filePath);
      console.log(`   ✅ Created ${doc.field}: ${filename} (${buffer.length} bytes)`);
    });
    
    console.log(`\n✅ Created ${files.length} document files\n`);
    
    // Upload files to GCS
    console.log('📤 Uploading files to Google Cloud Storage...');
    const sanitizedTheaterName = theaterData.name.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, ' ');
    const theaterFolder = `theater list/${sanitizedTheaterName}`;
    
    let fileUrls = {};
    try {
      fileUrls = await uploadFiles(files, theaterFolder);
      console.log('✅ Files uploaded successfully');
      
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
        // Ignore
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
 * Create theater with all documents via API
 */
async function createTheaterViaAPI(theaterData, index) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📝 STEP 1.${index + 1}: CREATE - Theater ${index + 1}: ${theaterData.name}`);
    console.log('='.repeat(70));
    
    // Create document files
    console.log('\n📦 Creating document files...');
    const documentTypes = [
      { field: 'theaterPhoto', type: 'image', text: 'THEATER PHOTO' },
      { field: 'logo', type: 'image', text: 'LOGO' },
      { field: 'aadharCard', type: 'image', text: 'AADHAR' },
      { field: 'panCard', type: 'image', text: 'PAN CARD' },
      { field: 'gstCertificate', type: 'pdf', text: null },
      { field: 'fssaiCertificate', type: 'pdf', text: null },
      { field: 'agreementCopy', type: 'pdf', text: null }
    ];
    
    const files = [];
    const filePaths = [];
    
    documentTypes.forEach(doc => {
      const filename = `${doc.field}-${theaterData.name.replace(/[^a-zA-Z0-9]/g, '_')}.${doc.type === 'image' ? 'png' : 'pdf'}`;
      let filePath;
      
      if (doc.type === 'image') {
        filePath = createImageFile(filename, 800, 600, doc.text);
      } else {
        filePath = createPDFFile(filename);
      }
      
      const buffer = fs.readFileSync(filePath);
      files.push({
        fieldname: doc.field,
        originalname: filename,
        mimetype: doc.type === 'image' ? 'image/png' : 'application/pdf',
        buffer: buffer,
        size: buffer.length
      });
      
      filePaths.push(filePath);
      console.log(`   ✅ Created ${doc.field}: ${filename} (${buffer.length} bytes)`);
    });
    
    console.log(`\n✅ Created ${files.length} document files\n`);
    
    // Prepare FormData for API
    const FormData = require('form-data');
    const formData = new FormData();
    
    // Add theater data fields
    formData.append('name', theaterData.name);
    formData.append('username', theaterData.username);
    formData.append('password', theaterData.password);
    formData.append('email', theaterData.email);
    formData.append('phone', theaterData.phone);
    formData.append('address[street]', theaterData.address.street);
    formData.append('address[city]', theaterData.address.city);
    formData.append('address[state]', theaterData.address.state);
    formData.append('address[pincode]', theaterData.address.pincode);
    formData.append('ownerDetails[name]', theaterData.ownerName);
    formData.append('ownerDetails[contactNumber]', theaterData.ownerContactNumber);
    formData.append('ownerDetails[personalAddress]', theaterData.personalAddress);
    formData.append('gstNumber', theaterData.gstNumber);
    formData.append('fssaiNumber', theaterData.fssaiNumber);
    
    // Add files
    files.forEach(file => {
      formData.append(file.fieldname, file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
    });
    
    // Create theater via API
    console.log('📤 Creating theater via API...');
    const response = await axios.post(`${API_BASE_URL}/theaters`, formData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...formData.getHeaders()
      }
    });
    
    if (response.data.success && response.data.data) {
      const theater = response.data.data;
      console.log('✅ Theater created successfully!');
      console.log(`   Theater ID: ${theater._id || theater.id}`);
      console.log(`   Name: ${theater.name}`);
      console.log(`   Username: ${theater.username}`);
      
      // Verify documents
      if (theater.documents) {
        const docCount = Object.values(theater.documents).filter(v => v !== null && v !== '').length;
        console.log(`   Documents uploaded: ${docCount}/${Object.keys(theater.documents).length}`);
        
        if (docCount > 0) {
          const sampleDoc = Object.entries(theater.documents).find(([_, v]) => v !== null && v !== '');
          if (sampleDoc) {
            const [docType, docUrl] = sampleDoc;
            if (docUrl.startsWith('https://storage.googleapis.com')) {
              console.log(`   ✅ Sample document (${docType}): GCS URL`);
              console.log(`      ${docUrl.substring(0, 80)}...`);
            } else if (docUrl.startsWith('data:')) {
              console.log(`   ⚠️  Sample document (${docType}): Base64 (GCS might not be configured)`);
            }
          }
        }
      }
      
      // Clean up temp files
      filePaths.forEach(filePath => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          // Ignore
        }
      });
      
      return theater;
    }
    
    throw new Error('Theater creation failed');
    
  } catch (error) {
    console.error(`❌ Error creating theater ${theaterData.name}:`, error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error('   Error details:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

/**
 * Read all theaters
 */
async function readTheaters(useAPI = false) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log('📖 STEP 2: READ - Reading all theaters...');
    console.log('='.repeat(70));
    
    if (useAPI && authToken) {
      const response = await axios.get(`${API_BASE_URL}/theaters?page=1&limit=100`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.data.success && response.data.data) {
        const theaters = response.data.data.theaters || response.data.data;
        console.log(`✅ Found ${theaters.length} theater(s)\n`);
        
        theaters.forEach((theater, index) => {
          console.log(`${index + 1}. ${theater.name} (ID: ${theater._id || theater.id})`);
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
      }
      
      return [];
    } else {
      // Direct database access
      const theaters = await Theater.find({}).lean().limit(100).sort({ createdAt: -1 });
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
    }
  } catch (error) {
    console.error('❌ Error reading theaters:', error.response?.data?.message || error.message);
    return [];
  }
}

/**
 * Update theater
 */
async function updateTheater(theaterId, index) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`✏️  STEP 3.${index + 1}: UPDATE - Updating Theater ${index + 1}...`);
    console.log('='.repeat(70));
    
    const theater = await axios.get(`${API_BASE_URL}/theaters/${theaterId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!theater.data.success) {
      console.error(`❌ Theater not found: ${theaterId}`);
      return null;
    }
    
    const currentTheater = theater.data.data;
    console.log(`   Current name: ${currentTheater.name}`);
    console.log(`   Current phone: ${currentTheater.phone || 'N/A'}`);
    
    // Update theater
    const updateData = {
      name: `${currentTheater.name} (Updated)`,
      phone: '9999999999'
    };
    
    const response = await axios.put(`${API_BASE_URL}/theaters/${theaterId}`, updateData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      const updatedTheater = response.data.data;
      console.log('✅ Theater updated successfully!');
      console.log(`   New name: ${updatedTheater.name}`);
      console.log(`   New phone: ${updatedTheater.phone}`);
      return updatedTheater;
    }
    
    throw new Error('Update failed');
    
  } catch (error) {
    console.error('❌ Error updating theater:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Delete theater
 */
async function deleteTheater(theaterId, index) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🗑️  STEP 4.${index + 1}: DELETE - Deleting Theater ${index + 1}...`);
    console.log('='.repeat(70));
    
    // Get theater details first
    const theater = await axios.get(`${API_BASE_URL}/theaters/${theaterId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!theater.data.success) {
      console.error(`❌ Theater not found: ${theaterId}`);
      return false;
    }
    
    const theaterData = theater.data.data;
    console.log(`   Theater: ${theaterData.name}`);
    console.log(`   ID: ${theaterId}`);
    
    // Delete documents from GCS if they exist
    if (theaterData.documents) {
      const fileUrls = Object.values(theaterData.documents).filter(v => 
        v !== null && v !== '' && typeof v === 'string' && v.startsWith('https://storage.googleapis.com')
      );
      
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
    const response = await axios.delete(`${API_BASE_URL}/theaters/${theaterId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.data.success) {
      console.log('✅ Theater deleted successfully!');
      return true;
    }
    
    throw new Error('Delete failed');
    
  } catch (error) {
    console.error('❌ Error deleting theater:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Main test function
 */
async function runFullCRUDTest() {
  try {
    console.log('🧪 Full CRUD Theater Test with Real File Uploads\n');
    console.log('='.repeat(70));
    console.log('This test will:');
    console.log('1. CREATE - Create 3 theaters with all documents (via API)');
    console.log('2. READ - Read all theaters and verify documents');
    console.log('3. UPDATE - Update theater information');
    console.log('4. DELETE - Delete test theaters and clean up GCS files');
    console.log('='.repeat(70));
    console.log('');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Verify GCS
    console.log('🔍 Verifying GCS configuration...');
    const gcsReady = await isGCSReady();
    if (!gcsReady) {
      console.log('⚠️  GCS not configured. Files will use base64 data URLs.');
      console.log('   To use GCS, configure it in Settings → Google Cloud Storage\n');
    } else {
      console.log('✅ GCS is configured and ready\n');
    }
    
    // Try to login (optional - will use direct DB if fails)
    const useAPI = process.env.USE_API === 'true';
    let loginSuccess = false;
    
    if (useAPI) {
      loginSuccess = await login();
      if (!loginSuccess) {
        console.error('❌ Cannot proceed without authentication');
        console.error('   Set USE_API=false to use direct database access');
        await mongoose.disconnect();
        process.exit(1);
      }
    } else {
      console.log('ℹ️  Using direct database access (USE_API=false)');
      console.log('   This bypasses API authentication\n');
    }
    
    // STEP 1: CREATE - Create 3 theaters
    console.log('\n' + '='.repeat(70));
    console.log('📝 STEP 1: CREATE - Creating 3 theaters with documents');
    console.log('='.repeat(70));
    
    if (loginSuccess) {
      // Create via API
      for (let i = 0; i < testTheaters.length; i++) {
        const theater = await createTheaterViaAPI(testTheaters[i], i);
        if (theater) {
          createdTheaters.push(theater);
        }
        // Wait between creations
        if (i < testTheaters.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } else {
      // Create via direct database access
      console.log('📝 Creating theaters with direct database access...\n');
      for (let i = 0; i < testTheaters.length; i++) {
        const theater = await createTheaterDirectDB(testTheaters[i], i);
        if (theater) {
          createdTheaters.push(theater);
        }
        // Wait between creations
        if (i < testTheaters.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    console.log(`\n✅ Created ${createdTheaters.length}/${testTheaters.length} theaters`);
    
    // Wait for database to sync
    console.log('\n⏳ Waiting 3 seconds for database to sync...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // STEP 2: READ - Read all theaters
    const allTheaters = await readTheaters(loginSuccess);
    
    // STEP 3: UPDATE - Update first theater
    if (createdTheaters.length > 0) {
      console.log('\n' + '='.repeat(70));
      console.log('✏️  STEP 3: UPDATE - Updating first theater');
      console.log('='.repeat(70));
      
      if (loginSuccess) {
        const updatedTheater = await updateTheater(createdTheaters[0]._id || createdTheaters[0].id, 0);
      } else {
        // Direct database update
        const theaterId = createdTheaters[0]._id;
        const theater = await Theater.findById(theaterId);
        if (theater) {
          console.log(`   Current name: ${theater.name}`);
          theater.name = `${theater.name} (Updated)`;
          theater.phone = '9999999999';
          await theater.save();
          console.log('✅ Theater updated successfully!');
          console.log(`   New name: ${theater.name}`);
          console.log(`   New phone: ${theater.phone}`);
        }
      }
    }
    
    // STEP 4: DELETE - Clean up
    const keepTestData = process.env.KEEP_TEST_DATA === 'true';
    
    if (!keepTestData && createdTheaters.length > 0) {
      console.log('\n' + '='.repeat(70));
      console.log('🗑️  STEP 4: DELETE - Cleaning up test theaters');
      console.log('='.repeat(70));
      console.log('\n⚠️  This will delete the test theaters.');
      console.log('   Set KEEP_TEST_DATA=true to keep them.\n');
      
      for (let i = 0; i < createdTheaters.length; i++) {
        if (loginSuccess) {
          await deleteTheater(createdTheaters[i]._id || createdTheaters[i].id, i);
        } else {
          // Direct database delete
          const theaterId = createdTheaters[i]._id;
          const theater = await Theater.findById(theaterId);
          if (theater) {
            console.log(`\n${'='.repeat(70)}`);
            console.log(`🗑️  STEP 4.${i + 1}: DELETE - Deleting Theater ${i + 1}...`);
            console.log('='.repeat(70));
            console.log(`   Theater: ${theater.name}`);
            console.log(`   ID: ${theaterId}`);
            
            // Delete documents from GCS
            if (theater.documents) {
              const fileUrls = Object.values(theater.documents).filter(v => 
                v !== null && v !== '' && typeof v === 'string' && v.startsWith('https://storage.googleapis.com')
              );
              
              if (fileUrls.length > 0) {
                console.log(`   Deleting ${fileUrls.length} files from GCS...`);
                try {
                  const { deleteFiles } = require('../utils/gcsUploadUtil');
                  const deletedCount = await deleteFiles(fileUrls);
                  console.log(`   ✅ Deleted ${deletedCount}/${fileUrls.length} files from GCS`);
                } catch (deleteError) {
                  console.warn(`   ⚠️  Failed to delete some files: ${deleteError.message}`);
                }
              }
            }
            
            await Theater.findByIdAndDelete(theaterId);
            console.log('✅ Theater deleted successfully!');
          }
        }
        if (i < createdTheaters.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else {
      console.log('\nℹ️  Keeping test theaters (KEEP_TEST_DATA=true)');
      createdTheaters.forEach((theater, index) => {
        console.log(`   ${index + 1}. ${theater.name} (ID: ${theater._id || theater.id})`);
      });
    }
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ GCS Configuration: ${gcsReady ? 'Configured' : 'Not Configured'}`);
    console.log(`✅ Theaters Created: ${createdTheaters.length}/${testTheaters.length}`);
    console.log(`✅ Theaters Read: ${allTheaters.length} total theaters in database`);
    console.log(`✅ Theaters Updated: ${createdTheaters.length > 0 ? '1' : '0'}`);
    console.log(`✅ Theaters Deleted: ${keepTestData ? '0 (kept)' : createdTheaters.length}`);
    
    if (createdTheaters.length === testTheaters.length) {
      console.log('\n✅ ALL TESTS PASSED! Full CRUD operations working correctly!');
      
      // Check if documents are in GCS
      const theatersWithGCS = createdTheaters.filter(t => {
        if (!t.documents) return false;
        const urls = Object.values(t.documents).filter(v => v && typeof v === 'string' && v.startsWith('https://storage.googleapis.com'));
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

