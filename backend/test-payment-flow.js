const fetch = require('node-fetch');

const API_BASE = 'http://localhost:8080/api';
const THEATER_ID = '6910485995ffe942c8fef423';

// Test credentials
const TEST_USER = {
  username: 'vetri',
  password: 'Vetri@123'
};

async function testPaymentFlow() {
  try {
    console.log('🧪 TESTING PAYMENT FLOW\n');
    console.log('='.repeat(60));
    
    // Step 1: Login
    console.log('\n📝 Step 1: Logging in...');
    const loginResponse = await fetch(`${API_BASE}/auth/theater-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER)
    });
    
    const loginData = await loginResponse.json();
    if (!loginData.success) {
      throw new Error('Login failed: ' + loginData.message);
    }
    
    const authToken = loginData.token;
    console.log('✅ Login successful');
    
    // Step 2: Create an order
    console.log('\n📝 Step 2: Creating order...');
    const orderData = {
      theaterId: THEATER_ID,
      items: [{
        productId: '673e7a4fc2e5b14ba463fc7b', // Popcorn product ID
        name: 'Pop Corn',
        quantity: 1,
        unitPrice: 200,
        totalPrice: 200
      }],
      customerInfo: {
        name: 'Test Customer',
        phone: '9876543210'
      },
      paymentMethod: 'card',
      source: 'pos',
      orderNotes: 'Test order for payment gateway'
    };
    
    const orderResponse = await fetch(`${API_BASE}/orders/theater`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(orderData)
    });
    
    const orderResult = await orderResponse.json();
    console.log('📦 Order Response:', JSON.stringify(orderResult, null, 2));
    
    if (!orderResult.success) {
      throw new Error('Order creation failed: ' + (orderResult.message || orderResult.error));
    }
    
    const orderId = orderResult.order._id;
    const orderNumber = orderResult.order.orderNumber;
    console.log(`✅ Order created: ${orderNumber} (ID: ${orderId})`);
    
    // Step 3: Create payment order
    console.log('\n📝 Step 3: Creating payment order...');
    const paymentResponse = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        orderId: orderId,
        paymentMethod: 'card'
      })
    });
    
    const paymentData = await paymentResponse.json();
    console.log('💳 Payment Response:', JSON.stringify(paymentData, null, 2));
    
    if (!paymentData.success) {
      console.log('\n❌ PAYMENT ORDER CREATION FAILED');
      console.log('Error:', paymentData.message);
      console.log('\n🔍 Debugging Info:');
      console.log('- Order ID:', orderId);
      console.log('- Payment Method: card');
      console.log('- Response Status:', paymentResponse.status);
      process.exit(1);
    }
    
    console.log('\n✅ Payment order created successfully!');
    console.log('Payment Order ID:', paymentData.paymentOrder.orderId);
    console.log('Amount:', paymentData.paymentOrder.amount / 100, 'INR');
    console.log('Provider:', paymentData.provider);
    console.log('Channel:', paymentData.channel);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TEST PASSED! Payment gateway is working correctly.');
    console.log('='.repeat(60));
    console.log('\n✅ You can now test in browser:');
    console.log('1. Go to ViewCart page');
    console.log('2. Select Card or UPI payment');
    console.log('3. Click "Confirm Order"');
    console.log('4. Razorpay modal should open!');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testPaymentFlow();
