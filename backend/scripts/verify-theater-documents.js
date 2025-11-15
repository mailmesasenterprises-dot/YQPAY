/**
 * Verification Script: Check Theater Documents in Database
 * 
 * This script verifies that theater documents are properly saved in the database.
 * It checks existing theaters and reports on document status.
 */

const mongoose = require('mongoose');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/test';

/**
 * Verify documents in database
 */
async function verifyTheaterDocuments() {
  try {
    console.log('🔍 Theater Document Verification\n');
    console.log('='.repeat(60));
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get Theater model
    const Theater = require('../models/Theater');
    
    // Find all theaters
    console.log('🔍 Fetching all theaters from database...');
    const theaters = await Theater.find({}).lean();
    console.log(`✅ Found ${theaters.length} theater(s) in database\n`);
    
    if (theaters.length === 0) {
      console.log('ℹ️  No theaters found in database. Create a theater first and run this script again.');
      await mongoose.disconnect();
      return;
    }
    
    // Analyze each theater
    let theatersWithDocuments = 0;
    let theatersWithoutDocuments = 0;
    let totalDocumentsSaved = 0;
    
    const documentTypes = [
      'theaterPhoto',
      'logo',
      'aadharCard',
      'panCard',
      'gstCertificate',
      'fssaiCertificate',
      'agreementCopy'
    ];
    
    theaters.forEach((theater, index) => {
      console.log(`\n📋 Theater ${index + 1}: ${theater.name || 'Unnamed'} (ID: ${theater._id})`);
      console.log('   Username:', theater.username || 'N/A');
      
      if (!theater.documents) {
        console.log('   ❌ Documents field: MISSING');
        theatersWithoutDocuments++;
        return;
      }
      
      const documents = theater.documents;
      let docCount = 0;
      let hasDocuments = false;
      
      console.log('   📄 Documents:');
      documentTypes.forEach(docType => {
        const docUrl = documents[docType];
        if (docUrl && docUrl !== null && docUrl !== '') {
          console.log(`      ✅ ${docType}: SAVED`);
          console.log(`         URL: ${docUrl.substring(0, 100)}${docUrl.length > 100 ? '...' : ''}`);
          
          // Check if it's a GCS URL
          if (docUrl.startsWith('https://storage.googleapis.com') || 
              docUrl.includes('googleapis.com') ||
              docUrl.startsWith('gs://')) {
            console.log('         Type: Google Cloud Storage ✅');
          } else if (docUrl.startsWith('data:')) {
            console.log('         Type: Base64 Data URL ⚠️  (not in GCS)');
          } else if (docUrl.startsWith('http')) {
            console.log('         Type: External URL');
          } else {
            console.log('         Type: Unknown format');
          }
          
          docCount++;
          hasDocuments = true;
        } else {
          console.log(`      ❌ ${docType}: NOT SAVED (${docUrl === null ? 'null' : docUrl === '' ? 'empty' : 'undefined'})`);
        }
      });
      
      if (hasDocuments) {
        theatersWithDocuments++;
        totalDocumentsSaved += docCount;
        console.log(`   📊 Summary: ${docCount}/${documentTypes.length} documents saved`);
      } else {
        theatersWithoutDocuments++;
        console.log(`   ❌ No documents saved for this theater`);
      }
      
      // Check agreement copy
      if (theater.agreementDetails && theater.agreementDetails.copy) {
        console.log(`   📄 Agreement Copy: ${theater.agreementDetails.copy.substring(0, 100)}...`);
      }
      
      // Check branding logo
      if (theater.branding && theater.branding.logo) {
        console.log(`   🎨 Branding Logo: ${theater.branding.logo.substring(0, 100)}...`);
      }
    });
    
    // Overall summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Overall Summary:');
    console.log(`   Total Theaters: ${theaters.length}`);
    console.log(`   Theaters with Documents: ${theatersWithDocuments}`);
    console.log(`   Theaters without Documents: ${theatersWithoutDocuments}`);
    console.log(`   Total Documents Saved: ${totalDocumentsSaved}`);
    console.log(`   Average Documents per Theater: ${theatersWithDocuments > 0 ? (totalDocumentsSaved / theatersWithDocuments).toFixed(2) : '0'}`);
    
    if (theatersWithDocuments === theaters.length && theaters.length > 0) {
      console.log('\n✅ SUCCESS: All theaters have documents saved correctly!');
    } else if (theatersWithDocuments > 0) {
      console.log('\n⚠️  WARNING: Some theaters are missing documents.');
      console.log('   Create or update theaters to ensure all documents are saved.');
    } else {
      console.log('\n❌ ERROR: No theaters have documents saved!');
      console.log('   Check the server logs when creating theaters to see what went wrong.');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('\n❌ Error verifying documents:', error.message);
    console.error('   Stack:', error.stack);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      // Ignore disconnect errors
    }
    process.exit(1);
  }
}

// Run verification
if (require.main === module) {
  verifyTheaterDocuments().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { verifyTheaterDocuments };

