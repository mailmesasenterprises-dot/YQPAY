# Stock Tracking Debug Guide - Kiosk Orders

## Issue
Product sales from kiosk orders are not reflecting in stock counts.

## Possible Causes & Solutions

### 1. **Stock Tracking Not Enabled**
Products must have `inventory.trackStock = true` to have their stock deducted.

**Check:**
```javascript
// In MongoDB or Product Management
product.inventory.trackStock = true  // Must be true
```

**Fix:**
Enable stock tracking for your products in the Product Management page.

### 2. **Product Structure Mismatch**
The backend expects products in this structure:
```javascript
{
  _id: ObjectId("..."),
  inventory: {
    currentStock: 100,
    trackStock: true,
    minStock: 10
  },
  pricing: {
    basePrice: 200
  }
}
```

### 3. **Stock Update Path**
The backend updates stock using this MongoDB query:
```javascript
db.collection('productlist').updateOne(
  {
    theater: theaterIdObjectId,
    'productList._id': productObjectId
  },
  {
    $set: {
      'productList.$.inventory.currentStock': newStock,
      'productList.$.updatedAt': new Date()
    }
  }
);
```

### 4. **Debugging Steps**

**Step 1: Check Console Logs**
After placing an order, check the browser console for:
```
Sending order data: {...}
Cart items: [...]
Order creation response: {...}
Order created successfully: {...}
```

**Step 2: Check Backend Logs**
The backend should show:
- Stock check for each product
- Stock update confirmation
- MonthlyStock recording

**Step 3: Verify in MongoDB**
After placing an order, check:

```javascript
// Check product stock
db.productlist.findOne(
  { theater: ObjectId("68f8837a541316c6ad54b79f") },
  { "productList.inventory": 1, "productList.name": 1 }
)

// Check MonthlyStock entries
db.monthlystocks.find({
  theaterId: ObjectId("68f8837a541316c6ad54b79f")
}).sort({ createdAt: -1 })
```

### 5. **Manual Stock Tracking Enable**

If stock tracking is disabled, you can enable it via MongoDB:

```javascript
db.productlist.updateOne(
  { 
    theater: ObjectId("68f8837a541316c6ad54b79f"),
    "productList._id": ObjectId("YOUR_PRODUCT_ID")
  },
  {
    $set: {
      "productList.$.inventory.trackStock": true
    }
  }
)
```

Or via Product Management UI:
1. Go to Products page
2. Edit the product
3. Enable "Track Stock" checkbox
4. Set initial stock quantity
5. Save

### 6. **Expected Backend Behavior**

When an order is created:

1. **Stock Check** (before creating order):
   ```javascript
   const currentStock = product.inventory?.currentStock ?? 0;
   const trackStock = product.inventory?.trackStock ?? true;
   
   if (trackStock && currentStock < item.quantity) {
     return error: 'INSUFFICIENT_STOCK'
   }
   ```

2. **Stock Deduction** (after validation):
   ```javascript
   const newStock = currentStock - item.quantity;
   // Update in productlist array
   ```

3. **MonthlyStock Recording**:
   ```javascript
   await recordStockUsage(theaterId, productId, quantity, orderDate);
   ```

### 7. **Test Scenario**

**Before Order:**
- Product: Pop Corn (250ML)
- Current Stock: 100
- Track Stock: ✅ Enabled

**Place Order:**
- Quantity: 2
- Expected Stock After: 98

**Verify:**
1. Order created successfully
2. Product stock reduced to 98
3. MonthlyStock has usage record
4. Stock appears in reports

### 8. **Common Issues**

❌ **Stock not updating:**
- `inventory.trackStock = false` (disabled)
- Product ID mismatch
- MongoDB array path incorrect

❌ **"Insufficient stock" error:**
- `currentStock < quantity`
- Stock tracking enabled but stock = 0

❌ **MonthlyStock not recording:**
- `recordStockUsage` function error
- No stock entries in MonthlyStock collection

### 9. **Quick Fix Checklist**

- [ ] Verify `inventory.trackStock = true` for products
- [ ] Check `inventory.currentStock > 0`
- [ ] Confirm product `_id` matches between cart and database
- [ ] Test with a product that has stock tracking enabled
- [ ] Check browser console for errors
- [ ] Verify backend logs for stock update confirmation
- [ ] Check MongoDB for actual stock value changes

### 10. **Next Steps**

1. **Place a test order** and check console logs
2. **Review the logged data** (orderData, cart, response)
3. **Check MongoDB** to see if stock actually decreased
4. **If stock didn't change**, check if `trackStock = true`
5. **If stock changed but UI doesn't reflect**, refresh the products page

---

## Console Logging Added

The following logs have been added to help debug:

**Frontend (KioskViewCart.js):**
```javascript
console.log('Sending order data:', orderData);
console.log('Cart items:', cart);
console.log('Order creation response:', result);
console.log('Order created successfully:', result.order);
```

**What to look for:**
- ✅ `productId` values are valid MongoDB ObjectIds
- ✅ `quantity` values are correct
- ✅ Response shows `success: true`
- ✅ Order has been created with correct items

---

**Created:** November 3, 2025
**Theater ID:** 68f8837a541316c6ad54b79f
