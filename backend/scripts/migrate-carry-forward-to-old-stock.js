/**
 * Database Migration Script: Rename "carryForward" to "oldStock"
 * 
 * This script migrates all existing database documents to use "oldStock" instead of "carryForward"
 * 
 * Usage: node backend/scripts/migrate-carry-forward-to-old-stock.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpay';

async function migrateDatabase() {
  try {
    console.log('🔄 Starting migration: carryForward → oldStock');
    console.log('📡 Connecting to MongoDB...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('monthlystocks');
    
    // Get all documents
    const documents = await collection.find({}).toArray();
    console.log(`📊 Found ${documents.length} monthly stock documents to migrate`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const doc of documents) {
      try {
        const updateFields = {};
        let hasChanges = false;
        
        // Update top-level carryForward field
        if (doc.carryForward !== undefined) {
          updateFields.oldStock = doc.carryForward;
          hasChanges = true;
        }
        
        // Update expiredCarryForwardStock
        if (doc.expiredCarryForwardStock !== undefined) {
          updateFields.expiredOldStock = doc.expiredCarryForwardStock;
          hasChanges = true;
        }
        
        // Update usedCarryForwardStock
        if (doc.usedCarryForwardStock !== undefined) {
          updateFields.usedOldStock = doc.usedCarryForwardStock;
          hasChanges = true;
        }
        
        // Update carryForward in stockDetails array
        if (doc.stockDetails && Array.isArray(doc.stockDetails)) {
          const updatedStockDetails = doc.stockDetails.map(detail => {
            const updatedDetail = { ...detail };
            if (detail.carryForward !== undefined) {
              updatedDetail.oldStock = detail.carryForward;
              delete updatedDetail.carryForward;
            }
            return updatedDetail;
          });
          
          if (updatedStockDetails.some((detail, index) => detail.oldStock !== doc.stockDetails[index]?.carryForward)) {
            updateFields.stockDetails = updatedStockDetails;
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          // Remove old fields
          const unsetFields = {};
          if (doc.carryForward !== undefined) {
            unsetFields.carryForward = '';
          }
          if (doc.expiredCarryForwardStock !== undefined) {
            unsetFields.expiredCarryForwardStock = '';
          }
          if (doc.usedCarryForwardStock !== undefined) {
            unsetFields.usedCarryForwardStock = '';
          }
          
          await collection.updateOne(
            { _id: doc._id },
            {
              $set: updateFields,
              $unset: unsetFields
            }
          );
          
          updatedCount++;
          console.log(`✅ Migrated document: ${doc._id}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error migrating document ${doc._id}:`, error.message);
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${updatedCount} documents`);
    console.log(`   ❌ Errors: ${errorCount} documents`);
    console.log(`   📊 Total processed: ${documents.length} documents`);
    
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

