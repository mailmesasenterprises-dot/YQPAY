const mongoose = require('mongoose');

// Individual stock detail entry within a month
const stockDetailSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ['ADDED', 'SOLD', 'EXPIRED', 'DAMAGED', 'RETURNED', 'ADJUSTMENT'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  stockAdded: {
    type: Number,
    default: 0
  },
  // NEW: Day-by-day tracking
  carryForward: {
    type: Number,
    default: 0,
    comment: 'Opening balance from previous day'
  },
  expiredOldStock: {
    type: Number,
    default: 0,
    comment: 'Stock from previous days that expired today'
  },
  usedStock: {
    type: Number,
    default: 0
  },
  // NEW: Track when stock was used (for month-based filtering)
  usageHistory: [{
    year: Number,
    month: Number,
    quantity: Number,
    orderDate: Date
  }],
  expiredStock: {
    type: Number,
    default: 0,
    comment: 'Today added stock that expired'
  },
  damageStock: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    required: true,
    comment: 'Closing balance for this day'
  },
  expireDate: Date,
  batchNumber: String,
  notes: String,
  // FIFO tracking: stores details of which stocks were deducted for SOLD entries
  fifoDetails: [{
    date: Date,
    batchNumber: String,
    deducted: Number,
    expireDate: Date
  }]
}, { _id: true });

// Monthly stock document schema
const monthlyStockSchema = new mongoose.Schema({
  theaterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: [true, 'Theater ID is required'],
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required'],
    index: true
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: 2020,
    max: 2100
  },
  month: {
    type: String,
    required: [true, 'Month is required'],
    enum: ['January', 'February', 'March', 'April', 'May', 'June', 
           'July', 'August', 'September', 'October', 'November', 'December']
  },
  monthNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  stockDetails: [stockDetailSchema],
  
  // Monthly totals
  totalStockAdded: {
    type: Number,
    default: 0
  },
  totalUsedStock: {
    type: Number,
    default: 0
  },
  totalExpiredStock: {
    type: Number,
    default: 0
  },
  // Expired stock from carry forward (previous months' stock that expired this month)
  expiredCarryForwardStock: {
    type: Number,
    default: 0
  },
  // NEW: Used stock from carry forward (previous months' stock that was sold this month)
  usedCarryForwardStock: {
    type: Number,
    default: 0
  },
  totalDamageStock: {
    type: Number,
    default: 0
  },
  
  // Carry forward from previous month
  carryForward: {
    type: Number,
    default: 0
  },
  
  // Closing balance for the month (will be opening balance for next month)
  closingBalance: {
    type: Number,
    default: 0
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
monthlyStockSchema.index({ theaterId: 1, productId: 1, year: 1, monthNumber: 1 }, { unique: true });
monthlyStockSchema.index({ theaterId: 1, year: 1, monthNumber: 1 });

// Pre-save hook to calculate totals
monthlyStockSchema.pre('save', function(next) {
  // Calculate monthly totals from stockDetails array
  this.totalStockAdded = 0;
  this.totalUsedStock = 0;
  this.totalExpiredStock = 0;
  this.totalDamageStock = 0;
  
  this.stockDetails.forEach(detail => {
    this.totalStockAdded += detail.stockAdded || 0;
    // ✅ FIFO FIX: Only count usedStock from ADDED entries to avoid double counting
    // SOLD entries are for display/tracking only; actual deductions are in ADDED entries
    if (detail.type === 'ADDED') {
      this.totalUsedStock += detail.usedStock || 0;
    }
    this.totalExpiredStock += detail.expiredStock || 0;
    this.totalDamageStock += detail.damageStock || 0;
  });
  
  // ✅ CRITICAL FIX: Calculate closing balance from carry forward + totals
  // Includes expired carry forward stock (old stock that expired this month)
  this.closingBalance = Math.max(0, 
    (this.carryForward || 0) + 
    (this.totalStockAdded || 0) - 
    (this.totalUsedStock || 0) - 
    (this.totalExpiredStock || 0) - 
    (this.expiredCarryForwardStock || 0) - 
    (this.totalDamageStock || 0)
  );
  
  this.updatedAt = new Date();
  next();
});

// Static method to get or create monthly document
monthlyStockSchema.statics.getOrCreateMonthlyDoc = async function(theaterId, productId, year, monthNumber, carryForward = 0) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  const month = monthNames[monthNumber - 1];
  
  let doc = await this.findOne({
    theaterId,
    productId,
    year,
    monthNumber
  });
  
  if (!doc) {
    // Create new document with carry forward
    doc = await this.create({
      theaterId,
      productId,
      year,
      month,
      monthNumber,
      stockDetails: [],
      carryForward,
      totalStockAdded: 0,
      totalUsedStock: 0,
      totalExpiredStock: 0,
      totalDamageStock: 0,
      closingBalance: carryForward
    });
  } else {
    // ✅ FIX: Update carryForward if it has changed and document has no entries yet
    // This handles the case where previous month's data was added after this month's document was created
    if (doc.stockDetails.length === 0 && doc.carryForward !== carryForward) {
      doc.carryForward = carryForward;
      doc.closingBalance = carryForward;
      await doc.save();
    }
    // ✅ FIX: If document has entries, recalculate all balances if carryForward changed
    else if (doc.stockDetails.length > 0 && doc.carryForward !== carryForward) {
      doc.carryForward = carryForward;
      
      // Recalculate all entry balances from the beginning
      let runningBalance = carryForward;
      for (let i = 0; i < doc.stockDetails.length; i++) {
        const entry = doc.stockDetails[i];
        runningBalance = runningBalance + entry.stockAdded - entry.usedStock - entry.expiredStock - entry.damageStock;
        entry.balance = Math.max(0, runningBalance);
        runningBalance = entry.balance;
      }
      
      await doc.save();
    }
  }
  
  return doc;
};

// Static method to get previous month's closing balance
monthlyStockSchema.statics.getPreviousMonthBalance = async function(theaterId, productId, year, monthNumber) {
  let prevYear = year;
  let prevMonth = monthNumber - 1;
  
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  
  const prevDoc = await this.findOne({
    theaterId,
    productId,
    year: prevYear,
    monthNumber: prevMonth
  });
  
  return prevDoc ? prevDoc.closingBalance : 0;
};

const MonthlyStock = mongoose.model('MonthlyStock', monthlyStockSchema);

module.exports = MonthlyStock;
