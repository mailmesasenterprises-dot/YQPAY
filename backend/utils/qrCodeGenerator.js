const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');
const ScreenQRCode = require('../models/ScreenQRCode');
const Theater = require('../models/Theater');
const Settings = require('../models/Settings');
const { uploadFile } = require('./gcsUploadUtil');

/**
 * QR Code Generator Utility
 * Generates QR codes with centered logos and custom colors
 */

/**
 * Fetch logo from URL or local path
 * @param {string} logoUrl - Logo URL or path
 * @returns {Promise<Buffer>} - Logo image buffer
 */
async function fetchLogo(logoUrl) {
  try {
    if (!logoUrl) return null;
    
    // Check if it's a URL
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      const response = await axios.get(logoUrl, { 
        responseType: 'arraybuffer',
        timeout: 5000 
      });
      return Buffer.from(response.data);
    }
    
    // Check if it's a local file
    const localPath = logoUrl.startsWith('/') 
      ? path.join(__dirname, '../uploads', logoUrl)
      : path.join(__dirname, '..', logoUrl);
      
    const exists = await fs.access(localPath).then(() => true).catch(() => false);
    if (exists) {
      return await fs.readFile(localPath);
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to fetch logo:', error.message);
    return null;
  }
}

/**
 * Get settings for QR code generation
 * @param {string} theaterId - Theater ID
 * @param {string} logoType - 'default' or 'theater'
 * @returns {Promise<object>} - Settings object with logo and color
 */
async function getQRSettings(theaterId, logoType = 'default') {
  try {
    let logoUrl = null;
    let primaryColor = '#000000'; // Default color - BLACK for QR codes

    if (logoType === 'theater' && theaterId) {
      // Get theater-specific logo
      const theater = await Theater.findById(theaterId);
      if (theater) {
        logoUrl = theater.logoUrl;
        // Always use black for QR codes regardless of theater branding
        primaryColor = '#000000';
      }
    } else {
      // Get default logo from general settings
      const qrImageSetting = await Settings.findOne({ 
        category: 'general', 
        key: 'qrCodeImage' 
      });
      
      if (qrImageSetting && qrImageSetting.value) {
        logoUrl = qrImageSetting.value;
      }
      
      // Always use black for QR codes
      primaryColor = '#000000';
    }

    return { logoUrl, primaryColor };
  } catch (error) {
    console.warn('Failed to get QR settings:', error.message);
    return { logoUrl: null, primaryColor: '#000000' };
  }
}

/**
 * Generate QR Code with centered logo
 * @param {string} data - The data to encode in QR code
 * @param {object} options - QR code generation options
 * @returns {Promise<Buffer>} - QR code image buffer
 */
async function generateQRCodeImage(data, options = {}) {
  try {
    const qrOptions = {
      errorCorrectionLevel: 'H', // High error correction for logo overlay
      type: 'image/png',
      quality: 0.95,
      margin: options.margin || 2,
      width: options.width || 500,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#FFFFFF'
      }
    };

    // Generate QR code as buffer
    const qrBuffer = await QRCode.toBuffer(data, qrOptions);
    
    // If no logo, return the plain QR code
    if (!options.logoBuffer) {
      return qrBuffer;
    }

    // Create canvas to overlay logo
    const qrImage = await loadImage(qrBuffer);
    const canvas = createCanvas(qrImage.width, qrImage.height);
    const ctx = canvas.getContext('2d');
    
    // Draw QR code
    ctx.drawImage(qrImage, 0, 0);
    
    // Load and draw logo in center
    try {
      const logo = await loadImage(options.logoBuffer);
      
      // Calculate logo size (20% of QR code size)
      const logoSize = Math.min(qrImage.width, qrImage.height) * 0.20;
      
      // Calculate exact center position
      const centerX = qrImage.width / 2;
      const centerY = qrImage.height / 2;
      const x = centerX - (logoSize / 2);
      const y = centerY - (logoSize / 2);
      
      // Draw white background circle for logo (perfectly centered)
      const bgRadius = logoSize / 2 + 10;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(centerX, centerY, bgRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw logo (perfectly centered)
      ctx.drawImage(logo, x, y, logoSize, logoSize);
      
    } catch (logoError) {
      console.warn('Failed to overlay logo:', logoError.message);
    }
    
    // Return canvas as buffer
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('QR code generation error:', error);
    throw new Error(`Failed to generate QR code image: ${error.message}`);
  }
}


