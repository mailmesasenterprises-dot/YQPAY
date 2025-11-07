const QRCode = require('qrcode');
const { uploadFile } = require('./gcsUploadUtil');
const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const os = require('os');

/**
 * Fetch logo from URL or local path
 * @param {string} logoUrl - Logo URL or path
 * @returns {Promise<Buffer>} - Logo image buffer
 */
async function fetchLogo(logoUrl) {
  try {
    if (!logoUrl) {
      console.log('🚫 No logo URL provided');
      return null;
    }

    console.log(`🔍 Attempting to fetch logo from: ${logoUrl}`);
    console.log(`🔍 Logo URL type: ${typeof logoUrl}, starts with http: ${logoUrl.startsWith('http')}`);

    // Handle data URLs (base64 encoded images)
    if (logoUrl.startsWith('data:image/')) {
      console.log(`📋 Processing data URL (base64 encoded image)`);
      try {
        // Extract the base64 data from the data URL
        const base64Data = logoUrl.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid data URL format');
        }
        
        const buffer = Buffer.from(base64Data, 'base64');
        console.log(`✅ Data URL processed successfully, buffer size: ${buffer.length} bytes`);
        return buffer;
      } catch (error) {
        console.error(`❌ Failed to process data URL: ${error.message}`);
        return null;
      }
    }

    // Handle URL (http/https)
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      console.log(`🌐 Fetching logo from HTTP URL: ${logoUrl}`);
      const response = await axios.get(logoUrl, {
        responseType: 'arraybuffer',
        timeout: 15000, // Increased timeout
        headers: {
          'User-Agent': 'YQPayNow-QR-Generator/1.0'
        }
      });
      console.log(`✅ HTTP fetch successful, response size: ${response.data.byteLength} bytes`);
      return Buffer.from(response.data);
    }

    // Handle Google Cloud Storage URLs (gs://)
    if (logoUrl.startsWith('gs://')) {
      console.log(`☁️  Google Cloud Storage URL detected: ${logoUrl}`);
      // Convert gs:// URL to https:// public URL
      const publicUrl = logoUrl.replace('gs://yqpaynow-theater-qr-codes/', 'https://storage.googleapis.com/yqpaynow-theater-qr-codes/');
      console.log(`🔄 Converted to public URL: ${publicUrl}`);
      
      const response = await axios.get(publicUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'YQPayNow-QR-Generator/1.0'
        }
      });
      console.log(`✅ GCS fetch successful, response size: ${response.data.byteLength} bytes`);
      return Buffer.from(response.data);
    }

    // Handle relative paths (e.g., /images/logo.jpg)
    if (logoUrl.startsWith('/')) {
      console.log(`🔗 Relative URL detected: ${logoUrl}`);
      
      // Convert relative path to full URL using frontend base URL
      let baseUrl;
      if (process.env.NODE_ENV === 'production') {
        baseUrl = process.env.BASE_URL?.trim() || 'https://yqpaynow.com';
      } else {
        baseUrl = process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
      }
      
      const fullUrl = `${baseUrl}${logoUrl}`;
      console.log(`🔄 Converted relative path to full URL: ${fullUrl}`);
      
      const response = await axios.get(fullUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'YQPayNow-QR-Generator/1.0'
        }
      });
      console.log(`✅ Relative URL fetch successful, response size: ${response.data.byteLength} bytes`);
      return Buffer.from(response.data);
    }

    // Handle local file path
    console.log(`📁 Attempting to read local file: ${logoUrl}`);
    const localPath = logoUrl.startsWith('/')
      ? path.join(__dirname, '../uploads', logoUrl)
      : path.join(__dirname, '..', logoUrl);

    console.log(`📁 Local file path resolved to: ${localPath}`);
    const fileBuffer = await fs.readFile(localPath);
    console.log(`✅ Local file read successful, size: ${fileBuffer.length} bytes`);
    return fileBuffer;

  } catch (error) {
    console.error('❌ Failed to fetch logo:', {
      logoUrl,
      errorMessage: error.message,
      errorCode: error.code,
      errorStatus: error.response?.status,
      errorStatusText: error.response?.statusText
    });
    return null;
  }
}

