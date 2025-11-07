# Monthly Stock Filtering Fix - Used Stock by Month

## Problem
Previously, the stock management system showed **all-time used stock** for each entry, regardless of which month you were viewing.

**Example:**
- Stock ADDED: 23 Sept 2025 (130 qty)
- Sales happened: October 2025 (10 qty sold from this stock via FIFO)
- **Old Behavior**: September view showed "Used Stock: 10" (incorrect)
- **New Behavior**: September view shows "Used Stock: 0", October view shows "Used Stock: 10" ✅

## Solution Implemented

### 1. Database Schema Update (`backend/models/MonthlyStock.js`)
Added `usageHistory` array to track when each portion of stock was used:

```javascript
usageHistory: [{
  year: Number,        // Which year the stock was used
  month: Number,       // Which month the stock was used (1-12)
  quantity: Number,    // How much was used in that month
  orderDate: Date      // When the order happened
}]
```

### 2. Order Processing Update (`backend/routes/orders.js`)
Modified the FIFO stock deduction logic to record usage history:

```javascript
// When deducting stock via FIFO
entry.usageHistory.push({
  year: year,
  month: monthNumber,
  quantity: deductAmount,
  orderDate: entryDate
});
```

### 3. Stock Display Update (`backend/routes/stock.js`)
Modified the GET route to filter `usedStock` based on the selected month:

```javascript
// Calculate usedStock for the current viewing month only
let filteredUsedStock = 0;
if (detail.usageHistory && Array.isArray(detail.usageHistory)) {
  filteredUsedStock = detail.usageHistory
    .filter(usage => usage.year === targetYear && usage.month === targetMonth)
    .reduce((sum, usage) => sum + (usage.quantity || 0), 0);
}

// Use filteredUsedStock in displayData
displayData: {
  stockAdded: detail.stockAdded,
  usedStock: filteredUsedStock,  // Only shows usage for selected month
  expiredStock: detail.expiredStock,
  damageStock: detail.damageStock,
  balance: detail.balance
}
```

## How It Works

### Scenario: Stock Added on 23 Sept 2025
1. **Add Stock**: 23 Sept 2025, 130 qty
   - `stockAdded: 130`
   - `usageHistory: []` (empty initially)

2. **Sale in October**: Customer orders 10 units on 5 Oct 2025
   - FIFO finds the Sept 23 stock entry
   - Deducts 10 units from it
   - Records in `usageHistory`:
     ```javascript
     usageHistory: [{
       year: 2025,
       month: 10,    // October
       quantity: 10,
       orderDate: "2025-10-05"
     }]
     ```
   - Total `usedStock: 10` (cumulative)

3. **Viewing September 2025**:
   - Filter: `usageHistory.filter(u => u.year === 2025 && u.month === 9)`
   - Result: `[]` (no matches)
   - Display: **Used Stock: 0** ✅

4. **Viewing October 2025**:
   - Filter: `usageHistory.filter(u => u.year === 2025 && u.month === 10)`
   - Result: `[{ year: 2025, month: 10, quantity: 10 }]`
   - Display: **Used Stock: 10** ✅

## Benefits

✅ **Accurate Month-Specific Reporting**: See exactly how much stock was used in each month  
✅ **Proper Balance Calculation**: Balance reflects current month's activity  
✅ **Historical Tracking**: Complete audit trail of when stock was consumed  
✅ **FIFO Integrity Maintained**: Stock is still deducted from oldest entries first  

## Testing

### Test Case 1: September View
1. Navigate to Stock Management for product added on 23 Sept 2025
2. Select month filter: **September 2025**
3. Verify:
   - Stock Added: 130
   - Used Stock: **0** (no sales in September)
   - Balance: 130

### Test Case 2: October View
1. Same product
2. Select month filter: **October 2025**
3. Verify:
   - Stock Added: 0 (no stock added in October)
   - Used Stock: **10** (sales happened in October)
   - Carry Forward: 130 (from September)
   - Balance: 120 (130 - 10)

## Migration Notes

### Existing Data
- Existing stock entries **do not have `usageHistory`** yet
- They will show `usedStock: 0` for all months until new sales occur
- **No data loss**: Total `usedStock` is still preserved
- New sales (after this update) will populate `usageHistory` correctly

### Future Sales
- All new sales from now on will automatically record usage history
- The system will gradually build up historical data as sales occur

## Files Modified

1. `backend/models/MonthlyStock.js` - Added usageHistory field
2. `backend/routes/orders.js` - Record usage month during FIFO deduction
3. `backend/routes/stock.js` - Filter usedStock by selected month

## Date: October 30, 2025
