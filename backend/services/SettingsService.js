const BaseService = require('./BaseService');
const Settings = require('../models/Settings');
const mongoose = require('mongoose');

/**
 * Settings Service
 * Handles all settings-related business logic
 */
class SettingsService extends BaseService {
  constructor() {
    super(Settings);
  }

  /**
   * Get general settings
   */
  async getGeneralSettings(theaterId = null) {
    const db = mongoose.connection.db;
    
    try {
      const settingsDoc = await db.collection('settings').findOne({ type: 'general' });
      
      if (settingsDoc && settingsDoc.generalConfig) {
        const generalConfig = settingsDoc.generalConfig;
        return {
          applicationName: generalConfig.applicationName || 'Theater Canteen System',
          browserTabTitle: generalConfig.browserTabTitle || 'YQPayNow - Theater Canteen',
          logoUrl: generalConfig.logoUrl || '',
          qrCodeUrl: generalConfig.qrCodeUrl || '',
          environment: generalConfig.environment || 'development',
          defaultCurrency: generalConfig.defaultCurrency || 'INR',
          timezone: generalConfig.timezone || 'Asia/Kolkata',
          dateFormat: generalConfig.dateFormat || 'DD/MM/YYYY',
          timeFormat: generalConfig.timeFormat || '12hour',
          languageRegion: generalConfig.languageRegion || 'en-IN',
          currency: generalConfig.currency || generalConfig.defaultCurrency || 'INR',
          currencySymbol: generalConfig.currencySymbol || '₹',
          primaryColor: generalConfig.primaryColor || '#8B5CF6',
          secondaryColor: generalConfig.secondaryColor || '#6366F1',
          taxRate: generalConfig.taxRate || 18,
          serviceChargeRate: generalConfig.serviceChargeRate || 0
        };
      }
      
      // Return defaults
      return {
        applicationName: 'Theater Canteen System',
        browserTabTitle: 'YQPayNow - Theater Canteen',
        logoUrl: '',
        qrCodeUrl: '',
        environment: 'development',
        defaultCurrency: 'INR',
        timezone: 'Asia/Kolkata',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12hour',
        languageRegion: 'en-IN',
        currency: 'INR',
        currencySymbol: '₹',
        primaryColor: '#8B5CF6',
        secondaryColor: '#6366F1',
        taxRate: 18,
        serviceChargeRate: 0
      };
    } catch (error) {
      console.error('Get general settings error:', error);
      throw error;
    }
  }

  /**
   * Update general settings
   */
  async updateGeneralSettings(settingsData) {
    const db = mongoose.connection.db;
    
    const result = await db.collection('settings').findOneAndUpdate(
      { type: 'general' },
      {
        $set: {
          generalConfig: settingsData,
          updatedAt: new Date()
        },
        $setOnInsert: {
          type: 'general',
          createdAt: new Date()
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    return result.value?.generalConfig || settingsData;
  }

  /**
   * Get theater-specific settings
   */
  async getTheaterSettings(theaterId) {
    if (!theaterId) {
      throw new Error('Theater ID is required');
    }

    const settings = await this.model.findOne({ theaterId }).lean().maxTimeMS(15000);
    return settings || null;
  }

  /**
   * Update theater settings
   */
  async updateTheaterSettings(theaterId, settingsData) {
    return this.model.findOneAndUpdate(
      { theaterId },
      { $set: { ...settingsData, updatedAt: new Date() } },
      { upsert: true, new: true, runValidators: true }
    ).maxTimeMS(15000);
  }
}

module.exports = new SettingsService();

