const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Theater = require('../models/Theater');
const Settings = require('../models/Settings');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/uploadMiddleware');
const { uploadFiles, deleteFile, deleteFiles } = require('../utils/gcsUploadUtil');
const roleService = require('../services/roleService');

const router = express.Router();

/**
 * GET /api/theaters
 * Get all theaters with pagination and filtering
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['active', 'inactive', 'suspended']).withMessage('Invalid status'),
  query('search').optional().isLength({ min: 1 }).withMessage('Search term must not be empty'),
  query('q').optional().isLength({ min: 1 }).withMessage('Search term must not be empty')
], async (req, res) => {
  try {
    console.log('📥 [GET /api/theaters] Request received:', {
      query: req.query,
      headers: { authorization: req.headers.authorization ? 'present' : 'missing' }
    });
    
    // Check MongoDB connection FIRST before doing anything else
    const mongoose = require('mongoose');
    const connectionState = mongoose.connection.readyState;
    console.log('🔍 [GET /api/theaters] MongoDB connection state:', connectionState, {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    }[connectionState]);
    
    if (connectionState !== 1) {
      const errorMsg = 'Database connection not available. Please check MongoDB connection.';
      console.error('❌ [GET /api/theaters]', errorMsg, 'State:', connectionState);
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: errorMsg,
        details: {
          connectionState,
          stateDescription: {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
          }[connectionState]
        }
      });
    }
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('⚠️ [GET /api/theaters] Validation errors:', errors.array());
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status, search, q, isActive } = req.query;
    
    console.log('🔍 [GET /api/theaters] Query params:', { page, limit, skip, status, search, q, isActive });

    // Build MongoDB query filter
    const filter = {};
    if (status) filter.status = status;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    // Support both 'search' and 'q' parameters for compatibility
    const searchTerm = search || q;
    if (searchTerm) {
      filter.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { username: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { 'address.city': { $regex: searchTerm, $options: 'i' } },
        { 'location.city': { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // 🚀 PERFORMANCE: Optimized query with lean and field selection
    // const { optimizedFind, optimizedCount } = require('../utils/queryOptimizer');
    
    // Execute query with basic mongoose methods
    let theaters, total;
    try {
      console.log('🔍 [GET /api/theaters] Executing database query with filter:', JSON.stringify(filter));
      console.log('🔍 [GET /api/theaters] Theater model:', Theater ? 'loaded' : 'NOT loaded');
      
      [theaters, total] = await Promise.all([
        Theater.find(filter)
          .select('-password -__v')
          .sort({ createdAt: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Theater.countDocuments(filter)
      ]);
      console.log(`✅ [GET /api/theaters] Query successful: Found ${theaters.length} theaters, Total: ${total}`);
    } catch (dbError) {
      console.error('❌ [GET /api/theaters] Database query error:', dbError);
      console.error('❌ [GET /api/theaters] Error name:', dbError.name);
      console.error('❌ [GET /api/theaters] Error message:', dbError.message);
      console.error('❌ [GET /api/theaters] Error stack:', dbError.stack);
      throw dbError;
    }

    // Set cache headers for better performance
    res.set('Cache-Control', 'public, max-age=60'); // Cache for 1 minute
    res.set('ETag', `theaters-${page}-${limit}-${total}`); // Enable conditional requests
    
    const response = {
      success: true,
      data: theaters,
      pagination: {
        current: page,
        limit,
        total,
        totalItems: total,
        pages: Math.ceil(total / limit),
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
    
    console.log('📤 [GET /api/theaters] Sending response:', {
      success: response.success,
      theaterCount: theaters.length,
      total: total,
      pagination: response.pagination
    });
    
    res.json(response);

  } catch (error) {
    console.error('❌ [GET /api/theaters] Error:', error);
    console.error('❌ [GET /api/theaters] Error stack:', error.stack);
    console.error('❌ [GET /api/theaters] Error name:', error.name);
    console.error('❌ [GET /api/theaters] Error message:', error.message);
    
    // Send detailed error response
    const errorResponse = {
      success: false,
      error: 'Failed to fetch theaters',
      message: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };
    
    console.error('❌ [GET /api/theaters] Sending error response:', errorResponse);
    res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/theaters/:id
 * Get a specific theater by ID
 */
