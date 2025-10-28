const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

// Test SMS connection
router.post('/test-sms', authenticateToken, async (req, res) => {
  try {
    const { provider, msg91ApiKey, msg91SenderId, msg91TemplateId } = req.body;

    if (provider !== 'msg91') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only MSG91 provider is currently supported' 
      });
    }

    // Validate MSG91 credentials
    if (!msg91ApiKey || !msg91SenderId || !msg91TemplateId) {
      return res.status(400).json({ 
        success: false, 
        message: 'MSG91 API Key, Sender ID, and Template ID are required' 
      });
    }

    // Test MSG91 API connection by fetching template details
    try {
      const response = await axios.get(
        `https://control.msg91.com/api/v5/flow/${msg91TemplateId}`,
        {
          headers: {
            'authkey': msg91ApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        return res.json({
          success: true,
          message: 'MSG91 connection successful! Template verified.',
          data: {
            templateId: msg91TemplateId,
            senderId: msg91SenderId
          }
        });
      }
    } catch (error) {
      console.error('MSG91 connection test failed:', error.response?.data || error.message);
      return res.json({
        success: false,
        message: error.response?.data?.message || 'Failed to connect to MSG91. Please check your credentials.'
      });
    }

  } catch (error) {
    console.error('Error testing SMS connection:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while testing SMS connection' 
    });
  }
});

// Send test OTP
router.post('/send-test-otp', authenticateToken, async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number is required' 
      });
    }

    // Clean phone number - remove spaces, dashes, and ensure it starts with country code
    let cleanPhoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // If doesn't start with +, add it
    if (!cleanPhoneNumber.startsWith('+')) {
      cleanPhoneNumber = '+' + cleanPhoneNumber;
    }

    // Validate phone number format (should be at least 10 digits with country code)
    if (cleanPhoneNumber.length < 10) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid phone number. Please enter number with country code (e.g., 919876543210)' 
      });
    }

    // Get MSG91 settings from database
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    const settingsDoc = await db.collection('settings').findOne({ type: 'sms' });
    
    if (!settingsDoc || !settingsDoc.smsConfig) {
      return res.status(400).json({ 
        success: false, 
        message: 'MSG91 is not configured. Please configure it in Settings first.' 
      });
    }

    const smsConfig = settingsDoc.smsConfig;
    const msg91ApiKey = smsConfig.msg91ApiKey;
    const msg91SenderId = smsConfig.msg91SenderId;
    const msg91TemplateId = smsConfig.msg91TemplateId;
    const msg91TemplateVariable = smsConfig.msg91TemplateVariable || 'OTP';

    if (!msg91ApiKey || !msg91TemplateId) {
      return res.status(400).json({ 
        success: false, 
        message: 'MSG91 API Key and Template ID are required. Please configure them in Settings.' 
      });
    }

    // Use provided OTP or generate random 6-digit OTP
    const otpToSend = otp || Math.floor(100000 + Math.random() * 900000).toString();

    // Send OTP via MSG91 Flow API
    try {
      // Remove + from phone number for MSG91 API
      const msg91PhoneNumber = cleanPhoneNumber.replace('+', '');

      console.log('📤 Sending to MSG91 API...');
      console.log('Phone:', msg91PhoneNumber);
      console.log('Template ID:', msg91TemplateId);
      console.log('Sender:', msg91SenderId);
      console.log('OTP:', otpToSend);

      const msg91Response = await axios.post(
        `https://control.msg91.com/api/v5/flow/`,
        {
          template_id: msg91TemplateId,
          sender: msg91SenderId,
          short_url: "0",
          mobiles: msg91PhoneNumber,
          [msg91TemplateVariable]: otpToSend
        },
        {
          headers: {
            'authkey': msg91ApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('📥 MSG91 Full Response:', JSON.stringify(msg91Response.data, null, 2));

      if (msg91Response.data.type === 'success') {
        return res.json({
          success: true,
          message: `Test OTP sent successfully to ${cleanPhoneNumber}`,
          otp: otpToSend, // Only for testing - remove in production
          data: {
            messageId: msg91Response.data.request_id,
            phoneNumber: cleanPhoneNumber,
            msg91Response: msg91Response.data
          }
        });
      } else {
        console.error('❌ MSG91 returned non-success:', msg91Response.data);
        return res.json({
          success: false,
          message: msg91Response.data.message || 'Failed to send OTP via MSG91',
          details: msg91Response.data
        });
      }

    } catch (error) {
      console.error('❌ MSG91 API Error:');
      console.error('Status:', error.response?.status);
      console.error('Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Message:', error.message);
      
      return res.json({
        success: false,
        message: error.response?.data?.message || 'Failed to send OTP. Please check your MSG91 configuration.',
        details: error.response?.data
      });
    }

  } catch (error) {
    console.error('Error sending test OTP:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while sending test OTP' 
    });
  }
});

