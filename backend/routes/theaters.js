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
  query('search').optional().isLength({ min: 1 }).withMessage('Search term must not be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status, search, isActive } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query
    const theaters = await Theater.find(query)
      .select('-password')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Theater.countDocuments(query);

    res.json({
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
    });

  } catch (error) {
    console.error('Get theaters error:', error);
    res.status(500).json({
      error: 'Failed to fetch theaters',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/theaters/:id
 * Get a specific theater by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.id).select('-password');
    
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
      console.log('🎭 Creating new theater...');
      console.log('📄 Form data:', Object.keys(req.body));
      console.log('📎 Files received:', req.files ? Object.keys(req.files) : 'none');
      
      // Detailed file logging
      if (req.files) {
        Object.keys(req.files).forEach(fieldName => {
          const fileArray = req.files[fieldName];
          fileArray.forEach(file => {
            console.log(`   📄 ${fieldName}:`, {
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: `${(file.size / 1024).toFixed(2)} KB`,
              hasBuffer: !!file.buffer
            });
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
          console.log('☁️  Uploading files to GCS...');
          
          // Create folder path: theater list/[Theater Name]
          const sanitizedTheaterName = name.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, ' ');
          const theaterFolder = `theater list/${sanitizedTheaterName}`;
          console.log(`📁 Creating folder: ${theaterFolder}`);
          
          const allFiles = [];
          Object.keys(req.files).forEach(fieldName => {
            req.files[fieldName].forEach(file => {
              allFiles.push({ ...file, fieldname: fieldName });
            });
          });

          fileUrls = await uploadFiles(allFiles, theaterFolder);
          console.log('✅ Files uploaded:', Object.keys(fileUrls));
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

      console.log('✅ Theater created successfully:', savedTheater._id);

      // Initialize default settings for the theater
      try {
        await Settings.initializeDefaults(savedTheater._id);
        console.log('✅ Default settings initialized');
      } catch (settingsError) {
        console.warn('⚠️  Failed to initialize settings:', settingsError.message);
      }

      // Create default Theater Admin role
      try {
        const defaultRole = await roleService.createDefaultTheaterAdminRole(
          savedTheater._id,
          savedTheater.name
        );
        console.log('✅ Default Theater Admin role created:', defaultRole._id);
      } catch (roleError) {
        console.error('⚠️  Failed to create default Theater Admin role:', roleError.message);
        // Don't fail theater creation if role creation fails
        // The role can be created later via migration script if needed
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
      console.log('🔄 Updating theater:', req.params.id);
      console.log('📄 Form data:', Object.keys(req.body));
      console.log('📎 Files:', req.files ? Object.keys(req.files) : 'none');

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
          console.log('☁️  Uploading new files to GCS...');
          
          // Create folder path: theater list/[Theater Name]
          // Use updated name if provided, otherwise use existing name
          const theaterName = req.body.name ? req.body.name.trim() : theater.name;
          const sanitizedTheaterName = theaterName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, ' ');
          const theaterFolder = `theater list/${sanitizedTheaterName}`;
          console.log(`📁 Uploading to folder: ${theaterFolder}`);
          
          const allFiles = [];
          Object.keys(req.files).forEach(fieldName => {
            req.files[fieldName].forEach(file => {
              allFiles.push({ ...file, fieldname: fieldName });
            });
          });

          fileUrls = await uploadFiles(allFiles, theaterFolder);
          console.log('✅ New files uploaded:', Object.keys(fileUrls));

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
            console.log(`🗑️  Deleted ${filesToDelete.length} old files`);
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
        updateData.isActive = req.body.isActive;
        // ✅ NEW: Handle related credentials when theater is deactivated/reactivated
        if (req.body.isActive === false) {
          console.log('🔒 Theater being deactivated - updating related QR codes');
          // Update all QR codes for this theater to inactive
          try {
            const qrUpdateResult = await Theater.updateOne(
              { _id: req.params.id },
              { $set: { 'qrCodes.$[].isActive': false } }
            );
            console.log('🔒 QR codes deactivated:', qrUpdateResult.modifiedCount);
          } catch (qrError) {
            console.warn('⚠️ Failed to deactivate QR codes:', qrError.message);
          }
        } else if (req.body.isActive === true) {
          console.log('🔓 Theater being reactivated - updating related QR codes to active');
          // Automatically reactivate all QR codes for this theater
          try {
            const qrUpdateResult = await Theater.updateOne(
              { _id: req.params.id },
              { $set: { 'qrCodes.$[].isActive': true } }
            );
            console.log('🔓 QR codes reactivated:', qrUpdateResult.modifiedCount);
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

      // Update theater
      const updatedTheater = await Theater.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');

      console.log('✅ Theater updated successfully:', updatedTheater._id);

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
 * Delete a theater (soft delete) and optionally clean up GCS files
 */
router.delete('/:id',
  authenticateToken,
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      console.log('🗑️  Deleting theater:', req.params.id);

      const theater = await Theater.findById(req.params.id);
      if (!theater) {
        return res.status(404).json({
          success: false,
          error: 'Theater not found',
          code: 'THEATER_NOT_FOUND'
        });
      }

      const deleteFiles = req.query.deleteFiles === 'true';

      if (deleteFiles) {
        // Hard delete with file cleanup
        console.log('🗑️  Hard delete - removing files from GCS...');
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
            const deletedCount = await deleteFiles(filesToDelete);
            console.log(`🗑️  Deleted ${deletedCount}/${filesToDelete.length} files from GCS`);
          } catch (fileError) {
            console.warn('⚠️  Some files could not be deleted:', fileError.message);
          }
        }

        // Remove from database
        await Theater.findByIdAndDelete(req.params.id);
        console.log('✅ Theater hard deleted');

        res.json({
          success: true,
          message: 'Theater and associated files deleted successfully'
        });
      } else {
        // Soft delete - Use findByIdAndUpdate to avoid validation issues with old theaters
        console.log('📝 Soft delete - setting isActive to false...');
        await Theater.findByIdAndUpdate(
          req.params.id,
          { 
            isActive: false, 
            status: 'inactive' 
          },
          { runValidators: false } // Don't run validators to avoid issues with old data
        );

        console.log('✅ Theater soft deleted');

        res.json({
          success: true,
          message: 'Theater deactivated successfully'
        });
      }

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

module.exports = router;