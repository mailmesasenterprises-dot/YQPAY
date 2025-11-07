# 🧪 Dual Payment Gateway Testing Guide

## 🎯 Testing Overview
This guide provides step-by-step instructions for testing the dual payment gateway implementation with separate APIs for Kiosk/POS and Online orders.

---

## 📋 Prerequisites

### 1. Razorpay Test Account
Create a test account at https://dashboard.razorpay.com

**Test Credentials**:
```
Key ID: rzp_test_xxxxxxxxxxxxx
Key Secret: your_test_secret_key_here
```

### 2. Test Cards
```
Success Card:
  Number: 4111 1111 1111 1111
  CVV: 123
  Expiry: Any future date (e.g., 12/25)

Failure Card:
  Number: 4111 1111 1111 1112
  CVV: 123
  Expiry: Any future date
```

### 3. Test UPI IDs
```
Success: success@razorpay
Failure: failure@razorpay
```

---

## 🔧 Setup Instructions

### Step 1: Configure Payment Gateway for Theater

1. **Login as Super Admin**
   ```
   URL: http://localhost:3000/login
   ```

2. **Navigate to Payment Gateway Settings**
   ```
   URL: http://localhost:3000/payment-gateway-settings
   Or: Dashboard → Payment Gateway Settings
   ```

3. **Select Theater**
   - Choose a theater from dropdown

4. **Configure Kiosk API (Tab 1)**
   - **Razorpay Configuration**:
     - Key ID: `rzp_test_xxxxxxxxxxxxx`
     - Key Secret: `your_test_secret_key_here`
     - Enable: ✅ ON
   - Click **Save Configuration**

5. **Configure Online API (Tab 2)**
   - **Razorpay Configuration**:
     - Key ID: `rzp_test_xxxxxxxxxxxxx` (can be same or different)
     - Key Secret: `your_test_secret_key_here`
     - Enable: ✅ ON
   - Click **Save Configuration**

---

## ✅ Test Cases

### Test Suite 1: Kiosk/POS Payment Flow

#### Test 1.1: Cash Payment (Kiosk - No Gateway)
**Objective**: Verify cash payments work without gateway interaction

**Steps**:
1. Login as Theater User
2. Navigate to POS/Kiosk Order Interface: `/online-pos/:theaterId`
3. Add products to cart
4. Proceed to checkout: `/kiosk-checkout/:theaterId`
5. Enter customer details
6. Navigate to payment: `/kiosk-payment/:theaterId`
7. Select **Cash** payment method
8. Click **Confirm Payment**

**Expected Results**:
- ✅ Order created successfully
- ✅ Payment method: Cash
- ✅ No Razorpay interaction
- ✅ Order appears in order history
- ✅ Success modal displayed

**Verification**:
```bash
# Check transaction log (should not exist for cash)
GET /api/payments/transactions/:theaterId

# Check order in database
GET /api/orders/:orderId
```

#### Test 1.2: Card Payment via Razorpay (Kiosk Channel)
**Objective**: Verify Razorpay card payment with kiosk gateway

**Steps**:
1. Follow steps 1-6 from Test 1.1
2. Select **Credit/Debit Card** payment method
3. Razorpay modal should open automatically
4. Enter test card details:
   - Card Number: `4111 1111 1111 1111`
   - CVV: `123`
   - Expiry: `12/25`
5. Click **Pay**

**Expected Results**:
- ✅ Razorpay modal opens with correct amount
- ✅ Payment successful
- ✅ Signature verification successful
- ✅ Order marked as paid
- ✅ Transaction logged with channel: 'kiosk'
- ✅ Success modal displays Razorpay payment ID

**Verification**:
```bash
# Check gateway config used
GET /api/payments/config/:theaterId/kiosk

# Check transaction created
GET /api/payments/transactions/:theaterId
# Should show: channel='kiosk', provider='razorpay', status='success'

# Check order payment status
GET /api/orders/:orderId
# Should show: paymentStatus='paid', paymentMethod='card'
```

#### Test 1.3: UPI Payment via Razorpay (Kiosk Channel)
**Objective**: Verify Razorpay UPI payment with kiosk gateway

**Steps**:
1. Follow steps 1-6 from Test 1.1
2. Select **UPI** payment method
3. Razorpay modal opens
4. Select UPI payment option
5. Use test UPI ID: `success@razorpay`
6. Confirm payment

**Expected Results**:
- ✅ Razorpay modal opens
- ✅ UPI payment flow initiated
- ✅ Payment successful
- ✅ Transaction logged with channel: 'kiosk', method: 'upi'

---

### Test Suite 2: Online/QR Payment Flow

#### Test 2.1: Customer QR Order - UPI Payment (Online Channel)
**Objective**: Verify online payment with QR order

