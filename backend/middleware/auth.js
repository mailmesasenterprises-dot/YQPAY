const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  console.log('🔐 [AUTH] authenticateToken called for:', req.method, req.path);
  
  // Check multiple possible header formats (Express normalizes to lowercase)
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  // ✅ FIX: Clean token to handle malformed tokens (remove quotes, trim whitespace)
  if (token) {
    token = String(token).trim().replace(/^["']|["']$/g, '');
    
    // Validate token format (should have 3 parts separated by dots)
    if (token.split('.').length !== 3) {
      console.log('❌ [AUTH] Invalid token format:', {
        parts: token.split('.').length,
        length: token.length,
        preview: token.substring(0, 20) + '...'
      });
      return res.status(401).json({ 
        error: 'Invalid token format',
        code: 'TOKEN_MALFORMED',
        message: 'Token format is invalid. Please login again.'
      });
    }
  }

  if (!token) {
    console.log('❌ [AUTH] No token provided');
    console.log('   Request headers:', {
      'authorization': req.headers['authorization'],
      'Authorization': req.headers['Authorization'],
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']?.substring(0, 50)
    });
    console.log('   Request origin:', req.headers['origin'] || req.headers['referer'] || 'unknown');
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'TOKEN_MISSING',
      message: 'Please login to access this resource'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'yqpaynow-super-secret-jwt-key-development-only', async (err, decoded) => {
    if (err) {
      console.log('❌ [AUTH] Token verification failed:', err.message);
      return res.status(403).json({ 
        error: 'Invalid or expired token',
        code: 'TOKEN_INVALID'
      });
    }
    
    console.log('✅ [AUTH] Token verified, user:', decoded.userId, 'type:', decoded.userType);
    
    // ✅ FIX: Check if user's theater is active (for theater users only, skip for super_admin)
    // Super admin should not be blocked by theater status
    if ((decoded.userType === 'theater_user' || decoded.userType === 'theater_admin') && 
        decoded.userType !== 'super_admin' && decoded.role !== 'super_admin') {
      try {
        const Theater = require('../models/Theater');
        const theaterId = decoded.theaterId || decoded.theater;
        
        if (!theaterId) {
          console.log('⚠️ [AUTH] Theater user has no theaterId in token:', {
            userId: decoded.userId,
            userType: decoded.userType,
            role: decoded.role
          });
          // Don't block - let the request continue, other middleware will handle it
        } else {
          const theater = await Theater.findById(theaterId).lean();
          
          if (!theater) {
            console.log('❌ [AUTH] Theater not found:', theaterId);
            return res.status(403).json({
              error: 'Theater not found',
              code: 'THEATER_NOT_FOUND',
              message: 'Your theater account could not be found. Please contact support.'
            });
          }
          
          if (!theater.isActive) {
            console.log('❌ [AUTH] Theater deactivated:', {
              theaterId: theaterId,
              theaterName: theater.name,
              isActive: theater.isActive
            });
            return res.status(403).json({
              error: 'Your theater account has been deactivated',
              code: 'THEATER_DEACTIVATED',
              message: 'Your theater account has been deactivated. Please contact support to reactivate.'
            });
          }
          console.log('✅ [AUTH] Theater active:', theater.name);
        }
      } catch (error) {
        console.log('⚠️ [AUTH] Error checking theater status:', error.message);
        console.log('   Error details:', {
          error: error.name,
          message: error.message,
          theaterId: decoded.theaterId || decoded.theater
        });
        // Continue with auth - don't block on database errors (connection issues, etc.)
        // This allows the request to proceed even if we can't verify theater status
      }
    }
    
    req.user = decoded;
    console.log('✅ [AUTH] Authentication successful, proceeding to next middleware');
    next();
  });
};

// Optional Authentication (for endpoints that work with or without auth)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET || 'yqpaynow-super-secret-jwt-key-development-only', (err, decoded) => {
      if (!err) {
        req.user = decoded;
      }
    });
  }
  
  next();
};