/**
 * Upload QR Code to Storage
 * @param {Buffer} buffer - Image buffer
 * @param {string} filename - File name
 * @param {string} folder - Storage folder path
 * @returns {Promise<string>} - Public URL of uploaded file
 */
async function uploadQRCode(buffer, filename, folder) {
  try {
    // Upload to GCS or save locally
    const url = await uploadFile(buffer, filename, folder, 'image/png');
    return url;
  } catch (error) {
    console.error('QR code upload error:', error);
    
    // Fallback: Save locally if GCS fails
    try {
      const uploadsDir = path.join(__dirname, '../uploads/qr-codes', folder);
      await fs.mkdir(uploadsDir, { recursive: true });
      
      const filePath = path.join(uploadsDir, filename);
      await fs.writeFile(filePath, buffer);
      
      const localUrl = `/uploads/qr-codes/${folder}/${filename}`;
      return localUrl;
    } catch (localError) {
      console.error('Local save failed:', localError);
      throw new Error('Failed to save QR code');
    }
  }
}

/**
 * Generate Single QR Code
 * @param {object} params - Generation parameters
 * @returns {Promise<object>} - Generated QR code info
 */
async function generateSingleQRCode({
  theaterId,
  theaterName,
  qrName,
  seatClass,
  logoUrl,
  logoType,
  userId,
  baseUrl = process.env.FRONTEND_URL || 'https://yqpay-78918378061.us-central1.run.app'
}) {
  try {
    // Get QR settings (logo and color)
    const settings = await getQRSettings(theaterId, logoType);
    const finalLogoUrl = logoUrl || settings.logoUrl;
    const primaryColor = settings.primaryColor;
    // Fetch logo if available
    const logoBuffer = finalLogoUrl ? await fetchLogo(finalLogoUrl) : null;
    if (logoBuffer) {
    }

    // Create QR code data (URL that will be embedded in QR)
    const qrCodeData = `${baseUrl}/menu/${theaterId}?qrName=${encodeURIComponent(qrName)}&type=single`;
    
    // Generate QR code image with logo
    const imageBuffer = await generateQRCodeImage(qrCodeData, {
      width: 500,
      margin: 2,
      darkColor: primaryColor, // Always black (#000000) for standard QR codes
      lightColor: '#FFFFFF',
      logoBuffer: logoBuffer
    });
    
    // Generate filename
    const timestamp = Date.now();
    const sanitizedName = qrName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const sanitizedTheater = (theaterName || 'theater').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${sanitizedName}_${timestamp}.png`;
    
    // Upload to storage with correct folder structure: qr-codes/single/{theater_name}/
    const folder = `qr-codes/single/${sanitizedTheater}`;
    const qrCodeUrl = await uploadQRCode(imageBuffer, filename, folder);
    
    // Save to database
    const screenQRCode = new ScreenQRCode({
      theater: theaterId,
      qrType: 'single',
      qrName: qrName,
      seatClass: seatClass || qrName,
      seat: null,
      qrCodeUrl: qrCodeUrl,
      qrCodeData: qrCodeData,
      logoUrl: finalLogoUrl || '',
      logoType: logoType || 'default',
      isActive: true,
      metadata: {
        totalSeats: 1,
        fileSize: imageBuffer.length,
        primaryColor: primaryColor,
        hasLogo: !!logoBuffer
      },
      createdBy: userId
    });
    
    await screenQRCode.save();
    return {
      success: true,
      qrCode: screenQRCode,
      count: 1
    };
  } catch (error) {
    console.error('❌ Single QR code generation failed:', error);
    throw error;
  }
}

/**
 * Generate Screen QR Codes (multiple seats)
 * @param {object} params - Generation parameters
 * @returns {Promise<object>} - Generated QR codes info
 */
async function generateScreenQRCodes({
  theaterId,
  theaterName,
  qrName,
  seatClass,
  selectedSeats,
  logoUrl,
  logoType,
  userId,
  baseUrl = process.env.FRONTEND_URL || 'https://yqpay-78918378061.us-central1.run.app'
}) {
  try {
    if (!selectedSeats || selectedSeats.length === 0) {
      throw new Error('No seats selected for screen QR code generation');
    }

    // Get QR settings (logo and color)
    const settings = await getQRSettings(theaterId, logoType);
    const finalLogoUrl = logoUrl || settings.logoUrl;
    const primaryColor = settings.primaryColor;
    // Fetch logo if available (reuse for all QR codes)
    const logoBuffer = finalLogoUrl ? await fetchLogo(finalLogoUrl) : null;
    if (logoBuffer) {
    }

    // Generate batch ID for grouping
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const generatedQRCodes = [];
    const sanitizedTheater = (theaterName || 'theater').replace(/[^a-zA-Z0-9-_]/g, '_');
    const sanitizedName = qrName.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    // Calculate seat range
    const sortedSeats = [...selectedSeats].sort();
    const seatRange = `${sortedSeats[0]}-${sortedSeats[sortedSeats.length - 1]}`;

    // Generate QR code for each seat
    for (const seat of selectedSeats) {
      try {
        // Create QR code data (URL with seat info)
        const qrCodeData = `${baseUrl}/menu/${theaterId}?qrName=${encodeURIComponent(qrName)}&seat=${encodeURIComponent(seat)}&type=screen`;
        
        // Generate QR code image with logo
        const imageBuffer = await generateQRCodeImage(qrCodeData, {
          width: 500,
          margin: 2,
          darkColor: primaryColor, // Always black (#000000) for standard QR codes
          lightColor: '#FFFFFF',
          logoBuffer: logoBuffer
        });
        
        // Generate filename
        const timestamp = Date.now();
        const sanitizedSeat = seat.replace(/[^a-zA-Z0-9-_]/g, '_');
        const filename = `${sanitizedSeat}_${timestamp}.png`;
        
        // Upload to storage with correct folder structure: qr-codes/screen/{theater_name}/{qr_name}/
        const folder = `qr-codes/screen/${sanitizedTheater}/${sanitizedName}`;
        const qrCodeUrl = await uploadQRCode(imageBuffer, filename, folder);
        
        // Save to database
        const screenQRCode = new ScreenQRCode({
          theater: theaterId,
          qrType: 'screen',
          qrName: qrName,
          seatClass: seatClass || qrName,
          seat: seat,
          qrCodeUrl: qrCodeUrl,
          qrCodeData: qrCodeData,
          logoUrl: finalLogoUrl || '',
          logoType: logoType || 'default',
          isActive: true,
          metadata: {
            batchId: batchId,
            seatRange: seatRange,
            totalSeats: selectedSeats.length,
            fileSize: imageBuffer.length,
            primaryColor: primaryColor,
            hasLogo: !!logoBuffer
          },
          createdBy: userId
        });
        
        await screenQRCode.save();
        generatedQRCodes.push(screenQRCode);
      } catch (seatError) {
        console.error(`❌ Failed to generate QR for seat ${seat}:`, seatError);
        // Continue with other seats even if one fails
      }
    }
    return {
      success: true,
      qrCodes: generatedQRCodes,
      count: generatedQRCodes.length,
      batchId: batchId,
      failedSeats: selectedSeats.length - generatedQRCodes.length
    };
  } catch (error) {
    console.error('❌ Screen QR code generation failed:', error);
    throw error;
  }
}

/**
 * Main QR Code Generation Function
 * @param {object} params - Generation parameters from frontend
 * @returns {Promise<object>} - Result with generated QR codes
 */
async function generateQRCodes(params) {
  try {
    const { theaterId, qrType, name, seatClass, selectedSeats, logoUrl, logoType, userId } = params;

    // Validate theater exists
    const theater = await Theater.findById(theaterId);
    if (!theater) {
      throw new Error('Theater not found');
    }

    const theaterName = theater.name || theater.theaterName || 'theater';

    // Generate based on type
    if (qrType === 'single') {
      return await generateSingleQRCode({
        theaterId,
        theaterName,
        qrName: name,
        seatClass,
        logoUrl,
        logoType,
        userId
      });
    } else if (qrType === 'screen') {
      return await generateScreenQRCodes({
        theaterId,
        theaterName,
        qrName: name,
        seatClass,
        selectedSeats,
        logoUrl,
        logoType,
        userId
      });
    } else {
      throw new Error(`Invalid QR type: ${qrType}`);
    }
  } catch (error) {
    console.error('❌ QR code generation error:', error);
    throw error;
  }
}

module.exports = {
  generateQRCodes,
  generateSingleQRCode,
  generateScreenQRCodes,
  generateQRCodeImage,
  getQRSettings,
  fetchLogo
};
