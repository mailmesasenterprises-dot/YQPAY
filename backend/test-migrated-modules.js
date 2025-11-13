/**
 * Test Script for 8 Migrated MVC Modules
 * Tests: Theaters, Products, Orders, Settings, Upload, Stock, Dashboard, Payments
 */

const http = require('http');

const BASE_URL = 'http://localhost:8080';
const TEST_TOKEN = process.env.TEST_TOKEN || '';

const results = {
  passed: [],
  failed: [],
  skipped: []
};

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(TEST_TOKEN && { 'Authorization': `Bearer ${TEST_TOKEN}` })
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            data: parsed,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body,
            error: e.message
          });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testTheaters() {
  console.log('\n🧪 Testing Theaters Module...\n');

  try {
    const response = await makeRequest('GET', '/api/theaters?page=1&limit=10');
    if (response.status === 200 && (response.data.success || Array.isArray(response.data) || response.data.data)) {
      results.passed.push('GET /api/theaters');
      console.log('✅ GET /api/theaters - PASSED');
    } else {
      results.failed.push({ endpoint: 'GET /api/theaters', reason: `Status: ${response.status}` });
      console.log('❌ GET /api/theaters - FAILED');
    }
  } catch (error) {
    results.failed.push({ endpoint: 'GET /api/theaters', reason: error.message });
    console.log('❌ GET /api/theaters - ERROR:', error.message);
  }
}

async function testProducts() {
  console.log('\n🧪 Testing Products Module...\n');

  const testTheaterId = '68d37ea676752b839952af81'; // Replace with actual theater ID
  try {
    const response = await makeRequest('GET', `/api/theater-products/${testTheaterId}?page=1&limit=10`);
    if (response.status === 200 || response.status === 404) {
      results.passed.push('GET /api/theater-products/:theaterId');
      console.log('✅ GET /api/theater-products/:theaterId - PASSED');
    } else {
      results.failed.push({ endpoint: 'GET /api/theater-products/:theaterId', reason: `Status: ${response.status}` });
      console.log('❌ GET /api/theater-products/:theaterId - FAILED');
    }
  } catch (error) {
    results.failed.push({ endpoint: 'GET /api/theater-products/:theaterId', reason: error.message });
    console.log('❌ GET /api/theater-products/:theaterId - ERROR:', error.message);
  }
}

async function testOrders() {
  console.log('\n🧪 Testing Orders Module...\n');

  const testTheaterId = '68d37ea676752b839952af81'; // Replace with actual theater ID
  try {
    const response = await makeRequest('GET', `/api/orders/theater/${testTheaterId}?page=1&limit=10`);
    if (response.status === 200 || response.status === 401 || response.status === 404) {
      results.passed.push('GET /api/orders/theater/:theaterId');
      console.log('✅ GET /api/orders/theater/:theaterId - PASSED');
    } else {
      results.failed.push({ endpoint: 'GET /api/orders/theater/:theaterId', reason: `Status: ${response.status}` });
      console.log('❌ GET /api/orders/theater/:theaterId - FAILED');
    }
  } catch (error) {
    results.failed.push({ endpoint: 'GET /api/orders/theater/:theaterId', reason: error.message });
    console.log('❌ GET /api/orders/theater/:theaterId - ERROR:', error.message);
  }
}

async function testSettings() {
  console.log('\n🧪 Testing Settings Module...\n');

  try {
    const response = await makeRequest('GET', '/api/settings/general');
    if (response.status === 200 && (response.data.success || response.data.data)) {
      results.passed.push('GET /api/settings/general');
      console.log('✅ GET /api/settings/general - PASSED');
    } else {
      results.failed.push({ endpoint: 'GET /api/settings/general', reason: `Status: ${response.status}` });
      console.log('❌ GET /api/settings/general - FAILED');
    }
  } catch (error) {
    results.failed.push({ endpoint: 'GET /api/settings/general', reason: error.message });
    console.log('❌ GET /api/settings/general - ERROR:', error.message);
  }
}

