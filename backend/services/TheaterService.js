const BaseService = require('./BaseService');
const Theater = require('../models/Theater');
const Settings = require('../models/Settings');
const roleService = require('./roleService');

/**
 * Theater Service
 * Handles all theater-related business logic
 */
class TheaterService extends BaseService {
  constructor() {
    super(Theater);
  }

  /**
   * Get theaters with pagination and filtering
   */
  async getTheaters(queryParams) {
    const startTime = Date.now();
    const {
      page = 1,
      limit = 10,
      status,
      isActive,
      q: searchTerm
    } = queryParams;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    if (searchTerm) {
      filter.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { username: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { 'address.city': { $regex: searchTerm, $options: 'i' } }
      ];
    }

    console.log('🔍 [TheaterService] Query filter:', JSON.stringify(filter));
    const result = await this.findAll(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: 1 },
      select: '-password -__v',
      lean: true
    });
    const duration = Date.now() - startTime;
    console.log(`✅ [TheaterService] Query completed in ${duration}ms`);
    return result;
  }

  /**
   * Get theater by ID
   */
  async getTheaterById(id) {
    return this.findById(id, {
      select: '-password -__v',
      lean: true
    });
  }

  /**
   * Create theater with files and default settings
   */
  async createTheater(theaterData, fileUrls = {}) {
    // Prepare theater document
    const theater = new Theater({
      ...theaterData,
      documents: {
        theaterPhoto: fileUrls.theaterPhoto || null,
        logo: fileUrls.logo || null,
        aadharCard: fileUrls.aadharCard || null,
        panCard: fileUrls.panCard || null,
        gstCertificate: fileUrls.gstCertificate || null,
        fssaiCertificate: fileUrls.fssaiCertificate || null,
        agreementCopy: fileUrls.agreementCopy || null
      },
      agreementDetails: {
        ...theaterData.agreementDetails,
        copy: fileUrls.agreementCopy || null
      },
      branding: {
        ...theaterData.branding,
        logo: fileUrls.logo || null,
        logoUrl: fileUrls.logo || null
      }
    });

    const savedTheater = await theater.save();

    // Initialize defaults (non-blocking)
    Promise.all([
      Settings.initializeDefaults(savedTheater._id).catch(err => 
        console.warn('Settings init failed:', err.message)
      ),
      roleService.createDefaultTheaterAdminRole(savedTheater._id, savedTheater.name).catch(err => 
        console.warn('Role creation failed:', err.message)
      ),
      roleService.createDefaultKioskRole(savedTheater._id, savedTheater.name).catch(err => 
        console.warn('Kiosk role creation failed:', err.message)
      )
    ]);

    return savedTheater;
  }

  /**
   * Update theater
   */
  async updateTheater(id, updateData) {
    return this.updateById(id, updateData, {
      new: true,
      runValidators: true
    });
  }

  /**
   * Delete theater (CASCADE DELETE)
   */
  async deleteTheater(id) {
    const theater = await this.findById(id);
    if (!theater) {
      throw new Error('Theater not found');
    }

    const deletionResults = { deleted: {}, errors: [] };

    // Delete related data
    try {
      const TheaterUserArray = require('../models/Theater');
      const usersDoc = await TheaterUserArray.findOne({ theaterId: id });
      if (usersDoc) {
        await TheaterUserArray.deleteOne({ theaterId: id });
        deletionResults.deleted.users = usersDoc.users.length;
      }
    } catch (error) {
      deletionResults.errors.push({ type: 'users', error: error.message });
    }

    try {
      const RoleArray = require('../models/RoleArray');
      const rolesDoc = await RoleArray.findOne({ theaterId: id });
      if (rolesDoc) {
        await RoleArray.deleteOne({ theaterId: id });
        deletionResults.deleted.roles = rolesDoc.roles.length;
      }
    } catch (error) {
      deletionResults.errors.push({ type: 'roles', error: error.message });
    }

    try {
      const ProductList = require('../models/ProductList');
      const products = await ProductList.find({ theater: id });
      await ProductList.deleteMany({ theater: id });
      deletionResults.deleted.products = products.length;
    } catch (error) {
      deletionResults.errors.push({ type: 'products', error: error.message });
    }

    try {
      const TheaterOrder = require('../models/TheaterOrder');
      const orders = await TheaterOrder.find({ theater: id });
      await TheaterOrder.deleteMany({ theater: id });
      deletionResults.deleted.orders = orders.length;
    } catch (error) {
      deletionResults.errors.push({ type: 'orders', error: error.message });
    }

    try {
      const QRCodeName = require('../models/QRCodeName');
      const qrCodes = await QRCodeName.find({ theater: id });
      await QRCodeName.deleteMany({ theater: id });
      deletionResults.deleted.qrCodes = qrCodes.length;
    } catch (error) {
      deletionResults.errors.push({ type: 'qrCodes', error: error.message });
    }

    try {
      const Setting = require('../models/Setting');
      await Setting.deleteOne({ theater: id });
      deletionResults.deleted.settings = 1;
    } catch (error) {
      deletionResults.errors.push({ type: 'settings', error: error.message });
    }

    // Delete files
    const { deleteFiles } = require('../utils/gcsUploadUtil');
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
        await deleteFiles(filesToDelete);
        deletionResults.deleted.files = filesToDelete.length;
      } catch (error) {
        deletionResults.errors.push({ type: 'files', error: error.message });
      }
    }

    // Delete theater
    await this.deleteById(id);
    deletionResults.deleted.theater = true;

    return {
      theater,
      deletionResults
    };
  }

  /**
   * Check if username exists
   */
  async usernameExists(username, excludeId = null) {
    const filter = { username: username.toLowerCase() };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    return this.exists(filter);
  }

  /**
   * Check if email exists
   */
  async emailExists(email, excludeId = null) {
    const filter = { email: email.toLowerCase() };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    return this.exists(filter);
  }

  /**
   * Get expiring agreements
   */
  async getExpiringAgreements(days = 5) {
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + days);

    const theaters = await this.model.find({
      'agreementDetails.endDate': {
        $gte: now,
        $lte: futureDate
      },
      isActive: true
    })
    .select('name _id agreementDetails.endDate ownerDetails.contactNumber')
    .lean()
    .maxTimeMS(20000);

    return theaters.map(theater => {
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
  }

  /**
   * Get agreement status for theater
   */
  async getAgreementStatus(theaterId) {
    const theater = await this.findById(theaterId, {
      select: 'name agreementDetails.endDate isActive',
      lean: true
    });

    if (!theater) {
      throw new Error('Theater not found');
    }

    if (!theater.agreementDetails?.endDate) {
      return {
        hasAgreement: false,
        isExpiring: false,
        daysUntilExpiration: null
      };
    }

    const now = new Date();
    const endDate = new Date(theater.agreementDetails.endDate);
    const daysUntilExpiration = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    const isExpiring = daysUntilExpiration <= 5 && daysUntilExpiration >= 0;
    const isExpired = daysUntilExpiration < 0;

    return {
      hasAgreement: true,
      isExpiring,
      isExpired,
      daysUntilExpiration: isExpired ? 0 : daysUntilExpiration,
      endDate: theater.agreementDetails.endDate
    };
  }
}

module.exports = new TheaterService();

