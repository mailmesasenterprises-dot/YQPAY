# Used Old Stock From Previous Months - Feature Implementation

## Overview
This feature tracks **carry forward stock that was sold in the current month**, similar to how we track "Expired Old Stock From Previous Months."

## Problem Statement
Previously, when orders were placed using FIFO (First In, First Out), the system deducted stock from the oldest entries (which could be from previous months), but there was no way to distinguish:
- How much of the current month's sales came from **current month stock**
- How much came from **carry forward stock (previous months)**

## Solution
Added a new field `usedCarryForwardStock` to track stock from previous months that was sold in the current month.

---

## Implementation Details

### 1. Database Schema Update (`backend/models/MonthlyStock.js`)

Added new field to track used carry forward stock:

```javascript
// Used stock from carry forward (previous months' stock that was sold this month)
usedCarryForwardStock: {
  type: Number,
  default: 0
}
```

**Placement:** Right after `expiredCarryForwardStock` field, maintaining parallel structure.

---

### 2. FIFO Logic Update (`backend/routes/orders.js`)

#### 2.1 Track Carry Forward Usage
Added logic to detect when stock is being deducted from previous months:

```javascript
let usedFromCarryForward = 0; // Track how much came from previous months

// Check if this is a previous month (carry forward stock)
const isCarryForwardMonth = (monthlyDoc.year < year) || 
                             (monthlyDoc.year === year && monthlyDoc.monthNumber < monthNumber);

if (isCarryForwardMonth) {
  usedFromCarryForward += deductAmount;
}
```

#### 2.2 Save Carry Forward Usage
Updated the save logic to record carry forward usage:

```javascript
// Update usedCarryForwardStock if we used stock from previous months
if (usedFromCarryForward > 0) {
  currentMonthDoc.usedCarryForwardStock = (currentMonthDoc.usedCarryForwardStock || 0) + usedFromCarryForward;
  console.log(`📊 Used Carry Forward Stock: ${usedFromCarryForward} units from previous months`);
}
```

#### 2.3 Enhanced Logging
Added detailed logging to show breakdown:

```javascript
console.log(`📦 Breakdown: ${quantity - usedFromCarryForward} from current month, ${usedFromCarryForward} from carry forward`);
console.log(`📦 FIFO Deduction: ${deductAmount} units from ${date} [CARRY FORWARD]`);
```

---

### 3. API Response Update (`backend/routes/stock.js`)

Added `usedOldStock` to statistics:

```javascript
statistics: {
  totalAdded: monthlyDoc.totalStockAdded,
  totalSold: monthlyDoc.totalUsedStock,
  totalExpired: monthlyDoc.totalExpiredStock,
  expiredOldStock: monthlyDoc.expiredCarryForwardStock || 0,
  usedOldStock: monthlyDoc.usedCarryForwardStock || 0, // NEW
  totalDamaged: monthlyDoc.totalDamageStock,
  openingBalance: Math.max(0, monthlyDoc.carryForward),
  closingBalance: Math.max(0, monthlyDoc.closingBalance)
}
```

---

### 4. Frontend Display (`frontend/src/pages/theater/StockManagement.js`)

#### 4.1 New Stat Card
Added a new stat card with orange/amber styling:

```javascript
{/* Used Old Stock (From Previous Months) */}
<div className="stat-card" style={{ border: '2px solid #F59E0B' }}>
  <div className="stat-number" style={{ color: '#D97706' }}>{summary.usedOldStock || 0}</div>
  <div className="stat-label" style={{ color: '#D97706' }}>Used Old Stock</div>
  <div className="stat-sublabel" style={{ fontSize: '12px', color: '#D97706', marginTop: '4px' }}>
    From Previous Months
  </div>
</div>
```

**Color Scheme:**
- **Expired Old Stock**: Red (`#EF4444`, `#DC2626`)
- **Used Old Stock**: Orange/Amber (`#F59E0B`, `#D97706`)
- Creates visual distinction between expired vs. used carry forward stock

#### 4.2 State Update
Added to summary state:

```javascript
usedOldStock: statistics?.usedOldStock || 0,
```

---

## How It Works - Example Scenario

### Month 1: September 2025
**Actions:**
- Add stock: **300 units** on Sept 9
- Add stock: **130 units** on Sept 23
- No sales in September

**Result:**
- Carry Forward to October: **430 units**

---

### Month 2: October 2025
**Actions:**
- Add stock: **200 units** on Oct 10
- **Sale 1**: 50 units on Oct 5
- **Sale 2**: 30 units on Oct 15
- Total sales: **80 units**

