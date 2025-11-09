const mongoose = require('mongoose');

const theaterUserSchema = new mongoose.Schema({
  theater: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: true
  },
  username: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },
  permissions: {
    canManageOrders: { type: Boolean, default: false },
    canManageMenu: { type: Boolean, default: false },
    canViewReports: { type: Boolean, default: false },
    canManageQR: { type: Boolean, default: false },
    canManageSettings: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  profileImage: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastLogin: {
    type: Date
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
  timestamps: true,
  collection: 'theaterusers' // Explicitly set collection name
});

// Indexes
theaterUserSchema.index({ theater: 1, username: 1 }, { unique: true });
theaterUserSchema.index({ email: 1 }, { unique: true });
theaterUserSchema.index({ theater: 1 });
theaterUserSchema.index({ role: 1 });
theaterUserSchema.index({ isActive: 1 });

// Note: Password hashing is done in the route, not here
// to avoid double hashing

module.exports = mongoose.model('TheaterUser', theaterUserSchema);
