const BaseService = require('./BaseService');
const QRCodeName = require('../models/QRCodeNameArray');

/**
 * QR Code Name Service
 * Handles all QR code name-related business logic
 */
class QRCodeNameService extends BaseService {
  constructor() {
    super(QRCodeName);
  }

  /**
   * Get QR code names for theater
   */
  async getQRCodeNames(theaterId, queryParams) {
    const { limit, isActive } = queryParams;

    const qrNamesDoc = await QRCodeName.findOne({ theater: theaterId })
      .populate('theater', 'name location')
      .lean()
      .maxTimeMS(20000);

    if (!qrNamesDoc) {
      return {
        qrCodeNames: [],
        theater: null,
        metadata: {
          totalQRNames: 0,
          activeQRNames: 0,
          inactiveQRNames: 0
        }
      };
    }

    let qrNameList = qrNamesDoc.qrNameList || [];
    
    if (isActive !== undefined) {
      qrNameList = qrNameList.filter(qr => qr.isActive === (isActive === 'true'));
    }

    if (limit) {
      qrNameList = qrNameList.slice(0, parseInt(limit));
    }

    return {
      qrCodeNames: qrNameList,
      theater: qrNamesDoc.theater,
      metadata: qrNamesDoc.metadata || {
        totalQRNames: qrNamesDoc.qrNameList?.length || 0,
        activeQRNames: qrNamesDoc.qrNameList?.filter(qr => qr.isActive).length || 0,
        inactiveQRNames: qrNamesDoc.qrNameList?.filter(qr => !qr.isActive).length || 0
      }
    };
  }

  /**
   * Create QR code name
   */
  async createQRCodeName(theaterId, data) {
    const { qrName, seatClass, description } = data;

    let qrNamesDoc = await QRCodeName.findOrCreateByTheater(theaterId);

    const existingQR = qrNamesDoc.qrNameList.find(qr =>
      qr.qrName.toLowerCase() === qrName.toLowerCase() && qr.isActive
    );

    if (existingQR) {
      throw new Error('QR name already exists in this theater');
    }

    await qrNamesDoc.addQRName({
      qrName: qrName.trim(),
      seatClass: seatClass.trim(),
      description: description ? description.trim() : ''
    });

    await qrNamesDoc.populate('theater', 'name location');

    return {
      qrCodeNames: qrNamesDoc.qrNameList,
      theater: qrNamesDoc.theater,
      metadata: qrNamesDoc.metadata
    };
  }

  /**
   * Update QR code name
   */
  async updateQRCodeName(theaterId, qrNameId, updateData) {
    const qrNamesDoc = await QRCodeName.findOne({ theater: theaterId }).maxTimeMS(20000);
    if (!qrNamesDoc) {
      throw new Error('QR code names document not found');
    }

    const qrName = qrNamesDoc.qrNameList.id(qrNameId);
    if (!qrName) {
      throw new Error('QR code name not found');
    }

    if (updateData.qrName) qrName.qrName = updateData.qrName.trim();
    if (updateData.seatClass) qrName.seatClass = updateData.seatClass.trim();
    if (updateData.description !== undefined) qrName.description = updateData.description.trim();
    if (updateData.isActive !== undefined) qrName.isActive = updateData.isActive;

    qrName.updatedAt = new Date();
    await qrNamesDoc.save();

    return qrName;
  }

  /**
   * Delete QR code name
   */
  async deleteQRCodeName(theaterId, qrNameId) {
    const qrNamesDoc = await QRCodeName.findOne({ theater: theaterId }).maxTimeMS(20000);
    if (!qrNamesDoc) {
      throw new Error('QR code names document not found');
    }

    const qrName = qrNamesDoc.qrNameList.id(qrNameId);
    if (!qrName) {
      throw new Error('QR code name not found');
    }

    qrNamesDoc.qrNameList.pull(qrNameId);
    await qrNamesDoc.save();

    return true;
  }
}

module.exports = new QRCodeNameService();