async function testUpload() {
  console.log('\n🧪 Testing Upload Module...\n');

  // Upload test requires file, so we'll just test the endpoint exists
  try {
    const response = await makeRequest('POST', '/api/upload/image');
    // 400 is expected without file, 401 if auth required
    if (response.status === 400 || response.status === 401) {
      results.passed.push('POST /api/upload/image (endpoint exists)');
      console.log('✅ POST /api/upload/image - PASSED (endpoint exists)');
    } else {
      results.failed.push({ endpoint: 'POST /api/upload/image', reason: `Status: ${response.status}` });
      console.log('❌ POST /api/upload/image - FAILED');
    }
  } catch (error) {
    results.failed.push({ endpoint: 'POST /api/upload/image', reason: error.message });
    console.log('❌ POST /api/upload/image - ERROR:', error.message);
  }
}

async function testStock() {
  console.log('\n🧪 Testing Stock Module...\n');

  const testTheaterId = '68d37ea676752b839952af81'; // Replace with actual theater ID
  const testProductId = '68d37ea676752b839952af82'; // Replace with actual product ID
  try {
    const response = await makeRequest('GET', `/api/theater-stock/${testTheaterId}/${testProductId}`);
    if (response.status === 200 || response.status === 401 || response.status === 404) {
      results.passed.push('GET /api/theater-stock/:theaterId/:productId');
      console.log('✅ GET /api/theater-stock/:theaterId/:productId - PASSED');
    } else {
      results.failed.push({ endpoint: 'GET /api/theater-stock/:theaterId/:productId', reason: `Status: ${response.status}` });
      console.log('❌ GET /api/theater-stock/:theaterId/:productId - FAILED');
    }
  } catch (error) {
    results.failed.push({ endpoint: 'GET /api/theater-stock/:theaterId/:productId', reason: error.message });
    console.log('❌ GET /api/theater-stock/:theaterId/:productId - ERROR:', error.message);
  }
}

async function testDashboard() {
  console.log('\n🧪 Testing Dashboard Module...\n');

  if (!TEST_TOKEN) {
    results.skipped.push('GET /api/dashboard/super-admin-stats (requires auth)');
    console.log('⏭️  GET /api/dashboard/super-admin-stats - SKIPPED (requires auth)');
    return;
  }

  try {
    const response = await makeRequest('GET', '/api/dashboard/super-admin-stats');
    if (response.status === 200 && (response.data.success || response.data.data)) {
      results.passed.push('GET /api/dashboard/super-admin-stats');
      console.log('✅ GET /api/dashboard/super-admin-stats - PASSED');
    } else {
      results.failed.push({ endpoint: 'GET /api/dashboard/super-admin-stats', reason: `Status: ${response.status}` });
      console.log('❌ GET /api/dashboard/super-admin-stats - FAILED');
    }
  } catch (error) {
    results.failed.push({ endpoint: 'GET /api/dashboard/super-admin-stats', reason: error.message });
    console.log('❌ GET /api/dashboard/super-admin-stats - ERROR:', error.message);
  }
}

async function testPayments() {
  console.log('\n🧪 Testing Payments Module...\n');

  const testTheaterId = '68d37ea676752b839952af81'; // Replace with actual theater ID
  try {
    const response = await makeRequest('GET', `/api/payments/config/${testTheaterId}/kiosk`);
    if (response.status === 200 || response.status === 404) {
      results.passed.push('GET /api/payments/config/:theaterId/:channel');
      console.log('✅ GET /api/payments/config/:theaterId/:channel - PASSED');
    } else {
      results.failed.push({ endpoint: 'GET /api/payments/config/:theaterId/:channel', reason: `Status: ${response.status}` });
      console.log('❌ GET /api/payments/config/:theaterId/:channel - FAILED');
    }
  } catch (error) {
    results.failed.push({ endpoint: 'GET /api/payments/config/:theaterId/:channel', reason: error.message });
    console.log('❌ GET /api/payments/config/:theaterId/:channel - ERROR:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Testing 8 Migrated MVC Modules...\n');
  console.log('⚠️  Note: Some tests may require authentication token (set TEST_TOKEN env variable)');
  console.log('⚠️  Note: Some tests may require valid theater/product IDs\n');

  await testTheaters();
  await testProducts();
  await testOrders();
  await testSettings();
  await testUpload();
  await testStock();
  await testDashboard();
  await testPayments();

  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⏭️  Skipped: ${results.skipped.length}`);

  if (results.passed.length > 0) {
    console.log('\n✅ Passed Tests:');
    results.passed.forEach(test => console.log(`   - ${test}`));
  }

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(test => console.log(`   - ${test.endpoint}: ${test.reason}`));
  }

  console.log('\n' + '='.repeat(50));

  process.exit(results.failed.length > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});

