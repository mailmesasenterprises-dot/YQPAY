const express = require('express');
const router = express.Router();
const MonthlyStock = require('../models/MonthlyStock');
const Product = require('../models/Product');
const { authenticateToken, requireTheaterAccess } = require('../middleware/auth');
const { getProductById, updateProductStock } = require('../utils/productHelper');

// Helper function to auto-expire stock across all months
async function autoExpireStock(theaterId, productId) {
  const now = new Date();
  
  // Get all monthly documents for this product
  const allMonthlyDocs = await MonthlyStock.find({
    theaterId,
    productId
  }).sort({ year: 1, monthNumber: 1 });
  
  let hasAnyExpiredItems = false;
  
  // Track stock that needs to be moved to next day's expiredOldStock
  // key: "YYYY-MM-DD" (date when it should appear as expired old), value: quantity
  const expiredStockToCarryForward = {};
  
  for (const monthlyDoc of allMonthlyDocs) {
    for (let i = 0; i < monthlyDoc.stockDetails.length; i++) {
      const entry = monthlyDoc.stockDetails[i];
      
      if (entry.expireDate) {
        const expiry = new Date(entry.expireDate);
        
        // Items expire at 00:01 AM the day AFTER the expiry date
        const dayAfterExpiry = new Date(expiry);
        dayAfterExpiry.setDate(expiry.getDate() + 1);
        dayAfterExpiry.setHours(0, 1, 0, 0);
        
        const isExpired = now >= dayAfterExpiry;
        
        if (isExpired) {
          // Calculate remaining stock that should expire
          // This is the balance on the expiry date that needs to be carried forward
          const remainingStock = Math.max(0, 
            entry.stockAdded - entry.usedStock - entry.damageStock - (entry.expiredOldStock || 0)
          );
          
          if (remainingStock > 0) {
            const entryDate = new Date(entry.date);
            
            // The stock expires on the expiry date, so it should be carried to the NEXT day
            const nextDay = new Date(expiry);
            nextDay.setDate(expiry.getDate() + 1);
            const nextDayStr = nextDay.toISOString().split('T')[0]; // YYYY-MM-DD
            
            // Track this expired stock to be added to next day's expiredOldStock
            if (!expiredStockToCarryForward[nextDayStr]) {
              expiredStockToCarryForward[nextDayStr] = 0;
            }
            expiredStockToCarryForward[nextDayStr] += remainingStock;
            
            hasAnyExpiredItems = true;
          }
        }
      }
    }
  }
  
  // Now go through all months again and add expiredOldStock to the appropriate dates
  // Also recalculate ALL balances to ensure consistency
  for (const monthlyDoc of allMonthlyDocs) {
    let docModified = false;
    
    for (let i = 0; i < monthlyDoc.stockDetails.length; i++) {
      const entry = monthlyDoc.stockDetails[i];
      const entryDateStr = new Date(entry.date).toISOString().split('T')[0];
      
      // If this date should receive expired old stock
      if (expiredStockToCarryForward[entryDateStr]) {
        if (!entry.expiredOldStock) {
          entry.expiredOldStock = 0;
        }
        entry.expiredOldStock += expiredStockToCarryForward[entryDateStr];
        docModified = true;
        
        // Mark as handled
        delete expiredStockToCarryForward[entryDateStr];
      }
    }
    
    // Always recalculate balances for consistency
    let runningBalance = monthlyDoc.carryForward;
    
    for (let i = 0; i < monthlyDoc.stockDetails.length; i++) {
      const entry = monthlyDoc.stockDetails[i];
      // Update carry forward for this entry (from previous day's balance)
      entry.carryForward = runningBalance;
      // Balance = CarryForward + StockAdded - UsedStock - ExpiredOldStock - DamageStock
      // NOTE: ExpiredStock is NOT subtracted because stock carries forward first, then becomes expiredOldStock on next day
      entry.balance = Math.max(0, runningBalance + entry.stockAdded - entry.usedStock - (entry.expiredOldStock || 0) - entry.damageStock);
      runningBalance = entry.balance;
    }
    
    if (docModified || hasAnyExpiredItems) {
      await monthlyDoc.save();
    }
  }
  
  return hasAnyExpiredItems;
}

// Helper function to update carry forward chain for all months
async function updateCarryForwardChain(theaterId, productId) {
  // Get all monthly documents sorted by date
  const allDocs = await MonthlyStock.find({
    theaterId,
    productId
  }).sort({ year: 1, monthNumber: 1 });

  let hasUpdates = false;

  for (let i = 0; i < allDocs.length; i++) {
    const doc = allDocs[i];
    
    // Get correct carry forward from previous month
    const correctCarryForward = await MonthlyStock.getPreviousMonthBalance(
      theaterId, 
      productId, 
      doc.year, 
      doc.monthNumber
    );

    // If carry forward doesn't match, update it
    if (doc.carryForward !== correctCarryForward) {
      doc.carryForward = correctCarryForward;

      // Recalculate all balances
      let runningBalance = correctCarryForward;
      for (let j = 0; j < doc.stockDetails.length; j++) {
        const entry = doc.stockDetails[j];
        // Update carry forward for this entry
        entry.carryForward = runningBalance;
        // Balance = CarryForward + StockAdded - UsedStock - ExpiredOldStock - ExpiredStock - DamageStock
        runningBalance = runningBalance + entry.stockAdded - entry.usedStock - (entry.expiredOldStock || 0) - (entry.expiredStock || 0) - entry.damageStock;
        entry.balance = Math.max(0, runningBalance);
        runningBalance = entry.balance;
      }

      await doc.save();
      hasUpdates = true;
    }
  }

  return hasUpdates;
}

