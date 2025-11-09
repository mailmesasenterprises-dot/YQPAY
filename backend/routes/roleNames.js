const express = require('express');
const RoleName = require('../models/RoleName');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * GET /api/role-names
 * Get all role names with optional filtering by theater
 */
router.get('/', [optionalAuth], async (req, res) => {
  try {
    const { 
      theaterId, 
      page = 1, 
      limit = 10, 
      search = '', 
      isActive 
    } = req.query;
    const query = {};

    // Filter by theater (map theaterId param to theater field)
    if (theaterId) {
      try {
        query.theater = new mongoose.Types.ObjectId(theaterId);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid theater ID format'
        });
      }
    }

    // Filter by active status
    if (isActive !== undefined && isActive !== '') {
      query.isActive = isActive === 'true';
    }

    // Search filter
    if (search && search.trim()) {
      query.$or = [
        { emailNotification: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { normalizedEmailNotification: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [emailNotifications, totalItems] = await Promise.all([
      RoleName.find(query)
        .populate('theater', 'name location contactInfo')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ priority: 1, createdAt: -1 })
        .lean(),
      RoleName.countDocuments(query)
    ]);
    const totalPages = Math.ceil(totalItems / parseInt(limit));

    res.json({
      success: true,
      data: {
        emailNotifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Get role names error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch email notifications',
      message: error.message
    });
  }
});

/**
 * GET /api/role-names/:id
 * Get a specific role name by ID
 */
router.get('/:id', [optionalAuth], async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email notification ID format'
      });
    }

    const roleName = await RoleName.findById(id)
      .populate('theater', 'name location contactInfo');

    if (!roleName) {
      return res.status(404).json({
        success: false,
        error: 'Email notification not found'
      });
    }

    res.json({
      success: true,
      data: roleName
    });

  } catch (error) {
    console.error('Get role name by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch email notification',
      message: error.message
    });
  }
});

/**
 * POST /api/role-names
 * Create a new role name
 */
router.post('/', [authenticateToken], async (req, res) => {
  try {
    const { emailNotification, description, theaterId, permissions, isGlobal, priority } = req.body;
    const theater = theaterId || req.body.theater;

    // Validate required fields
    if (!emailNotification || !theater) {
      return res.status(400).json({
        success: false,
        error: 'Email notification and theater are required fields'
      });
    }

    // Check if email notification already exists for this theater
    const nameExists = await RoleName.emailNotificationExistsForTheater(emailNotification, theater);
    if (nameExists) {
      return res.status(400).json({
        success: false,
        error: 'An email notification with this name already exists for this theater'
      });
    }

    // Create new email notification
    const newRoleName = new RoleName({
      emailNotification,
      description: description || '',
      theater,
      permissions: permissions || [],
      isGlobal: isGlobal || false,
      priority: priority || 1,
      isActive: true
    });

    await newRoleName.save();

    // Populate theater details
    await newRoleName.populate('theater', 'name location');
    res.status(201).json({
      success: true,
      message: 'Email notification created successfully',
      data: newRoleName
    });

  } catch (error) {
    console.error('Create role name error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create email notification',
      message: error.message
    });
  }
});

/**
 * PUT /api/role-names/:id
 * Update a role name
 */