**Steps**:
1. Scan QR code or navigate to: `/customer/:qrId`
2. Enter phone number and verify OTP
3. Add products to cart
4. Navigate to checkout: `/customer/checkout`
5. Fill customer details
6. Navigate to payment: `/customer/payment`
7. Select **UPI Payment**
8. Click **Pay Now**
9. Razorpay modal opens
10. Use test UPI: `success@razorpay`
11. Confirm payment

**Expected Results**:
- ✅ Gateway config fetched with channel: 'online'
- ✅ Razorpay initialized with correct online API credentials
- ✅ Payment successful
- ✅ Transaction logged with channel: 'online', provider: 'razorpay'
- ✅ Order created with orderType: 'qr_order'
- ✅ Navigate to success page with order details

**Verification**:
```bash
# Check gateway config used
GET /api/payments/config/:theaterId/online

# Verify transaction channel
GET /api/payments/transactions/:theaterId
# Filter by channel='online'

# Check order details
GET /api/orders/:orderId
# Should show: orderType='qr_order', paymentStatus='paid'
```

#### Test 2.2: Customer Card Payment (Online Channel)
**Objective**: Verify card payment through online gateway

**Steps**:
1. Follow steps 1-8 from Test 2.1
2. Select **Credit/Debit Card**
3. Enter test card: `4111 1111 1111 1111`
4. Click **Pay Now**

**Expected Results**:
- ✅ Razorpay modal opens with online gateway config
- ✅ Payment successful
- ✅ Signature verified
- ✅ Transaction channel: 'online'
- ✅ Order completed successfully

---

### Test Suite 3: Gateway Configuration Tests

#### Test 3.1: Gateway Disabled
**Objective**: Verify behavior when gateway is disabled

**Steps**:
1. Super Admin: Disable Razorpay in Payment Settings
2. Attempt card/UPI payment (kiosk or online)

**Expected Results**:
- ✅ Error message: "Payment gateway not configured"
- ✅ Order creation blocked for online payments
- ✅ Cash payment still works for kiosk

#### Test 3.2: Invalid Credentials
**Objective**: Verify error handling with wrong credentials

**Steps**:
1. Super Admin: Enter invalid Key ID/Secret
2. Save configuration
3. Attempt payment

**Expected Results**:
- ✅ Razorpay returns authentication error
- ✅ User sees error message
- ✅ Transaction logged with status: 'failed'

#### Test 3.3: Multiple Theater Testing
**Objective**: Verify each theater uses its own gateway config

**Steps**:
1. Configure Theater A with API Key Set 1
2. Configure Theater B with API Key Set 2
3. Make payment in Theater A
4. Make payment in Theater B

**Expected Results**:
- ✅ Theater A uses Key Set 1
- ✅ Theater B uses Key Set 2
- ✅ No credential crossover
- ✅ Transactions logged with correct theaterId

---

### Test Suite 4: Payment Verification Tests

#### Test 4.1: Signature Verification Success
**Objective**: Verify Razorpay signature is validated correctly

**Steps**:
1. Complete any Razorpay payment
2. Check backend logs

**Expected Results**:
- ✅ Signature verified successfully
- ✅ Payment marked as 'success'
- ✅ Order updated to 'paid'

#### Test 4.2: Signature Verification Failure
**Objective**: Verify tampered signatures are rejected

**Steps**:
1. Use browser dev tools to modify Razorpay response
2. Submit payment verification

**Expected Results**:
- ✅ Signature verification fails
- ✅ Payment marked as 'failed'
- ✅ Order remains 'pending'
- ✅ Error message displayed to user

---

### Test Suite 5: Transaction Logging Tests

#### Test 5.1: Transaction Created on Order
**Objective**: Verify transaction record created

**Steps**:
1. Complete any payment (kiosk or online)
2. Check transaction database

**Expected Results**:
```javascript
{
  gateway: {
    provider: 'razorpay',
    channel: 'kiosk' OR 'online',
    transactionId: 'pay_xxxxxxxxxxxxx'
  },
  order: ObjectId,
  status: 'success',
  amount: 100.00,
  timestamps created
}
```

#### Test 5.2: Failed Payment Logged
**Objective**: Verify failed payments are tracked

**Steps**:
1. Use failure test card: `4111 1111 1111 1112`
2. Complete payment

**Expected Results**:
- ✅ Transaction created with status: 'failed'
- ✅ Error message logged
- ✅ Order status remains 'pending'

---

### Test Suite 6: Statistics & Reporting

#### Test 6.1: Get Channel Statistics
**Objective**: Verify statistics endpoint

**Steps**:
```bash
GET /api/payments/statistics/:theaterId/kiosk
GET /api/payments/statistics/:theaterId/online
```

**Expected Results**:
```javascript
{
  success: true,
  statistics: {
    total: 10,
    success: 8,
    failed: 2,
    successRate: 80
  }
}
```

