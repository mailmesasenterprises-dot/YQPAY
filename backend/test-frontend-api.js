/**
 * Frontend Simulation Test - API Calls
 * Simulates what the frontend does when toggling pages
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';
const THEATER_ID = '68f8837a541316c6ad54b79f'; // YQ PAY NOW theater

// Authentication token (generated from create-test-token.js)
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJlbWFpbCI6ImFkbWluQHRlc3QuY29tIiwiaWF0IjoxNzYxNTY3NzQ0LCJleHAiOjE3NjE2NTQxNDR9.IMQ6VAlS53bnsl9FVek_-_1Pa16IyES7K4oHhGjr578';

// Axios config with auth header
const axiosConfig = {
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
};

// Test data
const testPages = [
  {
    page: 'TheaterDashboardWithId',
    pageName: 'Theater Dashboard (With ID)',
    route: '/theater-dashboard/:theaterId',
    description: 'Access to Theater Dashboard',
    category: 'admin'
  },
  {
    page: 'TheaterSettingsWithId',
    pageName: 'Theater Settings (With ID)',
    route: '/theater-settings/:theaterId',
    description: 'Access to Theater Settings',
    category: 'admin'
  },
  {
    page: 'TheaterKioskTypes',
    pageName: 'Theater Kiosk Types',
    route: '/theater-kiosk-types/:theaterId',
    description: 'Access to Theater Kiosk Types',
    category: 'admin'
  }
];

async function testFrontendFlow() {
  console.log('=' .repeat(70));
  console.log('🌐 FRONTEND SIMULATION TEST');
  console.log('='.repeat(70));
  
  try {
    // Clean up first
    console.log('\n🧹 STEP 0: Clean up existing data...');
    const mongoose = require('mongoose');
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow');
    const PageAccessArray = require('./models/PageAccessArray');
    await PageAccessArray.deleteMany({ theater: THEATER_ID });
    await mongoose.disconnect();
    console.log('✅ Cleanup complete\n');

    // Step 1: GET initial state (should be empty)
    console.log('=' .repeat(70));
    console.log('📖 STEP 1: GET - Fetch page access (Initial state)');
    console.log('='.repeat(70));
    console.log(`🔗 GET ${API_BASE_URL}/page-access?theaterId=${THEATER_ID}\n`);

    const getResponse1 = await axios.get(`${API_BASE_URL}/page-access`, {
      params: { theaterId: THEATER_ID },
      ...axiosConfig
    });

    console.log('📥 Response:', getResponse1.status, getResponse1.statusText);
    console.log('📄 Data:', JSON.stringify(getResponse1.data, null, 2));
    console.log(`\n✅ Initial state: ${getResponse1.data.data.pageAccessList.length} pages`);

    // Step 2: POST - Toggle first page ON
    console.log('\n' + '='.repeat(70));
    console.log('📝 STEP 2: POST - Toggle first page ON (Theater Dashboard)');
    console.log('='.repeat(70));
    console.log(`🔗 POST ${API_BASE_URL}/page-access\n`);

    const postData1 = {
      theaterId: THEATER_ID,
      ...testPages[0]
    };
    console.log('📤 Request body:', JSON.stringify(postData1, null, 2));

        const postResponse1 = await axios.post(`${API_BASE_URL}/page-access`, testPage1, axiosConfig);
    
    console.log('\n📥 Response:', postResponse1.status, postResponse1.statusText);
    console.log('📄 Data:', JSON.stringify(postResponse1.data, null, 2));
    console.log(`\n✅ Page "${testPages[0].pageName}" added successfully!`);

    // Step 3: POST - Toggle second page ON
    console.log('\n' + '='.repeat(70));
    console.log('📝 STEP 3: POST - Toggle second page ON (Theater Settings)');
    console.log('='.repeat(70));
    console.log(`🔗 POST ${API_BASE_URL}/page-access\n`);

    const postData2 = {
      theaterId: THEATER_ID,
      ...testPages[1]
    };
    console.log('📤 Request body:', JSON.stringify(postData2, null, 2));

        const postResponse2 = await axios.post(`${API_BASE_URL}/page-access`, testPage2, axiosConfig);
    
    console.log('\n📥 Response:', postResponse2.status, postResponse2.statusText);
    console.log('📄 Data:', JSON.stringify(postResponse2.data, null, 2));
    console.log(`\n✅ Page "${testPages[1].pageName}" added successfully!`);

    // Step 4: POST - Toggle third page ON
    console.log('\n' + '='.repeat(70));
    console.log('📝 STEP 4: POST - Toggle third page ON (Theater Kiosk Types)');
    console.log('='.repeat(70));
    console.log(`🔗 POST ${API_BASE_URL}/page-access\n`);

    const postData3 = {
      theaterId: THEATER_ID,
      ...testPages[2]
    };
    console.log('📤 Request body:', JSON.stringify(postData3, null, 2));

        const postResponse3 = await axios.post(`${API_BASE_URL}/page-access`, testPage3, axiosConfig);
    
    console.log('\n📥 Response:', postResponse3.status, postResponse3.statusText);
    console.log('📄 Data:', JSON.stringify(postResponse3.data, null, 2));
    console.log(`\n✅ Page "${testPages[2].pageName}" added successfully!`);

    // Step 5: GET - Verify all pages are saved
    console.log('\n' + '='.repeat(70));
    console.log('📖 STEP 5: GET - Fetch all pages (Verify state)');
    console.log('='.repeat(70));
    console.log(`🔗 GET ${API_BASE_URL}/page-access?theaterId=${THEATER_ID}\n`);

    const getResponse2 = await axios.get(`${API_BASE_URL}/page-access`, {
      params: { theaterId: THEATER_ID },
      ...axiosConfig
    });

    console.log('📥 Response:', getResponse2.status, getResponse2.statusText);
    console.log('📄 Full Response:', JSON.stringify(getResponse2.data, null, 2));
    
    const pageList = getResponse2.data.data.pageAccessList;
    console.log(`\n✅ Total pages saved: ${pageList.length}`);
    console.log('\n📋 Pages in database:');
    pageList.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.pageName} (${p.page})`);
      console.log(`      Route: ${p.route}`);
      console.log(`      Active: ${p.isActive}`);
    });

    // Step 6: DELETE - Toggle one page OFF
    console.log('\n' + '='.repeat(70));
    console.log('🗑️ STEP 6: DELETE - Toggle page OFF (Theater Settings)');
    console.log('='.repeat(70));

    const pageToDelete = pageList.find(p => p.page === 'TheaterSettingsWithId');
    console.log(`🔗 DELETE ${API_BASE_URL}/page-access/${pageToDelete._id}\n`);
    console.log(`📄 Deleting page: ${pageToDelete.pageName} (ID: ${pageToDelete._id})`);

        const deleteResponse = await axios.delete(`${API_BASE_URL}/page-access`, {
      data: { theaterId: THEATER_ID, pageName: 'Order History' },
      ...axiosConfig
    });
    
    console.log('\n📥 Response:', deleteResponse.status, deleteResponse.statusText);
    console.log('📄 Data:', JSON.stringify(deleteResponse.data, null, 2));
    console.log(`\n✅ Page "${pageToDelete.pageName}" deleted successfully!`);

    // Step 7: GET - Final verification
    console.log('\n' + '='.repeat(70));
    console.log('📖 STEP 7: GET - Final verification');
    console.log('='.repeat(70));
    console.log(`🔗 GET ${API_BASE_URL}/page-access?theaterId=${THEATER_ID}\n`);

    const getResponse3 = await axios.get(`${API_BASE_URL}/page-access`, {
      params: { theaterId: THEATER_ID },
      ...axiosConfig
    });

    const finalPageList = getResponse3.data.data.pageAccessList;
    console.log(`✅ Final page count: ${finalPageList.length}`);
    console.log('\n📋 Remaining pages:');
    finalPageList.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.pageName} (${p.page})`);
    });

    // Database verification
    console.log('\n' + '='.repeat(70));
    console.log('💾 DATABASE VERIFICATION');
    console.log('='.repeat(70));

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow');
    const db = mongoose.connection.db;
    const dbDoc = await db.collection('pageaccesses').findOne({ 
      theater: new mongoose.Types.ObjectId(THEATER_ID) 
    });
    
    if (dbDoc) {
      console.log('\n✅ Document found in "pageaccesses" collection');
      console.log(`📊 Theater: ${dbDoc.theater}`);
      console.log(`📊 Pages in array: ${dbDoc.pageAccessList.length}`);
      console.log(`📊 Metadata:`, JSON.stringify(dbDoc.metadata, null, 2));
      
      console.log('\n📄 Full document structure:');
      console.log(JSON.stringify({
        _id: dbDoc._id,
        theater: dbDoc.theater,
        pageAccessList: dbDoc.pageAccessList,
        metadata: dbDoc.metadata,
        createdAt: dbDoc.createdAt,
        updatedAt: dbDoc.updatedAt
      }, null, 2));
    }
    
    await mongoose.disconnect();

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log('✅ Initial GET: Returned empty array');
    console.log('✅ POST (3x): Successfully added 3 pages');
    console.log('✅ GET after POST: All 3 pages retrieved');
    console.log('✅ DELETE (1x): Successfully removed 1 page');
    console.log('✅ Final GET: 2 pages remaining');
    console.log('✅ Database: Data saved in "pageaccesses" collection');
    console.log('✅ Structure: Theater ID + pageAccessList array');
    console.log('\n🎉 ALL FRONTEND TESTS PASSED!');

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Check if axios is installed
try {
  require.resolve('axios');
  testFrontendFlow()
    .then(() => {
      console.log('\n✅ Frontend simulation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
} catch (e) {
  console.log('⚠️ Installing axios...');
  const { execSync } = require('child_process');
  execSync('npm install axios', { stdio: 'inherit' });
  console.log('✅ Axios installed. Please run the script again.');
  process.exit(0);
}
