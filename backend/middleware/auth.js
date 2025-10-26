const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'TOKEN_MISSING'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'yqpaynow-super-secret-jwt-key-development-only', async (err, decoded) => {
    if (err) {
      return res.status(403).json({ 
        error: 'Invalid or expired token',
        code: 'TOKEN_INVALID'
      });
    }
    
    // ✅ NEW: Check if user's theater is active (for theater users only)
    if (decoded.userType === 'theater_user' || decoded.userType === 'theater_admin') {
      try {
        const Theater = require('../models/Theater');
        const theater = await Theater.findById(decoded.theaterId || decoded.theater);
        
        if (!theater || !theater.isActive) {
          return res.status(403).json({
            error: 'Your theater account has been deactivated',
            code: 'THEATER_DEACTIVATED'
          });
        }
      } catch (error) {
        console.log('⚠️ Error checking theater status during auth:', error.message);
        // Continue with auth - don't block on database errors
      }
    }
    
    req.user = decoded;
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
    
    console.log('🔐 requireRole check:', {
      requiredRoles: roles,
      userRole: userRole,
      tokenData: req.user
    });

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
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const requestedTheaterId = req.params.theaterId || req.body.theaterId;
  
  console.log('🔐 requireTheaterAccess check:');
  console.log('   User role:', req.user.role);
  console.log('   User userType:', req.user.userType);
  console.log('   User theater:', req.user.theater);
  console.log('   User theaterId:', req.user.theaterId);
  console.log('   Requested theaterId:', requestedTheaterId);
  
  // Super admin or admin can access all theaters
  if (req.user.role === 'super_admin' || req.user.role === 'admin' || req.user.userType === 'admin') {
    console.log('   ✅ Access granted: Admin');
    return next();
  }

  // ✅ NEW: Check if theater is active before granting access
  const Theater = require('../models/Theater');
  try {
    const theater = await Theater.findById(requestedTheaterId);
    if (!theater || !theater.isActive) {
      console.log('   ❌ Access denied: Theater is inactive or not found');
      return res.status(403).json({
        error: 'Theater is currently inactive',
        code: 'THEATER_INACTIVE'
      });
    }
  } catch (error) {
    console.log('   ❌ Error checking theater status:', error.message);
    return res.status(500).json({
      error: 'Unable to verify theater status',
      code: 'THEATER_CHECK_ERROR'
    });
  }

  // Manager role can access their own theater
  if (req.user.role === 'Manager' && String(req.user.theaterId) === String(requestedTheaterId)) {
    console.log('   ✅ Access granted: Manager with matching theater');
    return next();
  }

  // Theater admin can only access their own theater
  if (req.user.role === 'theater_admin' && String(req.user.theaterId) === String(requestedTheaterId)) {
    console.log('   ✅ Access granted: Theater Admin with matching theater');
    return next();
  }

  // Theater staff can only access their own theater
  if (req.user.role === 'theater_staff' && String(req.user.theaterId) === String(requestedTheaterId)) {
    console.log('   ✅ Access granted: Theater Staff with matching theater');
    return next();
  }

  // Theater user (new format) - check theater or theaterId field
  if (req.user.userType === 'theater_user') {
    const userTheater = req.user.theater || req.user.theaterId;
    if (String(userTheater) === String(requestedTheaterId)) {
      console.log('   ✅ Access granted: Theater User with matching theater');
      return next();
    }
  }

  console.log('   ❌ Access denied: No matching conditions');
  console.log('   💡 Hint: User role/userType:', req.user.role || req.user.userType);
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
      console.log('✅ Super admin - full access granted');
      return next();
    }

    // Theater users must have role-based permissions
    if (req.user.userType === 'theater_admin' || req.user.userType === 'theater_user') {
      try {
        // Get user's role from theaterusers collection
        const theaterUser = await mongoose.connection.db.collection('theaterusers')
          .findOne({ _id: new mongoose.Types.ObjectId(req.user.userId) });

        if (!theaterUser || !theaterUser.role) {
          console.log('❌ Theater user has no role assigned');
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
            console.log('❌ Role not found or inactive');
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
            console.log(`✅ Page access granted: ${pageName} for role: ${role.name}`);
            return next();
          } else {
            console.log(`❌ Page access denied: ${pageName} for role: ${role.name}`);
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
    console.log('✅ Super admin - full access granted');
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
      console.log(`✅ Theater Admin access granted: ${role.name}`);
      return next();
    } else {
      console.log(`❌ Not Theater Admin: ${role.name}`);
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