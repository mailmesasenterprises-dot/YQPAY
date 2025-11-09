// Test payment flow with PowerShell
const https = require('http');

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('🧪 Testing Payment Flow\n');
  
  // Step 1: Login
  console.log('📝 Step 1: Login...');
  const loginResult = await makeRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/theater-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'vetri', password: 'Vetri@123' });
  
  if (!loginResult.body.success) {
    console.log('❌ Login failed:', loginResult.body.message);
    return;
  }
  
  const token = loginResult.body.token;
  console.log('✅ Login successful\n');
  
  // Step 2: Create Order
  console.log('📝 Step 2: Creating order...');
  const orderResult = await makeRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/api/orders/theater',
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {
    theaterId: '6910485995ffe942c8fef423',
    items: [{
      productId: '673e7a4fc2e5b14ba463fc7b',
      name: 'Pop Corn',
      quantity: 1,
      unitPrice: 200,
      totalPrice: 200
    }],
    customerInfo: { name: 'Test Customer', phone: '9876543210' },
    paymentMethod: 'card',
    source: 'pos'
  });
  
  if (!orderResult.body.success) {
    console.log('❌ Order failed:', orderResult.body);
    return;
  }
  
  const orderId = orderResult.body.order._id;
  console.log('✅ Order created:', orderId, '\n');
  
  // Step 3: Create Payment Order
  console.log('📝 Step 3: Creating payment order...');
  const paymentResult = await makeRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/api/payments/create-order',
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {
    orderId: orderId,
    paymentMethod: 'card'
  });
  
  console.log('\n💳 Payment Result:');
  console.log(JSON.stringify(paymentResult.body, null, 2));
  
  if (paymentResult.body.success) {
    console.log('\n🎉 SUCCESS! Payment gateway is working!');
    console.log('✅ Razorpay order ID:', paymentResult.body.paymentOrder.orderId);
  } else {
    console.log('\n❌ FAILED:', paymentResult.body.message);
  }
}

test().catch(console.error);
