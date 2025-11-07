// Auto-set authentication token for testing
console.log('🔧 Auto-setting authentication token...');

const freshToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZDY0ZTliMzE0NWE0NWUzN2ZiMGUyMyIsInVzZXJUeXBlIjoidGhlYXRlcl91c2VyIiwidGhlYXRlciI6IjY4ZDM3ZWE2NzY3NTJiODM5OTUyYWY4MSIsInRoZWF0ZXJJZCI6IjY4ZDM3ZWE2NzY3NTJiODM5OTUyYWY4MSIsInBlcm1pc3Npb25zIjpbXSwiaWF0IjoxNzU5Mjk3NDc4LCJleHAiOjE3NTkzODM4Nzh9.W70K7iR9R3w3pAFlnrlYxOp-wD2KCLZoAAVcesi6dFA";

localStorage.setItem('authToken', freshToken);
console.log('✅ Auth token set successfully!');

// Test API call
async function testStockAPI() {
  try {
    const response = await fetch('http://localhost:5000/api/theater-stock/68d37ea676752b839952af81/68dc50016bd18d627dc2bc42', {
      headers: {
        'Authorization': `Bearer ${freshToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('✅ API Test Result:', data);
    
    // Reload the current page
    setTimeout(() => {
      console.log('🔄 Reloading page...');
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('❌ API Test Error:', error);
  }
}

testStockAPI();