// Role-based authorization middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // ✅ FIX: Check both 'role' and 'userType' fields
    const userRole = req.user.role || req.user.userType;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: roles,
        userRole: userRole,
        tokenRole: req.user.role,
        tokenUserType: req.user.userType
      });
    }

    next();
  };
};

// Theater ownership middleware (ensure user can only access their theater data)
const requireTheaterAccess = async (req, res, next) => {
  console.log('🔐 requireTheaterAccess middleware - checking access');
  console.log('👤 User:', req.user ? { userId: req.user.userId, role: req.user.role, userType: req.user.userType, theaterId: req.user.theaterId } : 'No user');
  console.log('🎯 Requested Theater:', req.params.theaterId || req.body.theaterId);
  
  if (!req.user) {
    console.error('❌ No user in request');
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const requestedTheaterId = req.params.theaterId || req.body.theaterId;
  // Super admin or admin can access all theaters
  if (req.user.role === 'super_admin' || req.user.role === 'admin' || req.user.userType === 'admin') {
    console.log('✅ Admin access granted');
    return next();
  }

  // ✅ NEW: Check if theater is active before granting access
  const Theater = require('../models/Theater');
  try {
    console.log('🔍 Checking theater status:', requestedTheaterId);
    const theater = await Theater.findById(requestedTheaterId);
    if (!theater) {
      console.error('❌ Theater not found:', requestedTheaterId);
      return res.status(404).json({
        error: 'Theater not found',
        code: 'THEATER_NOT_FOUND'
      });
    }
    if (!theater.isActive) {
      console.error('❌ Theater is inactive:', requestedTheaterId);
      return res.status(403).json({
        error: 'Theater is currently inactive',
        code: 'THEATER_INACTIVE'
      });
    }
    console.log('✅ Theater is active');
  } catch (error) {
    console.error('❌ Error checking theater:', error.message);
    return res.status(500).json({
      error: 'Unable to verify theater status',
      code: 'THEATER_CHECK_ERROR',
      details: error.message
    });
  }

  // Manager role can access their own theater
  if (req.user.role === 'Manager' && String(req.user.theaterId) === String(requestedTheaterId)) {
    console.log('✅ Manager access granted');
    return next();
  }

  // Theater admin can only access their own theater
  if (req.user.role === 'theater_admin' && String(req.user.theaterId) === String(requestedTheaterId)) {
    console.log('✅ Theater admin access granted');
    return next();
  }

  // Theater staff can only access their own theater
  if (req.user.role === 'theater_staff' && String(req.user.theaterId) === String(requestedTheaterId)) {
    console.log('✅ Theater staff access granted');
    return next();
  }

  // Theater user (new format) - check theater or theaterId field
  if (req.user.userType === 'theater_user') {
    const userTheater = req.user.theater || req.user.theaterId;
    if (String(userTheater) === String(requestedTheaterId)) {
      console.log('✅ Theater user access granted');
      return next();
    }
  }
  
  console.error('❌ Access denied - user does not have permission for this theater');
  return res.status(403).json({
    error: 'Access denied to this theater',
    code: 'THEATER_ACCESS_DENIED'
  });
};

// ✅ NEW: Role-based page access middleware
// Checks if user has permission to access a specific page based on their role
const requirePageAccess = (pageName) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Super admin has access to everything
    if (req.user.role === 'super_admin' || req.user.userType === 'super_admin') {
      return next();
    }

    // Theater users must have role-based permissions
    if (req.user.userType === 'theater_admin' || req.user.userType === 'theater_user') {
      try {
        // Get user's role from theaterusers collection
        const theaterUser = await mongoose.connection.db.collection('theaterusers')
          .findOne({ _id: new mongoose.Types.ObjectId(req.user.userId) });

        if (!theaterUser || !theaterUser.role) {
          return res.status(403).json({
            error: 'No role assigned',
            code: 'NO_ROLE_ASSIGNED'
          });
        }

        // Get role permissions
        if (mongoose.Types.ObjectId.isValid(theaterUser.role)) {
          const role = await mongoose.connection.db.collection('roles')
            .findOne({ 
              _id: new mongoose.Types.ObjectId(theaterUser.role),
              isActive: true 
            });

          if (!role) {
            return res.status(403).json({
              error: 'Role not found',
              code: 'ROLE_NOT_FOUND'
            });
          }

          // Check if role has permission for this page
          const hasAccess = role.permissions && role.permissions.some(p => 
            p.page === pageName && p.hasAccess === true
          );

          if (hasAccess) {
            return next();
          } else {
            return res.status(403).json({
              error: 'Access denied to this page',
              code: 'PAGE_ACCESS_DENIED',
              page: pageName,
              role: role.name
            });
          }
        }
      } catch (error) {
        console.error('❌ Error checking page access:', error);
        return res.status(500).json({
          error: 'Failed to verify page access',
          code: 'PAGE_ACCESS_CHECK_FAILED'
        });
      }
    }

    // Default deny
    return res.status(403).json({
      error: 'Access denied',
      code: 'ACCESS_DENIED'
    });
  };
};

