const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const TheaterUser = require('../models/TheaterUserModel');
const Role = require('../models/Role');
const Theater = require('../models/Theater');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/theater-users
 * Create new theater user with role-based access
 */
router.post('/', [
  authenticateToken,
  body('theater').notEmpty().isMongoId().withMessage('Valid theater ID required'),
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').notEmpty().isMongoId().withMessage('Valid role ID required'),
  body('fullName').trim().notEmpty().withMessage('Full name required'),
  body('phoneNumber').trim().notEmpty().withMessage('Phone number required')
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        message: errors.array()[0].msg
      });
    }

    const { theater, username, email, password, role, fullName, phoneNumber } = req.body;
    // Verify theater exists
    const theaterExists = await Theater.findById(theater);
    if (!theaterExists) {
      return res.status(404).json({
        success: false,
        error: 'Theater not found'
      });
    }

    // Verify role exists
    const roleExists = await Role.findById(role);
    if (!roleExists) {
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      });
    }

    // Check username uniqueness (case-insensitive)
    const existingUsername = await TheaterUser.findOne({ 
      username: username.toLowerCase(),
      theater: theater
    });
    
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        error: 'Username already exists for this theater'
      });
    }

    // Check email uniqueness globally (case-insensitive)
    const existingEmail = await TheaterUser.findOne({ 
      email: email.toLowerCase() 
    });
    
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new TheaterUser({
      theater: theater,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role,
      fullName: fullName,
      phoneNumber: phoneNumber,
      isActive: true,
      createdBy: req.user.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await user.save();
    
    // Populate references before returning
    await user.populate('role', 'name description');
    await user.populate('theater', 'name location');
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        theater: user.theater,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Create user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user',
      message: error.message
    });
  }
});

/**
 * GET /api/theater-users/by-theater/:theaterId
 * Get users for a specific theater
 */
router.get('/by-theater/:theaterId', [
  authenticateToken,
  requireRole(['super_admin', 'theater_admin'])
], async (req, res) => {
  try {
    const { theaterId } = req.params;
    const users = await TheaterUser.find({ theater: theaterId })
      .populate('role', 'name description')
      .populate('theater', 'name location')
      .select('-password')
      .sort({ createdAt: -1 });

    // ✅ SAFETY: Handle users with null/undefined roles (orphaned references)
    const safeUsers = users.map(user => {
      const userObj = user.toObject();
      if (!userObj.role) {
        console.warn(`⚠️ User ${userObj.username} has no role assigned (orphaned reference)`);
        userObj.role = {
          _id: 'no-role',
          name: 'No Role Assigned',
          description: 'This user has an invalid role reference'
        };
      }
      return userObj;
    });
    res.json({
      success: true,
      data: safeUsers
    });

  } catch (error) {
    console.error('❌ Get theater users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch theater users',
      message: error.message
    });
  }
});

/**
 * GET /api/theater-users/:id
 * Get a specific user by ID
 */
router.get('/:id', [authenticateToken], async (req, res) => {
  try {
    const user = await TheaterUser.findById(req.params.id)
      .populate('role', 'name description')
      .populate('theater', 'name location')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      message: error.message
    });
  }
});

/**
 * PUT /api/theater-users/:id
 * Update theater user details
 */
router.put('/:id', [
  authenticateToken,
  body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phoneNumber').optional().trim().notEmpty().withMessage('Phone number cannot be empty'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isMongoId().withMessage('Valid role ID required'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        message: errors.array()[0].msg
      });
    }

    const user = await TheaterUser.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const { fullName, email, phoneNumber, password, role, isActive } = req.body;

    // Update fields if provided
    if (fullName !== undefined) user.fullName = fullName;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (role !== undefined) {
      // Verify role exists
      const roleExists = await Role.findById(role);
      if (!roleExists) {
        return res.status(404).json({
          success: false,
          error: 'Role not found'
        });
      }
      user.role = role;
    }
    if (isActive !== undefined) user.isActive = isActive;

    // Check email uniqueness if changing
    if (email && email.toLowerCase() !== user.email) {
      const existingEmail = await TheaterUser.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: user._id }
      });
      
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email already in use'
        });
      }
      user.email = email.toLowerCase();
    }

    // Hash new password if provided
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    user.updatedAt = new Date();
    await user.save();
    
    // Populate references
    await user.populate('role', 'name description');
    await user.populate('theater', 'name location');
    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        theater: user.theater,
        isActive: user.isActive,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      message: error.message
    });
  }
});

/**
 * DELETE /api/theater-users/:id
 * Soft delete theater user
 */
router.delete('/:id', [authenticateToken], async (req, res) => {
  try {
    const user = await TheaterUser.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    // Soft delete - set isActive to false
    user.isActive = false;
    user.updatedAt = new Date();
    await user.save();
    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      message: error.message
    });
  }
});

/**
 * POST /api/theater-users/test
 * Test endpoint for theater users (kept for backward compatibility)
 */
router.post('/test', [authenticateToken], (req, res) => {
  res.json({
    success: true,
    message: 'Theater users test endpoint working',
    data: {
      user: {
        id: req.user.userId,
        role: req.user.role,
        username: req.user.username
      },
      timestamp: new Date()
    }
  });
});

module.exports = router;