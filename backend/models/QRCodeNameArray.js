const mongoose = require('mongoose');

/**
 * QRCodeName Schema (Array-based structure like ProductTypes)
 * Manages QR code names/templates for theaters in array format
 * Similar to ProductTypes collection structure
 */
const qrCodeNameSchema = new mongoose.Schema({
  // Theater reference (required)
  theater: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: [true, 'Theater reference is required'],
    index: true,
    unique: true // One document per theater
  },
  
  // Array of QR Code Names (similar to productTypeList)
  qrNameList: [{
    // QR Code Name (e.g., "YQ S-1", "YQ-S2", "S-2")
    qrName: {
      type: String,
      required: [true, 'QR code name is required'],
      trim: true,
      maxlength: [100, 'QR code name cannot exceed 100 characters']
    },
    
    // Seat Class (e.g., "YQ001", "YQ002", "S-2", "GENERAL", "VIP", "PREMIUM")
    seatClass: {
      type: String,
      required: [true, 'Seat class is required'],
      trim: true,
      maxlength: [50, 'Seat class cannot exceed 50 characters']
    },
    
    // Description (optional)
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    
    // Active status (soft delete support)
    isActive: {
      type: Boolean,
      default: true
    },
    
    // Sort order for display
    sortOrder: {
      type: Number,
      default: 0
    },
    
    // Timestamps for individual QR name
    createdAt: {
      type: Date,
      default: Date.now
    },
    
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata (similar to ProductTypes)
  metadata: {
    totalQRNames: {
      type: Number,
      default: 0
    },
    activeQRNames: {
      type: Number,
      default: 0
    },
    inactiveQRNames: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  collection: 'qrcodenames' // Keep same collection name
});

/**
 * Indexes for performance optimization
 */
qrCodeNameSchema.index({ theater: 1 });
qrCodeNameSchema.index({ 'qrNameList.qrName': 'text', 'qrNameList.seatClass': 'text' });
qrCodeNameSchema.index({ 'qrNameList.isActive': 1 });

/**
 * Pre-save middleware to update metadata
 */
qrCodeNameSchema.pre('save', function(next) {
  if (this.isModified('qrNameList')) {
    this.metadata.totalQRNames = this.qrNameList.length;
    this.metadata.activeQRNames = this.qrNameList.filter(qr => qr.isActive).length;
    this.metadata.inactiveQRNames = this.qrNameList.filter(qr => !qr.isActive).length;
    this.metadata.lastUpdated = new Date();
  }
  next();
});

/**
 * Methods for managing QR names (similar to ProductTypes methods)
 */

// Method to add a new QR name
qrCodeNameSchema.methods.addQRName = function(qrNameData) {
  const newQRName = {
    ...qrNameData,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  };
  
  this.qrNameList.push(newQRName);
  return this.save();
};

// Method to update a QR name
qrCodeNameSchema.methods.updateQRName = function(qrNameId, updates) {
  const qrName = this.qrNameList.id(qrNameId);
  if (!qrName) {
    throw new Error('QR name not found');
  }
  
  Object.assign(qrName, updates);
  qrName.updatedAt = new Date();
  return this.save();
};

// Method to deactivate a QR name (soft delete)
qrCodeNameSchema.methods.deactivateQRName = function(qrNameId) {
  const qrName = this.qrNameList.id(qrNameId);
  if (!qrName) {
    throw new Error('QR name not found');
  }
  
  qrName.isActive = false;
  qrName.updatedAt = new Date();
  return this.save();
};

// Method to permanently delete a QR name
qrCodeNameSchema.methods.deleteQRName = function(qrNameId) {
  const qrName = this.qrNameList.id(qrNameId);
  if (!qrName) {
    throw new Error('QR name not found');
  }
  
  this.qrNameList.pull(qrNameId);
  return this.save();
};

// Static method to find or create QR names document for a theater
qrCodeNameSchema.statics.findOrCreateByTheater = async function(theaterId) {
  let doc = await this.findOne({ theater: theaterId });
  
  if (!doc) {
    doc = new this({
      theater: theaterId,
      qrNameList: [],
      metadata: {
        totalQRNames: 0,
        activeQRNames: 0,
        inactiveQRNames: 0,
        lastUpdated: new Date()
      }
    });
  }
  
  return doc;
};

// Static method to find QR names by theater
qrCodeNameSchema.statics.findByTheater = function(theaterId, options = {}) {
  const query = { theater: theaterId };
  
  if (options.isActive !== undefined) {
    query['qrNameList.isActive'] = options.isActive;
  }
  
  return this.findOne(query);
};

// Virtual properties
qrCodeNameSchema.virtual('activeQRNamesList').get(function() {
  return this.qrNameList.filter(qr => qr.isActive);
});

qrCodeNameSchema.virtual('inactiveQRNamesList').get(function() {
  return this.qrNameList.filter(qr => !qr.isActive);
});

// Ensure virtual fields are serialized
qrCodeNameSchema.set('toJSON', { virtuals: true });
qrCodeNameSchema.set('toObject', { virtuals: true });

// Use different model name to avoid conflict with QRCodeName model
const QRCodeNameArray = mongoose.model('QRCodeNameArray', qrCodeNameSchema);

module.exports = QRCodeNameArray;