/**
 * Overlay logo on QR code center
 * @param {Buffer} qrBuffer - QR code image buffer
 * @param {Buffer} logoBuffer - Logo image buffer
 * @returns {Promise<Buffer>} - QR code with logo overlay
 */
/**
 * Add text above and below QR code image
 * @param {Buffer} qrBuffer - QR code image buffer
 * @param {string} topText - Text to display above QR (application name)
 * @param {string} bottomText - Text to display below QR (QR code name/seat)
 * @returns {Promise<Buffer>} - QR code with text
 */
async function addTextToQR(qrBuffer, topText, bottomText) {
  try {
    // Load QR code image
    const qrImage = await loadImage(qrBuffer);

    // Calculate canvas size (QR code + space for text)
    const padding = 20;
    const topTextHeight = 60;
    const bottomTextHeight = 50;
    const canvasWidth = qrImage.width + (padding * 2);
    const canvasHeight = qrImage.height + topTextHeight + bottomTextHeight + (padding * 2);

    // Create canvas
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw top text (Application Name)
    if (topText) {
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(topText.toUpperCase(), canvasWidth / 2, topTextHeight / 2 + padding);
    }

    // Draw QR code in center
    ctx.drawImage(qrImage, padding, topTextHeight + padding);

    // Draw bottom text (QR Code Name/Seat)
    if (bottomText) {
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const bottomY = topTextHeight + padding + qrImage.height + (bottomTextHeight / 2);
      ctx.fillText(bottomText, canvasWidth / 2, bottomY);
    }

    // Return canvas as buffer
    return canvas.toBuffer('image/png');

  } catch (error) {
    console.error('❌ Add text to QR error:', error);
    // Return original QR code if text addition fails
    return qrBuffer;
  }
}

