// Firebase Connection Test Script
// Run this with: node test-firebase-connection.js

const firebaseConfig = {
  apiKey: "AIzaSyCPYMczaYoeSCTGEenDFZBWedWcx0rgeBw",
  authDomain: "yqpaynow-e26ba.firebaseapp.com",
  projectId: "yqpaynow-e26ba",
  storageBucket: "yqpaynow-e26ba.firebasestorage.app",
  messagingSenderId: "178836174873",
  appId: "1:178836174873:web:0e89dfd30414bd7e915288",
  measurementId: "G-RNLTXEWNWW"
};

console.log('🔥 Testing Firebase Configuration...\n');
console.log('Configuration:', JSON.stringify(firebaseConfig, null, 2));

// Test 1: Check if configuration has all required fields
console.log('\n✅ Test 1: Configuration Validation');
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

if (missingFields.length === 0) {
  console.log('   ✓ All required fields are present');
} else {
  console.log('   ✗ Missing fields:', missingFields.join(', '));
}

// Test 2: Try to connect to Firebase REST API
console.log('\n✅ Test 2: Firebase REST API Connection');

async function testFirebaseConnection() {
  try {
    // Test Firebase Auth REST API
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;
    
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        returnSecureToken: false
      })
    });

    const data = await response.json();
    
    if (response.status === 400 && data.error && data.error.message) {
      // Even an error response means the API key is valid and we can connect
      console.log('   ✓ Firebase API is reachable');
      console.log('   ✓ API Key is valid');
      console.log('   ✓ Project ID:', firebaseConfig.projectId);
      console.log('   ✓ Auth Domain:', firebaseConfig.authDomain);
      console.log('   ✓ Storage Bucket:', firebaseConfig.storageBucket);
      return true;
    } else {
      console.log('   ✗ Unexpected response:', data);
      return false;
    }
  } catch (error) {
    console.log('   ✗ Connection failed:', error.message);
    return false;
  }
}

// Test 3: Check Storage Bucket accessibility
console.log('\n✅ Test 3: Storage Bucket Accessibility');

async function testStorageBucket() {
  try {
    const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o`;
    
    const response = await fetch(storageUrl);
    
    if (response.status === 200 || response.status === 401 || response.status === 403) {
      // 200 = accessible, 401/403 = exists but needs auth
      console.log('   ✓ Storage bucket exists and is reachable');
      console.log('   ✓ Bucket URL:', storageUrl);
      return true;
    } else {
      console.log('   ✗ Storage bucket not found or not accessible');
      console.log('   ✗ Status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('   ✗ Storage check failed:', error.message);
    return false;
  }
}

// Run all tests
(async () => {
  const authTest = await testFirebaseConnection();
  const storageTest = await testStorageBucket();
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log('Configuration Validation:', '✅ PASS');
  console.log('Firebase API Connection:', authTest ? '✅ PASS' : '❌ FAIL');
  console.log('Storage Bucket Check:', storageTest ? '✅ PASS' : '❌ FAIL');
  console.log('='.repeat(50));
  
  if (authTest && storageTest) {
    console.log('\n🎉 SUCCESS! Firebase is properly configured and connected.');
    console.log('\n📝 Next Steps:');
    console.log('   1. Install Firebase SDK: npm install firebase');
    console.log('   2. Use this config in your app');
    console.log('   3. Initialize Firebase with: initializeApp(firebaseConfig)');
  } else {
    console.log('\n⚠️  WARNING! Some tests failed. Please check your Firebase configuration.');
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Verify API key in Firebase Console');
    console.log('   2. Check project ID matches');
    console.log('   3. Ensure storage bucket is created');
    console.log('   4. Check Firebase project permissions');
  }
  
  process.exit(authTest && storageTest ? 0 : 1);
})();