router.get('/:id', async (req, res) => {
  try {
    // 🚀 PERFORMANCE: Optimized findOne with caching
    const { optimizedFindOne } = require('../utils/queryOptimizer');
    
    const theater = await optimizedFindOne(Theater, { _id: req.params.id }, {
      select: '-password -__v',
      lean: true,
      cache: true,
      cacheTTL: 120000 // 2 minute cache for individual theater
    });
    
    if (!theater) {
      return res.status(404).json({
        error: 'Theater not found',
        code: 'THEATER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: theater
    });

  } catch (error) {
    console.error('Get theater error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid theater ID',
        code: 'INVALID_ID'
      });
    }
    res.status(500).json({
      error: 'Failed to fetch theater',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/theaters
 * Create a new theater with file uploads
 * Accepts multipart/form-data with optional files:
 * - theaterPhoto, logo, aadharCard, panCard, gstCertificate, fssaiCertificate, agreementCopy
 */
router.post('/', 
  authenticateToken,
  requireRole(['super_admin']),
  upload.fields([
    { name: 'theaterPhoto', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'aadharCard', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
    { name: 'gstCertificate', maxCount: 1 },
    { name: 'fssaiCertificate', maxCount: 1 },
    { name: 'agreementCopy', maxCount: 1 }
  ]),
  async (req, res) => {
    try {


      // Detailed file logging
      if (req.files) {
        Object.keys(req.files).forEach(fieldName => {
          const fileArray = req.files[fieldName];
          fileArray.forEach(file => {

          });
        });
      }

      const {
        name,
        username,
        password,
        email,
        phone,
        address,  // Can be street address or general address
        street,   // Alternative field name
        city,
        state,
        pincode,
        ownerName,
        ownerContactNumber,
        personalAddress,
        ownerPersonalAddress, // Alternative field name
        agreementStartDate,
        agreementEndDate,
        facebook,
        instagram,
        twitter,
        youtube,
        website
      } = req.body;

      // Validate required fields
      if (!name || !username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Theater name, username, and password are required'
        });
      }

      // Check if username already exists
      const existingTheater = await Theater.findOne({ username: username.toLowerCase() });
      if (existingTheater) {
        return res.status(409).json({
          success: false,
          error: 'Username already exists',
          code: 'USERNAME_EXISTS'
        });
      }

      // Check if email already exists (if provided)
      if (email) {
        const existingEmail = await Theater.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
          return res.status(409).json({
            success: false,
            error: 'Email already exists',
            code: 'EMAIL_EXISTS'
          });
        }
      }

      // Upload files to GCS with theater-specific folder
      let fileUrls = {};
      if (req.files && Object.keys(req.files).length > 0) {
        try {
          // Create folder path: theater list/[Theater Name]
          const sanitizedTheaterName = name.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, ' ');
          const theaterFolder = `theater list/${sanitizedTheaterName}`;
          const allFiles = [];
          Object.keys(req.files).forEach(fieldName => {
            req.files[fieldName].forEach(file => {
              allFiles.push({ ...file, fieldname: fieldName });
            });
          });

          fileUrls = await uploadFiles(allFiles, theaterFolder);

        } catch (uploadError) {
          console.error('❌ File upload error:', uploadError);
          return res.status(500).json({
            success: false,
            error: 'Failed to upload files',
            message: uploadError.message
          });
        }
      }

      // Create theater document
      const theaterData = {
        name: name.trim(),
        username: username.toLowerCase().trim(),
        password,
        email: email ? email.toLowerCase().trim() : undefined,
        phone: phone || undefined,
        address: {
          street: address || street || '',  // Accept either 'address' or 'street'
          city: city || '',
          state: state || '',
          pincode: pincode || ''
        },
        location: {
          city: city || '',
          state: state || '',
          country: 'India'
        },
        // Don't include geoLocation unless we have valid coordinates
        // geoLocation will be added later when we implement geocoding
        ownerDetails: {
          name: ownerName || '',
          contactNumber: ownerContactNumber || '',
          personalAddress: personalAddress || ownerPersonalAddress || ''  // Accept either format
        },
        agreementDetails: {
          startDate: agreementStartDate ? new Date(agreementStartDate) : undefined,
          endDate: agreementEndDate ? new Date(agreementEndDate) : undefined,
          copy: fileUrls.agreementCopy || null
        },
        documents: {
          theaterPhoto: fileUrls.theaterPhoto || null,
          logo: fileUrls.logo || null,
          aadharCard: fileUrls.aadharCard || null,
          panCard: fileUrls.panCard || null,
          gstCertificate: fileUrls.gstCertificate || null,
          fssaiCertificate: fileUrls.fssaiCertificate || null,
          agreementCopy: fileUrls.agreementCopy || null
        },
        socialMedia: {
          facebook: facebook || null,
          instagram: instagram || null,
          twitter: twitter || null,
          youtube: youtube || null,
          website: website || null
        },
        settings: {
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          language: 'en'
        },
        branding: {
          primaryColor: '#6B0E9B',
          secondaryColor: '#F3F4F6',
          logo: fileUrls.logo || null,
          logoUrl: fileUrls.logo || null // For backward compatibility
        },
        isActive: true,
        status: 'active'
      };

      const theater = new Theater(theaterData);
      const savedTheater = await theater.save();
      // Initialize default settings for the theater
      try {
        await Settings.initializeDefaults(savedTheater._id);
      } catch (settingsError) {
        console.warn('⚠️  Failed to initialize settings:', settingsError.message);
      }

      // Create default Theater Admin role
      try {
        const defaultRole = await roleService.createDefaultTheaterAdminRole(
          savedTheater._id,
          savedTheater.name
        );
      } catch (roleError) {
        console.error('⚠️  Failed to create default Theater Admin role:', roleError.message);
        // Don't fail theater creation if role creation fails
        // The role can be created later via migration script if needed
      }

      // Create default Kiosk Screen role
      try {
        const kioskRole = await roleService.createDefaultKioskRole(
          savedTheater._id,
          savedTheater.name
        );
      } catch (kioskRoleError) {
        console.error('⚠️  Failed to create default Kiosk Screen role:', kioskRoleError.message);
        // Don't fail theater creation if role creation fails
      }

      res.status(201).json({
        success: true,
        message: 'Theater created successfully',
        data: {
          id: savedTheater._id,
          name: savedTheater.name,
          username: savedTheater.username,
          email: savedTheater.email,
          phone: savedTheater.phone,
          status: savedTheater.status,
          documents: savedTheater.documents,
          createdAt: savedTheater.createdAt
        }
      });

    } catch (error) {
      console.error('❌ Create theater error:', error);
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate entry',
          message: 'Username or email already exists'
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to create theater',
        message: error.message
      });
    }
  });

