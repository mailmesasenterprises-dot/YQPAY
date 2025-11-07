/**
 * Quick Test: Verify JWT Token Contains UserType
 * 
 * Run this in the browser console after logging in to verify the fix
 */

console.log('🔍 Checking JWT Token Structure...\n');

const token = localStorage.getItem('authToken');

if (!token) {
  console.log('❌ No auth token found. Please login first.');
} else {
  console.log('✅ Token found!\n');
  
  // Decode JWT (split at dots and decode base64)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.log('❌ Invalid token format');
  } else {
    const payload = JSON.parse(atob(parts[1]));
    
    console.log('📦 Token Payload:');
    console.log('================');
    console.log(`   User ID: ${payload.userId}`);
    console.log(`   Username: ${payload.username}`);
    console.log(`   Role: ${payload.role}`);
    console.log(`   UserType: ${payload.userType || '❌ MISSING!'}`);
    console.log(`   Theater ID: ${payload.theaterId}`);
    console.log('');
    
    // Check if userType exists
    if (payload.userType) {
      console.log(`✅ UserType field EXISTS: "${payload.userType}"`);
      console.log('');
      
      if (payload.userType === 'theater_admin') {
        console.log('🎭 THEATER ADMIN detected!');
        console.log('   → Should see ALL orders in order history');
      } else if (payload.userType === 'theater_user') {
        console.log('👤 THEATER USER detected!');
        console.log('   → Should see ONLY own orders in order history');
      } else if (payload.userType === 'super_admin' || payload.userType === 'admin') {
        console.log('👑 SUPER ADMIN detected!');
        console.log('   → Should see ALL orders across ALL theaters');
      }
    } else {
      console.log('❌ UserType field is MISSING!');
      console.log('   → This means you need to logout and login again');
      console.log('   → Old tokens don\'t have userType field');
      console.log('');
      console.log('⚠️  TO FIX:');
      console.log('   1. Logout from the application');
      console.log('   2. Login again');
      console.log('   3. Run this script again to verify');
    }
  }
}

console.log('\n========================================');
console.log('Copy this script and paste in browser console (F12)');
console.log('========================================');