**FIFO Process:**
1. **Sale 1 (50 units):**
   - Deducts from Sept 9 stock (oldest entry)
   - `usedCarryForwardStock += 50`
   - Log: `"📦 FIFO Deduction: 50 units from 9 Sept 2025 [CARRY FORWARD]"`

2. **Sale 2 (30 units):**
   - Deducts from Sept 9 stock (still has available stock)
   - `usedCarryForwardStock += 30`
   - Log: `"📦 FIFO Deduction: 30 units from 9 Sept 2025 [CARRY FORWARD]"`

**October Stats:**
```
Carry Forward: 430
Total Added: 200 (current month)
Total Sales: 80
  ├─ Used Old Stock: 80 (from September)
  └─ Used Current Month Stock: 0
Expired Old Stock: 0
Total Damaged: 0
Overall Balance: 550 (430 + 200 - 80)
```

---

### Month 3: November 2025
**Actions:**
- Add stock: **100 units** on Nov 5
- **Sale**: 350 units on Nov 10

**FIFO Process:**
1. Deduct from Sept 9 (220 remaining): 220 units → `usedCarryForwardStock += 220`
2. Deduct from Sept 23 (130 remaining): 130 units → `usedCarryForwardStock += 130`
3. Total from carry forward: **350 units**
4. Current month stock: **0 units used**

**November Stats:**
```
Carry Forward: 550
Total Added: 100 (current month)
Total Sales: 350
  ├─ Used Old Stock: 350 (from Sept/Oct carry forward)
  └─ Used Current Month Stock: 0
Overall Balance: 300 (550 + 100 - 350)
```

---

## Benefits

### 1. **Accurate Tracking**
- Know exactly how much old stock vs. new stock is being sold
- Better inventory turnover analysis

### 2. **Parallel to Expired Stock**
- Consistent with "Expired Old Stock From Previous Months"
- Shows complete picture of what happens to carry forward stock

### 3. **FIFO Transparency**
- Visual confirmation that FIFO is working correctly
- Easy to verify oldest stock is being sold first

### 4. **Business Insights**
- If `usedOldStock` is high → Good! Selling old inventory first
- If `usedOldStock` is low → May have slow-moving old stock

---

## Visual Layout

### Statistics Cards Order:
1. **Carry Forward** (from previous month)
2. **Total Added** (current month - green)
3. **Total Sales** (current month - purple)
4. **Total Expired** (current month - red)
5. **Expired Old Stock** (from previous months - dark red)
6. **Used Old Stock** (from previous months - orange) ⭐ **NEW**
7. **Total Damaged** (current month)
8. **Total Balance** (current month only)
9. **Overall Balance** (purple highlight - carries to next month)

---

## Database Fields Summary

| Field | Type | Description |
|-------|------|-------------|
| `totalStockAdded` | Number | Stock added in current month |
| `totalUsedStock` | Number | Total stock sold (current + carry forward) |
| `totalExpiredStock` | Number | Stock expired in current month |
| `expiredCarryForwardStock` | Number | Carry forward stock that expired this month |
| `usedCarryForwardStock` | Number | **NEW:** Carry forward stock sold this month |
| `totalDamageStock` | Number | Stock damaged in current month |
| `carryForward` | Number | Opening balance (from previous month) |
| `closingBalance` | Number | Ending balance (carries to next month) |

---

## Formula Breakdown

### Total Sales (totalUsedStock)
```
Total Sales = Used Current Month Stock + Used Old Stock
```

Example: 80 total sales = 0 (current) + 80 (old)

### Overall Balance
```
Overall Balance = Carry Forward + Total Added - Total Sales - Total Expired - Expired Old Stock - Total Damaged
```

**Important:** We use `totalUsedStock` (which includes both current and old), NOT separate fields.

---

## Testing Checklist

- [x] Schema updated with `usedCarryForwardStock`
- [x] FIFO detects carry forward months correctly
- [x] `usedCarryForwardStock` accumulates correctly
- [x] API returns `usedOldStock` in statistics
- [x] Frontend displays new stat card with orange styling
- [x] Logging shows `[CARRY FORWARD]` tag
- [x] Backend server restarts successfully

---

## Files Modified

1. ✅ `backend/models/MonthlyStock.js` - Added `usedCarryForwardStock` field
2. ✅ `backend/routes/orders.js` - Track carry forward usage in FIFO
3. ✅ `backend/routes/stock.js` - Include `usedOldStock` in statistics
4. ✅ `frontend/src/pages/theater/StockManagement.js` - Display new stat card

---

## Date: October 30, 2025