/**
 * PUT /api/theaters/:id
 * Update a theater with optional file uploads
 */
router.put('/:id',
  authenticateToken,
  upload.fields([
    { name: 'theaterPhoto', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
    { name: 'aadharCard', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
    { name: 'gstCertificate', maxCount: 1 },
    { name: 'fssaiCertificate', maxCount: 1 },
    { name: 'agreementCopy', maxCount: 1 }
  ]),
  async (req, res) => {
    try {


      const theater = await Theater.findById(req.params.id);
      if (!theater) {
        return res.status(404).json({
          success: false,
          error: 'Theater not found',
          code: 'THEATER_NOT_FOUND'
        });
      }

      // Check authorization (super_admin or theater owner)
      if (req.user.role !== 'super_admin' && req.user.theaterId?.toString() !== req.params.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      // Upload new files and delete old ones if replaced
      let fileUrls = {};
      if (req.files && Object.keys(req.files).length > 0) {
        try {
          // Create folder path: theater list/[Theater Name]
          // Use updated name if provided, otherwise use existing name
          const theaterName = req.body.name ? req.body.name.trim() : theater.name;
          const sanitizedTheaterName = theaterName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, ' ');
          const theaterFolder = `theater list/${sanitizedTheaterName}`;
          const allFiles = [];
          Object.keys(req.files).forEach(fieldName => {
            req.files[fieldName].forEach(file => {
              allFiles.push({ ...file, fieldname: fieldName });
            });
          });

          fileUrls = await uploadFiles(allFiles, theaterFolder);

          // Delete old files that are being replaced
          const filesToDelete = [];
          if (fileUrls.theaterPhoto && theater.documents?.theaterPhoto) {
            filesToDelete.push(theater.documents.theaterPhoto);
          }
          if (fileUrls.logo && theater.documents?.logo) {
            filesToDelete.push(theater.documents.logo);
          }
          if (fileUrls.aadharCard && theater.documents?.aadharCard) {
            filesToDelete.push(theater.documents.aadharCard);
          }
          if (fileUrls.panCard && theater.documents?.panCard) {
            filesToDelete.push(theater.documents.panCard);
          }
          if (fileUrls.gstCertificate && theater.documents?.gstCertificate) {
            filesToDelete.push(theater.documents.gstCertificate);
          }
          if (fileUrls.fssaiCertificate && theater.documents?.fssaiCertificate) {
            filesToDelete.push(theater.documents.fssaiCertificate);
          }
          if (fileUrls.agreementCopy && theater.agreementDetails?.copy) {
            filesToDelete.push(theater.agreementDetails.copy);
          }

          if (filesToDelete.length > 0) {
            await deleteFiles(filesToDelete);
          }
        } catch (uploadError) {
          console.error('❌ File upload error:', uploadError);
          return res.status(500).json({
            success: false,
            error: 'Failed to upload files',
            message: uploadError.message
          });
        }
      }

      // Prepare update data
      const updateData = {};
      
      if (req.body.name) updateData.name = req.body.name.trim();
      if (req.body.email) updateData.email = req.body.email.toLowerCase().trim();
      if (req.body.phone) updateData.phone = req.body.phone;
      if (req.body.isActive !== undefined) {
        // ✅ FIX: Convert to boolean properly (handles string or boolean input)
        const isActiveValue = req.body.isActive === true || req.body.isActive === 'true';
        updateData.isActive = isActiveValue;
        console.log('🔄 Updating theater isActive status:', { 
          theaterId: req.params.id, 
          receivedValue: req.body.isActive, 
          convertedValue: isActiveValue 
        });
        
        // ✅ NEW: Handle related credentials when theater is deactivated/reactivated
        if (isActiveValue === false) {
          // Update all QR codes for this theater to inactive
          try {
            const qrUpdateResult = await Theater.updateOne(
              { _id: req.params.id },
              { $set: { 'qrCodes.$[].isActive': false } }
            );
            console.log('✅ QR codes deactivated for theater:', req.params.id);
          } catch (qrError) {
            console.warn('⚠️ Failed to deactivate QR codes:', qrError.message);
          }
        } else if (isActiveValue === true) {
          // Automatically reactivate all QR codes for this theater
          try {
            const qrUpdateResult = await Theater.updateOne(
              { _id: req.params.id },
              { $set: { 'qrCodes.$[].isActive': true } }
            );
            console.log('✅ QR codes reactivated for theater:', req.params.id);
          } catch (qrError) {
            console.warn('⚠️ Failed to reactivate QR codes:', qrError.message);
          }
        }
      }
      
      if (req.body.address || req.body.city || req.body.state || req.body.pincode) {
        updateData.address = {
          street: req.body.address || theater.address?.street || '',
          city: req.body.city || theater.address?.city || '',
          state: req.body.state || theater.address?.state || '',
          pincode: req.body.pincode || theater.address?.pincode || ''
        };
      }

      if (req.body.city || req.body.state) {
        updateData.location = {
          city: req.body.city || theater.location?.city || '',
          state: req.body.state || theater.location?.state || ''
        };
      }

      if (req.body.ownerName || req.body.ownerContactNumber || req.body.personalAddress) {
        updateData.ownerDetails = {
          name: req.body.ownerName || theater.ownerDetails?.name || '',
          contactNumber: req.body.ownerContactNumber || theater.ownerDetails?.contactNumber || '',
          personalAddress: req.body.personalAddress || theater.ownerDetails?.personalAddress || ''
        };
      }

      if (req.body.agreementStartDate || req.body.agreementEndDate || fileUrls.agreementCopy) {
        updateData.agreementDetails = {
          startDate: req.body.agreementStartDate ? new Date(req.body.agreementStartDate) : theater.agreementDetails?.startDate,
          endDate: req.body.agreementEndDate ? new Date(req.body.agreementEndDate) : theater.agreementDetails?.endDate,
          copy: fileUrls.agreementCopy || theater.agreementDetails?.copy || null
        };
      }

      if (Object.keys(fileUrls).length > 0) {
        updateData.documents = {
          theaterPhoto: fileUrls.theaterPhoto || theater.documents?.theaterPhoto || null,
          logo: fileUrls.logo || theater.documents?.logo || null,
          aadharCard: fileUrls.aadharCard || theater.documents?.aadharCard || null,
          panCard: fileUrls.panCard || theater.documents?.panCard || null,
          gstCertificate: fileUrls.gstCertificate || theater.documents?.gstCertificate || null,
          fssaiCertificate: fileUrls.fssaiCertificate || theater.documents?.fssaiCertificate || null,
          agreementCopy: fileUrls.agreementCopy || theater.documents?.agreementCopy || null
        };

        if (fileUrls.logo) {
          updateData.branding = {
            ...theater.branding,
            logo: fileUrls.logo
          };
        }
      }

      if (req.body.facebook || req.body.instagram || req.body.twitter || req.body.youtube || req.body.website) {
        updateData.socialMedia = {
          facebook: req.body.facebook || theater.socialMedia?.facebook || null,
          instagram: req.body.instagram || theater.socialMedia?.instagram || null,
          twitter: req.body.twitter || theater.socialMedia?.twitter || null,
          youtube: req.body.youtube || theater.socialMedia?.youtube || null,
          website: req.body.website || theater.socialMedia?.website || null
        };
      }

      // 🔥 Handle Payment Gateway Configuration
      if (req.body.paymentGateway) {
        console.log('Updating payment gateway configuration:', req.body.paymentGateway);
        updateData.paymentGateway = {
          ...req.body.paymentGateway,
          lastUpdated: new Date()
        };
      }

      // Update theater
      const updatedTheater = await Theater.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');
      res.json({
        success: true,
        message: 'Theater updated successfully',
        data: updatedTheater
      });

    } catch (error) {
      console.error('❌ Update theater error:', error);
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid theater ID',
          code: 'INVALID_ID'
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to update theater',
        message: error.message
      });
    }
  });