#### Test 6.2: Transaction History
**Objective**: Verify transaction listing

**Steps**:
```bash
GET /api/payments/transactions/:theaterId?channel=kiosk
GET /api/payments/transactions/:theaterId?channel=online
```

**Expected Results**:
- ✅ Returns paginated transaction list
- ✅ Correct channel filter applied
- ✅ Transaction details complete

---

## 🐛 Common Issues & Troubleshooting

### Issue 1: "Payment gateway not ready"
**Cause**: Razorpay script not loaded
**Solution**: Check network tab, ensure script loads from CDN

### Issue 2: "Payment gateway not configured"
**Cause**: No gateway config in theater settings
**Solution**: Configure gateway in Super Admin panel

### Issue 3: "Signature verification failed"
**Cause**: Wrong Key Secret or tampered response
**Solution**: Double-check credentials in settings

### Issue 4: Wrong channel detected
**Cause**: orderType not set correctly
**Solution**: 
- Kiosk orders: orderType = 'counter' or 'dine_in'
- Online orders: orderType = 'qr_order' or 'online'

---

## 📊 Testing Checklist

### Backend
- [ ] Theater model saves paymentGateway.kiosk config
- [ ] Theater model saves paymentGateway.online config
- [ ] GET /api/payments/config/:theaterId/kiosk returns correct config
- [ ] GET /api/payments/config/:theaterId/online returns correct config
- [ ] POST /api/payments/create-order creates Razorpay order
- [ ] POST /api/payments/verify validates signature
- [ ] PaymentTransaction created for each payment
- [ ] Channel detection works based on orderType

### Frontend - Kiosk
- [ ] Razorpay script loads on KioskPayment page
- [ ] Gateway config fetched with channel='kiosk'
- [ ] Cash payment works without gateway
- [ ] Card payment opens Razorpay modal
- [ ] UPI payment opens Razorpay modal
- [ ] Payment success shows order confirmation
- [ ] Payment failure shows error message

### Frontend - Online
- [ ] Razorpay script loads on CustomerPayment page
- [ ] Gateway config fetched with channel='online'
- [ ] Card payment opens Razorpay modal
- [ ] UPI payment opens Razorpay modal
- [ ] Net Banking option available
- [ ] Payment success navigates to success page
- [ ] Payment failure shows error message

### Super Admin UI
- [ ] Theater dropdown populated
- [ ] Kiosk tab shows configuration form
- [ ] Online tab shows configuration form
- [ ] Razorpay fields: Key ID, Key Secret, Enable toggle
- [ ] PhonePe fields: Merchant ID, Salt Key, Salt Index, Enable toggle
- [ ] Paytm fields: Merchant ID, Merchant Key, Enable toggle
- [ ] Password visibility toggle works
- [ ] Save button updates theater configuration
- [ ] Success/error messages displayed

---

## 🎓 Testing Tips

1. **Use Browser Dev Tools**: Monitor network requests to verify correct API calls
2. **Check Backend Logs**: Look for signature verification and transaction creation logs
3. **Test Edge Cases**: Empty cart, cancelled payments, network failures
4. **Multi-Theater**: Always test with at least 2 theaters to ensure no config crossover
5. **Clear Cache**: Between tests, clear localStorage and cookies

---

## 📝 Test Report Template

```markdown
## Test Execution Report
**Date**: YYYY-MM-DD
**Tester**: Name
**Environment**: Development/Staging/Production

### Test Results
| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 1.1 | Kiosk Cash Payment | ✅ Pass | |
| 1.2 | Kiosk Card Payment | ✅ Pass | |
| 1.3 | Kiosk UPI Payment | ✅ Pass | |
| 2.1 | Online UPI Payment | ✅ Pass | |
| 2.2 | Online Card Payment | ✅ Pass | |
| 3.1 | Gateway Disabled | ✅ Pass | |
| 3.2 | Invalid Credentials | ✅ Pass | |
| 3.3 | Multiple Theaters | ✅ Pass | |

### Issues Found
1. [Issue Description]
   - Severity: High/Medium/Low
   - Steps to Reproduce
   - Expected vs Actual

### Overall Assessment
- Total Tests: 20
- Passed: 18
- Failed: 2
- Pass Rate: 90%

### Recommendations
[List any recommendations for improvement]
```

---

## 🚀 Next Steps After Testing

1. ✅ Fix any issues found during testing
2. ✅ Deploy to staging environment
3. ✅ Conduct UAT (User Acceptance Testing)
4. ⏳ Add PhonePe integration
5. ⏳ Add Paytm integration
6. ⏳ Implement refund functionality
7. ⏳ Add payment analytics dashboard

---

**Generated**: ${new Date().toISOString()}
**Version**: 1.0
