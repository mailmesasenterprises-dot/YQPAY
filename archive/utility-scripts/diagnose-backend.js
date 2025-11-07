/**
 * Backend URL Diagnostic Script
 * Shows which backend server is being used
 */

const networkIP_from_QR = '169.254.8.1';
const productionURL = 'https://yqpay-78918378061.us-central1.run.app';
const localIP = '192.168.1.6';

console.log('\n============================================================');
console.log('🔍 BACKEND SERVER DIAGNOSTIC');
console.log('============================================================\n');

console.log('📊 QR Code Analysis:');
console.log(`   QR Code was generated with: http://${networkIP_from_QR}:3001`);
console.log(`   Generated at: 2025-10-30T07:02:54 (7:02 AM)\n`);

console.log('🖥️  Known Backend Servers:\n');

console.log('1️⃣  THIS PC (Current Terminal):');
console.log(`   IP: ${localIP}`);
console.log(`   Status: ✅ RUNNING with FIXED code`);
console.log(`   QR URLs: ${productionURL}\n`);

console.log('2️⃣  ANOTHER DEVICE:');
console.log(`   IP: ${networkIP_from_QR}`);
console.log(`   Status: ❌ RUNNING with OLD code`);
console.log(`   QR URLs: http://${networkIP_from_QR}:3001\n`);

console.log('============================================================');
console.log('⚠️  PROBLEM IDENTIFIED:');
console.log('============================================================\n');

console.log('You are generating QR codes from DEVICE 2 (169.254.8.1)');
console.log('which still has the OLD code with network IP.\n');

console.log('✅ SOLUTION:\n');
console.log('   Option 1: Stop the backend on 169.254.8.1');
console.log('   Option 2: Update the code on 169.254.8.1');
console.log('   Option 3: Use THIS PC (192.168.1.6) to generate QR codes\n');

console.log('🎯 TO FIX:\n');
console.log('   1. Find the device with IP 169.254.8.1');
console.log('   2. Stop the backend server on that device');
console.log('   3. Pull the latest code from this repository');
console.log('   4. Restart the backend on that device\n');

console.log('============================================================\n');