/**
 * DELETE /api/theaters/:id
 * Permanently delete a theater and all related data (CASCADE DELETE)
 * Deletes: Theater, Users, Roles, Products, Orders, QR Codes, Settings, Files
 */
router.delete('/:id',
  authenticateToken,
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      const theaterId = req.params.id;
      const theater = await Theater.findById(theaterId);
      
      if (!theater) {
        return res.status(404).json({
          success: false,
          error: 'Theater not found',
          code: 'THEATER_NOT_FOUND'
        });
      }

      console.log(`🗑️  Starting CASCADE DELETE for theater: ${theater.name} (${theaterId})`);
      
      const deletionResults = {
        theater: theater.name,
        theaterId: theaterId,
        deleted: {},
        errors: []
      };

      // 1. Delete Theater Users (array-based)
      try {
        const TheaterUserArray = require('../models/TheaterUserArray');
        const usersDoc = await TheaterUserArray.findOne({ theaterId: theaterId });
        if (usersDoc) {
          const userCount = usersDoc.users.length;
          await TheaterUserArray.deleteOne({ theaterId: theaterId });
          deletionResults.deleted.users = userCount;
          console.log(`✅ Deleted ${userCount} theater users`);
        } else {
          deletionResults.deleted.users = 0;
        }
      } catch (error) {
        console.error('❌ Error deleting users:', error.message);
        deletionResults.errors.push({ type: 'users', error: error.message });
        deletionResults.deleted.users = 0;
      }

      // 2. Delete Roles (array-based)
      try {
        const RoleArray = require('../models/RoleArray');
        const rolesDoc = await RoleArray.findOne({ theaterId: theaterId });
        if (rolesDoc) {
          const roleCount = rolesDoc.roles.length;
          await RoleArray.deleteOne({ theaterId: theaterId });
          deletionResults.deleted.roles = roleCount;
          console.log(`✅ Deleted ${roleCount} roles`);
        } else {
          deletionResults.deleted.roles = 0;
        }
      } catch (error) {
        console.error('❌ Error deleting roles:', error.message);
        deletionResults.errors.push({ type: 'roles', error: error.message });
        deletionResults.deleted.roles = 0;
      }

      // 3. Delete Products
      try {
        const ProductList = require('../models/ProductList');
        const products = await ProductList.find({ theater: theaterId });
        const productCount = products.length;
        await ProductList.deleteMany({ theater: theaterId });
        deletionResults.deleted.products = productCount;
        console.log(`✅ Deleted ${productCount} products`);
      } catch (error) {
        console.error('❌ Error deleting products:', error.message);
        deletionResults.errors.push({ type: 'products', error: error.message });
        deletionResults.deleted.products = 0;
      }

      // 4. Delete Orders
      try {
        const TheaterOrder = require('../models/TheaterOrder');
        const orders = await TheaterOrder.find({ theater: theaterId });
        const orderCount = orders.length;
        await TheaterOrder.deleteMany({ theater: theaterId });
        deletionResults.deleted.orders = orderCount;
        console.log(`✅ Deleted ${orderCount} orders`);
      } catch (error) {
        console.error('❌ Error deleting orders:', error.message);
        deletionResults.errors.push({ type: 'orders', error: error.message });
        deletionResults.deleted.orders = 0;
      }

      // 5. Delete QR Codes
      try {
        const QRCodeName = require('../models/QRCodeName');
        const qrCodes = await QRCodeName.find({ theater: theaterId });
        const qrCount = qrCodes.length;
        await QRCodeName.deleteMany({ theater: theaterId });
        deletionResults.deleted.qrCodes = qrCount;
        console.log(`✅ Deleted ${qrCount} QR codes`);
      } catch (error) {
        console.error('❌ Error deleting QR codes:', error.message);
        deletionResults.errors.push({ type: 'qrCodes', error: error.message });
        deletionResults.deleted.qrCodes = 0;
      }

      // 6. Delete Settings
      try {
        const Setting = require('../models/Setting');
        const settings = await Setting.findOne({ theater: theaterId });
        if (settings) {
          await Setting.deleteOne({ theater: theaterId });
          deletionResults.deleted.settings = 1;
          console.log(`✅ Deleted settings`);
        } else {
          deletionResults.deleted.settings = 0;
        }
      } catch (error) {
        console.error('❌ Error deleting settings:', error.message);
        deletionResults.errors.push({ type: 'settings', error: error.message });
        deletionResults.deleted.settings = 0;
      }

      // 7. Delete uploaded files from storage
      const filesToDelete = [];
      if (theater.documents?.theaterPhoto) filesToDelete.push(theater.documents.theaterPhoto);
      if (theater.documents?.logo) filesToDelete.push(theater.documents.logo);
      if (theater.documents?.aadharCard) filesToDelete.push(theater.documents.aadharCard);
      if (theater.documents?.panCard) filesToDelete.push(theater.documents.panCard);
      if (theater.documents?.gstCertificate) filesToDelete.push(theater.documents.gstCertificate);
      if (theater.documents?.fssaiCertificate) filesToDelete.push(theater.documents.fssaiCertificate);
      if (theater.agreementDetails?.copy) filesToDelete.push(theater.agreementDetails.copy);

      if (filesToDelete.length > 0) {
        try {
          const { deleteFiles: deleteFilesUtil } = require('../utils/gcsUploadUtil');
          await deleteFilesUtil(filesToDelete);
          deletionResults.deleted.files = filesToDelete.length;
          console.log(`✅ Deleted ${filesToDelete.length} files from storage`);
        } catch (fileError) {
          console.warn('⚠️  Some files could not be deleted:', fileError.message);
          deletionResults.errors.push({ type: 'files', error: fileError.message });
          deletionResults.deleted.files = 0;
        }
      } else {
        deletionResults.deleted.files = 0;
      }

      // 8. Finally, delete the theater itself
      await Theater.findByIdAndDelete(theaterId);
      deletionResults.deleted.theater = true;
      console.log(`✅ Deleted theater document`);

      console.log(`🎉 CASCADE DELETE completed for theater: ${theater.name}`);
      console.log('📊 Deletion summary:', JSON.stringify(deletionResults.deleted, null, 2));

      res.json({
        success: true,
        message: `Theater "${theater.name}" and all related data deleted permanently`,
        summary: deletionResults.deleted,
        warnings: deletionResults.errors.length > 0 ? deletionResults.errors : undefined
      });

    } catch (error) {
      console.error('❌ Delete theater error:', error);
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid theater ID',
          code: 'INVALID_ID'
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to delete theater',
        message: error.message
      });
    }
  });