async function overlayLogoOnQR(qrBuffer, logoBuffer) {
  try {
    // Load QR code image
    const qrImage = await loadImage(qrBuffer);
    const canvas = createCanvas(qrImage.width, qrImage.height);
    const ctx = canvas.getContext('2d');

    // Draw QR code
    ctx.drawImage(qrImage, 0, 0);

    // Load logo
    const logo = await loadImage(logoBuffer);

    // Calculate logo size (20% of QR code size for better visibility and centering)
    const maxLogoSize = Math.min(qrImage.width, qrImage.height) * 0.20;
    
    // Calculate aspect ratio of logo
    const logoAspectRatio = logo.width / logo.height;
    let logoWidth, logoHeight;
    
    // Maintain aspect ratio while fitting within maxLogoSize
    if (logoAspectRatio > 1) {
      // Wider than tall
      logoWidth = maxLogoSize;
      logoHeight = maxLogoSize / logoAspectRatio;
    } else {
      // Taller than wide or square
      logoHeight = maxLogoSize;
      logoWidth = maxLogoSize * logoAspectRatio;
    }
    
    // Center the logo
    const x = (qrImage.width - logoWidth) / 2;
    const y = (qrImage.height - logoHeight) / 2;

    // Draw white background circle for logo (based on the larger dimension)
    const backgroundRadius = Math.max(logoWidth, logoHeight) / 2 + 8;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(
      qrImage.width / 2,
      qrImage.height / 2,
      backgroundRadius,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Save context state
    ctx.save();

    // Create circular clipping path for logo (slightly smaller than background)
    const clipRadius = backgroundRadius - 3;
    ctx.beginPath();
    ctx.arc(
      qrImage.width / 2,
      qrImage.height / 2,
      clipRadius,
      0,
      Math.PI * 2
    );
    ctx.closePath();
    ctx.clip();

    // Draw logo in center (maintaining aspect ratio, clipped to circle)
    ctx.drawImage(logo, x, y, logoWidth, logoHeight);

    // Restore context
    ctx.restore();

    console.log(`✅ Logo overlay completed: ${logoWidth}x${logoHeight} (aspect ratio: ${logoAspectRatio.toFixed(2)})`);

    // Return canvas as buffer
    return canvas.toBuffer('image/png');

  } catch (error) {
    console.error('❌ Logo overlay error:', error);
    // Return original QR code if overlay fails
    return qrBuffer;
  }
}

/**
 * Get super admin primary color from settings
 * @returns {Promise<string>} Primary color hex code
 */
async function getSuperAdminPrimaryColor() {
  try {
    // Always return black for QR codes
    return '#000000';
    
    // Old code that fetched from database (disabled):
    // const db = mongoose.connection.db;
    // const settingsDoc = await db.collection('settings').findOne({ type: 'general' });
    // if (settingsDoc && settingsDoc.generalConfig && settingsDoc.generalConfig.primaryColor) {
    //   return settingsDoc.generalConfig.primaryColor;
    // }
  } catch (error) {
    console.error('⚠️  Error fetching primary color, using black:', error.message);
    return '#000000';
  }
}

/**
 * Get application name from settings
 * @returns {Promise<string>} Application name
 */
async function getApplicationName() {
  try {
    const db = mongoose.connection.db;
    const settingsDoc = await db.collection('settings').findOne({ type: 'general' });

    if (settingsDoc && settingsDoc.generalConfig && settingsDoc.generalConfig.applicationName) {
      return settingsDoc.generalConfig.applicationName;
    }

    // Fallback to default
    return 'SCAN THIS QR';
  } catch (error) {
    console.error('⚠️  Error fetching application name, using default:', error.message);
    return 'SCAN THIS QR';
  }
}

/**
 * Get default logo URL from settings
 * @returns {Promise<string>} Default logo URL
 */
async function getDefaultLogoUrl() {
  try {
    const db = mongoose.connection.db;
    const settingsDoc = await db.collection('settings').findOne({ type: 'general' });

    if (settingsDoc && settingsDoc.generalConfig && settingsDoc.generalConfig.qrCodeUrl) {
      console.log('🎨 Found default logo URL in settings:', settingsDoc.generalConfig.qrCodeUrl);
      return settingsDoc.generalConfig.qrCodeUrl;
    }

    // Fallback to empty string if no default logo configured
    console.log('⚠️ No default logo URL found in settings');
    return '';
  } catch (error) {
    console.error('⚠️ Error fetching default logo URL, using empty string:', error.message);
    return '';
  }
}

/**
 * Generate a single or screen QR code and upload to Google Cloud Storage
 * @param {Object} params - Generation parameters
 * @param {string} params.theaterId - Theater ID
 * @param {string} params.theaterName - Theater name for GCS path
 * @param {string} params.qrName - QR code name
 * @param {string} params.seatClass - Seat class
 * @param {string} params.seat - Seat identifier (only for screen type)
 * @param {string} params.logoUrl - Optional logo URL
 * @param {string} params.logoType - Logo type (default, theater, custom)
 * @param {string} params.userId - User ID generating the QR
 * @returns {Promise<Object>} Generated QR code details
 */
async function generateSingleQRCode({
  theaterId,
  theaterName,
  qrName,
  seatClass,
  seat = null,
  logoUrl = '',
  logoType = 'default',
  userId
}) {
  try {
    // Handle default logo URL fetching
    let finalLogoUrl = logoUrl;
    if (logoType === 'default' && !logoUrl) {
      console.log('🔍 Logo type is default but no logoUrl provided, fetching from settings...');
      finalLogoUrl = await getDefaultLogoUrl();
      console.log('🎨 Retrieved default logo URL from settings:', finalLogoUrl);
    }

    const qrTypeLabel = seat ? 'Screen' : 'Single';
    console.log(`🎨 Generating ${qrTypeLabel} QR Code:`, {
      theaterId,
      qrName,
      seatClass,
      seat,
      logoUrl: logoUrl,
      finalLogoUrl: finalLogoUrl,
      logoType
    });

    // Get super admin primary color for QR code
    const primaryColor = await getSuperAdminPrimaryColor();
    console.log(`🎨 Using primary color for QR code: ${primaryColor}`);

    // Generate unique QR code data URL
    const timestamp = Date.now();
    const seatPart = seat ? `_${seat}` : '';
    const uniqueId = `${theaterId}_${qrName}_${seatClass}${seatPart}_${timestamp}`.replace(/\s+/g, '_');

let baseUrl;

if (process.env.NODE_ENV === 'production') {
  // use cloud run domain
  baseUrl = process.env.BASE_URL?.trim() || 'https://yqpaynow.com';
} else {
  baseUrl = process.env.FRONTEND_URL?.trim() || 'https://yqpaynow.com';
}

console.log(`🌐 QR Code Base URL: ${baseUrl}`);

const typeParam = seat ? 'screen' : 'single';
const seatParam = seat ? `&seat=${encodeURIComponent(seat)}` : '';
const qrCodeData = `${baseUrl}/menu/${theaterId}?qrName=${encodeURIComponent(qrName)}&type=${typeParam}${seatParam}`;

    // QR code options with super admin primary color
    const qrOptions = {
      errorCorrectionLevel: 'H', // High error correction for logo overlay
      type: 'image/png',
      quality: 1,
      margin: 2,
      width: 512,
      color: {
        dark: primaryColor, // Use super admin's primary color
        light: '#FFFFFF'
      }
    };

    // Generate base QR code as buffer
    let qrCodeBuffer = await QRCode.toBuffer(qrCodeData, qrOptions);

    // Fetch and overlay logo if provided
    console.log(`🔍 Logo check: finalLogoUrl="${finalLogoUrl}", originalLogoUrl="${logoUrl}", type=${typeof finalLogoUrl}, truthy=${!!finalLogoUrl}`);
    if (finalLogoUrl) {
      console.log(`🖼️  Fetching logo for overlay: ${finalLogoUrl}`);
      const logoBuffer = await fetchLogo(finalLogoUrl);

      if (logoBuffer) {
        console.log(`✅ Logo fetched successfully, size: ${logoBuffer.length} bytes, overlaying on QR code...`);
        qrCodeBuffer = await overlayLogoOnQR(qrCodeBuffer, logoBuffer);
      } else {
        console.log(`❌ Logo buffer is null/empty, skipping overlay`);
      }
    } else {
      console.log(`⚠️  No logo URL provided, skipping logo overlay`);
    }

    // Get application name and add text to QR code
    const applicationName = await getApplicationName();
    const bottomText = seat ? `${qrName} | ${seat}` : qrName;
    console.log(`📝 Adding text to QR: Top="${applicationName}", Bottom="${bottomText}"`);
    qrCodeBuffer = await addTextToQR(qrCodeBuffer, applicationName, bottomText);

    // Upload to Google Cloud Storage
    const gcsPath = await uploadToGCS(qrCodeBuffer, {
      theaterId,
      theaterName,
      qrName,
      seatClass,
      seat,
      timestamp
    });

    console.log(`✅ ${qrTypeLabel} QR Code generated:`, {
      qrCodeData: qrCodeData.substring(0, 100) + '...',
      gcsPath
    });

    return {
      qrCodeUrl: gcsPath,
      qrCodeData: qrCodeData,
      logoUrl: finalLogoUrl,
      logoType,
      uniqueId
    };

  } catch (error) {
    console.error('❌ Generate QR Code error:', error);
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
}

/**
 * Upload QR code image to Google Cloud Storage
 * @param {Buffer} buffer - QR code image buffer
 * @param {Object} metadata - File metadata
 * @returns {Promise<string>} GCS file URL
 */
async function uploadToGCS(buffer, metadata) {
  try {
    // Sanitize names for file paths
    const sanitizedTheater = metadata.theaterName ? metadata.theaterName.replace(/[^a-zA-Z0-9\-_]/g, '_') : metadata.theaterId;
    const sanitizedQRName = metadata.qrName.replace(/[^a-zA-Z0-9\-_]/g, '_');
    const sanitizedSeatClass = metadata.seatClass.replace(/[^a-zA-Z0-9\-_]/g, '_');

    // Create filename and folder structure matching existing pattern
    let folder, filename;

    if (metadata.seat) {
      // Screen QR: qr-codes/screen/{theater_name}/{qr_name}/
      folder = `qr-codes/screen/${sanitizedTheater}/${sanitizedQRName}`;
      const seatPart = metadata.seat.replace(/[^a-zA-Z0-9\-_]/g, '_');
      filename = `${sanitizedQRName}_${sanitizedSeatClass}_${seatPart}_${metadata.timestamp}.png`;
    } else {
      // Single QR: qr-codes/single/{theater_name}/
      folder = `qr-codes/single/${sanitizedTheater}`;
      filename = `${sanitizedQRName}_${sanitizedSeatClass}_${metadata.timestamp}.png`;
    }

    // Use the working GCS upload utility (loads credentials from MongoDB)
    const gcsUrl = await uploadFile(buffer, filename, folder, 'image/png');

    console.log('✅ Uploaded to GCS:', `${folder}/${filename}`);
    return gcsUrl;

  } catch (error) {
    console.error('❌ GCS Upload error:', error);

    // Fallback: save to local filesystem if GCS fails
    return await saveToLocalFilesystem(buffer, metadata);
  }
}

/**
 * Fallback: Save QR code to local filesystem
 * @param {Buffer} buffer - QR code image buffer
 * @param {Object} metadata - File metadata
 * @returns {Promise<string>} Local file URL
 */
async function saveToLocalFilesystem(buffer, metadata) {
  try {
    const sanitizedTheater = metadata.theaterName ? metadata.theaterName.replace(/[^a-zA-Z0-9\-_]/g, '_') : metadata.theaterId;
    const sanitizedQRName = metadata.qrName.replace(/[^a-zA-Z0-9\-_]/g, '_');
    const sanitizedSeatClass = metadata.seatClass.replace(/[^a-zA-Z0-9\-_]/g, '_');

    let uploadsDir, filename;

    if (metadata.seat) {
      // Screen QR: uploads/qr-codes/screen/{theater_name}/{qr_name}/
      uploadsDir = path.join(__dirname, '../uploads/qr-codes/screen', sanitizedTheater, sanitizedQRName);
      const seatPart = metadata.seat.replace(/[^a-zA-Z0-9\-_]/g, '_');
      filename = `${sanitizedQRName}_${sanitizedSeatClass}_${seatPart}_${metadata.timestamp}.png`;
    } else {
      // Single QR: uploads/qr-codes/single/{theater_name}/
      uploadsDir = path.join(__dirname, '../uploads/qr-codes/single', sanitizedTheater);
      filename = `${sanitizedQRName}_${sanitizedSeatClass}_${metadata.timestamp}.png`;
    }

    // Create directory if it doesn't exist
    await fs.mkdir(uploadsDir, { recursive: true });

    const filepath = path.join(uploadsDir, filename);

    // Write buffer to file
    await fs.writeFile(filepath, buffer);

    // Return relative URL
    const qrType = metadata.seat ? 'screen' : 'single';
    const relativeUrl = metadata.seat
      ? `/uploads/qr-codes/${qrType}/${sanitizedTheater}/${sanitizedQRName}/${filename}`
      : `/uploads/qr-codes/${qrType}/${sanitizedTheater}/${filename}`;

    console.log('✅ Saved to local filesystem:', relativeUrl);

    return relativeUrl;

  } catch (error) {
    console.error('❌ Local filesystem save error:', error);
    throw new Error(`Failed to save QR code: ${error.message}`);
  }
}

/**
 * Generate multiple single QR codes in batch
 * @param {Array} qrConfigs - Array of QR code configurations
 * @returns {Promise<Array>} Array of generated QR code details
 */
async function generateBatchSingleQRCodes(qrConfigs) {
  try {
    console.log(`🎨 Generating ${qrConfigs.length} Single QR Codes in batch`);

    const results = [];
    const errors = [];

    for (const config of qrConfigs) {
      try {
        const result = await generateSingleQRCode(config);
        results.push({
          success: true,
          ...result
        });
      } catch (error) {
        errors.push({
          success: false,
          config,
          error: error.message
        });
      }
    }

    console.log(`✅ Batch generation complete: ${results.length} success, ${errors.length} failed`);

    return {
      successful: results,
      failed: errors,
      totalGenerated: results.length,
      totalFailed: errors.length
    };

  } catch (error) {
    console.error('❌ Batch generation error:', error);
    throw error;
  }
}

module.exports = {
  generateSingleQRCode,
  generateBatchSingleQRCodes,
  uploadToGCS,
  saveToLocalFilesystem,
  getDefaultLogoUrl
};
