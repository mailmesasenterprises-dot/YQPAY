/**
 * Database Migration Script: Rename "stockAdded" to "invordStock"
 * 
 * This script migrates all existing database documents to use "invordStock" instead of "stockAdded"
 * 
 * Usage: node backend/scripts/migrate-stock-added-to-invord-stock.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpay';

async function migrateDatabase() {
  try {
    console.log('🔄 Starting migration: stockAdded → invordStock');
    console.log('📡 Connecting to MongoDB...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const monthlyStocksCollection = db.collection('monthlystocks');
    const stocksCollection = db.collection('stocks');
    
    // Migrate monthlystocks collection
    const monthlyDocs = await monthlyStocksCollection.find({}).toArray();
    console.log(`📊 Found ${monthlyDocs.length} monthly stock documents to migrate`);
    
    let monthlyUpdatedCount = 0;
    let monthlyErrorCount = 0;
    
    for (const doc of monthlyDocs) {
      try {
        const updateFields = {};
        let hasChanges = false;
        
        // Update top-level totalStockAdded field
        if (doc.totalStockAdded !== undefined) {
          updateFields.totalInvordStock = doc.totalStockAdded;
          hasChanges = true;
        }
        
        // Update stockAdded in stockDetails array
        if (doc.stockDetails && Array.isArray(doc.stockDetails)) {
          const updatedStockDetails = doc.stockDetails.map(detail => {
            const updatedDetail = { ...detail };
            if (detail.stockAdded !== undefined) {
              updatedDetail.invordStock = detail.stockAdded;
              delete updatedDetail.stockAdded;
            }
            return updatedDetail;
          });
          
          if (updatedStockDetails.some((detail, index) => detail.invordStock !== doc.stockDetails[index]?.stockAdded)) {
            updateFields.stockDetails = updatedStockDetails;
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          // Remove old fields
          const unsetFields = {};
          if (doc.totalStockAdded !== undefined) {
            unsetFields.totalStockAdded = '';
          }
          
          await monthlyStocksCollection.updateOne(
            { _id: doc._id },
            {
              $set: updateFields,
              $unset: unsetFields
            }
          );
          
          monthlyUpdatedCount++;
          console.log(`✅ Migrated monthly stock document: ${doc._id}`);
        }
      } catch (error) {
        monthlyErrorCount++;
        console.error(`❌ Error migrating monthly stock document ${doc._id}:`, error.message);
      }
    }
    
    // Migrate stocks collection (if it exists)
    const stockDocs = await stocksCollection.find({}).toArray();
    console.log(`📊 Found ${stockDocs.length} stock documents to migrate`);
    
    let stockUpdatedCount = 0;
    let stockErrorCount = 0;
    
    for (const doc of stockDocs) {
      try {
        const updateFields = {};
        let hasChanges = false;
        
        // Update displayData.stockAdded
        if (doc.displayData && doc.displayData.stockAdded !== undefined) {
          if (!updateFields.displayData) {
            updateFields.displayData = { ...doc.displayData };
          }
          updateFields.displayData.invordStock = doc.displayData.stockAdded;
          delete updateFields.displayData.stockAdded;
          hasChanges = true;
        }
        
        if (hasChanges) {
          // Remove old fields
          const unsetFields = {};
          if (doc.displayData && doc.displayData.stockAdded !== undefined) {
            unsetFields['displayData.stockAdded'] = '';
          }
          
          await stocksCollection.updateOne(
            { _id: doc._id },
            {
              $set: updateFields,
              $unset: unsetFields
            }
          );
          
          stockUpdatedCount++;
          console.log(`✅ Migrated stock document: ${doc._id}`);
        }
      } catch (error) {
        stockErrorCount++;
        console.error(`❌ Error migrating stock document ${doc._id}:`, error.message);
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`   Monthly Stocks:`);
    console.log(`     ✅ Successfully migrated: ${monthlyUpdatedCount} documents`);
    console.log(`     ❌ Errors: ${monthlyErrorCount} documents`);
    console.log(`   Stocks:`);
    console.log(`     ✅ Successfully migrated: ${stockUpdatedCount} documents`);
    console.log(`     ❌ Errors: ${stockErrorCount} documents`);
    console.log(`   📊 Total processed: ${monthlyDocs.length + stockDocs.length} documents`);
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run migration
migrateDatabase();

