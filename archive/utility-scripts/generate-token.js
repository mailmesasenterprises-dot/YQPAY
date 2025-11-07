const jwt = require('jsonwebtoken');

// Create a test token
const payload = {
  userId: '68ed25e6962cb3e997acc163',
  username: 'admin',
  role: 'Admin'
};

const secretKey = 'yqpaynow-super-secret-jwt-key-development-only'; // Use the same secret as in your server
const token = jwt.sign(payload, secretKey, { expiresIn: '24h' });

console.log('Generated token:');
console.log(token);