// Helper function to download stock data for all products on a specific date
async function downloadStockByDate(req, res, theaterId, dateStr, category, status, stockFilter) {
  try {
    console.log('�🔥🔥 DOWNLOAD STOCK BY DATE FUNCTION ENTERED 🔥🔥🔥');
    console.log('�📊 downloadStockByDate called with:', { theaterId, dateStr, category, status, stockFilter });
    
    const ExcelJS = require('exceljs');
    const mongoose = require('mongoose');
    
    // Parse the date
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
      console.error('❌ Invalid date string:', dateStr);
      return res.status(400).json({
        success: false,
        error: `Invalid date format: ${dateStr}`
      });
    }
    
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth() + 1;
    const targetDay = targetDate.getDate();
    
    console.log('📅 Target date:', { targetYear, targetMonth, targetDay, dateStr });

    // ✅ FIX: Fetch products from productlist collection (NEW structure)
    const productContainer = await mongoose.connection.db.collection('productlist').findOne({
      theater: new mongoose.Types.ObjectId(theaterId),
      productList: { $exists: true }
    });

    let products = [];
    
    if (productContainer && productContainer.productList) {
      products = productContainer.productList || [];
      console.log('✅ Found products in NEW structure:', products.length);
    } else {
      // Fallback to OLD structure
      const Product = require('../models/Product');
      products = await Product.find({ theaterId: new mongoose.Types.ObjectId(theaterId) }).lean();
      console.log('✅ Found products in OLD structure:', products.length);
    }
    
    if (!products || products.length === 0) {
      console.log('❌ No products found for theater');
      return res.status(404).json({
        success: false,
        error: 'No products found for this theater'
      });
    }
    
    console.log('✅ Found theater with', products.length, 'products');

    // Apply filters
    if (category) {
      products = products.filter(p => String(p.category) === String(category) || String(p.categoryId) === String(category));
    }

    if (status && status !== 'all') {
      if (status === 'live') {
        products = products.filter(p => p.isActive && p.isAvailable);
      } else if (status === 'offline') {
        products = products.filter(p => !p.isActive || !p.isAvailable);
      }
    }

    if (stockFilter && stockFilter !== 'all') {
      if (stockFilter === 'in-stock') {
        products = products.filter(p => (p.currentStock || 0) > (p.lowStockAlert || 5));
      } else if (stockFilter === 'low-stock') {
        products = products.filter(p => {
          const stock = p.currentStock || 0;
          const alert = p.lowStockAlert || 5;
          return stock > 0 && stock <= alert;
        });
      } else if (stockFilter === 'out-of-stock') {
        products = products.filter(p => (p.currentStock || 0) <= 0);
      }
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = req.user.username || 'System';
    workbook.created = new Date();

    // Add worksheet
    const worksheet = workbook.addWorksheet('Stock by Date');

    // Style definitions
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    const titleStyle = {
      font: { bold: true, size: 16, color: { argb: 'FF8B5CF6' } },
      alignment: { horizontal: 'center' }
    };

    // Add title
    worksheet.mergeCells('A1:K1');
    worksheet.getCell('A1').value = `Stock Management Report - ${targetDate.toLocaleDateString('en-IN')}`;
    worksheet.getCell('A1').style = titleStyle;
    worksheet.getRow(1).height = 25;

    // Add metadata
    worksheet.getCell('A2').value = `Date: ${targetDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    worksheet.getCell('A3').value = `Generated By: ${req.user.username}`;
    worksheet.getCell('A4').value = `Generated At: ${new Date().toLocaleString('en-IN')}`;

    // Add headers (row 6)
    const headers = [
      'S.No',
      'Product Name',
      'Category',
      'Carry Forward',
      'Stock Added',
      'Expired Old Stock',
      'Used Stock',
      'Expired Stock',
      'Damage Stock',
      'Balance',
      'Status'
    ];
    worksheet.getRow(6).values = headers;
    worksheet.getRow(6).eachCell((cell) => {
      cell.style = headerStyle;
    });
    worksheet.getRow(6).height = 20;

    // Set column widths
    worksheet.columns = [
      { width: 8 },   // S.No
      { width: 30 },  // Product Name
      { width: 20 },  // Category
      { width: 15 },  // Carry Forward
      { width: 15 },  // Stock Added
      { width: 18 },  // Expired Old Stock
      { width: 15 },  // Used Stock
      { width: 15 },  // Expired Stock
      { width: 15 },  // Damage Stock
      { width: 15 },  // Balance
      { width: 12 }   // Status
    ];

    // Fetch stock data for each product
    let rowNumber = 7;
    let totalCarryForward = 0;
    let totalStockAdded = 0;
    let totalExpiredOld = 0;
    let totalUsed = 0;
    let totalExpired = 0;
    let totalDamage = 0;
    let totalBalance = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      // Find monthly stock document for this product
      const monthlyDoc = await MonthlyStock.findOne({
        theaterId,
        productId: product._id,
        year: targetYear,
        monthNumber: targetMonth
      });

      let stockData = {
        carryForward: 0,
        stockAdded: 0,
        expiredOldStock: 0,
        usedStock: 0,
        expiredStock: 0,
        damageStock: 0,
        balance: 0
      };

      if (monthlyDoc && monthlyDoc.stockDetails) {
        // Find the entry for this specific date
        const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
        const dayEntry = monthlyDoc.stockDetails.find(entry => {
          const entryDateStr = new Date(entry.date).toISOString().split('T')[0];
          return entryDateStr === dateStr;
        });

        if (dayEntry) {
          stockData = {
            carryForward: dayEntry.carryForward || 0,
            stockAdded: dayEntry.stockAdded || 0,
            expiredOldStock: dayEntry.expiredOldStock || 0,
            usedStock: dayEntry.usedStock || 0,
            expiredStock: dayEntry.expiredStock || 0,
            damageStock: dayEntry.damageStock || 0,
            balance: dayEntry.balance || 0
          };
        }
      }

      // Update totals
      totalCarryForward += stockData.carryForward;
      totalStockAdded += stockData.stockAdded;
      totalExpiredOld += stockData.expiredOldStock;
      totalUsed += stockData.usedStock;
      totalExpired += stockData.expiredStock;
      totalDamage += stockData.damageStock;
      totalBalance += stockData.balance;

      const productStatus = (product.isActive && product.isAvailable) ? 'LIVE' : 'OFFLINE';

      const row = worksheet.getRow(rowNumber);
      row.values = [
        i + 1,
        product.name || 'N/A',
        product.categoryName || 'N/A',
        stockData.carryForward,
        stockData.stockAdded,
        stockData.expiredOldStock,
        stockData.usedStock,
        stockData.expiredStock,
        stockData.damageStock,
        stockData.balance,
        productStatus
      ];

      // Apply styling
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };
        
        if (colNumber >= 1 && colNumber <= 3) {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Color coding for status
        if (colNumber === 11) { // Status column
          if (productStatus === 'LIVE') {
            cell.font = { color: { argb: 'FF16A34A' }, bold: true };
          } else {
            cell.font = { color: { argb: 'FF6B7280' }, bold: true };
          }
        }
      });

      row.height = 18;
      rowNumber++;
    }

    // Add summary row
    rowNumber += 1;
    const summaryRow = worksheet.getRow(rowNumber);
    summaryRow.values = ['', 'TOTALS', '', totalCarryForward, totalStockAdded, totalExpiredOld, totalUsed, totalExpired, totalDamage, totalBalance, ''];
    summaryRow.eachCell((cell) => {
      cell.font = { bold: true, size: 12 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Generate Excel file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Stock_${dateStr}_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('❌ Error generating Stock by Date Excel:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Excel report',
      error: error.message
    });
  }
}

// POST /:theaterId/:productId/regenerate - Regenerate auto carry forward entries
router.post('/:theaterId/:productId/regenerate', authenticateToken, requireTheaterAccess, async (req, res) => {
  try {
    const { theaterId, productId } = req.params;
    const { year, month } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;

    console.log('🔄 Regenerating auto entries for', { targetYear, targetMonth });

    const monthlyDoc = await MonthlyStock.findOne({
      theaterId,
      productId,
      year: targetYear,
      monthNumber: targetMonth
    });

    if (!monthlyDoc) {
      return res.status(404).json({
        success: false,
        message: 'Monthly document not found'
      });
    }

    // Remove all auto-generated entries (entries with notes starting with "Auto")
    const beforeCount = monthlyDoc.stockDetails.length;
    monthlyDoc.stockDetails = monthlyDoc.stockDetails.filter(entry => 
      !entry.notes || !entry.notes.startsWith('Auto')
    );
    const removedCount = beforeCount - monthlyDoc.stockDetails.length;
    
    // Fix any manual entries that have wrong expiredStock
    for (const entry of monthlyDoc.stockDetails) {
      if (entry.expireDate) {
        const entryDate = new Date(entry.date);
        const expiryDate = new Date(entry.expireDate);
        
        // If entry date is before expiry date, it shouldn't have expiredStock
        if (entryDate < expiryDate && entry.expiredStock > 0) {
          console.log(`Fixing entry on ${entryDate.toLocaleDateString()} - removing incorrect expiredStock: ${entry.expiredStock}`);
          entry.stockAdded += entry.expiredStock; // Move back to stockAdded
          entry.expiredStock = 0;
        }
      }
    }
    
    await monthlyDoc.save();
    console.log(`✅ Removed ${removedCount} auto-generated entries and fixed manual entries`);

    res.json({
      success: true,
      message: `Regenerated successfully. Removed ${removedCount} auto entries and fixed manual entries.`,
      data: { removedCount }
    });

  } catch (error) {
    console.error('Regenerate Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate entries',
      error: error.message
    });
  }
});

// DELETE /:theaterId/:productId/clear-month - Clear all entries for a specific month
router.delete('/:theaterId/:productId/clear-month', authenticateToken, requireTheaterAccess, async (req, res) => {
  try {
    const { theaterId, productId } = req.params;
    const { year, month } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;

    console.log('🗑️ Clearing all entries for', { targetYear, targetMonth });

    const monthlyDoc = await MonthlyStock.findOne({
      theaterId,
      productId,
      year: targetYear,
      monthNumber: targetMonth
    });

    if (!monthlyDoc) {
      return res.status(404).json({
        success: false,
        message: 'Monthly document not found'
      });
    }

    const entriesCount = monthlyDoc.stockDetails.length;
    monthlyDoc.stockDetails = [];
    await monthlyDoc.save();

    console.log(`✅ Cleared ${entriesCount} entries from ${targetMonth}/${targetYear}`);

    res.json({
      success: true,
      message: `Cleared ${entriesCount} entries successfully`,
      data: { clearedCount: entriesCount }
    });

  } catch (error) {
    console.error('Clear Month Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear entries',
      error: error.message
    });
  }
});

// GET /:theaterId/:productId - Get monthly stock data
router.get('/:theaterId/:productId', authenticateToken, requireTheaterAccess, async (req, res) => {
  try {
    // 🚀 CRITICAL: Prevent browser caching of stock data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { theaterId, productId } = req.params;
    const { year, month } = req.query;
    const currentDate = new Date();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;

    // ? AUTO-EXPIRE STOCK ACROSS ALL MONTHS
    const hasExpiredItems = await autoExpireStock(theaterId, productId);

    // ? UPDATE CARRY FORWARD CHAIN FOR ALL MONTHS
    await updateCarryForwardChain(theaterId, productId);

    const previousBalance = await MonthlyStock.getPreviousMonthBalance(theaterId, productId, targetYear, targetMonth);
    const monthlyDoc = await MonthlyStock.getOrCreateMonthlyDoc(theaterId, productId, targetYear, targetMonth, previousBalance);

    // AUTO-CREATE DAILY CARRY FORWARD ENTRIES
    // If this is the current month and we have a carry forward, check if we need first day entry
    const today = new Date();
    const isCurrentMonth = targetYear === today.getFullYear() && targetMonth === (today.getMonth() + 1);
    const firstDayOfMonth = new Date(targetYear, targetMonth - 1, 1, 12, 0, 0, 0); // Noon local time
    
    console.log('Checking for first day entry:', {
      targetYear,
      targetMonth,
      carryForward: monthlyDoc.carryForward,
      existingEntriesCount: monthlyDoc.stockDetails.length
    });
    
    // Check if there's already an entry for the 1st of this month
    const hasFirstDayEntry = monthlyDoc.stockDetails.some(entry => {
      const entryDate = new Date(entry.date);
      const isFirstDay = entryDate.getFullYear() === targetYear &&
             entryDate.getMonth() === (targetMonth - 1) &&
             entryDate.getDate() === 1;
      console.log('Entry date check:', {
        entryDate: entryDate.toISOString(),
        isFirstDay,
        targetYear,
        targetMonth
      });
      return isFirstDay;
    });
    
    console.log('Has first day entry?', hasFirstDayEntry);
    
    if (monthlyDoc.carryForward > 0 && !hasFirstDayEntry) {
      // Create an entry for the 1st of the month with carry forward
      console.log('✅ Creating carry forward entry for Nov 1:', {
        firstDayOfMonth: firstDayOfMonth.toISOString(),
        carryForward: monthlyDoc.carryForward
      });
      
      monthlyDoc.stockDetails.push({
        date: firstDayOfMonth,
        type: 'ADDED',
        quantity: 0,
        carryForward: monthlyDoc.carryForward,
        stockAdded: 0,
        expiredOldStock: 0,
        usedStock: 0,
        expiredStock: 0,
        damageStock: 0,
        balance: monthlyDoc.carryForward,
        notes: 'Auto-generated carry forward from previous month'
      });
      
      await monthlyDoc.save();
      console.log('✅ Carry forward entry saved successfully');
    }
    
    if (isCurrentMonth && monthlyDoc.stockDetails.length > 0) {
      // Check if today needs a carry forward entry
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0); // Noon local time
      const hasEntryToday = monthlyDoc.stockDetails.some(entry => {
        const entryDate = new Date(entry.date);
        return entryDate.getFullYear() === todayDate.getFullYear() &&
               entryDate.getMonth() === todayDate.getMonth() &&
               entryDate.getDate() === todayDate.getDate();
      });
      
      if (!hasEntryToday) {
        // Get yesterday's balance
        const sortedEntries = monthlyDoc.stockDetails
          .map(e => ({ ...e.toObject(), date: new Date(e.date) }))
          .sort((a, b) => b.date - a.date);
        
        const previousBalance = sortedEntries.length > 0 ? sortedEntries[0].balance : monthlyDoc.carryForward;
        
        // Create today's carry forward entry
        monthlyDoc.stockDetails.push({
          date: todayDate,
          type: 'ADDED',
          quantity: 0,
          carryForward: previousBalance,
          stockAdded: 0,
          expiredOldStock: 0,
          usedStock: 0,
          expiredStock: 0,
          damageStock: 0,
          balance: previousBalance,
          notes: 'Auto-generated daily carry forward'
        });
        
        await monthlyDoc.save();
      }
    }

    // Update product's current stock if items were expired
    if (hasExpiredItems) {
      try {
        await updateProductStock(productId, theaterId, {
          currentStock: monthlyDoc.closingBalance
        });
      } catch (prodError) {
        console.error('  ? Failed to update product stock:', prodError.message);
      }
    }

    // NEW: Auto-generate missing daily carry forward entries for stocks with expiry dates
    console.log('🔄 Checking for missing daily carry forward entries...');
    
    // Get all ADDED entries with expiry dates
    const addedEntriesWithExpiry = monthlyDoc.stockDetails.filter(entry => 
      (entry.type === 'ADDED' || entry.type === 'RETURNED') && 
      entry.expireDate &&
      entry.stockAdded > 0
    );
    
    for (const sourceEntry of addedEntriesWithExpiry) {
      const stockAddedDate = new Date(sourceEntry.date);
      const expiryDate = new Date(sourceEntry.expireDate);
      
      // Normalize dates to midnight for comparison
      stockAddedDate.setHours(0, 0, 0, 0);
      expiryDate.setHours(0, 0, 0, 0);
      
      // ✅ FIX: Stock expires the DAY AFTER the expiry label date at 00:01 AM
      // Example: Expiry date "2 Nov 2025" means stock is good until end of 2 Nov
      // Stock expires on "3 Nov 2025 at 00:01 AM"
      const actualExpiryDate = new Date(expiryDate);
      actualExpiryDate.setDate(expiryDate.getDate() + 1);
      actualExpiryDate.setHours(0, 1, 0, 0);
      
      // ✅ FIX: Only create entries up to TODAY, not future dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Determine the last day we should create entries for
      // It should be the earlier of: today OR actual expiry date
      const lastDayToCreate = actualExpiryDate < today ? actualExpiryDate : today;
      
      console.log(`📦 Processing stock added on ${stockAddedDate.toLocaleDateString()}`);
      console.log(`   Expiry label: ${expiryDate.toLocaleDateString()}`);
      console.log(`   Actual expiry: ${actualExpiryDate.toLocaleDateString()} at 00:01 AM`);
      console.log(`   Today: ${today.toLocaleDateString()}`);
      console.log(`   Will create entries up to: ${lastDayToCreate.toLocaleDateString()}`);
      
      // Start from the day after stock was added
      let currentDay = new Date(stockAddedDate);
      currentDay.setDate(currentDay.getDate() + 1);
      currentDay.setHours(0, 0, 0, 0);
      
      let carryingQuantity = sourceEntry.stockAdded;
      
      // ✅ FIX: Loop only up to the last day we should create (today or expiry, whichever is earlier)
      while (currentDay <= lastDayToCreate) {
        const dayYear = currentDay.getFullYear();
        const dayMonth = currentDay.getMonth() + 1;
        
        // Get monthly doc for this day
        let dayMonthDoc = monthlyDoc;
        if (dayYear !== targetYear || dayMonth !== targetMonth) {
          const dayPreviousBalance = await MonthlyStock.getPreviousMonthBalance(theaterId, productId, dayYear, dayMonth);
          dayMonthDoc = await MonthlyStock.getOrCreateMonthlyDoc(theaterId, productId, dayYear, dayMonth, dayPreviousBalance);
        }
        
        // Check if entry exists for this exact date
        const existingEntryIndex = dayMonthDoc.stockDetails.findIndex(e => {
          const eDate = new Date(e.date);
          return eDate.getDate() === currentDay.getDate() &&
                 eDate.getMonth() === currentDay.getMonth() &&
                 eDate.getFullYear() === currentDay.getFullYear();
        });
        
        // ✅ FIX: Check if this is the actual expiry date (day AFTER the expiry label)
        // Example: Label "2 Nov" → Stock expires on "3 Nov" at 00:01 AM
        const isExpiryDate = currentDay.getDate() === actualExpiryDate.getDate() &&
                            currentDay.getMonth() === actualExpiryDate.getMonth() &&
                            currentDay.getFullYear() === actualExpiryDate.getFullYear();
        
        console.log(`  🔍 Checking date ${currentDay.toLocaleDateString()}:`, {
          currentDay: currentDay.toISOString().split('T')[0],
          expiryLabelDate: expiryDate.toISOString().split('T')[0],
          actualExpiryDate: actualExpiryDate.toISOString().split('T')[0],
          isExpiryDate,
          carryingQuantity
        });
        
        if (existingEntryIndex === -1) {
          // No entry exists - create new carry forward entry
          const entriesBeforeThisDay = dayMonthDoc.stockDetails
            .filter(entry => new Date(entry.date) < currentDay)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          
          const previousDayTotalBalance = entriesBeforeThisDay.length > 0 
            ? entriesBeforeThisDay[0].balance 
            : dayMonthDoc.carryForward;
          
          const autoEntry = {
            date: new Date(currentDay),
            type: 'ADDED',
            quantity: 0,
            carryForward: previousDayTotalBalance,
            stockAdded: 0,
            expiredOldStock: isExpiryDate ? carryingQuantity : 0,
            usedStock: 0,
            expiredStock: 0,
            damageStock: 0,
            balance: isExpiryDate 
              ? Math.max(0, previousDayTotalBalance - carryingQuantity)
              : previousDayTotalBalance,
            // Don't store expireDate in auto-generated entries - they show their own date
            batchNumber: sourceEntry.batchNumber,
            notes: isExpiryDate 
              ? `Auto: Expired from ${stockAddedDate.toLocaleDateString()} (Label: ${expiryDate.toLocaleDateString()})`
              : `Auto: CF from ${stockAddedDate.toLocaleDateString()}`
          };
          
          dayMonthDoc.stockDetails.push(autoEntry);
          await dayMonthDoc.save();
          
          console.log(`  ✅ Created ${isExpiryDate ? 'EXPIRY' : 'CF'} entry for ${currentDay.toLocaleDateString()}`);
        } else if (isExpiryDate) {
          // Entry exists and it's the actual expiry date (day after label) - update expiredOldStock
          const existingEntry = dayMonthDoc.stockDetails[existingEntryIndex];
          if (!existingEntry.expiredOldStock || existingEntry.expiredOldStock === 0) {
            const previousBalance = existingEntry.carryForward || 0;
            existingEntry.expiredOldStock = carryingQuantity;
            existingEntry.balance = Math.max(0, 
              previousBalance + (existingEntry.stockAdded || 0) - 
              carryingQuantity - (existingEntry.usedStock || 0) - (existingEntry.expiredStock || 0) - (existingEntry.damageStock || 0)
            );
            dayMonthDoc.markModified('stockDetails');
            await dayMonthDoc.save();
            console.log(`  ✅ Updated existing entry for ${currentDay.toLocaleDateString()} with expiredOldStock (expires day after label ${expiryDate.toLocaleDateString()})`);
          }
        }
        
        // Stop after expiry date
        if (isExpiryDate) {
          console.log(`  🛑 Stock expired on ${currentDay.toLocaleDateString()}`);
          break;
        }
        
        // Move to next day
        currentDay.setDate(currentDay.getDate() + 1);
      }
    }
    
    // ✅ CRITICAL: Recalculate ALL balances after auto-generation is complete
    // This ensures that when multiple batches expire on the same day, the total is correct
    console.log('🔄 Recalculating all balances after auto-generation...');
    
    // Reload to get all auto-generated entries
    let monthlyDocForRecalc = await MonthlyStock.findOne({
      theaterId,
      productId,
      year: targetYear,
      monthNumber: targetMonth
    });
    
    // Sort by date
    monthlyDocForRecalc.stockDetails.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Recalculate running balance
    let runningBalance = monthlyDocForRecalc.carryForward;
    
    for (let i = 0; i < monthlyDocForRecalc.stockDetails.length; i++) {
      const entry = monthlyDocForRecalc.stockDetails[i];
      // Update carry forward for this entry (from previous day's balance)
      entry.carryForward = runningBalance;
      // Balance = CarryForward + StockAdded - UsedStock - ExpiredOldStock - ExpiredStock - DamageStock
      entry.balance = Math.max(0, runningBalance + entry.stockAdded - entry.usedStock - (entry.expiredOldStock || 0) - entry.expiredStock - entry.damageStock);
      runningBalance = entry.balance;
    }
    
    await monthlyDocForRecalc.save();
    console.log('✅ Balance recalculation complete');
    
    // Reload the monthly doc after auto-generation
    const updatedMonthlyDoc = await MonthlyStock.findOne({
      theaterId,
      productId,
      year: targetYear,
      monthNumber: targetMonth
    }).populate('productId').populate('theaterId');

    const product = await getProductById(productId, theaterId);

    // ✅ FIX: Filter out future date entries - only show up to TODAY
    const todayEndOfDay = new Date();
    todayEndOfDay.setHours(23, 59, 59, 999); // End of today
    
    // Sort entries by date in ascending order
    const sortedEntries = updatedMonthlyDoc.stockDetails
      .filter(detail => {
        const entryDate = new Date(detail.date);
        return entryDate <= todayEndOfDay; // Only include entries up to today
      })
      .sort((a, b) => {
        return new Date(a.date) - new Date(b.date);
      });

    console.log(`📅 Today: ${todayEndOfDay.toLocaleDateString()}, Total entries in DB: ${updatedMonthlyDoc.stockDetails.length}, Showing: ${sortedEntries.length}`);

    const response = {
      success: true,
      data: {
        entries: sortedEntries.map((detail, index) => {
          // Debug logging for first entry
          if (index === 0) {
            console.log('First entry date details:', {
              rawDate: detail.date,
              isoString: detail.date ? new Date(detail.date).toISOString() : 'no date',
              localString: detail.date ? new Date(detail.date).toLocaleDateString() : 'no date'
            });
          }
          
          return {
            _id: detail._id,
            type: detail.type,
            quantity: detail.quantity,
            usedStock: detail.usedStock || 0, // Total all-time used stock
            damageStock: detail.damageStock || 0,
            balance: detail.balance || 0,
            displayData: {
              carryForward: detail.carryForward || 0,
              stockAdded: detail.stockAdded || 0,
              expiredOldStock: detail.expiredOldStock || 0,
              usedStock: detail.usedStock || 0, // Show total used stock from all orders
              expiredStock: detail.expiredStock || 0,
              damageStock: detail.damageStock || 0,
              balance: detail.balance || 0
            },
            date: detail.date,
            entryDate: detail.date,
            expireDate: detail.expireDate,
            batchNumber: detail.batchNumber,
            notes: detail.notes
          };
        }),
        currentStock: Math.max(0, updatedMonthlyDoc.closingBalance),
        statistics: {
          totalAdded: updatedMonthlyDoc.totalStockAdded,
           expiredOldStock: updatedMonthlyDoc.expiredCarryForwardStock || 0,
          usedOldStock: updatedMonthlyDoc.usedCarryForwardStock || 0, 
          totalSold: updatedMonthlyDoc.totalUsedStock,
          totalExpired: updatedMonthlyDoc.totalExpiredStock,
           totalDamaged: updatedMonthlyDoc.totalDamageStock,
          openingBalance: Math.max(0, updatedMonthlyDoc.carryForward),
          closingBalance: Math.max(0, updatedMonthlyDoc.closingBalance)
        },
        period: {
          year: updatedMonthlyDoc.year,
          month: updatedMonthlyDoc.monthNumber,
          monthName: updatedMonthlyDoc.month
        },
        product: product ? {
          _id: product._id,
          name: product.name,
          currentStock: Math.max(0, updatedMonthlyDoc.closingBalance)
        } : null
      }
    };

    console.log(`📊 Sending ${response.data.entries.length} entries for ${targetYear}-${targetMonth}`);
    if (response.data.entries.length > 0) {
      console.log('First entry being sent:', JSON.stringify(response.data.entries[0], null, 2));
    }

    res.json(response);

  } catch (error) {
    console.error('GET Monthly Stock Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly stock data',
      error: error.message
    });
  }
});

// POST /:theaterId/:productId - Add stock entry to monthly document
router.post('/:theaterId/:productId', authenticateToken, requireTheaterAccess, async (req, res) => {
  try {
    const { theaterId, productId } = req.params;
    const { date, type, quantity, usedStock, damageStock, expiredOldStock, balance, expireDate, notes, batchNumber } = req.body;
    // Validation
    if (!type || !quantity || !date) {
      return res.status(400).json({
        success: false,
        message: 'Date, type, and quantity are required'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }

    // Parse the entry date
    const entryDate = new Date(date);
    const year = entryDate.getFullYear();
    const monthNumber = entryDate.getMonth() + 1;

    // Get previous month's closing balance
    const previousBalance = await MonthlyStock.getPreviousMonthBalance(theaterId, productId, year, monthNumber);
    
    // Get or create monthly document
    let monthlyDoc = await MonthlyStock.getOrCreateMonthlyDoc(theaterId, productId, year, monthNumber, previousBalance);

    // NEW: Calculate day-by-day carry forward
    // Find the last entry BEFORE this date (could be from previous day)
    const entriesBeforeToday = monthlyDoc.stockDetails
      .filter(entry => new Date(entry.date) < entryDate)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const previousDayBalance = entriesBeforeToday.length > 0 
      ? entriesBeforeToday[0].balance 
      : monthlyDoc.carryForward; // If no previous day, use month's carry forward

    // Create new stock detail entry with day-by-day tracking
    const newEntry = {
      date: entryDate,
      type,
      quantity,
      carryForward: previousDayBalance, // Opening balance from previous day
      stockAdded: 0,
      expiredOldStock: expiredOldStock || 0, // Stock from previous days that expired today
      usedStock: usedStock || 0,
      expiredStock: 0, // Today's stock that expired
      damageStock: damageStock || 0,
      balance: balance || previousDayBalance,
      expireDate: expireDate || undefined,
      batchNumber: batchNumber || undefined,
      notes: notes || undefined
    };

    // Populate display fields based on type
    const qty = Math.abs(quantity);
    switch (type) {
      case 'ADDED':
      case 'RETURNED':
        newEntry.stockAdded = qty;
        // Balance = CarryForward + StockAdded - UsedStock - ExpiredOldStock - ExpiredStock - DamageStock
        newEntry.balance = Math.max(0, 
          previousDayBalance + qty - (usedStock || 0) - (expiredOldStock || 0) - (newEntry.expiredStock || 0) - (damageStock || 0)
        );
        break;
      case 'SOLD':
        newEntry.usedStock = qty;
        newEntry.balance = Math.max(0, previousDayBalance - qty);
        break;
      case 'EXPIRED':
        newEntry.expiredStock = qty;
        newEntry.balance = Math.max(0, previousDayBalance - qty);
        break;
      case 'DAMAGED':
        newEntry.damageStock = qty;
        newEntry.balance = Math.max(0, previousDayBalance - qty);
        break;
      case 'ADJUSTMENT':
        if (quantity > 0) {
          newEntry.stockAdded = qty;
          newEntry.balance = Math.max(0, previousDayBalance + qty);
        } else {
          newEntry.usedStock = qty;
          newEntry.balance = Math.max(0, previousDayBalance - qty);
        }
        break;
    }

    // Add entry to stockDetails array
    monthlyDoc.stockDetails.push(newEntry);

    // NEW: Auto-generate daily carry forward entries until expiry date
    if (expireDate && (type === 'ADDED' || type === 'RETURNED')) {
      console.log('🔄 Auto-generating daily carry forward entries...');
      const expiryDate = new Date(expireDate);
      const currentEntryDate = new Date(entryDate);
      
      // Stock expires the day AFTER the expiry date
      const actualExpiryDate = new Date(expiryDate);
      actualExpiryDate.setDate(expiryDate.getDate() + 1);
      
      console.log(`Stock added on ${currentEntryDate.toLocaleDateString()}, expiry date: ${expiryDate.toLocaleDateString()}, will expire on: ${actualExpiryDate.toLocaleDateString()}`);
      
      // Start from the day after the stock was added
      let nextDay = new Date(currentEntryDate);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(12, 0, 0, 0); // Noon to avoid timezone issues
      
      let carryingBalance = newEntry.balance;
      let carryingQuantity = qty; // Track the specific stock being carried forward
      
      // Loop until the day stock actually expires (day AFTER expiry date)
      while (nextDay <= actualExpiryDate) {
        const dayYear = nextDay.getFullYear();
        const dayMonth = nextDay.getMonth() + 1;
        
        // Get monthly doc for this day (might be different month)
        let dayMonthDoc = monthlyDoc;
        if (dayYear !== year || dayMonth !== monthNumber) {
          const dayPreviousBalance = await MonthlyStock.getPreviousMonthBalance(theaterId, productId, dayYear, dayMonth);
          dayMonthDoc = await MonthlyStock.getOrCreateMonthlyDoc(theaterId, productId, dayYear, dayMonth, dayPreviousBalance);
        }
        
        // Check if entry already exists for this date
        const existingEntry = dayMonthDoc.stockDetails.find(e => {
          const eDate = new Date(e.date);
          return eDate.getDate() === nextDay.getDate() &&
                 eDate.getMonth() === nextDay.getMonth() &&
                 eDate.getFullYear() === nextDay.getFullYear();
        });
        
        if (!existingEntry) {
          // Calculate carry forward from previous day's total balance
          const entriesBeforeThisDay = dayMonthDoc.stockDetails
            .filter(entry => new Date(entry.date) < nextDay)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          
          const previousDayTotalBalance = entriesBeforeThisDay.length > 0 
            ? entriesBeforeThisDay[0].balance 
            : dayMonthDoc.carryForward;
          
          // Check if this is the ACTUAL expiry date (day after expiry date on label)
          const isExpiryDate = nextDay.getDate() === actualExpiryDate.getDate() &&
                               nextDay.getMonth() === actualExpiryDate.getMonth() &&
                               nextDay.getFullYear() === actualExpiryDate.getFullYear();
          
          const autoEntry = {
            date: new Date(nextDay),
            type: 'ADDED',
            quantity: 0,
            carryForward: previousDayTotalBalance,
            stockAdded: 0,
            expiredOldStock: isExpiryDate ? carryingQuantity : 0, // Expire on expiry date
            usedStock: 0,
            expiredStock: 0,
            damageStock: 0,
            balance: isExpiryDate 
              ? Math.max(0, previousDayTotalBalance - carryingQuantity) // Deduct expired stock
              : previousDayTotalBalance, // Just carry forward
            // Don't store expireDate in auto-generated entries
            batchNumber: batchNumber,
            notes: `Auto-generated: ${isExpiryDate ? 'Expired stock from ' : 'Carry forward from '}${currentEntryDate.toLocaleDateString()}`
          };
          
          dayMonthDoc.stockDetails.push(autoEntry);
          await dayMonthDoc.save();
          
          console.log(`✅ Created ${isExpiryDate ? 'EXPIRY' : 'carry forward'} entry for ${nextDay.toLocaleDateString()}`);
          
          // Update carrying balance
          carryingBalance = autoEntry.balance;
          
          // If stock expired, stop creating more entries
          if (isExpiryDate) {
            console.log(`🛑 Stock expired on ${nextDay.toLocaleDateString()}, stopping carry forward`);
            break;
          }
        } else {
          console.log(`⏭️ Entry already exists for ${nextDay.toLocaleDateString()}, skipping`);
        }
        
        // Move to next day
        nextDay.setDate(nextDay.getDate() + 1);
      }
    }

    // Save (pre-save hook will recalculate totals)
    await monthlyDoc.save();

    // Update product's current stock
    try {
      await updateProductStock(productId, theaterId, {
        currentStock: monthlyDoc.closingBalance
      });
    } catch (prodError) {
      console.error('Failed to update product stock:', prodError.message);
    }

    // Return response
    res.status(201).json({
      success: true,
      message: 'Stock entry added successfully',
      data: {
        entry: {
          _id: newEntry._id,
          date: newEntry.date,
          type: newEntry.type,
          quantity: newEntry.quantity,
          displayData: {
            carryForward: newEntry.carryForward,
            stockAdded: newEntry.stockAdded,
            expiredOldStock: newEntry.expiredOldStock,
            usedStock: newEntry.usedStock,
            expiredStock: newEntry.expiredStock,
            damageStock: newEntry.damageStock,
            balance: newEntry.balance
          }
        },
        currentStock: monthlyDoc.closingBalance,
        monthlyTotals: {
          totalStockAdded: monthlyDoc.totalStockAdded,
          totalUsedStock: monthlyDoc.totalUsedStock,
          totalExpiredStock: monthlyDoc.totalExpiredStock,
          totalDamageStock: monthlyDoc.totalDamageStock
        }
      }
    });

  } catch (error) {
    console.error('POST Stock Entry Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add stock entry',
      error: error.message
    });
  }
});

// PUT /:theaterId/:productId/:entryId - Update stock entry
router.put('/:theaterId/:productId/:entryId', authenticateToken, requireTheaterAccess, async (req, res) => {
  try {
    const { theaterId, productId, entryId } = req.params;
    const { date, type, quantity, usedStock, damageStock, expiredOldStock, balance, expireDate, notes, batchNumber } = req.body;
    // Parse the entry date
    const entryDate = new Date(date);
    const year = entryDate.getFullYear();
    const monthNumber = entryDate.getMonth() + 1;

    // Find the monthly document
    const monthlyDoc = await MonthlyStock.findOne({
      theaterId,
      productId,
      year,
      monthNumber
    });

    if (!monthlyDoc) {
      return res.status(404).json({
        success: false,
        message: 'Monthly document not found'
      });
    }

    // Find the entry to update
    const entryIndex = monthlyDoc.stockDetails.findIndex(e => e._id.toString() === entryId);
    
    if (entryIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Stock entry not found'
      });
    }

    // Update the entry
    monthlyDoc.stockDetails[entryIndex].date = entryDate;
    monthlyDoc.stockDetails[entryIndex].type = type;
    monthlyDoc.stockDetails[entryIndex].quantity = quantity;
    monthlyDoc.stockDetails[entryIndex].expireDate = expireDate;
    monthlyDoc.stockDetails[entryIndex].notes = notes;
    monthlyDoc.stockDetails[entryIndex].batchNumber = batchNumber;

    // Store user-entered values from request
    const userEnteredUsedStock = usedStock || 0;
    const userEnteredDamageStock = damageStock || 0;
    const userEnteredExpiredOldStock = expiredOldStock || 0;

    // Sort entries by date to ensure proper day-by-day calculation
    monthlyDoc.stockDetails.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Recalculate all balances from the beginning with day-by-day carry forward
    let runningBalance = monthlyDoc.carryForward;
    
    for (let i = 0; i < monthlyDoc.stockDetails.length; i++) {
      const entry = monthlyDoc.stockDetails[i];
      const qty = Math.abs(entry.quantity);
      
      // Set carry forward from previous day
      entry.carryForward = runningBalance;
      
      // Find the updated entry by ID (since we sorted, index may have changed)
      const isUpdatedEntry = entry._id.toString() === entryId;
      
      // Reset display fields
      entry.stockAdded = 0;
      entry.expiredStock = 0;
      
      // For the updated entry, preserve user-entered values
      if (isUpdatedEntry) {
        entry.usedStock = userEnteredUsedStock;
        entry.damageStock = userEnteredDamageStock;
        entry.expiredOldStock = userEnteredExpiredOldStock;
      } else {
        entry.usedStock = entry.usedStock || 0;
        entry.damageStock = entry.damageStock || 0;
        entry.expiredOldStock = entry.expiredOldStock || 0;
      }
      
      // Calculate based on type
      switch (entry.type) {
        case 'ADDED':
        case 'RETURNED':
          entry.stockAdded = qty;
          // Balance = CarryForward + StockAdded - UsedStock - ExpiredOldStock - ExpiredStock - DamageStock
          entry.balance = Math.max(0, runningBalance + qty - entry.usedStock - entry.expiredOldStock - entry.expiredStock - entry.damageStock);
          runningBalance = entry.balance;
          break;
        case 'SOLD':
          entry.usedStock = qty;
          entry.balance = Math.max(0, runningBalance - qty);
          runningBalance = entry.balance;
          break;
        case 'EXPIRED':
          entry.expiredStock = qty;
          entry.balance = Math.max(0, runningBalance - qty);
          runningBalance = entry.balance;
          break;
        case 'DAMAGED':
          entry.damageStock = qty;
          entry.balance = Math.max(0, runningBalance - qty);
          runningBalance = entry.balance;
          break;
        case 'ADJUSTMENT':
          if (entry.quantity > 0) {
            entry.stockAdded = qty;
            entry.balance = Math.max(0, runningBalance + qty);
            runningBalance = entry.balance;
          } else {
            entry.usedStock = qty;
            entry.balance = Math.max(0, runningBalance - qty);
            runningBalance = entry.balance;
          }
          break;
      }
    }

    // Save (pre-save hook will recalculate totals)
    await monthlyDoc.save();
    // Update product stock
    try {
      await updateProductStock(productId, theaterId, {
        currentStock: monthlyDoc.closingBalance
      });
    } catch (prodError) {
      console.error('Failed to update product stock:', prodError.message);
    }

    res.json({
      success: true,
      message: 'Stock entry updated successfully',
      data: {
        entry: monthlyDoc.stockDetails[entryIndex],
        currentStock: monthlyDoc.closingBalance
      }
    });

  } catch (error) {
    console.error('PUT Stock Entry Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stock entry',
      error: error.message
    });
  }
});

// DELETE /:theaterId/:productId/:entryId - Delete stock entry
router.delete('/:theaterId/:productId/:entryId', authenticateToken, requireTheaterAccess, async (req, res) => {
  try {
    const { theaterId, productId, entryId } = req.params;
    const { year, month } = req.query;
    const targetYear = parseInt(year);
    const targetMonth = parseInt(month);

    // Find the monthly document
    const monthlyDoc = await MonthlyStock.findOne({
      theaterId,
      productId,
      year: targetYear,
      monthNumber: targetMonth
    });

    if (!monthlyDoc) {
      return res.status(404).json({
        success: false,
        message: 'Monthly document not found'
      });
    }

    // Find and remove the entry
    const entryIndex = monthlyDoc.stockDetails.findIndex(e => e._id.toString() === entryId);
    
    if (entryIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Stock entry not found'
      });
    }

    // Remove the entry
    monthlyDoc.stockDetails.splice(entryIndex, 1);

    // Recalculate all balances
    let runningBalance = monthlyDoc.carryForward;
    
    for (let i = 0; i < monthlyDoc.stockDetails.length; i++) {
      const entry = monthlyDoc.stockDetails[i];
      const qty = Math.abs(entry.quantity);
      
      switch (entry.type) {
        case 'ADDED':
        case 'RETURNED':
          runningBalance += qty;
          break;
        case 'SOLD':
        case 'EXPIRED':
        case 'DAMAGED':
          runningBalance -= qty;
          break;
        case 'ADJUSTMENT':
          runningBalance += entry.quantity; // Can be positive or negative
          break;
      }
      
      entry.balance = runningBalance;
    }

    // Save
    await monthlyDoc.save();
    // Update product stock
    try {
      await updateProductStock(productId, theaterId, {
        currentStock: monthlyDoc.closingBalance
      });
    } catch (prodError) {
      console.error('Failed to update product stock:', prodError.message);
    }

    res.json({
      success: true,
      message: 'Stock entry deleted successfully',
      data: {
        currentStock: monthlyDoc.closingBalance
      }
    });

  } catch (error) {
    console.error('DELETE Stock Entry Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete stock entry',
      error: error.message
    });
  }
});

/**
 * GET /api/monthly-stock/excel/:theaterId/:productId
 * Export specific product's monthly stock details to Excel
 */
router.get('/excel/:theaterId/:productId', authenticateToken, requireTheaterAccess, async (req, res) => {
  try {
    const { theaterId, productId } = req.params;
    const { year, month } = req.query;
    const ExcelJS = require('exceljs');
    
    const currentDate = new Date();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;

    // Get monthly stock document
    const monthlyDoc = await MonthlyStock.findOne({
      theaterId,
      productId,
      year: targetYear,
      monthNumber: targetMonth
    });

    if (!monthlyDoc || monthlyDoc.stockDetails.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No stock data found for this period'
      });
    }

    // Get product details
    const product = await getProductById(productId, theaterId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = req.user.username || 'System';
    workbook.created = new Date();

    // Add worksheet
    const worksheet = workbook.addWorksheet('Stock Details');

    // Style definitions
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    const titleStyle = {
      font: { bold: true, size: 16, color: { argb: 'FF8B5CF6' } },
      alignment: { horizontal: 'center' }
    };

    // Add title
    worksheet.mergeCells('A1:L1');
    worksheet.getCell('A1').value = `Stock Management Report - ${product.name}`;
    worksheet.getCell('A1').style = titleStyle;
    worksheet.getRow(1).height = 25;

    // Add metadata
    worksheet.getCell('A2').value = `Period: ${monthlyDoc.month} ${monthlyDoc.year}`;
    worksheet.getCell('A3').value = `Generated By: ${req.user.username}`;
    worksheet.getCell('A4').value = `Generated At: ${new Date().toLocaleString('en-IN')}`;

    // Add summary statistics
    worksheet.getCell('A5').value = `Opening Balance: ${monthlyDoc.carryForward || 0}`;
    worksheet.getCell('D5').value = `Total Added: ${monthlyDoc.totalStockAdded || 0}`;
    worksheet.getCell('G5').value = `Total Used: ${monthlyDoc.totalUsedStock || 0}`;
    worksheet.getCell('J5').value = `Closing Balance: ${monthlyDoc.closingBalance || 0}`;

    // Add headers (row 7)
    const headers = [
      'S.No',
      'Date',
      'Type',
      'Stock Added',
      'Expired Old Stock',
      'Carry Forward',
      'Used Stock',
      'Expired Stock',
      'Damage Stock',
      'Balance',
      'Expire Date',
      'Batch Number'
    ];
    worksheet.getRow(7).values = headers;
    worksheet.getRow(7).eachCell((cell) => {
      cell.style = headerStyle;
    });
    worksheet.getRow(7).height = 20;

    // Set column widths
    worksheet.columns = [
      { width: 8 },   // S.No
      { width: 15 },  // Date
      { width: 12 },  // Type
      { width: 15 },  // Stock Added
      { width: 18 },  // Expired Old Stock
      { width: 15 },  // Carry Forward
      { width: 12 },  // Used Stock
      { width: 15 },  // Expired Stock
      { width: 15 },  // Damage Stock
      { width: 12 },  // Balance
      { width: 15 },  // Expire Date
      { width: 18 }   // Batch Number
    ];

    // Sort stock details by date
    const sortedDetails = monthlyDoc.stockDetails.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Populate data rows
    let rowNumber = 8;
    sortedDetails.forEach((detail, index) => {
      const row = worksheet.getRow(rowNumber);
      row.values = [
        index + 1,
        new Date(detail.date).toLocaleDateString('en-IN'),
        detail.type || 'ADDED',
        detail.stockAdded || 0,
        detail.expiredOldStock || 0,
        detail.carryForward || 0,
        detail.usedStock || 0,
        detail.expiredStock || 0,
        detail.damageStock || 0,
        detail.balance || 0,
        detail.expireDate ? new Date(detail.expireDate).toLocaleDateString('en-IN') : '-',
        detail.batchNumber || '-'
      ];

      // Apply styling
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };
        
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Color coding for stock values
        if (colNumber >= 4 && colNumber <= 9) { // Stock columns
          if (cell.value > 0) {
            cell.font = { color: { argb: 'FF059669' } };
          }
        }

        // Highlight balance
        if (colNumber === 10) {
          cell.font = { bold: true };
        }
      });

      row.height = 18;
      rowNumber++;
    });

    // Add summary row
    rowNumber += 1;
    const summaryRow = worksheet.getRow(rowNumber);
    summaryRow.values = ['', 'SUMMARY', '', '', '', '', '', '', '', '', '', ''];
    summaryRow.eachCell((cell) => {
      cell.font = { bold: true, size: 12 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    });

    rowNumber++;
    worksheet.getCell(`B${rowNumber}`).value = `Total Entries: ${sortedDetails.length}`;
    worksheet.getCell(`D${rowNumber}`).value = `Total Added: ${monthlyDoc.totalStockAdded || 0}`;
    worksheet.getCell(`F${rowNumber}`).value = `Total Used: ${monthlyDoc.totalUsedStock || 0}`;
    worksheet.getCell(`H${rowNumber}`).value = `Total Expired: ${monthlyDoc.totalExpiredStock || 0}`;
    worksheet.getCell(`J${rowNumber}`).value = `Total Damaged: ${monthlyDoc.totalDamageStock || 0}`;

    // Generate Excel file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Stock_${product.name}_${monthlyDoc.month}_${monthlyDoc.year}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Stock Excel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Excel report',
      error: error.message
    });
  }
});

/**
 * GET /api/theater-stock/excel/:theaterId
 * Export all products stock to Excel based on filters
 */
router.get('/excel/:theaterId', authenticateToken, requireTheaterAccess, async (req, res) => {
  console.log('🎯🎯🎯 Excel route ENTERED - theaterId:', req.params.theaterId);
  console.log('🎯🎯🎯 User:', req.user);
  try {
    console.log('🎯 Excel route hit with theaterId:', req.params.theaterId);
    console.log('🔍 Query params:', req.query);
    console.log('🔍 Date param specifically:', req.query.date);
    
    const { theaterId } = req.params;
    const { date, month, year, startDate, endDate, category, status, stockFilter } = req.query;
    const ExcelJS = require('exceljs');
    const mongoose = require('mongoose');

    // If date parameter is provided, download stock management data for that specific date
    if (date) {
      console.log('📅 Date parameter found, calling downloadStockByDate with date:', date);
      console.log('📅 About to call downloadStockByDate...');
      const result = await downloadStockByDate(req, res, theaterId, date, category, status, stockFilter);
      console.log('📅 downloadStockByDate completed');
      return result;
    }
    
    console.log('📋 No date parameter, downloading product list');

    // ✅ FIX: Fetch products from productlist collection (NEW structure)
    const productContainer = await mongoose.connection.db.collection('productlist').findOne({
      theater: new mongoose.Types.ObjectId(theaterId),
      productList: { $exists: true }
    });

    let products = [];
    
    if (productContainer && productContainer.productList) {
      products = productContainer.productList || [];
      console.log('✅ Found products in NEW structure:', products.length);
    } else {
      // Fallback to OLD structure
      const Product = require('../models/Product');
      products = await Product.find({ theaterId: new mongoose.Types.ObjectId(theaterId) }).lean();
      console.log('✅ Found products in OLD structure:', products.length);
    }
    
    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No products found for this theater'
      });
    }
    // Apply category filter
    if (category) {
      products = products.filter(p => String(p.category) === String(category) || String(p.categoryId) === String(category));
    }

    // Apply status filter
    if (status && status !== 'all') {
      if (status === 'live') {
        products = products.filter(p => p.isActive && p.isAvailable);
      } else if (status === 'offline') {
        products = products.filter(p => !p.isActive || !p.isAvailable);
      }
    }

    // Apply stock filter
    if (stockFilter && stockFilter !== 'all') {
      if (stockFilter === 'in-stock') {
        products = products.filter(p => (p.currentStock || 0) > (p.lowStockAlert || 5));
      } else if (stockFilter === 'low-stock') {
        products = products.filter(p => {
          const stock = p.currentStock || 0;
          const alert = p.lowStockAlert || 5;
          return stock > 0 && stock <= alert;
        });
      } else if (stockFilter === 'out-of-stock') {
        products = products.filter(p => (p.currentStock || 0) <= 0);
      }
    }
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = req.user.username || 'System';
    workbook.created = new Date();

    // Add worksheet
    const worksheet = workbook.addWorksheet('Product Stock');

    // Style definitions
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    const titleStyle = {
      font: { bold: true, size: 16, color: { argb: 'FF8B5CF6' } },
      alignment: { horizontal: 'center' }
    };

    // Add title
    worksheet.mergeCells('A1:J1');
    worksheet.getCell('A1').value = 'Product Stock Report';
    worksheet.getCell('A1').style = titleStyle;
    worksheet.getRow(1).height = 25;

    // Add metadata
    worksheet.getCell('A2').value = `Generated By: ${req.user.username}`;
    worksheet.getCell('A3').value = `Generated At: ${new Date().toLocaleString('en-IN')}`;
    
    let filterInfo = 'Filter: ';
    if (date) {
      filterInfo += `Date: ${new Date(date).toLocaleDateString('en-IN')}`;
    } else if (startDate && endDate) {
      filterInfo += `Date Range: ${new Date(startDate).toLocaleDateString('en-IN')} to ${new Date(endDate).toLocaleDateString('en-IN')}`;
    } else if (month && year) {
      filterInfo += `Month: ${new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
    } else {
      filterInfo += 'All Records';
    }
    if (category) {
      filterInfo += ` | Category Filter Applied`;
    }
    if (status && status !== 'all') {
      filterInfo += ` | Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`;
    }
    if (stockFilter && stockFilter !== 'all') {
      filterInfo += ` | Stock: ${stockFilter}`;
    }
    worksheet.getCell('A4').value = filterInfo;

    // Add headers (row 6)
    const headers = ['S.No', 'Product Name', 'Category', 'Price', 'Current Stock', 'Low Stock Alert', 'Stock Status', 'Status', 'GST %', 'Description'];
    worksheet.getRow(6).values = headers;
    worksheet.getRow(6).eachCell((cell) => {
      cell.style = headerStyle;
    });
    worksheet.getRow(6).height = 20;

    // Set column widths
    worksheet.columns = [
      { width: 8 },   // S.No
      { width: 30 },  // Product Name
      { width: 20 },  // Category
      { width: 12 },  // Price
      { width: 15 },  // Current Stock
      { width: 15 },  // Low Stock Alert
      { width: 15 },  // Stock Status
      { width: 12 },  // Status
      { width: 10 },  // GST %
      { width: 40 }   // Description
    ];

    // Populate data rows
    let rowNumber = 7;
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const currentStock = product.currentStock || 0;
      const lowStockAlert = product.lowStockAlert || 5;
      
      let stockStatus = 'In Stock';
      if (currentStock <= 0) {
        stockStatus = 'Out of Stock';
      } else if (currentStock <= lowStockAlert) {
        stockStatus = 'Low Stock';
      }

      const productStatus = (product.isActive && product.isAvailable) ? 'LIVE' : 'OFFLINE';

      const row = worksheet.getRow(rowNumber);
      row.values = [
        i + 1,
        product.name || 'N/A',
        product.categoryName || 'N/A',
        `?${parseFloat(product.sellingPrice || 0).toFixed(2)}`,
        currentStock,
        lowStockAlert,
        stockStatus,
        productStatus,
        product.gstPercentage || 0,
        product.description || 'N/A'
      ];

      // Apply styling
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };
        
        if (colNumber >= 1 && colNumber <= 3) {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Color coding for stock status
        if (colNumber === 7) { // Stock Status column
          if (stockStatus === 'Out of Stock') {
            cell.font = { color: { argb: 'FFDC2626' }, bold: true };
          } else if (stockStatus === 'Low Stock') {
            cell.font = { color: { argb: 'FFEA580C' }, bold: true };
          } else {
            cell.font = { color: { argb: 'FF16A34A' }, bold: true };
          }
        }

        // Color coding for product status
        if (colNumber === 8) { // Status column
          if (productStatus === 'LIVE') {
            cell.font = { color: { argb: 'FF16A34A' }, bold: true };
          } else {
            cell.font = { color: { argb: 'FF6B7280' }, bold: true };
          }
        }
      });

      row.height = 18;
      rowNumber++;
    }

    // Add summary row
    rowNumber += 1;
    const summaryRow = worksheet.getRow(rowNumber);
    summaryRow.values = ['', 'SUMMARY', '', '', '', '', '', '', '', ''];
    summaryRow.eachCell((cell) => {
      cell.font = { bold: true, size: 12 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    });

    rowNumber++;
    const totalProducts = products.length;
    const liveProducts = products.filter(p => p.isActive && p.isAvailable).length;
    const offlineProducts = totalProducts - liveProducts;
    const lowStockProducts = products.filter(p => {
      const stock = p.currentStock || 0;
      const alert = p.lowStockAlert || 5;
      return stock > 0 && stock <= alert;
    }).length;
    const outOfStockProducts = products.filter(p => (p.currentStock || 0) <= 0).length;

    worksheet.getCell(`B${rowNumber}`).value = `Total Products: ${totalProducts}`;
    worksheet.getCell(`D${rowNumber}`).value = `LIVE: ${liveProducts}`;
    worksheet.getCell(`F${rowNumber}`).value = `OFFLINE: ${offlineProducts}`;
    worksheet.getCell(`H${rowNumber}`).value = `Low Stock: ${lowStockProducts}`;
    worksheet.getCell(`J${rowNumber}`).value = `Out of Stock: ${outOfStockProducts}`;

    // Generate Excel file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Product_Stock_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('❌❌❌ Error in Excel route:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Excel report',
      error: error.message
    });
  }
});

