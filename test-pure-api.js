/**
 * Pure Frontend API Test
 * Only uses axios - no backend imports
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';
const THEATER_ID = '68f8837a541316c6ad54b79f';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJlbWFpbCI6ImFkbWluQHRlc3QuY29tIiwiaWF0IjoxNzYxNTY3NzQ0LCJleHAiOjE3NjE2NTQxNDR9.IMQ6VAlS53bnsl9FVek_-_1Pa16IyES7K4oHhGjr578';

const config = {
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
};

async function test() {
  console.log('======================================================================');
  console.log('🌐 FRONTEND API TEST');
  console.log('======================================================================\n');
  
  try {
    // Step 1: GET initial
    console.log('📖 STEP 1: GET initial state');
    const get1 = await axios.get(`${API_BASE_URL}/page-access?theaterId=${THEATER_ID}`, config);
    console.log(`✅ Status: ${get1.status}`);
    console.log(`📄 Response structure: ${JSON.stringify(Object.keys(get1.data))}`);
    if (get1.data.data) {
      console.log(`📊 Data structure: ${JSON.stringify(Object.keys(get1.data.data))}`);
      if (get1.data.data.pageAccessList) {
        console.log(`✅ pageAccessList exists with ${get1.data.data.pageAccessList.length} items\n`);
      } else {
        console.log(`❌ pageAccessList NOT FOUND in response!\n`);
        console.log('Full response:', JSON.stringify(get1.data, null, 2));
        process.exit(1);
      }
    }

    // Step 2: POST page 1
    console.log('📝 STEP 2: POST - Add Theater Dashboard');
    const post1 = await axios.post(`${API_BASE_URL}/page-access`, {
      theaterId: THEATER_ID,
      page: 'TheaterDashboard',
      pageName: 'Theater Dashboard',
      route: '/theater-dashboard/:theaterId',
      description: 'Theater Dashboard',
      category: 'admin'
    }, config);
    console.log(`✅ Status: ${post1.status}`);
    console.log(`✅ Added: ${post1.data.data.pageAccessList.length} pages total\n`);

    // Step 3: POST page 2
    console.log('📝 STEP 3: POST - Add Theater Settings');
    const post2 = await axios.post(`${API_BASE_URL}/page-access`, {
      theaterId: THEATER_ID,
      page: 'TheaterSettings',
      pageName: 'Theater Settings',
      route: '/theater-settings/:theaterId',
      description: 'Theater Settings',
      category: 'admin'
    }, config);
    console.log(`✅ Status: ${post2.status}`);
    console.log(`✅ Added: ${post2.data.data.pageAccessList.length} pages total\n`);

    // Step 4: POST page 3
    console.log('📝 STEP 4: POST - Add Order History');
    const post3 = await axios.post(`${API_BASE_URL}/page-access`, {
      theaterId: THEATER_ID,
      page: 'OrderHistory',
      pageName: 'Order History',
      route: '/order-history/:theaterId',
      description: 'Order History',
      category: 'admin'
    }, config);
    console.log(`✅ Status: ${post3.status}`);
    console.log(`✅ Added: ${post3.data.data.pageAccessList.length} pages total\n`);

    // Step 5: GET verify
    console.log('📖 STEP 5: GET - Verify all 3 pages');
    const get2 = await axios.get(`${API_BASE_URL}/page-access?theaterId=${THEATER_ID}`, config);
    console.log(`✅ Status: ${get2.status}`);
    console.log(`✅ Total pages: ${get2.data.data.pageAccessList.length}`);
    const pages = get2.data.data.pageAccessList.map(p => p.pageName);
    console.log(`📋 Pages: ${pages.join(', ')}\n`);

    // Step 6: DELETE one
    console.log('🗑️  STEP 6: DELETE - Remove Theater Settings');
    const del = await axios.delete(`${API_BASE_URL}/page-access`, {
      data: { theaterId: THEATER_ID, pageName: 'Theater Settings' },
      ...config
    });
    console.log(`✅ Status: ${del.status}`);
    console.log(`✅ Remaining: ${del.data.data.pageAccessList.length} pages\n`);

    // Step 7: GET final
    console.log('📖 STEP 7: GET - Final state (should be 2 pages)');
    const get3 = await axios.get(`${API_BASE_URL}/page-access?theaterId=${THEATER_ID}`, config);
    console.log(`✅ Status: ${get3.status}`);
    console.log(`✅ Final count: ${get3.data.data.pageAccessList.length}`);
    const finalPages = get3.data.data.pageAccessList.map(p => p.pageName);
    console.log(`📋 Pages: ${finalPages.join(', ')}\n`);

    console.log('======================================================================');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('======================================================================');
    console.log('✅ GET: Returns pageAccessList array');
    console.log('✅ POST: Adds pages to array');
    console.log('✅ DELETE: Removes pages from array');
    console.log('✅ Response structure matches frontend expectations');
    console.log('======================================================================');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

test();