// ✅ NEW: Check if user is Theater Admin
const requireTheaterAdminRole = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Super admin has full access
  if (req.user.role === 'super_admin' || req.user.userType === 'super_admin') {
    return next();
  }

  try {
    const theaterUser = await mongoose.connection.db.collection('theaterusers')
      .findOne({ _id: new mongoose.Types.ObjectId(req.user.userId) });

    if (!theaterUser || !theaterUser.role) {
      return res.status(403).json({
        error: 'No role assigned',
        code: 'NO_ROLE_ASSIGNED'
      });
    }

    const role = await mongoose.connection.db.collection('roles')
      .findOne({ 
        _id: new mongoose.Types.ObjectId(theaterUser.role),
        isActive: true 
      });

    if (!role) {
      return res.status(403).json({
        error: 'Role not found',
        code: 'ROLE_NOT_FOUND'
      });
    }

    // Check if it's Theater Admin role (default role or named "Theater Admin")
    if (role.isDefault === true || role.name === 'Theater Admin') {
      return next();
    } else {
      return res.status(403).json({
        error: 'Only Theater Admin can access this resource',
        code: 'THEATER_ADMIN_REQUIRED',
        role: role.name
      });
    }
  } catch (error) {
    console.error('❌ Error checking Theater Admin role:', error);
    return res.status(500).json({
      error: 'Failed to verify Theater Admin access',
      code: 'ADMIN_CHECK_FAILED'
    });
  }
};

// ✅ NEW: Get user-specific data access scope
const getUserDataScope = async (userId) => {
  try {
    const theaterUser = await mongoose.connection.db.collection('theaterusers')
      .findOne({ _id: new mongoose.Types.ObjectId(userId) });

    if (!theaterUser) {
      return { hasAccess: false, scope: {}, userId: null };
    }

    const role = await mongoose.connection.db.collection('roles')
      .findOne({ _id: new mongoose.Types.ObjectId(theaterUser.role) });

    // Theater Admin = full access
    if (role && (role.name === 'Theater Admin' || role.isDefault === true)) {
      return {
        hasAccess: true,
        scope: { 
          type: 'full',
          description: 'Full access to all data',
          userId: userId
        }
      };
    }

    // ✅ Other roles = USER-SPECIFIC filtered access
    return {
      hasAccess: true,
      scope: {
        type: 'user_specific',
        description: 'User-specific access to assigned data only',
        userId: userId,
        userName: theaterUser.username,
        userEmail: theaterUser.email,
        userFullName: theaterUser.fullName,
        filters: theaterUser.dataAccess || {}
      }
    };

  } catch (error) {
    console.error('❌ Error getting data scope:', error);
    return { hasAccess: false, scope: {}, userId: null };
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireTheaterAccess,
  requirePageAccess,
  requireTheaterAdminRole, // ✅ New
  getUserDataScope // ✅ New
};