/**
 * GET /api/theater-stock/excel-all-history/:theaterId
 * Export day-by-day stock history for ALL products in theater
 */
router.get('/excel-all-history/:theaterId', authenticateToken, requireTheaterAccess, async (req, res) => {
  console.log('🎯 Excel all-history route ENTERED - theaterId:', req.params.theaterId);
  try {
    const { theaterId } = req.params;
    const { year, month } = req.query;
    const ExcelJS = require('exceljs');
    const mongoose = require('mongoose');

    const currentDate = new Date();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;

    console.log('📅 Target period:', targetYear, targetMonth);

    // Fetch all products from productlist collection
    const productContainer = await mongoose.connection.db.collection('productlist').findOne({
      theater: new mongoose.Types.ObjectId(theaterId),
      productList: { $exists: true }
    });

    let products = [];
    
    if (productContainer && productContainer.productList) {
      products = productContainer.productList || [];
      console.log('✅ Found products in productList:', products.length);
    } else {
      // Fallback to OLD structure
      const Product = require('../models/Product');
      products = await Product.find({ theaterId: new mongoose.Types.ObjectId(theaterId) }).lean();
      console.log('✅ Found products in OLD structure:', products.length);
    }
    
    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No products found for this theater'
      });
    }

    console.log('📦 Processing', products.length, 'products');

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = req.user.username || 'System';
    workbook.created = new Date();

    // Add worksheet
    const worksheet = workbook.addWorksheet('All Products Stock History');

    // Style definitions
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    const titleStyle = {
      font: { bold: true, size: 16, color: { argb: 'FF8B5CF6' } },
      alignment: { horizontal: 'center' }
    };

    const productColumnStyle = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } },
      border: {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      }
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[targetMonth - 1];

    // Add title
    worksheet.mergeCells('A1:P1');
    worksheet.getCell('A1').value = `Theater Stock History Report - ${monthName} ${targetYear}`;
    worksheet.getCell('A1').style = titleStyle;
    worksheet.getRow(1).height = 25;

    // Add metadata
    worksheet.getCell('A2').value = `Generated By: ${req.user.username} | Generated At: ${new Date().toLocaleString('en-IN')}`;
    worksheet.getRow(2).height = 18;

    // Add blank row
    worksheet.getRow(3).height = 5;

    // Add headers (row 4)
    const headers = [
      'S.No',
      'Product Name',
      'Category',
      'Price (₹)',
      'Current Stock',
      'Date',
      'Type',
      'Stock Added',
      'Expired Old Stock',
      'Carry Forward',
      'Used Stock',
      'Expired Stock',
      'Damage Stock',
      'Balance',
      'Expire Date',
      'Batch Number'
    ];
    
    worksheet.getRow(4).values = headers;
    worksheet.getRow(4).eachCell((cell) => {
      cell.style = headerStyle;
    });
    worksheet.getRow(4).height = 20;

    // Freeze header row
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 4 }
    ];

    // Set column widths
    worksheet.columns = [
      { width: 8 },   // S.No
      { width: 25 },  // Product Name
      { width: 20 },  // Category
      { width: 12 },  // Price
      { width: 15 },  // Current Stock
      { width: 12 },  // Date
      { width: 12 },  // Type
      { width: 15 },  // Stock Added
      { width: 18 },  // Expired Old Stock
      { width: 15 },  // Carry Forward
      { width: 12 },  // Used Stock
      { width: 15 },  // Expired Stock
      { width: 15 },  // Damage Stock
      { width: 12 },  // Balance
      { width: 15 },  // Expire Date
      { width: 18 }   // Batch Number
    ];

    // Populate data rows
    let globalRowNumber = 5;
    let globalSerialNumber = 1;
    let totalProductsWithData = 0;
    let totalEntriesAcrossAllProducts = 0;

    for (const product of products) {
      // Fetch monthly stock document for this product
      const monthlyDoc = await MonthlyStock.findOne({
        theaterId: new mongoose.Types.ObjectId(theaterId),
        productId: product._id,
        year: targetYear,
        monthNumber: targetMonth
      });

      // Skip products with no stock history for this month
      if (!monthlyDoc || !monthlyDoc.stockDetails || monthlyDoc.stockDetails.length === 0) {
        console.log(`⚠️ No stock data for product: ${product.name}`);
        continue;
      }

      totalProductsWithData++;

      // Sort stock details by date
      const sortedDetails = monthlyDoc.stockDetails.sort((a, b) => new Date(a.date) - new Date(b.date));
      totalEntriesAcrossAllProducts += sortedDetails.length;

      // Product information (reused for each row)
      const productName = product.name || 'N/A';
      const categoryName = product.categoryName || product.category?.name || 'N/A';
      const price = parseFloat(product.sellingPrice || product.pricing?.basePrice || 0).toFixed(2);
      const currentStock = monthlyDoc.closingBalance || 0;

      // Add rows for each stock entry
      for (const detail of sortedDetails) {
        const row = worksheet.getRow(globalRowNumber);
        
        row.values = [
          globalSerialNumber,
          productName,
          categoryName,
          `₹${price}`,
          currentStock,
          new Date(detail.date).toLocaleDateString('en-IN'),
          detail.type || 'ADDED',
          detail.stockAdded || 0,
          detail.expiredOldStock || 0,
          detail.carryForward || 0,
          detail.usedStock || 0,
          detail.expiredStock || 0,
          detail.damageStock || 0,
          detail.balance || 0,
          detail.expireDate ? new Date(detail.expireDate).toLocaleDateString('en-IN') : '',
          detail.batchNumber || ''
        ];

        // Apply styling to each cell
        row.eachCell((cell, colNumber) => {
          // Product information columns (1-5) - light blue background
          if (colNumber >= 1 && colNumber <= 5) {
            cell.style = productColumnStyle;
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          } else {
            // Stock movement columns (6-16) - white background
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }

          // Number columns - right align
          if (colNumber >= 8 && colNumber <= 14) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }

          // Balance column - bold
          if (colNumber === 14) {
            cell.font = { bold: true };
          }
        });

        row.height = 18;
        globalRowNumber++;
        globalSerialNumber++;
      }
    }

    // Add summary at bottom
    globalRowNumber += 1;
    const summaryRow = worksheet.getRow(globalRowNumber);
    summaryRow.values = ['', 'GRAND TOTAL SUMMARY', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    summaryRow.eachCell((cell) => {
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    summaryRow.height = 25;

    globalRowNumber++;
    worksheet.getCell(`A${globalRowNumber}`).value = `Total Products with Data: ${totalProductsWithData}`;
    worksheet.getCell(`A${globalRowNumber}`).font = { bold: true };
    
    worksheet.getCell(`D${globalRowNumber}`).value = `Total Entries: ${totalEntriesAcrossAllProducts}`;
    worksheet.getCell(`D${globalRowNumber}`).font = { bold: true };

    worksheet.getCell(`G${globalRowNumber}`).value = `Period: ${monthName} ${targetYear}`;
    worksheet.getCell(`G${globalRowNumber}`).font = { bold: true };

    console.log(`✅ Generated Excel with ${totalProductsWithData} products, ${totalEntriesAcrossAllProducts} total entries`);

    // Generate Excel file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Theater_Stock_History_${monthName}_${targetYear}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('❌ Error in excel-all-history route:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Excel report',
      error: error.message
    });
  }
});

module.exports = router;

