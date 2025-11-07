/**
 * Test script to verify QR code URL generation
 * This will show exactly what URL will be embedded in new QR codes
 */

require('dotenv').config();

// Simulate the exact logic from singleQRGenerator.js
const DEFAULT_PRODUCTION_URL = 'https://yqpay-78918378061.us-central1.run.app';
const baseUrl = process.env.FRONTEND_URL || DEFAULT_PRODUCTION_URL;

console.log('\n============================================================');
console.log('🧪 QR CODE URL GENERATION TEST');
console.log('============================================================\n');

console.log('📋 Environment Variables:');
console.log(`   FRONTEND_URL: ${process.env.FRONTEND_URL || '(not set)'}\n`);

console.log('🔧 URL Logic:');
console.log(`   DEFAULT_PRODUCTION_URL = '${DEFAULT_PRODUCTION_URL}'`);
console.log(`   baseUrl = process.env.FRONTEND_URL || DEFAULT_PRODUCTION_URL\n`);

console.log('✅ RESULT:');
console.log(`   baseUrl = '${baseUrl}'\n`);

console.log('📝 Example QR Code URLs that will be generated:\n');

const theaterId = '68f8837a541316c6ad54b79f';
const qrName1 = 'Screen - 1';
const qrName2 = 'Screen - 2';
const seat = 'A1';

const url1 = `${baseUrl}/menu/${theaterId}?qrName=${encodeURIComponent(qrName1)}&type=single`;
const url2 = `${baseUrl}/menu/${theaterId}?qrName=${encodeURIComponent(qrName2)}&type=screen&seat=${seat}`;

console.log(`   Single QR: ${url1}`);
console.log(`   Screen QR: ${url2}\n`);

console.log('============================================================');
console.log('🎯 CONCLUSION:');
console.log('============================================================');

if (baseUrl.includes('yqpay-78918378061.us-central1.run.app')) {
  console.log('   ✅ SUCCESS: Using Google Cloud URL');
  console.log('   ✅ QR codes will work on ALL systems');
} else if (baseUrl.includes('192.168') || baseUrl.includes('169.254')) {
  console.log('   ❌ ERROR: Using network IP address');
  console.log('   ❌ QR codes will ONLY work on local network');
} else if (baseUrl.includes('localhost')) {
  console.log('   ❌ ERROR: Using localhost');
  console.log('   ❌ QR codes will ONLY work on this computer');
} else {
  console.log(`   ⚠️  WARNING: Using unknown URL: ${baseUrl}`);
}

console.log('============================================================\n');
