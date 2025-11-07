/**
 * Migration Script: Convert QR Code URLs to Base64 Data URLs
 * 
 * This script regenerates all QR codes that are currently using
 * fake GCS mock URLs and converts them to base64 data URLs that
 * display correctly in the browser.
 * 
 * Run with: node scripts/migrate-qr-to-base64.js
 */

const mongoose = require('mongoose');
const { generateQRCodeImage } = require('../utils/qrCodeGenerator');
const path = require('path');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://aedentekuiuxdesigner:Aedentek%40123%23@cluster0.vrj9qje.mongodb.net/yqpay';

async function migrateQRCodes() {
  try {
    console.log('🔄 Starting QR Code migration to base64...\n');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const qrCodesCollection = db.collection('singleqrcodes');
    
    // Find all QR codes with mock URLs (check nested structure)
    const qrCodes = await qrCodesCollection.find({}).toArray();
    
    // Filter for those with mock URLs
    const qrCodesToMigrate = qrCodes.filter(qr => {
      if (!qr.qrDetails || !qr.qrDetails[0] || !qr.qrDetails[0].seats) {
        return false;
      }
      return qr.qrDetails[0].seats.some(seat => 
        seat.qrCodeUrl && seat.qrCodeUrl.includes('mock')
      );
    });
    
    console.log(`📊 Found ${qrCodesToMigrate.length} QR codes to migrate\n`);
    
    if (qrCodesToMigrate.length === 0) {
      console.log('✅ No QR codes need migration!');
      process.exit(0);
    }
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const qrCode of qrCodesToMigrate) {
      try {
        console.log(`\n🎯 Processing QR Code: ${qrCode.qrDetails[0]?.qrName || 'Unknown'}`);
        console.log(`   Theater ID: ${qrCode.theater}`);
        console.log(`   Seats: ${qrCode.qrDetails[0]?.seats?.length || 0}`);
        
        const qrDetail = qrCode.qrDetails[0];
        if (!qrDetail || !qrDetail.seats) {
          console.log('   ⚠️  No seats found, skipping');
          continue;
        }
        
        // Update each seat's QR code
        for (const seat of qrDetail.seats) {
          if (!seat.qrCodeData || !seat.qrCodeUrl.includes('mock')) {
            continue;
          }
          
          console.log(`   🔄 Regenerating QR for seat: ${seat.seat}`);
          
          // Generate new QR code as base64
          const imageBuffer = await generateQRCodeImage(seat.qrCodeData, {
            width: 500,
            margin: 2,
            darkColor: '#7c3aed',
            lightColor: '#FFFFFF'
          });
          
          // Convert to base64 data URL
          const base64Data = imageBuffer.toString('base64');
          const dataUrl = `data:image/png;base64,${base64Data}`;
          
          // Update seat QR code URL
          seat.qrCodeUrl = dataUrl;
          seat.updatedAt = new Date();
          
          console.log(`   ✅ Seat ${seat.seat} updated (base64 length: ${dataUrl.length})`);
        }
        
        // Save updated QR code
        await qrCodesCollection.updateOne(
          { _id: qrCode._id },
          { $set: { qrDetails: qrCode.qrDetails } }
        );
        
        updatedCount++;
        console.log(`   ✅ QR Code updated successfully!`);
        
      } catch (error) {
        console.error(`   ❌ Error processing QR Code:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n\n📊 Migration Complete!`);
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total: ${qrCodesToMigrate.length}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateQRCodes();
