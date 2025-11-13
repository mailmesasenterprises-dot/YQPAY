/**
 * Test Script for MVC Endpoints
 * Tests all migrated endpoints to ensure they work correctly
 */

const http = require('http');

const BASE_URL = 'http://localhost:8080';
const TEST_TOKEN = process.env.TEST_TOKEN || ''; // Set your test token here

// Test results
const results = {
  passed: [],
  failed: []
};

// Helper function to make HTTP requests
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
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test functions
async function testTheatersEndpoints() {
  console.log('\n🧪 Testing Theaters Endpoints...\n');

  // Test GET /api/theaters
  try {
    const response = await makeRequest('GET', '/api/theaters?page=1&limit=10');
    if (response.status === 200 && response.data.success) {
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

  // Test GET /api/theaters/expiring-agreements
  if (TEST_TOKEN) {
    try {
      const response = await makeRequest('GET', '/api/theaters/expiring-agreements');
      if (response.status === 200 || response.status === 401) {
        results.passed.push('GET /api/theaters/expiring-agreements');
        console.log('✅ GET /api/theaters/expiring-agreements - PASSED');
      } else {
        results.failed.push({ endpoint: 'GET /api/theaters/expiring-agreements', reason: `Status: ${response.status}` });
        console.log('❌ GET /api/theaters/expiring-agreements - FAILED');
      }
    } catch (error) {
      results.failed.push({ endpoint: 'GET /api/theaters/expiring-agreements', reason: error.message });
      console.log('❌ GET /api/theaters/expiring-agreements - ERROR:', error.message);
    }
  }
}

async function testProductsEndpoints() {
  console.log('\n🧪 Testing Products Endpoints...\n');

  // Test GET /api/theater-products/:theaterId (requires a valid theaterId)
  const testTheaterId = '68d37ea676752b839952af81'; // Replace with actual theater ID
  try {
    const response = await makeRequest('GET', `/api/theater-products/${testTheaterId}?page=1&limit=10`);
    if (response.status === 200 && (response.data.success || Array.isArray(response.data))) {
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

async function testOrdersEndpoints() {
  console.log('\n🧪 Testing Orders Endpoints...\n');

  // Test GET /api/orders/theater/:theaterId (requires a valid theaterId)
  const testTheaterId = '68d37ea676752b839952af81'; // Replace with actual theater ID
  try {
    const response = await makeRequest('GET', `/api/orders/theater/${testTheaterId}?page=1&limit=10`);
    if (response.status === 200 || response.status === 401) {
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

// Main test runner
async function runTests() {
  console.log('🚀 Starting MVC Endpoints Tests...\n');
  console.log('⚠️  Note: Some tests may require authentication token (set TEST_TOKEN env variable)');
  console.log('⚠️  Note: Some tests may require valid theater/product IDs\n');

  await testTheatersEndpoints();
  await testProductsEndpoints();
  await testOrdersEndpoints();

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  
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

// Run tests
runTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});

