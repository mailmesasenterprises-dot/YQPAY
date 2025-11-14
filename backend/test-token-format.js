/**
 * Test JWT Token Format
 * This will help identify malformed token issues
 */

const jwt = require('jsonwebtoken');

console.log('🔍 Testing JWT Token Format\n');
console.log('='.repeat(70));

// Test token from command line
const testToken = process.argv[2];

if (!testToken) {
  console.log('⚠️  No token provided');
  console.log('\n📝 Usage:');
  console.log('   node test-token-format.js YOUR_JWT_TOKEN');
  console.log('\n💡 To get a token:');
  console.log('   1. Login via frontend or API');
  console.log('   2. Copy token from browser localStorage (authToken)');
  console.log('   3. Run: node test-token-format.js YOUR_TOKEN');
  console.log('\n🔍 Testing token format validation...\n');
  
  // Test with a sample token structure
  const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGQzN2U5MDM1NGVkNTY2ZTA4NTVhYjkiLCJ1c2VybmFtZSI6InN1cGVyYWRtaW4iLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJ1c2VyVHlwZSI6InN1cGVyX2FkbWluIiwiaWF0IjoxNzU5Mzg4MTgwLCJleHAiOjE3NTk0NzQ1ODB9.invalid';
  console.log('📋 Sample token structure:');
  console.log('   Format: HEADER.PAYLOAD.SIGNATURE');
  console.log('   Parts:', sampleToken.split('.').length);
  console.log('\n💡 Common issues:');
  console.log('   1. Token has extra spaces or quotes');
  console.log('   2. Token is truncated or incomplete');
  console.log('   3. Token has newlines or special characters');
  console.log('   4. Token is wrapped in JSON string');
  process.exit(0);
}

console.log('📋 Token Analysis:');
console.log('   Length:', testToken.length);
console.log('   Parts:', testToken.split('.').length, '(should be 3)');
console.log('   Starts with:', testToken.substring(0, 20) + '...');
console.log('   Ends with:', '...' + testToken.substring(testToken.length - 20));
console.log('');

// Check for common issues
const issues = [];
if (testToken.includes(' ')) {
  issues.push('❌ Contains spaces');
}
if (testToken.includes('"')) {
  issues.push('❌ Contains quotes (might be JSON string)');
}
if (testToken.includes('\n')) {
  issues.push('❌ Contains newlines');
}
if (testToken.split('.').length !== 3) {
  issues.push(`❌ Invalid format (${testToken.split('.').length} parts instead of 3)`);
}
if (testToken.trim() !== testToken) {
  issues.push('❌ Has leading/trailing whitespace');
}

if (issues.length > 0) {
  console.log('⚠️  Token Format Issues:');
  issues.forEach(issue => console.log('   ' + issue));
  console.log('');
  console.log('💡 Fix:');
  console.log('   1. Remove quotes if token is wrapped in JSON');
  console.log('   2. Trim whitespace: token.trim()');
  console.log('   3. Ensure token has exactly 3 parts separated by dots');
  console.log('');
}

// Try to decode
try {
  // Clean token
  const cleanToken = testToken.trim().replace(/^["']|["']$/g, '');
  
  console.log('🔍 Attempting to verify token...');
  const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET || 'yqpaynow-super-secret-jwt-key-development-only');
  
  console.log('✅ Token is valid!');
  console.log('\n📊 Decoded Token:');
  console.log('   User ID:', decoded.userId);
  console.log('   Username:', decoded.username);
  console.log('   Role:', decoded.role);
  console.log('   User Type:', decoded.userType);
  console.log('   Theater ID:', decoded.theaterId || 'N/A');
  console.log('   Issued At:', new Date(decoded.iat * 1000).toLocaleString());
  console.log('   Expires At:', new Date(decoded.exp * 1000).toLocaleString());
  
  const now = Date.now() / 1000;
  if (decoded.exp < now) {
    console.log('\n⚠️  Token is EXPIRED!');
    console.log('   Expired:', Math.round((now - decoded.exp) / 60), 'minutes ago');
  } else {
    console.log('\n✅ Token is still valid');
    console.log('   Expires in:', Math.round((decoded.exp - now) / 60), 'minutes');
  }
  
} catch (error) {
  console.error('❌ Token verification failed!');
  console.error('   Error:', error.name);
  console.error('   Message:', error.message);
  console.log('');
  
  if (error.name === 'JsonWebTokenError') {
    if (error.message.includes('malformed')) {
      console.log('🔍 Malformed Token Issues:');
      console.log('   1. Check if token has exactly 3 parts (header.payload.signature)');
      console.log('   2. Check if token has extra characters (spaces, quotes, newlines)');
      console.log('   3. Check if token is truncated');
      console.log('   4. Check if token is wrapped in JSON string');
      console.log('');
      console.log('💡 Common fixes:');
      console.log('   - Remove quotes: token.replace(/^["\']|["\']$/g, "")');
      console.log('   - Trim whitespace: token.trim()');
      console.log('   - Check localStorage value directly in browser console');
    } else if (error.message.includes('invalid signature')) {
      console.log('🔍 Invalid Signature:');
      console.log('   - Token was signed with different JWT_SECRET');
      console.log('   - Check backend .env file for JWT_SECRET');
      console.log('   - Ensure frontend and backend use same secret');
    }
  } else if (error.name === 'TokenExpiredError') {
    console.log('⚠️  Token is EXPIRED!');
    console.log('   Solution: Login again to get a new token');
  }
}

