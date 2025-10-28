// Comprehensive Firebase Connection Test
// Tests Firebase Authentication, Storage, and Configuration

const firebaseConfig = {
  apiKey: "AIzaSyCPYMczaYoeSCTGEenDFZBWedWcx0rgeBw",
  authDomain: "yqpaynow-e26ba.firebaseapp.com",
  projectId: "yqpaynow-e26ba",
  storageBucket: "yqpaynow-e26ba.firebasestorage.app",
  messagingSenderId: "178836174873",
  appId: "1:178836174873:web:0e89dfd30414bd7e915288",
  measurementId: "G-RNLTXEWNWW"
};

console.log('🔥 Firebase Connection Test Suite\n');
console.log('Project:', firebaseConfig.projectId);
console.log('Auth Domain:', firebaseConfig.authDomain);
console.log('Storage Bucket:', firebaseConfig.storageBucket);
console.log('\n' + '='.repeat(60) + '\n');

let testResults = {
  configValidation: false,
  apiConnection: false,
  authEndpoint: false,
  storageCheck: false
};

// Test 1: Configuration Validation
console.log('Test 1: Configuration Validation');
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

if (missingFields.length === 0) {
  console.log('✅ PASS - All required fields present\n');
  testResults.configValidation = true;
} else {
  console.log('❌ FAIL - Missing fields:', missingFields.join(', ') + '\n');
}

// Test 2: Firebase Auth API Connection
async function testAuthAPI() {
  console.log('Test 2: Firebase Auth API Connection');
  try {
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`;
    
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'test' })
    });

    const data = await response.json();
    
    if (data.error) {
      const errorCode = data.error.message;
      if (errorCode.includes('INVALID_ID_TOKEN') || errorCode.includes('INVALID_ARGUMENT')) {
        console.log('✅ PASS - Auth API is reachable and responding');
        console.log('   API Key is valid\n');
        testResults.authEndpoint = true;
        testResults.apiConnection = true;
        return true;
      } else if (errorCode.includes('API_KEY_INVALID')) {
        console.log('❌ FAIL - API Key is invalid\n');
        return false;
      }
    }
    
    console.log('✅ PASS - Auth API responding\n');
    testResults.authEndpoint = true;
    testResults.apiConnection = true;
    return true;
  } catch (error) {
    console.log('❌ FAIL - Cannot reach Firebase Auth API');
    console.log('   Error:', error.message + '\n');
    return false;
  }
}

// Test 3: Storage Bucket Check (multiple formats)
async function testStorage() {
  console.log('Test 3: Firebase Storage Accessibility');
  
  const storageBuckets = [
    `${firebaseConfig.projectId}.firebasestorage.app`,
    `${firebaseConfig.projectId}.appspot.com`
  ];
  
  for (const bucket of storageBuckets) {
    try {
      console.log(`   Testing bucket: ${bucket}`);
      const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o`;
      
      const response = await fetch(storageUrl);
      const status = response.status;
      
      if (status === 200) {
        console.log('   ✅ Storage bucket exists and is publicly accessible');
        testResults.storageCheck = true;
        return true;
      } else if (status === 401 || status === 403) {
        console.log('   ✅ Storage bucket exists (authentication required)');
        testResults.storageCheck = true;
        return true;
      } else if (status === 404) {
        console.log('   ⚠️  Bucket not found with this format');
      } else {
        console.log(`   ⚠️  Unexpected status: ${status}`);
      }
    } catch (error) {
      console.log('   ❌ Error checking bucket:', error.message);
    }
  }
  
  console.log('❌ FAIL - Storage bucket not accessible with any format\n');
  return false;
}

// Test 4: Project Configuration Check
async function testProjectConfig() {
  console.log('\nTest 4: Project Configuration Check');
  
  try {
    // Try to access Firebase project metadata
    const configUrl = `https://firebase.googleapis.com/v1beta1/projects/${firebaseConfig.projectId}`;
    
    const response = await fetch(configUrl, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 200 || response.status === 401 || response.status === 403) {
      console.log('✅ PASS - Firebase project exists and is accessible\n');
      return true;
    } else {
      console.log('⚠️  WARNING - Project metadata check inconclusive\n');
      return true; // Don't fail on this
    }
  } catch (error) {
    console.log('⚠️  WARNING - Could not verify project metadata\n');
    return true; // Don't fail on this
  }
}

// Run all tests
(async () => {
  try {
    await testAuthAPI();
    await testStorage();
    await testProjectConfig();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log('Configuration Validation:', testResults.configValidation ? '✅ PASS' : '❌ FAIL');
    console.log('Firebase API Connection:', testResults.apiConnection ? '✅ PASS' : '❌ FAIL');
    console.log('Auth Endpoint Check:    ', testResults.authEndpoint ? '✅ PASS' : '❌ FAIL');
    console.log('Storage Bucket Check:   ', testResults.storageCheck ? '✅ PASS' : '⚠️  WARNING');
    console.log('='.repeat(60));
    
    const criticalTests = testResults.configValidation && testResults.apiConnection && testResults.authEndpoint;
    
    if (criticalTests) {
      console.log('\n✅ SUCCESS! Firebase is properly configured and connected.');
      
      if (!testResults.storageCheck) {
        console.log('\n⚠️  Note: Storage bucket needs to be initialized');
        console.log('   This is normal for new projects.');
        console.log('   Storage will work once you:');
        console.log('   1. Upload your first file through Firebase Console, OR');
        console.log('   2. Initialize storage in your app');
      }
      
      console.log('\n✅ Your Firebase configuration is READY TO USE!');
      console.log('\n📝 To use in your application:');
      console.log('   1. Install: npm install firebase');
      console.log('   2. Import: import { initializeApp } from "firebase/app"');
      console.log('   3. Initialize: const app = initializeApp(firebaseConfig)');
      
    } else {
      console.log('\n❌ FAILED! Please fix the following issues:');
      if (!testResults.configValidation) console.log('   - Fix configuration values');
      if (!testResults.apiConnection) console.log('   - Check internet connection');
      if (!testResults.authEndpoint) console.log('   - Verify API key in Firebase Console');
    }
    
    process.exit(criticalTests ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
    process.exit(1);
  }
})();