// Customer OTP endpoints (no authentication required)

// Send OTP to customer
router.post('/send-otp', async (req, res) => {
  try {
    const { phoneNumber, purpose = 'order_verification' } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number is required' 
      });
    }

    // Clean phone number
    let cleanPhoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    if (!cleanPhoneNumber.startsWith('+')) {
      cleanPhoneNumber = '+' + cleanPhoneNumber;
    }

    // Get MSG91 settings
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const settingsDoc = await db.collection('settings').findOne({ type: 'sms' });
    
    if (!settingsDoc || !settingsDoc.smsConfig || !settingsDoc.smsConfig.enabled) {
      return res.status(400).json({ 
        success: false, 
        error: 'SMS service is not enabled' 
      });
    }

    const smsConfig = settingsDoc.smsConfig;
    const msg91ApiKey = smsConfig.msg91ApiKey;
    const msg91SenderId = smsConfig.msg91SenderId;
    const msg91TemplateId = smsConfig.msg91TemplateId;
    const msg91TemplateVariable = smsConfig.msg91TemplateVariable || 'OTP';
    const otpLength = smsConfig.otpLength || 4;

    // Generate OTP based on configured length
    const min = Math.pow(10, otpLength - 1);
    const max = Math.pow(10, otpLength) - 1;
    const otp = Math.floor(min + Math.random() * (max - min + 1)).toString();

    // Store OTP in temporary collection (expires in 5 minutes)
    const otpExpiry = smsConfig.otpExpiry || 300; // seconds
    await db.collection('otp_verifications').updateOne(
      { phoneNumber: cleanPhoneNumber },
      {
        $set: {
          otp: otp,
          purpose: purpose,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + otpExpiry * 1000),
          attempts: 0
        }
      },
      { upsert: true }
    );

    // Send OTP via MSG91
    try {
      const msg91PhoneNumber = cleanPhoneNumber.replace('+', '');

      const msg91Response = await axios.post(
        `https://control.msg91.com/api/v5/flow/`,
        {
          template_id: msg91TemplateId,
          sender: msg91SenderId,
          short_url: "0",
          mobiles: msg91PhoneNumber,
          [msg91TemplateVariable]: otp
        },
        {
          headers: {
            'authkey': msg91ApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (msg91Response.data.type === 'success') {
        return res.json({
          success: true,
          message: `OTP sent successfully to ${cleanPhoneNumber}`,
          data: {
            phoneNumber: cleanPhoneNumber,
            expiresIn: otpExpiry,
            otpLength: otpLength
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          error: msg91Response.data.message || 'Failed to send OTP'
        });
      }

    } catch (error) {
      console.error('MSG91 API Error:', error.response?.data || error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to send OTP. Please try again.'
      });
    }

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error while sending OTP' 
    });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp, purpose = 'order_verification' } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number and OTP are required' 
      });
    }

    // Clean phone number
    let cleanPhoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    if (!cleanPhoneNumber.startsWith('+')) {
      cleanPhoneNumber = '+' + cleanPhoneNumber;
    }

    // Get OTP from database
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    const otpRecord = await db.collection('otp_verifications').findOne({
      phoneNumber: cleanPhoneNumber
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        error: 'No OTP found for this phone number. Please request a new OTP.'
      });
    }

    // Check if OTP expired
    if (new Date() > otpRecord.expiresAt) {
      await db.collection('otp_verifications').deleteOne({ phoneNumber: cleanPhoneNumber });
      return res.status(400).json({
        success: false,
        error: 'OTP has expired. Please request a new OTP.'
      });
    }

    // Check max attempts
    const maxRetries = 3;
    if (otpRecord.attempts >= maxRetries) {
      await db.collection('otp_verifications').deleteOne({ phoneNumber: cleanPhoneNumber });
      return res.status(400).json({
        success: false,
        error: 'Maximum verification attempts exceeded. Please request a new OTP.'
      });
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      // Increment attempts
      await db.collection('otp_verifications').updateOne(
        { phoneNumber: cleanPhoneNumber },
        { $inc: { attempts: 1 } }
      );

      return res.status(400).json({
        success: false,
        error: `Invalid OTP. ${maxRetries - otpRecord.attempts - 1} attempts remaining.`
      });
    }

    // OTP verified successfully - delete record
    await db.collection('otp_verifications').deleteOne({ phoneNumber: cleanPhoneNumber });

    return res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        phoneNumber: cleanPhoneNumber,
        verified: true
      }
    });

  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error while verifying OTP' 
    });
  }
});

module.exports = router;
