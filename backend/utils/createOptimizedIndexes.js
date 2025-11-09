/**
 * Create Optimized Database Indexes
 * Run this script to create all necessary indexes for optimal query performance
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// Import models (with error handling for optional models)
const Theater = require('../models/Theater');
const Product = require('../models/Product');
const Order = require('../models/Order');
const TheaterOrders = require('../models/TheaterOrders');
const Category = require('../models/Category');
const Stock = require('../models/Stock');
const MonthlyStock = require('../models/MonthlyStock');
const Role = require('../models/Role');
const RoleArray = require('../models/RoleArray');
const SingleQRCode = require('../models/SingleQRCode');
const PageAccessArray = require('../models/PageAccessArray');
const TheaterUserArray = require('../models/TheaterUserArray');

// Optional models
let QRCodeName, QRCodeNameArray;
try {
  QRCodeName = require('../models/QRCodeName');
} catch (e) {
  console.warn('⚠️  QRCodeName model not available');
}
try {
  QRCodeNameArray = require('../models/QRCodeNameArray');
} catch (e) {
  console.warn('⚠️  QRCodeNameArray model not available');
}

/**
 * Create indexes for optimal query performance
 */
const createIndexes = async () => {
  try {
    console.log('🚀 Starting index creation...\n');

    // Theater indexes
    console.log('📊 Creating Theater indexes...');
    await Theater.collection.createIndex({ username: 1 }, { unique: true, background: true });
    await Theater.collection.createIndex({ email: 1 }, { background: true });
    await Theater.collection.createIndex({ isActive: 1, createdAt: 1 }, { background: true });
    await Theater.collection.createIndex({ name: 'text', username: 'text', email: 'text' }, { background: true });
    await Theater.collection.createIndex({ 'address.city': 1, 'address.state': 1 }, { background: true });
    await Theater.collection.createIndex({ createdAt: 1 }, { background: true });
    console.log('✅ Theater indexes created');

    // Product indexes
    console.log('📊 Creating Product indexes...');
    await Product.collection.createIndex({ theaterId: 1, categoryId: 1 }, { background: true });
    await Product.collection.createIndex({ theaterId: 1, isActive: 1, status: 1 }, { background: true });
    await Product.collection.createIndex({ theaterId: 1, name: 'text' }, { background: true });
    await Product.collection.createIndex({ theaterId: 1, createdAt: -1 }, { background: true });
    await Product.collection.createIndex({ 'inventory.currentStock': 1 }, { background: true });
    console.log('✅ Product indexes created');

    // Order indexes
    console.log('📊 Creating Order indexes...');
    await Order.collection.createIndex({ theaterId: 1, createdAt: -1 }, { background: true });
    await Order.collection.createIndex({ theaterId: 1, status: 1, createdAt: -1 }, { background: true });
    await Order.collection.createIndex({ orderNumber: 1 }, { unique: true, background: true });
    await Order.collection.createIndex({ 'customerInfo.phone': 1 }, { background: true });
    await Order.collection.createIndex({ createdAt: -1 }, { background: true });
    await Order.collection.createIndex({ status: 1, createdAt: -1 }, { background: true });
    console.log('✅ Order indexes created');

    // TheaterOrders indexes
    console.log('📊 Creating TheaterOrders indexes...');
    await TheaterOrders.collection.createIndex({ theater: 1, 'orders.createdAt': -1 }, { background: true });
    await TheaterOrders.collection.createIndex({ theater: 1 }, { background: true });
    console.log('✅ TheaterOrders indexes created');

    // Category indexes
    console.log('📊 Creating Category indexes...');
    await Category.collection.createIndex({ theaterId: 1, isActive: 1 }, { background: true });
    await Category.collection.createIndex({ theaterId: 1, createdAt: -1 }, { background: true });
    console.log('✅ Category indexes created');

    // Stock indexes
    console.log('📊 Creating Stock indexes...');
    await Stock.collection.createIndex({ theaterId: 1, productId: 1, date: -1 }, { background: true });
    await Stock.collection.createIndex({ theaterId: 1, date: -1 }, { background: true });
    await Stock.collection.createIndex({ date: -1 }, { background: true });
    console.log('✅ Stock indexes created');

    // MonthlyStock indexes
    console.log('📊 Creating MonthlyStock indexes...');
    await MonthlyStock.collection.createIndex({ theaterId: 1, productId: 1, month: -1, year: -1 }, { background: true });
    await MonthlyStock.collection.createIndex({ theaterId: 1, month: -1, year: -1 }, { background: true });
    console.log('✅ MonthlyStock indexes created');

    // Role indexes
    console.log('📊 Creating Role indexes...');
    await Role.collection.createIndex({ theaterId: 1 }, { background: true });
    await Role.collection.createIndex({ name: 1, theaterId: 1 }, { background: true });
    console.log('✅ Role indexes created');

    // RoleArray indexes
    console.log('📊 Creating RoleArray indexes...');
    await RoleArray.collection.createIndex({ theaterId: 1 }, { unique: true, background: true });
    await RoleArray.collection.createIndex({ 'roles.name': 1 }, { background: true });
    console.log('✅ RoleArray indexes created');

    // QRCodeName indexes (if model exists)
    if (QRCodeName) {
      console.log('📊 Creating QRCodeName indexes...');
      await QRCodeName.collection.createIndex({ theaterId: 1 }, { background: true });
      await QRCodeName.collection.createIndex({ name: 1, theaterId: 1 }, { background: true });
      console.log('✅ QRCodeName indexes created');
    }

    // QRCodeNameArray indexes (if model exists)
    if (QRCodeNameArray) {
      console.log('📊 Creating QRCodeNameArray indexes...');
      await QRCodeNameArray.collection.createIndex({ theaterId: 1 }, { unique: true, background: true });
      await QRCodeNameArray.collection.createIndex({ 'qrCodeNames.name': 1 }, { background: true });
      console.log('✅ QRCodeNameArray indexes created');
    }

    // SingleQRCode indexes
    console.log('📊 Creating SingleQRCode indexes...');
    await SingleQRCode.collection.createIndex({ theaterId: 1, qrType: 1 }, { background: true });
    await SingleQRCode.collection.createIndex({ theaterId: 1, qrName: 1 }, { background: true });
    await SingleQRCode.collection.createIndex({ theaterId: 1, createdAt: -1 }, { background: true });
    console.log('✅ SingleQRCode indexes created');

    // PageAccessArray indexes
    console.log('📊 Creating PageAccessArray indexes...');
    await PageAccessArray.collection.createIndex({ theaterId: 1 }, { unique: true, background: true });
    await PageAccessArray.collection.createIndex({ 'pageAccess.page': 1 }, { background: true });
    console.log('✅ PageAccessArray indexes created');

    // TheaterUserArray indexes
    console.log('📊 Creating TheaterUserArray indexes...');
    await TheaterUserArray.collection.createIndex({ theaterId: 1 }, { unique: true, background: true });
    await TheaterUserArray.collection.createIndex({ 'users.username': 1 }, { background: true });
    await TheaterUserArray.collection.createIndex({ 'users.isActive': 1 }, { background: true });
    console.log('✅ TheaterUserArray indexes created');

    console.log('\n✅ All indexes created successfully!');
    console.log('📈 Query performance should be significantly improved.\n');

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    await createIndexes();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });
}

module.exports = { createIndexes };

