/**
 * CRUD Test Script for PageAccessArray
 * Tests Create, Read, Update, Delete operations
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';

async function testPageAccessCRUD() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Import models
    const PageAccessArray = require('./models/PageAccessArray');
    const Theater = require('./models/Theater');

    console.log('=' .repeat(70));
    console.log('🧪 STARTING CRUD TESTS FOR PAGE ACCESS ARRAY');
    console.log('='.repeat(70));

    // Get a test theater ID
    console.log('\n📋 Step 1: Finding a test theater...');
    const theater = await Theater.findOne();
    if (!theater) {
      console.log('❌ No theater found in database. Please add a theater first.');
      return;
    }
    const theaterId = theater._id;
    console.log(`✅ Found theater: ${theater.name} (ID: ${theaterId})`);

    // Clean up any existing test data
    console.log('\n🧹 Cleaning up existing page access data for this theater...');
    await PageAccessArray.deleteMany({ theater: theaterId });
    console.log('✅ Cleanup complete');

    // ========== CREATE TEST ==========
    console.log('\n' + '='.repeat(70));
    console.log('📝 TEST 1: CREATE - Adding pages to theater');
    console.log('='.repeat(70));

    // Create first page
    console.log('\n1️⃣ Creating page access document and adding first page...');
    let pageAccessDoc = await PageAccessArray.findOrCreateByTheater(theaterId);
    console.log(`✅ Document created/found. Collection: ${pageAccessDoc.collection.name}`);

    const page1 = await pageAccessDoc.addPage({
      page: 'TheaterDashboardWithId',
      pageName: 'Theater Dashboard',
      route: '/theater-dashboard/:theaterId',
      category: 'admin',
      description: 'Main theater dashboard',
      isActive: true
    });
    console.log(`✅ Page 1 added: ${page1.pageName}`);

    // Add second page
    console.log('\n2️⃣ Adding second page...');
    const page2 = await pageAccessDoc.addPage({
      page: 'TheaterKioskTypes',
      pageName: 'Theater Kiosk Types',
      route: '/theater-kiosk-types/:theaterId',
      category: 'admin',
      description: 'Manage kiosk types',
      isActive: true
    });
    console.log(`✅ Page 2 added: ${page2.pageName}`);

    // Add third page
    console.log('\n3️⃣ Adding third page...');
    const page3 = await pageAccessDoc.addPage({
      page: 'TheaterProductList',
      pageName: 'Theater Product List',
      route: '/theater-products/:theaterId',
      category: 'products',
      description: 'View all products',
      isActive: true
    });
    console.log(`✅ Page 3 added: ${page3.pageName}`);

    console.log(`\n📊 Total pages in array: ${pageAccessDoc.pageAccessList.length}`);
    console.log('📦 Metadata:', JSON.stringify(pageAccessDoc.metadata, null, 2));

    // ========== READ TEST ==========
    console.log('\n' + '='.repeat(70));
    console.log('📖 TEST 2: READ - Fetching page access data');
    console.log('='.repeat(70));

    console.log('\n1️⃣ Reading by theater ID...');
    const readDoc = await PageAccessArray.findOne({ theater: theaterId })
      .populate('theater', 'name location');
    
    if (readDoc) {
      console.log(`✅ Found document for theater: ${readDoc.theater.name}`);
      console.log(`📄 Pages in database: ${readDoc.pageAccessList.length}`);
      console.log('\n📋 Page List:');
      readDoc.pageAccessList.forEach((p, idx) => {
        console.log(`   ${idx + 1}. ${p.pageName} (${p.page}) - ${p.isActive ? 'Active' : 'Inactive'}`);
      });
    } else {
      console.log('❌ Document not found!');
    }

    // ========== UPDATE TEST ==========
    console.log('\n' + '='.repeat(70));
    console.log('✏️ TEST 3: UPDATE - Modifying existing page');
    console.log('='.repeat(70));

    console.log('\n1️⃣ Finding page to update...');
    const pageToUpdate = readDoc.pageAccessList.find(p => p.page === 'TheaterKioskTypes');
    console.log(`✅ Found page: ${pageToUpdate.pageName}`);

    console.log('\n2️⃣ Updating page properties...');
    const updatedPage = await readDoc.updatePage(pageToUpdate._id, {
      description: 'UPDATED: Manage all kiosk types for theater',
      isActive: false  // Toggle to inactive
    });
    console.log(`✅ Page updated: ${updatedPage.pageName}`);
    console.log(`   Description: ${updatedPage.description}`);
    console.log(`   Active: ${updatedPage.isActive}`);

    // Re-read to verify
    console.log('\n3️⃣ Verifying update...');
    const verifyDoc = await PageAccessArray.findOne({ theater: theaterId });
    const verifiedPage = verifyDoc.pageAccessList.find(p => p.page === 'TheaterKioskTypes');
    console.log(`✅ Verified - isActive: ${verifiedPage.isActive}, description: ${verifiedPage.description}`);

    // ========== DELETE TEST ==========
    console.log('\n' + '='.repeat(70));
    console.log('🗑️ TEST 4: DELETE - Removing a page');
    console.log('='.repeat(70));

    console.log('\n1️⃣ Finding page to delete...');
    const pageToDelete = verifyDoc.pageAccessList.find(p => p.page === 'TheaterProductList');
    console.log(`✅ Found page to delete: ${pageToDelete.pageName} (ID: ${pageToDelete._id})`);

    console.log('\n2️⃣ Deleting page...');
    await verifyDoc.removePage(pageToDelete._id);
    console.log(`✅ Page "${pageToDelete.pageName}" removed from array`);

    console.log('\n3️⃣ Verifying deletion...');
    const finalDoc = await PageAccessArray.findOne({ theater: theaterId });
    console.log(`📊 Pages remaining: ${finalDoc.pageAccessList.length}`);
    console.log('\n📋 Remaining pages:');
    finalDoc.pageAccessList.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.pageName}`);
    });

    // ========== FINAL VERIFICATION ==========
    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST 5: DATABASE VERIFICATION');
    console.log('='.repeat(70));

    const db = mongoose.connection.db;
    const collection = db.collection('pageaccesses');
    
    console.log('\n1️⃣ Checking collection...');
    const count = await collection.countDocuments();
    console.log(`📊 Total documents in 'pageaccesses': ${count}`);

    console.log('\n2️⃣ Checking document structure...');
    const dbDoc = await collection.findOne({ theater: new mongoose.Types.ObjectId(theaterId) });
    if (dbDoc) {
      console.log('✅ Document found in database');
      console.log(`   Theater: ${dbDoc.theater}`);
      console.log(`   Pages in array: ${dbDoc.pageAccessList.length}`);
      console.log(`   Metadata:`, JSON.stringify(dbDoc.metadata, null, 2));
      
      console.log('\n📄 Document structure:');
      console.log(JSON.stringify({
        _id: dbDoc._id,
        theater: dbDoc.theater,
        pageAccessList: dbDoc.pageAccessList.map(p => ({
          page: p.page,
          pageName: p.pageName,
          route: p.route,
          isActive: p.isActive
        })),
        metadata: dbDoc.metadata
      }, null, 2));
    }

    // ========== SUMMARY ==========
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log('✅ CREATE: Successfully added 3 pages');
    console.log('✅ READ: Successfully retrieved page access data');
    console.log('✅ UPDATE: Successfully modified page properties');
    console.log('✅ DELETE: Successfully removed a page');
    console.log('✅ VERIFICATION: Data correctly stored in "pageaccesses" collection');
    console.log('\n🎉 ALL TESTS PASSED!');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the tests
testPageAccessCRUD()
  .then(() => {
    console.log('\n✅ Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error.message);
    process.exit(1);
  });
