// Quick Banner Test - Run in Browser Console
// Copy and paste this entire code into your browser console on the banner page

(async function testBannerCRUD() {
  console.log('🧪 Starting Banner CRUD Test...\n');
  
  const token = localStorage.getItem('authToken');
  const theaterId = window.location.pathname.split('/')[2];
  const baseUrl = `http://localhost:8080/api/theater-banners`;
  
  console.log('📋 Theater ID:', theaterId);
  console.log('🔑 Token:', token ? 'Found ✅' : 'Missing ❌');
  
  // Test 1: GET Banners
  console.log('\n1️⃣ Testing GET (List Banners)...');
  try {
    const response = await fetch(`${baseUrl}/${theaterId}?page=1&limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ GET Success!');
      console.log('   Statistics:', data.data.statistics);
      console.log('   Banners:', data.data.banners.length);
    } else {
      console.error('❌ GET Failed:', response.status, data);
    }
  } catch (error) {
    console.error('❌ GET Error:', error.message);
  }
  
  // Test 2: CREATE Banner (with test image)
  console.log('\n2️⃣ Testing POST (Create Banner)...');
  console.log('⚠️ You need to click "CREATE NEW BANNER" button and upload an image');
  console.log('   The CREATE operation requires a real image file from the UI');
  
  // Instructions
  console.log('\n📝 To test CREATE:');
  console.log('   1. Click the purple "CREATE NEW BANNER" button');
  console.log('   2. Upload any image file');
  console.log('   3. Click "CREATE BANNER"');
  console.log('   4. Check if banner appears in the table');
  
  console.log('\n✅ If the table shows your new banner, CREATE is working!');
  console.log('\n🎉 Banner system test complete!');
})();