/**
 * PUT /api/theaters/:id/password
 * Update theater password
 */
router.put('/:id/password', [
  authenticateToken,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({
        error: 'Theater not found',
        code: 'THEATER_NOT_FOUND'
      });
    }

    // Check authorization
    if (req.user.role !== 'super_admin' && req.user.theaterId !== req.params.id) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password (only if not super admin)
    if (req.user.role !== 'super_admin') {
      const isCurrentPasswordValid = await theater.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          error: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }
    }

    // Update password
    theater.password = newPassword;
    await theater.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Update password error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid theater ID',
        code: 'INVALID_ID'
      });
    }
    res.status(500).json({
      error: 'Failed to update password',
      message: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/theaters/:id
 * Delete a theater (soft delete)
 */
router.delete('/:id', [
  authenticateToken,
  requireRole(['super_admin'])
], async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id);
    if (!theater) {
      return res.status(404).json({
        error: 'Theater not found',
        code: 'THEATER_NOT_FOUND'
      });
    }

    // Soft delete
    theater.isActive = false;
    theater.status = 'inactive';
    await theater.save();

    res.json({
      success: true,
      message: 'Theater deleted successfully'
    });

  } catch (error) {
    console.error('Delete theater error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid theater ID',
        code: 'INVALID_ID'
      });
    }
    res.status(500).json({
      error: 'Failed to delete theater',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/theaters/:id/dashboard
 * Get theater dashboard data
 */
router.get('/:id/dashboard', [authenticateToken], async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id).select('-password');
    if (!theater) {
      return res.status(404).json({
        error: 'Theater not found',
        code: 'THEATER_NOT_FOUND'
      });
    }

    // Check authorization
    if (req.user.role !== 'super_admin' && req.user.theaterId !== req.params.id) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Get dashboard statistics
    const Product = require('../models/Product');
    const Order = require('../models/Order');
    
    const [
      totalProducts,
      activeProducts,
      totalOrders,
      todayOrders,
      todayRevenue
    ] = await Promise.all([
      Product.countDocuments({ theaterId: req.params.id }),
      Product.countDocuments({ theaterId: req.params.id, isActive: true, status: 'active' }),
      Order.countDocuments({ theaterId: req.params.id }),
      Order.countDocuments({ 
        theaterId: req.params.id,
        createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
      }),
      Order.aggregate([
        {
          $match: {
            theaterId: new require('mongoose').Types.ObjectId(req.params.id),
            createdAt: { $gte: new Date().setHours(0, 0, 0, 0) },
            'payment.status': 'paid'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$pricing.total' }
          }
        }
      ])
    ]);

    const dashboardData = {
      theater: {
        id: theater._id,
        name: theater.name,
        status: theater.status,
        isActive: theater.isActive
      },
      stats: {
        products: {
          total: totalProducts,
          active: activeProducts
        },
        orders: {
          total: totalOrders,
          today: todayOrders
        },
        revenue: {
          today: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
          currency: theater.settings?.currency || 'INR'
        }
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid theater ID',
        code: 'INVALID_ID'
      });
    }
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/theaters/expiring-agreements
 * Get theaters with agreements expiring within 5 days
 */
router.get('/expiring-agreements', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const fiveDaysFromNow = new Date(now);
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    
    // Find theaters with agreements expiring within 5 days
    const expiringTheaters = await Theater.find({
      'agreementDetails.endDate': {
        $gte: now,
        $lte: fiveDaysFromNow
      },
      isActive: true
    })
    .select('name _id agreementDetails.endDate ownerDetails.contactNumber')
    .lean();

    // Calculate days until expiration for each theater
    const theatersWithDays = expiringTheaters.map(theater => {
      const endDate = new Date(theater.agreementDetails.endDate);
      const daysUntilExpiration = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      
      return {
        theaterId: theater._id,
        theaterName: theater.name,
        endDate: theater.agreementDetails.endDate,
        daysUntilExpiration,
        contactNumber: theater.ownerDetails?.contactNumber || null
      };
    });

    res.json({
      success: true,
      data: {
        expiringTheaters: theatersWithDays,
        count: theatersWithDays.length,
        checkDate: now,
        expirationWindow: 5
      }
    });
  } catch (error) {
    console.error('Error fetching expiring agreements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch expiring agreements',
      message: error.message
    });
  }
});

/**
 * GET /api/theaters/:theaterId/agreement-status
 * Get agreement expiration status for a specific theater
 */
router.get('/:theaterId/agreement-status', authenticateToken, async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.theaterId)
      .select('name agreementDetails.endDate isActive')
      .lean();

    if (!theater) {
      return res.status(404).json({
        success: false,
        error: 'Theater not found'
      });
    }

    if (!theater.agreementDetails?.endDate) {
      return res.json({
        success: true,
        data: {
          hasAgreement: false,
          isExpiring: false,
          daysUntilExpiration: null
        }
      });
    }

    const now = new Date();
    const endDate = new Date(theater.agreementDetails.endDate);
    const daysUntilExpiration = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    const isExpiring = daysUntilExpiration <= 5 && daysUntilExpiration >= 0;
    const isExpired = daysUntilExpiration < 0;

    res.json({
      success: true,
      data: {
        hasAgreement: true,
        isExpiring,
        isExpired,
        daysUntilExpiration: isExpired ? 0 : daysUntilExpiration,
        endDate: theater.agreementDetails.endDate
      }
    });
  } catch (error) {
    console.error('Error fetching agreement status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agreement status',
      message: error.message
    });
  }
});

module.exports = router;