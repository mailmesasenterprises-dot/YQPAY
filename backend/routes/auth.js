const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Theater = require('../models/Theater');
const User = require('../models/User');

const router = express.Router();

// Generate JWT token
const generateToken = (user) => {
  const tokenPayload = {
    userId: user._id,
    username: user.username,
    role: user.role,
    userType: user.userType, // ✅ ADD: Include userType for proper role checking
    theaterId: user.theaterId
  };
  return jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET || 'yqpaynow-super-secret-jwt-key-development-only',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Generate refresh token
const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user._id },
    process.env.JWT_REFRESH_SECRET || 'yqpaynow-super-secret-refresh-key-development-only',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

/**
 * POST /api/auth/login
 * Authenticate user - supports both email (admins) and username (users)
 */
router.post('/login', [
  body('email').optional(),
  body('username').optional(),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, username, password } = req.body;
    const loginIdentifier = email || username;
    let authenticatedUser = null;

    if (!loginIdentifier) {
      return res.status(400).json({
        error: 'Username or email is required',
        code: 'MISSING_IDENTIFIER'
      });
    }
    // Step 1: Check ADMINS collection by email
    if (loginIdentifier.includes('@')) {
      try {
        const admin = await mongoose.connection.db.collection('admins')
          .findOne({ email: loginIdentifier, isActive: true });
        
        if (admin && await bcrypt.compare(password, admin.password)) {
          authenticatedUser = {
            _id: admin._id,
            username: admin.email,
            name: admin.name,
            role: admin.role,
            email: admin.email,
            phone: admin.phone,
            theaterId: null,
            userType: admin.role || 'super_admin' // Use the actual role from the admin document
          };
          
          // Update last login
          await mongoose.connection.db.collection('admins')
            .updateOne({ _id: admin._id }, { 
              $set: { lastLogin: new Date() }
            });
        }
      } catch (error) {
      }
    }

    // Step 2: Check THEATERUSERS collection by username if no admin found (ARRAY-BASED STRUCTURE)
    if (!authenticatedUser) {

      try {
        // Find the theater document that contains this user in its users array
        const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
          .findOne({ 
            'users.username': loginIdentifier, 
            'users.isActive': true 
          });
        
        if (theaterUsersDoc && theaterUsersDoc.users) {
          // Find the specific user within the users array
          const theaterUser = theaterUsersDoc.users.find(
            u => u.username === loginIdentifier && u.isActive === true
          );
          
          if (theaterUser && await bcrypt.compare(password, theaterUser.password)) {
            // ✅ Return pending status - PIN is required before completing login
            return res.json({
              success: true,
              isPinRequired: true,
              message: 'Password validated. Please enter your PIN.',
              pendingAuth: {
                userId: theaterUser._id.toString(),
                username: theaterUser.username,
                theaterId: theaterUsersDoc.theaterId.toString()
              }
            });
            
            // Get theater details
            let theaterInfo = null;
            if (theaterUsersDoc.theaterId) {
              theaterInfo = await mongoose.connection.db.collection('theaters')
                .findOne({ _id: theaterUsersDoc.theaterId });
            }
            
            // Get role details if role is ObjectId
            let roleInfo = null;
            let userType = 'theater_user';
            let rolePermissions = [];
            
            if (theaterUser.role) {
              try {
                if (typeof theaterUser.role === 'string' && theaterUser.role.includes('admin')) {
                  userType = 'theater_admin';
                } else if (mongoose.Types.ObjectId.isValid(theaterUser.role)) {
                  // First check RoleArray collection (nested structure)
                  const rolesDoc = await mongoose.connection.db.collection('roles')
                    .findOne({ 
                      theater: theaterUsersDoc.theaterId, // ✅ FIX: Use 'theater' not 'theaterId'
                      'roleList._id': new mongoose.Types.ObjectId(theaterUser.role)
                    });
                  if (rolesDoc && rolesDoc.roleList) {
                    // Find the specific role in the roleList array
                    roleInfo = rolesDoc.roleList.find(
                      r => r._id.toString() === theaterUser.role.toString() && r.isActive
                    );
                    if (roleInfo) {
                    }
                  }
                  
                  if (roleInfo) {
                    // Check if role name includes 'admin'
                    if (roleInfo.name && roleInfo.name.toLowerCase().includes('admin')) {
                      userType = 'theater_admin';
                    }
                    
                    // ✅ EXTRACT ROLE PERMISSIONS for theater users
                    if (roleInfo.permissions && Array.isArray(roleInfo.permissions)) {
                      rolePermissions = [{
                        role: {
                          _id: roleInfo._id,
                          name: roleInfo.name,
                          description: roleInfo.description || ''
                        },
                        permissions: roleInfo.permissions.filter(p => p.hasAccess === true)
                      }];
                    }
                  }
                }
              } catch (roleError) {
              }
            }
            
            authenticatedUser = {
              _id: theaterUser._id,
              username: theaterUser.username,
              name: theaterUser.fullName || `${theaterUser.firstName || ''} ${theaterUser.lastName || ''}`.trim(),
              role: roleInfo ? roleInfo.name : (theaterUser.role || 'theater_user'),
              email: theaterUser.email,
              phone: theaterUser.phoneNumber,
              theaterId: theaterUsersDoc.theaterId, // ✅ Use theaterId from parent document
              theaterName: theaterInfo ? theaterInfo.name : null,
              userType: userType,
              rolePermissions: rolePermissions // ✅ ATTACH ROLE PERMISSIONS to authenticated user
            };
            
            // Update last login in the nested array
            await mongoose.connection.db.collection('theaterusers')
              .updateOne(
                { 
                  theaterId: theaterUsersDoc.theaterId,
                  'users._id': theaterUser._id 
                },
                { 
                  $set: { 
                    'users.$.lastLogin': new Date(),
                    'users.$.updatedAt': new Date()
                  }
                }
              );
          }
        }
      } catch (error) {
      }
    }

    // Step 3: Check legacy USERS collection by username if no theater user found
    if (!authenticatedUser) {
      try {
        const user = await User.findOne({ 
          username: loginIdentifier, 
          isActive: true 
        }).populate('theaterId');
        
        if (user && await bcrypt.compare(password, user.password)) {
          // ✅ CHECK: Validate theater is active for theater users
          if (user.theaterId) {
            if (!user.theaterId.isActive) {
              return res.status(403).json({
                success: false,
                error: 'Theater access has been disabled. Please contact administration.',
                code: 'THEATER_INACTIVE'
              });
            }
          }
          
          authenticatedUser = {
            _id: user._id,
            username: user.username,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            role: user.role,
            email: user.email,
            phone: user.phone,
            theaterId: user.theaterId,
            theaterName: user.theaterId ? user.theaterId.name : null,
            userType: 'user'
          };
          
          // Update last login
          user.lastLogin = new Date();
          await user.save();
        }
      } catch (error) {
      }
    }

    // Step 4: Authentication failed
    if (!authenticatedUser) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Step 5: Generate tokens and respond
    const token = generateToken(authenticatedUser);
    const refreshToken = generateRefreshToken(authenticatedUser);

    // ✅ INCLUDE ROLE PERMISSIONS in response (theater users only)
    const response = {
      success: true,
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: authenticatedUser._id,
        username: authenticatedUser.username,
        name: authenticatedUser.name,
        role: authenticatedUser.role,
        email: authenticatedUser.email,
        phone: authenticatedUser.phone,
        theaterId: authenticatedUser.theaterId ? String(authenticatedUser.theaterId) : null, // ✅ Convert to string
        theaterName: authenticatedUser.theaterName,
        userType: authenticatedUser.userType
      }
    };

    // Add rolePermissions for theater users only (not super admin)
    if (authenticatedUser.rolePermissions && authenticatedUser.rolePermissions.length > 0) {
      response.rolePermissions = authenticatedUser.rolePermissions;
    } else {

    }
    res.json(response);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/validate-pin
 * Validate PIN for theater users (second step of authentication)
 */
