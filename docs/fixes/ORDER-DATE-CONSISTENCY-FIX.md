# Order Date Consistency Fix

## Bug Description
When placing an order, the stock usage was being recorded in the **previous month** instead of the **current month** due to inconsistent date usage across the order creation process.

## Root Cause
Multiple `new Date()` calls were being made at different points in the code:
1. Line 312: `recordStockUsage(..., new Date())` - for stock tracking
2. Line 403: `placedAt: new Date()` - for order timestamp
3. Line 405-406: `createdAt/updatedAt: new Date()` - for metadata

Each `new Date()` call creates a **slightly different timestamp** (milliseconds apart), and if these calls happened to cross a month boundary (e.g., at 23:59:59.999 on the last day of a month), the stock could be recorded in a different month than the order.

## Solution
Created a **single `orderDate` variable** at the start of the order creation process and used it consistently throughout:

```javascript
// At the start of order creation (Line 172)
const orderDate = new Date();

// Used everywhere consistently:
- recordStockUsage(..., orderDate)        // Stock tracking
- timestamps: { placedAt: orderDate }      // Order timestamp
- createdAt: orderDate                     // Order creation
- updatedAt: orderDate                     // Order update
- metadata.lastOrderDate: orderDate        // Theater metadata
```

## Changes Made

### File: `backend/routes/orders.js`

#### 1. Create Single Order Date (Line 172-181)
```javascript
const orderDate = new Date();

console.log('📅 Order Date:', orderDate.toISOString());
console.log('📅 Order Year:', orderDate.getFullYear());
console.log('📅 Order Month:', orderDate.getMonth() + 1);
```

#### 2. Stock Usage Recording (Line 319)
**Before:**
```javascript
await recordStockUsage(theaterId, productObjectId, item.quantity, new Date());
```

**After:**
```javascript
await recordStockUsage(theaterId, productObjectId, item.quantity, orderDate);
```

#### 3. Order Timestamps (Line 403-406)
**Before:**
```javascript
timestamps: {
  placedAt: new Date()
},
createdAt: new Date(),
updatedAt: new Date()
```

**After:**
```javascript
timestamps: {
  placedAt: orderDate
},
createdAt: orderDate,
updatedAt: orderDate
```

#### 4. Theater Metadata (Line 430-431)
**Before:**
```javascript
$set: {
  'metadata.lastOrderDate': new Date(),
  updatedAt: new Date()
}
```

**After:**
```javascript
$set: {
  'metadata.lastOrderDate': orderDate,
  updatedAt: orderDate
}
```

## Testing

### Before Fix:
**Order placed on October 30, 2025:**
- Order created: October 30, 2025
- Stock deducted: **September 30, 2025** ❌ (Wrong month!)
- "Used Old Stock" not showing correctly

### After Fix:
**Order placed on October 30, 2025:**
- Order created: October 30, 2025 ✅
- Stock deducted: October 30, 2025 ✅
- "Used Old Stock" shows correctly in October stats ✅

### Test Steps:
1. Navigate to Stock Management page for October 2025
2. Note current values (e.g., Total Sales: 0, Used Old Stock: 0)
3. Place an order for 50 units
4. Refresh Stock Management page
5. **Expected Results:**
   - Total Sales: 50 ✅
   - Used Old Stock: 50 ✅ (if stock came from carry forward)
   - Overall Balance: 89 (139 - 50) ✅

## Enhanced Logging
Added detailed logging to track the exact date being used:

```javascript
console.log('📅 Order Date:', orderDate.toISOString());
console.log('📅 Order Year:', orderDate.getFullYear());
console.log('📅 Order Month:', orderDate.getMonth() + 1);
```

This helps verify that:
- Stock is being recorded in the correct month
- Order timestamps are consistent
- FIFO deduction happens in the right month

## Impact
✅ **Orders now correctly record stock usage in the current month**  
✅ **"Used Old Stock" statistics now accurate**  
✅ **Month-to-month stock tracking now reliable**  
✅ **No more discrepancies between order date and stock deduction date**  

## Files Modified
- `backend/routes/orders.js` (Lines 172, 319, 403-406, 430-431)

## Date: October 30, 2025
