const BaseController = require('./BaseController');
const theaterService = require('../services/TheaterService');
const { uploadFiles, deleteFiles } = require('../utils/gcsUploadUtil');

/**
 * Theater Controller
 * Handles HTTP requests and responses for theater endpoints
 */
class TheaterController extends BaseController {
  /**
   * GET /api/theaters
   * Get all theaters with pagination and filtering
   */
  static async getAll(req, res) {
    const startTime = Date.now();
    try {
      // Check database connection
      if (!BaseController.checkDatabaseConnection()) {
        return res.status(503).json(
          BaseController.getDatabaseErrorResponse(req)
        );
      }

      console.log('🔍 [TheaterController] Fetching theaters with query:', req.query);
      const result = await theaterService.getTheaters(req.query);
      const duration = Date.now() - startTime;
      console.log(`✅ [TheaterController] Fetched ${result.data.length} theaters in ${duration}ms`);
      return BaseController.paginated(res, result.data, result.pagination);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [TheaterController] Get theaters error after ${duration}ms:`, error);
      return BaseController.error(res, 'Failed to fetch theaters', 500, {
        message: error.message
      });
    }
  }

  /**
   * GET /api/theaters/:id
   * Get a specific theater by ID
   */
  static async getById(req, res) {
    try {
      const theater = await theaterService.getTheaterById(req.params.id);

      if (!theater) {
        return BaseController.error(res, 'Theater not found', 404, {
          code: 'THEATER_NOT_FOUND'
        });
      }

      return BaseController.success(res, theater);
    } catch (error) {
      console.error('Get theater error:', error);
      if (error.name === 'CastError') {
        return BaseController.error(res, 'Invalid theater ID', 400, {
          code: 'INVALID_ID'
        });
      }
      return BaseController.error(res, 'Failed to fetch theater', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/theaters
   * Create a new theater
   */
  static async create(req, res) {
    try {
      const {
        name,
        username,
        password,
        email,
        phone,
        address,
        street,
        city,
        state,
        pincode,
        ownerName,
        ownerContactNumber,
        personalAddress,
        ownerPersonalAddress,
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
        return BaseController.error(res, 'Theater name, username, and password are required', 400);
      }

      // Check for duplicates
      if (await theaterService.usernameExists(username)) {
        return BaseController.error(res, 'Username already exists', 409, {
          code: 'USERNAME_EXISTS'
        });
      }

      if (email && await theaterService.emailExists(email)) {
        return BaseController.error(res, 'Email already exists', 409, {
          code: 'EMAIL_EXISTS'
        });
      }

      // Upload files
      let fileUrls = {};
      if (req.files && Object.keys(req.files).length > 0) {
        try {
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
          console.error('File upload error:', uploadError);
          return BaseController.error(res, 'Failed to upload files', 500, {
            message: uploadError.message
          });
        }
      }

      // Prepare theater data
      const theaterData = {
        name: name.trim(),
        username: username.toLowerCase().trim(),
        password,
        email: email ? email.toLowerCase().trim() : undefined,
        phone: phone || undefined,
        address: {
          street: address || street || '',
          city: city || '',
          state: state || '',
          pincode: pincode || ''
        },
        location: {
          city: city || '',
          state: state || '',
          country: 'India'
        },
        ownerDetails: {
          name: ownerName || '',
          contactNumber: ownerContactNumber || '',
          personalAddress: personalAddress || ownerPersonalAddress || ''
        },
        agreementDetails: {
          startDate: agreementStartDate ? new Date(agreementStartDate) : undefined,
          endDate: agreementEndDate ? new Date(agreementEndDate) : undefined
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
          secondaryColor: '#F3F4F6'
        },
        isActive: true,
        status: 'active'
      };

      const savedTheater = await theaterService.createTheater(theaterData, fileUrls);

      return res.status(201).json({
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
      console.error('Create theater error:', error);
      if (error.code === 11000) {
        return BaseController.error(res, 'Duplicate entry', 409, {
          message: 'Username or email already exists'
        });
      }
      return BaseController.error(res, 'Failed to create theater', 500, {
        message: error.message
      });
    }
  }

  /**
   * PUT /api/theaters/:id
   * Update a theater
   */
  static async update(req, res) {
    try {
      const theater = await theaterService.getTheaterById(req.params.id);
      if (!theater) {
        return BaseController.error(res, 'Theater not found', 404, {
          code: 'THEATER_NOT_FOUND'
        });
      }

      // Check authorization
      if (req.user.role !== 'super_admin' && req.user.theaterId?.toString() !== req.params.id) {
        return BaseController.error(res, 'Access denied', 403, {
          code: 'ACCESS_DENIED'
        });
      }

      // Upload new files and delete old ones
      let fileUrls = {};
      if (req.files && Object.keys(req.files).length > 0) {
        try {
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

          // Delete old files
          const filesToDelete = [];
          if (fileUrls.theaterPhoto && theater.documents?.theaterPhoto) filesToDelete.push(theater.documents.theaterPhoto);
          if (fileUrls.logo && theater.documents?.logo) filesToDelete.push(theater.documents.logo);
          if (fileUrls.aadharCard && theater.documents?.aadharCard) filesToDelete.push(theater.documents.aadharCard);
          if (fileUrls.panCard && theater.documents?.panCard) filesToDelete.push(theater.documents.panCard);
          if (fileUrls.gstCertificate && theater.documents?.gstCertificate) filesToDelete.push(theater.documents.gstCertificate);
          if (fileUrls.fssaiCertificate && theater.documents?.fssaiCertificate) filesToDelete.push(theater.documents.fssaiCertificate);
          if (fileUrls.agreementCopy && theater.agreementDetails?.copy) filesToDelete.push(theater.agreementDetails.copy);

          if (filesToDelete.length > 0) {
            await deleteFiles(filesToDelete);
          }
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          return BaseController.error(res, 'Failed to upload files', 500, {
            message: uploadError.message
          });
        }
      }

      // Build update data
      const updateData = {};
      if (req.body.name) updateData.name = req.body.name.trim();
      if (req.body.email) updateData.email = req.body.email.toLowerCase().trim();
      if (req.body.phone) updateData.phone = req.body.phone;
      if (req.body.isActive !== undefined) {
        const isActiveValue = req.body.isActive === true || req.body.isActive === 'true';
        updateData.isActive = isActiveValue;
        
        // Update QR codes when theater status changes
        const Theater = require('../models/Theater');
        if (isActiveValue === false) {
          await Theater.updateOne(
            { _id: req.params.id },
            { $set: { 'qrCodes.$[].isActive': false } }
          ).catch(err => console.warn('QR deactivation failed:', err.message));
        } else if (isActiveValue === true) {
          await Theater.updateOne(
            { _id: req.params.id },
            { $set: { 'qrCodes.$[].isActive': true } }
          ).catch(err => console.warn('QR reactivation failed:', err.message));
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
      if (req.body.paymentGateway) {
        updateData.paymentGateway = {
          ...req.body.paymentGateway,
          lastUpdated: new Date()
        };
      }

      const updatedTheater = await theaterService.updateTheater(req.params.id, updateData);

      return BaseController.success(res, updatedTheater, 'Theater updated successfully');
    } catch (error) {
      console.error('Update theater error:', error);
      if (error.name === 'CastError') {
        return BaseController.error(res, 'Invalid theater ID', 400, {
          code: 'INVALID_ID'
        });
      }
      return BaseController.error(res, 'Failed to update theater', 500, {
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/theaters/:id
   * Delete a theater
   */
  static async delete(req, res) {
    try {
      const { theater, deletionResults } = await theaterService.deleteTheater(req.params.id);

      return BaseController.success(res, {
        message: `Theater "${theater.name}" and all related data deleted permanently`,
        summary: deletionResults.deleted,
        warnings: deletionResults.errors.length > 0 ? deletionResults.errors : undefined
      });
    } catch (error) {
      console.error('Delete theater error:', error);
      if (error.message === 'Theater not found') {
        return BaseController.error(res, 'Theater not found', 404, {
          code: 'THEATER_NOT_FOUND'
        });
      }
      if (error.name === 'CastError') {
        return BaseController.error(res, 'Invalid theater ID', 400, {
          code: 'INVALID_ID'
        });
      }
      return BaseController.error(res, 'Failed to delete theater', 500, {
        message: error.message
      });
    }
  }

  /**
   * PUT /api/theaters/:id/password
   * Update theater password
   */
  static async updatePassword(req, res) {
    try {
      const theater = await theaterService.getTheaterById(req.params.id);
      if (!theater) {
        return BaseController.error(res, 'Theater not found', 404, {
          code: 'THEATER_NOT_FOUND'
        });
      }

      // Check authorization
      if (req.user.role !== 'super_admin' && req.user.theaterId?.toString() !== req.params.id) {
        return BaseController.error(res, 'Access denied', 403, {
          code: 'ACCESS_DENIED'
        });
      }

      // Verify current password (only if not super admin)
      if (req.user.role !== 'super_admin' && req.body.currentPassword) {
        const Theater = require('../models/Theater');
        const theaterDoc = await Theater.findById(req.params.id);
        const isCurrentPasswordValid = await theaterDoc.comparePassword(req.body.currentPassword);
        if (!isCurrentPasswordValid) {
          return BaseController.error(res, 'Current password is incorrect', 400, {
            code: 'INVALID_CURRENT_PASSWORD'
          });
        }
      }

      // Update password
      const Theater = require('../models/Theater');
      const theaterDoc = await Theater.findById(req.params.id);
      theaterDoc.password = req.body.newPassword;
      await theaterDoc.save();

      return BaseController.success(res, null, 'Password updated successfully');
    } catch (error) {
      console.error('Update password error:', error);
      if (error.name === 'CastError') {
        return BaseController.error(res, 'Invalid theater ID', 400, {
          code: 'INVALID_ID'
        });
      }
      return BaseController.error(res, 'Failed to update password', 500, {
        message: error.message
      });
    }
  }

  /**
   * GET /api/theaters/expiring-agreements
   * Get theaters with expiring agreements
   */
  static async getExpiringAgreements(req, res) {
    try {
      const theaters = await theaterService.getExpiringAgreements(5);
      return BaseController.success(res, {
        expiringTheaters: theaters,
        count: theaters.length,
        checkDate: new Date(),
        expirationWindow: 5
      });
    } catch (error) {
      console.error('Error fetching expiring agreements:', error);
      return BaseController.error(res, 'Failed to fetch expiring agreements', 500, {
        message: error.message
      });
    }
  }

  /**
   * GET /api/theaters/:theaterId/agreement-status
   * Get agreement status
   */
  static async getAgreementStatus(req, res) {
    try {
      const status = await theaterService.getAgreementStatus(req.params.theaterId);
      return BaseController.success(res, status);
    } catch (error) {
      console.error('Error fetching agreement status:', error);
      if (error.message === 'Theater not found') {
        return BaseController.error(res, 'Theater not found', 404);
      }
      return BaseController.error(res, 'Failed to fetch agreement status', 500, {
        message: error.message
      });
    }
  }

  /**
   * GET /api/theaters/:id/dashboard
   * Get theater dashboard data
   */
  static async getDashboard(req, res) {
    try {
      const theater = await theaterService.getTheaterById(req.params.id);
      if (!theater) {
        return BaseController.error(res, 'Theater not found', 404, {
          code: 'THEATER_NOT_FOUND'
        });
      }

      // Check authorization
      if (req.user.role !== 'super_admin' && req.user.theaterId?.toString() !== req.params.id) {
        return BaseController.error(res, 'Access denied', 403, {
          code: 'ACCESS_DENIED'
        });
      }

      // Get dashboard statistics
      const Product = require('../models/Product');
      const Order = require('../models/Order');
      const mongoose = require('mongoose');
      
      const [
        totalProducts,
        activeProducts,
        totalOrders,
        todayOrders,
        todayRevenue
      ] = await Promise.all([
        Product.countDocuments({ theaterId: req.params.id }).maxTimeMS(15000),
        Product.countDocuments({ theaterId: req.params.id, isActive: true, status: 'active' }).maxTimeMS(15000),
        Order.countDocuments({ theaterId: req.params.id }).maxTimeMS(15000),
        Order.countDocuments({ 
          theaterId: req.params.id,
          createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
        }).maxTimeMS(15000),
        Order.aggregate([
          {
            $match: {
              theaterId: new mongoose.Types.ObjectId(req.params.id),
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
        ]).maxTimeMS(15000)
      ]);

      return BaseController.success(res, {
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
      });
    } catch (error) {
      console.error('Get dashboard error:', error);
      if (error.name === 'CastError') {
        return BaseController.error(res, 'Invalid theater ID', 400, {
          code: 'INVALID_ID'
        });
      }
      return BaseController.error(res, 'Failed to fetch dashboard data', 500, {
        message: error.message
      });
    }
  }
}

module.exports = TheaterController;