router.put('/:id', [authenticateToken], async (req, res) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const { emailNotification, description, permissions, isGlobal, priority, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email notification ID format'
      });
    }
    const roleNameDoc = await RoleName.findById(id);

    if (!roleNameDoc) {
      return res.status(404).json({
        success: false,
        error: 'Email notification not found'
      });
    }
    
    // 🛡️ ENHANCED PROTECTION: Special handling for default roles
    if (roleNameDoc.isDefault) {
      // Check if this is a permission-only update
      const isPermissionOnlyUpdate = 
        permissions !== undefined && 
        emailNotification === undefined && 
        description === undefined && 
        priority === undefined &&
        isGlobal === undefined;

      // ✅ ALLOW: Permission-only updates for default roles
      if (isPermissionOnlyUpdate) {
        roleNameDoc.permissions = permissions;
        
        // Also allow isActive toggle (optional)
        if (isActive !== undefined) {
          roleNameDoc.isActive = isActive;
        }
        
        await roleNameDoc.save();
        await roleNameDoc.populate('theater', 'name location');
        return res.json({
          success: true,
          message: 'Default role permissions updated successfully',
          data: roleNameDoc
        });
      }

      // ❌ BLOCK: All other edits for default roles
      return res.status(403).json({
        success: false,
        error: 'Default role is protected. Only page access permissions can be updated. Role name, description, and other properties cannot be modified.',
        code: 'DEFAULT_ROLE_PROTECTED',
        allowedFields: ['permissions', 'isActive'],
        blockedFields: ['emailNotification', 'description', 'priority', 'isGlobal']
      });
    }

    // Regular email notifications can be fully edited
    // Check if new email notification conflicts with existing email notification
    if (emailNotification && emailNotification !== roleNameDoc.emailNotification) {
      const nameExists = await RoleName.emailNotificationExistsForTheater(emailNotification, roleNameDoc.theater, id);
      if (nameExists) {
        return res.status(400).json({
          success: false,
          error: 'An email notification with this name already exists for this theater'
        });
      }
      roleNameDoc.emailNotification = emailNotification;
    }

    // Update fields for non-default roles
    if (description !== undefined) roleNameDoc.description = description;
    if (permissions !== undefined) roleNameDoc.permissions = permissions;
    if (isGlobal !== undefined) roleNameDoc.isGlobal = isGlobal;
    if (priority !== undefined) roleNameDoc.priority = priority;
    if (isActive !== undefined) roleNameDoc.isActive = isActive;

    await roleNameDoc.save();
    await roleNameDoc.populate('theater', 'name location');

    const duration = Date.now() - startTime;
    res.json({
      success: true,
      message: 'Email notification updated successfully',
      data: roleNameDoc
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [ROLE NAME UPDATE] Error after ${duration}ms:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to update email notification',
      message: error.message
    });
  }
});

/**
 * DELETE /api/role-names/:id
 * Delete a role name (hard delete - permanently removes from database)
 */
router.delete('/:id', [authenticateToken], async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email notification ID format'
      });
    }

    const roleName = await RoleName.findById(id);

    if (!roleName) {
      return res.status(404).json({
        success: false,
        error: 'Email notification not found'
      });
    }

    // 🛡️ PROTECTION: Check if this is a default role that cannot be deleted
    if (roleName.isDefault) {
      return res.status(403).json({
        success: false,
        error: 'Default roles cannot be deleted',
        code: 'DEFAULT_ROLE_PROTECTED'
      });
    }

    // Hard delete - permanently remove from database
    await RoleName.findByIdAndDelete(id);
    res.json({
      success: true,
      message: 'Email notification permanently deleted',
      data: { _id: roleName._id, emailNotification: roleName.emailNotification }
    });

  } catch (error) {
    console.error('Delete role name error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete email notification',
      message: error.message
    });
  }
});

/**
 * GET /api/role-names/theater/:theaterId/summary
 * Get role name summary statistics for a theater
 */
router.get('/theater/:theaterId/summary', [optionalAuth], async (req, res) => {
  try {
    const { theaterId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(theaterId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid theater ID format'
      });
    }

    const theaterObjectId = new mongoose.Types.ObjectId(theaterId);

    const [totalRoleNames, activeRoleNames, inactiveRoleNames] = await Promise.all([
      RoleName.countDocuments({ theater: theaterObjectId }),
      RoleName.countDocuments({ theater: theaterObjectId, isActive: true }),
      RoleName.countDocuments({ theater: theaterObjectId, isActive: false })
    ]);

    res.json({
      success: true,
      data: {
        totalRoleNames,
        activeRoleNames,
        inactiveRoleNames
      }
    });

  } catch (error) {
    console.error('Get role name summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch email notification summary',
      message: error.message
    });
  }
});

module.exports = router;

