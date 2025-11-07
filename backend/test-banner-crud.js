const mongoose = require('mongoose');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Test configuration
const API_BASE = 'http://localhost:8080/api/theater-banners';
const TEST_THEATER_ID = '68ff8837a541316c6ad54b79f'; // Replace with your theater ID
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with valid token

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testGetBanners() {
  log('\n📋 TEST 1: GET Banners (List)', 'cyan');
  try {
    const response = await fetch(`${API_BASE}/${TEST_THEATER_ID}?page=1&limit=10`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      log('✅ GET Banners - SUCCESS', 'green');
      log(`   Total: ${data.data.statistics.total}, Active: ${data.data.statistics.active}`, 'blue');
      log(`   Banners: ${JSON.stringify(data.data.banners, null, 2)}`, 'blue');
      return data.data.banners;
    } else {
      log(`❌ GET Banners - FAILED: ${data.error}`, 'red');
      return [];
    }
  } catch (error) {
    log(`❌ GET Banners - ERROR: ${error.message}`, 'red');
    return [];
  }
}

async function testCreateBanner() {
  log('\n📝 TEST 2: CREATE Banner (POST)', 'cyan');
  try {
    // Create a test image buffer (1x1 pixel PNG)
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const formData = new FormData();
    formData.append('isActive', 'true');
    formData.append('sortOrder', '0');
    formData.append('image', testImageBuffer, {
      filename: 'test-banner.png',
      contentType: 'image/png'
    });

    const response = await fetch(`${API_BASE}/${TEST_THEATER_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (response.ok) {
      log('✅ CREATE Banner - SUCCESS', 'green');
      log(`   Banner ID: ${data.data.banner._id}`, 'blue');
      log(`   Image URL: ${data.data.banner.imageUrl}`, 'blue');
      return data.data.banner;
    } else {
      log(`❌ CREATE Banner - FAILED: ${data.error}`, 'red');
      log(`   Details: ${JSON.stringify(data.details || data.message, null, 2)}`, 'yellow');
      return null;
    }
  } catch (error) {
    log(`❌ CREATE Banner - ERROR: ${error.message}`, 'red');
    return null;
  }
}

async function testUpdateBanner(bannerId) {
  log('\n✏️ TEST 3: UPDATE Banner (PUT)', 'cyan');
  try {
    const formData = new FormData();
    formData.append('isActive', 'false');

    const response = await fetch(`${API_BASE}/${TEST_THEATER_ID}/${bannerId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (response.ok) {
      log('✅ UPDATE Banner - SUCCESS', 'green');
      log(`   Updated isActive: ${data.data.banner.isActive}`, 'blue');
      return data.data.banner;
    } else {
      log(`❌ UPDATE Banner - FAILED: ${data.error}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ UPDATE Banner - ERROR: ${error.message}`, 'red');
    return null;
  }
}

async function testDeleteBanner(bannerId) {
  log('\n🗑️ TEST 4: DELETE Banner (DELETE)', 'cyan');
  try {
    const response = await fetch(`${API_BASE}/${TEST_THEATER_ID}/${bannerId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      log('✅ DELETE Banner - SUCCESS', 'green');
      return true;
    } else {
      log(`❌ DELETE Banner - FAILED: ${data.error}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ DELETE Banner - ERROR: ${error.message}`, 'red');
    return false;
  }
}

async function runTests() {
  log('═══════════════════════════════════════════', 'cyan');
  log('   THEATER BANNER CRUD OPERATIONS TEST', 'cyan');
  log('═══════════════════════════════════════════', 'cyan');
  
  // Test 1: Get initial banners
  const initialBanners = await testGetBanners();
  
  // Test 2: Create a new banner
  const createdBanner = await testCreateBanner();
  
  if (createdBanner) {
    // Test 3: Update the banner
    await testUpdateBanner(createdBanner._id);
    
    // Test 4: Delete the banner
    await testDeleteBanner(createdBanner._id);
    
    // Verify deletion
    log('\n🔍 Verifying deletion...', 'cyan');
    await testGetBanners();
  }
  
  log('\n═══════════════════════════════════════════', 'cyan');
  log('   TEST SUITE COMPLETED', 'cyan');
  log('═══════════════════════════════════════════\n', 'cyan');
}

// Run tests
runTests().catch(error => {
  log(`\n💥 FATAL ERROR: ${error.message}`, 'red');
  console.error(error);
});