router.post('/validate-pin', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('pin').isLength({ min: 4, max: 4 }).withMessage('PIN must be 4 digits'),
  body('theaterId').notEmpty().withMessage('Theater ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userId, pin, theaterId } = req.body;

    // Find the theater users document
    const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 
        theaterId: new mongoose.Types.ObjectId(theaterId),
        'users._id': new mongoose.Types.ObjectId(userId)
      });
    if (!theaterUsersDoc) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    // Find the specific user in the array
    const theaterUser = theaterUsersDoc.users.find(
      u => u._id.toString() === userId && u.isActive === true
    );
    if (theaterUser) {

    }

    if (!theaterUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found or inactive',
        code: 'USER_NOT_FOUND'
      });
    }

    // Validate PIN


    if (theaterUser.pin !== pin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid PIN',
        code: 'INVALID_PIN'
      });
    }
    // Get theater details and validate theater is active
    let theaterInfo = null;
    if (theaterUsersDoc.theaterId) {
      theaterInfo = await mongoose.connection.db.collection('theaters')
        .findOne({ _id: theaterUsersDoc.theaterId });
      
      // ✅ CHECK: Prevent login if theater is inactive
      if (!theaterInfo) {
        return res.status(404).json({
          success: false,
          error: 'Theater not found',
          code: 'THEATER_NOT_FOUND'
        });
      }
      
      if (theaterInfo.isActive === false) {
        return res.status(403).json({
          success: false,
          error: 'Theater access has been disabled. Please contact administration.',
          code: 'THEATER_INACTIVE'
        });
      }
    }

    // Get role details if role is ObjectId
    let roleInfo = null;
    let userType = 'theater_user';
    let rolePermissions = [];

    if (theaterUser.role) {
      try {
        if (typeof theaterUser.role === 'string' && theaterUser.role.includes('admin')) {
          userType = 'theater_admin';
        } else if (mongoose.Types.ObjectId.isValid(theaterUser.role)) {
          const rolesDoc = await mongoose.connection.db.collection('roles')
            .findOne({
              theater: theaterUsersDoc.theaterId,
              'roleList._id': new mongoose.Types.ObjectId(theaterUser.role)
            });

          if (rolesDoc && rolesDoc.roleList) {
            roleInfo = rolesDoc.roleList.find(
              r => r._id.toString() === theaterUser.role.toString() && r.isActive
            );

            if (roleInfo) {
              if (roleInfo.name && roleInfo.name.toLowerCase().includes('admin')) {
                userType = 'theater_admin';
              }

              if (roleInfo.permissions && Array.isArray(roleInfo.permissions)) {
                rolePermissions = [{
                  role: {
                    _id: roleInfo._id,
                    name: roleInfo.name,
                    description: roleInfo.description || ''
                  },
                  permissions: roleInfo.permissions.filter(p => p.hasAccess === true)
                }];
              }
            }
          }
        }
      } catch (roleError) {
      }
    }

    const authenticatedUser = {
      _id: theaterUser._id,
      username: theaterUser.username,
      name: theaterUser.fullName || `${theaterUser.firstName || ''} ${theaterUser.lastName || ''}`.trim(),
      role: roleInfo ? roleInfo.name : (theaterUser.role || 'theater_user'),
      email: theaterUser.email,
      phone: theaterUser.phoneNumber,
      theaterId: theaterUsersDoc.theaterId,
      theaterName: theaterInfo ? theaterInfo.name : null,
      userType: userType,
      rolePermissions: rolePermissions
    };

    // Update last login
    await mongoose.connection.db.collection('theaterusers')
      .updateOne(
        {
          theaterId: theaterUsersDoc.theaterId,
          'users._id': theaterUser._id
        },
        {
          $set: {
            'users.$.lastLogin': new Date(),
            'users.$.updatedAt': new Date()
          }
        }
      );

    // Generate tokens
    const token = generateToken(authenticatedUser);
    const refreshToken = generateRefreshToken(authenticatedUser);

    const response = {
      success: true,
      message: 'PIN validated successfully',
      token,
      refreshToken,
      user: {
        id: authenticatedUser._id,
        username: authenticatedUser.username,
        name: authenticatedUser.name,
        role: authenticatedUser.role,
        email: authenticatedUser.email,
        phone: authenticatedUser.phone,
        theaterId: authenticatedUser.theaterId ? String(authenticatedUser.theaterId) : null,
        theaterName: authenticatedUser.theaterName,
        userType: authenticatedUser.userType
      }
    };

    if (authenticatedUser.rolePermissions && authenticatedUser.rolePermissions.length > 0) {
      response.rolePermissions = authenticatedUser.rolePermissions;
    }
    res.json(response);

  } catch (error) {
    console.error('❌ PIN validation error:', error);
    res.status(500).json({
      success: false,
      error: 'PIN validation failed',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token using refresh token
 */
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { refreshToken } = req.body;

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken, 
      process.env.JWT_REFRESH_SECRET || 'yqpaynow-super-secret-refresh-key-development-only'
    );

    // Find user
    const user = await User.findById(decoded.userId).populate('theaterId');
    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generate new tokens
    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // In production, you might want to maintain a blacklist of tokens
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate('theaterId').select('-password');
    
    if (!user) {
      // Handle default admin case
      if (req.user.userId === 'admin_default') {
        return res.json({
          success: true,
          user: {
            id: 'admin_default',
            username: 'admin111',
            role: 'super_admin',
            theaterId: null
          }
        });
      }
      
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        theaterId: user.theaterId,
        theaterName: user.theaterId ? user.theaterId.name : null,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      error: 'Failed to get user information',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/validate
 * Validate JWT token and return user info if valid
 */
router.get('/validate', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    // Check if userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.user.userId)) {
      return res.status(401).json({
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Token is already validated by middleware, user info is in req.user
    const user = await User.findById(req.user.userId)
      .populate('theaterId', 'name location')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      valid: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        theaterId: user.theaterId,
        theaterName: user.theaterId ? user.theaterId.name : null,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({
      error: 'Failed to validate token',
      message: 'Internal server error'
    });
  }
});

module.exports = router;