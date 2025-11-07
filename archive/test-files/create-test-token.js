/**
 * Create test auth token for API testing
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Create a super admin token
const payload = {
  userId: '507f1f77bcf86cd799439011', // Fake admin ID
  role: 'super_admin',
  email: 'admin@test.com'
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

console.log('🔐 Test Authentication Token:');
console.log('='.repeat(70));
console.log(token);
console.log('='.repeat(70));
console.log('\n📋 Token Payload:', payload);
console.log('⏰ Expires in: 24 hours');
console.log('\n💡 Use this token in Authorization header:');
console.log(`   Authorization: Bearer ${token}`);
console.log('\n📝 Save this to use in test-frontend-api.js');
