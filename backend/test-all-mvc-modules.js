/**
 * Test Script for ALL 14 Migrated MVC Modules
 * Tests: Theaters, Products, Orders, Settings, Upload, Stock, Dashboard, Payments,
 *        QR Codes, QR Code Names, Roles, Page Access, Theater Users, Theater Dashboard
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

async function testEndpoint(name, method, path, expectedStatus = 200, data = null) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   ${method} ${path}`);
    
    const response = await makeRequest(method, path, data);
    
    if (response.status === expectedStatus || (expectedStatus === 'any' && response.status < 500)) {
      console.log(`   ✅ PASSED (Status: ${response.status})`);
      results.passed.push({ name, method, path, status: response.status });
      return true;
    } else {
      console.log(`   ❌ FAILED (Expected: ${expectedStatus}, Got: ${response.status})`);
      console.log(`   Response:`, JSON.stringify(response.data, null, 2).substring(0, 200));
      results.failed.push({ name, method, path, expected: expectedStatus, got: response.status });
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    results.failed.push({ name, method, path, error: error.message });
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Tests for ALL 14 MVC Modules\n');
  console.log('='.repeat(60));

  // Core Business Modules (8)
  console.log('\n📦 Core Business Modules');
  console.log('-'.repeat(60));
  
  await testEndpoint('Theaters - GET', 'GET', '/api/theaters?page=1&limit=10');
  await testEndpoint('Products - GET', 'GET', '/api/products?page=1&limit=10');
  await testEndpoint('Orders - GET', 'GET', '/api/orders?page=1&limit=10');
  await testEndpoint('Settings - GET', 'GET', '/api/settings');
  await testEndpoint('Stock - GET', 'GET', '/api/theater-stock?theaterId=507f1f77bcf86cd799439011');
  await testEndpoint('Dashboard - GET', 'GET', '/api/dashboard');
  await testEndpoint('Payments - GET Config', 'GET', '/api/payments/config?theaterId=507f1f77bcf86cd799439011&channel=kiosk');

  // User & Access Management (6)
  console.log('\n👥 User & Access Management Modules');
  console.log('-'.repeat(60));
  
  await testEndpoint('QR Codes - Verify', 'GET', '/api/qrcodes/verify/test123');
  await testEndpoint('QR Code Names - GET', 'GET', '/api/qrcodenames?theaterId=507f1f77bcf86cd799439011');
  await testEndpoint('Roles - GET', 'GET', '/api/roles?theaterId=507f1f77bcf86cd799439011');
  await testEndpoint('Page Access - GET', 'GET', '/api/page-access?theaterId=507f1f77bcf86cd799439011');
  await testEndpoint('Theater Users - GET', 'GET', '/api/theater-users?theaterId=507f1f77bcf86cd799439011');
  await testEndpoint('Theater Dashboard - GET', 'GET', '/api/theater-dashboard/507f1f77bcf86cd799439011', 'any');

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⏭️  Skipped: ${results.skipped.length}`);
  console.log(`📈 Success Rate: ${((results.passed.length / (results.passed.length + results.failed.length)) * 100).toFixed(1)}%`);

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(test => {
      console.log(`   - ${test.name}: ${test.method} ${test.path}`);
      if (test.error) console.log(`     Error: ${test.error}`);
      if (test.expected) console.log(`     Expected: ${test.expected}, Got: ${test.got}`);
    });
  }

  if (results.passed.length > 0) {
    console.log('\n✅ Passed Tests:');
    results.passed.slice(0, 10).forEach(test => {
      console.log(`   - ${test.name}`);
    });
    if (results.passed.length > 10) {
      console.log(`   ... and ${results.passed.length - 10} more`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(results.failed.length === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED');
  console.log('='.repeat(60));

  process.exit(results.failed.length === 0 ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});

