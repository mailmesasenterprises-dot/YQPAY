const express = require('express');
const router = express.Router();
const PageAccessArray = require('../models/PageAccessArray');
const { authenticateToken, optionalAuth, requireRole } = require('../middleware/auth');
const { body, validationResult, param, query } = require('express-validator');

console.log('🔧 PageAccessArray routes file loaded successfully!');

/**
 * @route   GET /api/page-access
 * @desc    Get page access for a theater (array-based structure)
 * @access  Public
 */
router.get('/', [optionalAuth], async (req, res) => {
  try {
    console.log('📥 GET /api/page-access - Request received');
    console.log('Query params:', req.query);
    
    const { theaterId, limit = 100, page = 1, isActive, category, search } = req.query;
    
    if (!theaterId) {
      return res.status(400).json({
        success: false,
        message: 'Theater ID is required'
      });
    }

    // Get pages for theater using static method
    const result = await PageAccessArray.getByTheater(theaterId, {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      category
    });

    console.log(`✅ Found ${result.pages.length} pages for theater ${theaterId}`);

    res.json({
      success: true,
      data: {
        pages: result.pages,
        theater: result.theater,
        metadata: result.metadata,
        pagination: result.pagination
      }
    });

  } catch (error) {
    console.error('❌ Error fetching page access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch page access',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/page-access
 * @desc    Create/Add a page access to theater (theaterId in body)
 * @access  Private (Admin/Super Admin)
 */
router.post('/', [
  authenticateToken,
  body('theaterId').isMongoId().withMessage('Valid theater ID is required'),
  body('page').notEmpty().trim().withMessage('Page identifier is required'),
  body('pageName').notEmpty().trim().withMessage('Page name is required'),
  body('route').notEmpty().trim().withMessage('Route is required')
], async (req, res) => {
  try {
    console.log('📥 POST /api/page-access - Create page access');
    
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      theaterId, 
      page,
      pageName,
      displayName,
      route,
      category = 'admin',
      description = '',
      icon = '',
      requiredRoles = [],
      requiredPermissions = [],
      showInMenu = true,
      showInSidebar = true,
      menuOrder = 0,
      isActive = true,
      isBeta = false,
      requiresSubscription = false,
      tags = [],
      version = '1.0.0'
    } = req.body;

    console.log('🔍 Creating page access for theater:', theaterId);
    console.log('📄 Page data:', { page, pageName, route });

    // Find or create page access document for theater
    let pageAccessDoc = await PageAccessArray.findOrCreateByTheater(theaterId);

    // Add page to theater
    const newPage = await pageAccessDoc.addPage({
      page: page.trim(),
      pageName: pageName.trim(),
      displayName: displayName || pageName,
      route: route.trim(),
      category,
      description: description.trim(),
      icon,
      requiredRoles,
      requiredPermissions,
      showInMenu,
      showInSidebar,
      menuOrder,
      isActive,
      isBeta,
      requiresSubscription,
      tags,
      version
    });

    // Populate theater info
    await pageAccessDoc.populate('theater', 'name location');

    console.log(`✅ Page "${pageName}" added for theater ${theaterId}`);

    res.status(201).json({
      success: true,
      message: 'Page access created successfully',
      data: {
        page: newPage,
        theater: pageAccessDoc.theater,
        metadata: pageAccessDoc.metadata
      }
    });

  } catch (error) {
    console.error('❌ Error creating page access:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to create page access',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/page-access/:pageId
 * @desc    Update a page access by ID (finds theater automatically)
 * @access  Private (Admin/Super Admin)
 */
router.put('/:pageId', [
  authenticateToken,
  param('pageId').isMongoId().withMessage('Valid page ID is required')
], async (req, res) => {
  try {
    console.log('📥 PUT /api/page-access/:pageId - Update page access');
    console.log('🔍 Page ID:', req.params.pageId);
    console.log('📦 Update Data:', JSON.stringify(req.body, null, 2));
    
    const { pageId } = req.params;
    const updateData = req.body;

    // Find document containing this page
    const pageAccessDoc = await PageAccessArray.findOne({ 'pageAccessList._id': pageId });

    if (!pageAccessDoc) {
      return res.status(404).json({
        success: false,
        message: 'Page access not found'
      });
    }

    // Update the page
    const updatedPage = await pageAccessDoc.updatePage(pageId, updateData);

    // Populate theater info
    await pageAccessDoc.populate('theater', 'name location');

    console.log(`✅ Page access ${pageId} updated successfully`);

    res.json({
      success: true,
      message: 'Page access updated successfully',
      data: {
        page: updatedPage,
        theater: pageAccessDoc.theater,
        metadata: pageAccessDoc.metadata
      }
    });

  } catch (error) {
    console.error('❌ Error updating page access:', error);
    
    if (error.message === 'Page not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update page access',
      error: error.message
    });
  }
});

/**
 * @route   PATCH /api/page-access/:pageId/toggle
 * @desc    Toggle page access active status
 * @access  Private (Admin/Super Admin)
 */
router.patch('/:pageId/toggle', [
  authenticateToken,
  param('pageId').isMongoId().withMessage('Valid page ID is required'),
  body('isActive').isBoolean().withMessage('isActive must be boolean')
], async (req, res) => {
  try {
    console.log('📥 PATCH /api/page-access/:pageId/toggle - Toggle page status');
    console.log('🔍 Page ID:', req.params.pageId);
    console.log('📦 New Status:', req.body.isActive);
    
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { pageId } = req.params;
    const { isActive } = req.body;

    // Find document containing this page
    const pageAccessDoc = await PageAccessArray.findOne({ 'pageAccessList._id': pageId });

    if (!pageAccessDoc) {
      return res.status(404).json({
        success: false,
        message: 'Page access not found'
      });
    }

    // Toggle the page
    const toggledPage = await pageAccessDoc.togglePage(pageId, isActive);

    // Populate theater info
    await pageAccessDoc.populate('theater', 'name location');

    console.log(`✅ Page access ${pageId} toggled to ${isActive}`);

    res.json({
      success: true,
      message: `Page access ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        page: toggledPage,
        theater: pageAccessDoc.theater,
        metadata: pageAccessDoc.metadata
      }
    });

  } catch (error) {
    console.error('❌ Error toggling page access:', error);
    
    if (error.message === 'Page not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to toggle page access',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/page-access/:pageId
 * @desc    Delete a page access by ID (finds theater automatically)
 * @access  Private (Admin/Super Admin)
 */
router.delete('/:pageId', [
  authenticateToken,
  requireRole(['super_admin']),
  param('pageId').isMongoId().withMessage('Valid page ID is required')
], async (req, res) => {
  try {
    console.log('📥 DELETE /api/page-access/:pageId - Delete page access');
    console.log('🔍 Page ID:', req.params.pageId);
    
    const { pageId } = req.params;

    // Find document containing this page
    const pageAccessDoc = await PageAccessArray.findOne({ 'pageAccessList._id': pageId });

    if (!pageAccessDoc) {
      return res.status(404).json({
        success: false,
        message: 'Page access not found'
      });
    }

    // Store page name before deletion
    const page = pageAccessDoc.pageAccessList.id(pageId);
    const pageName = page ? page.pageName : 'Unknown';

    // Remove the page
    await pageAccessDoc.removePage(pageId);

    console.log(`✅ Page access ${pageId} deleted successfully`);

    res.json({
      success: true,
      message: `Page access "${pageName}" deleted successfully`,
      data: {
        deletedPageId: pageId,
        metadata: pageAccessDoc.metadata
      }
    });

  } catch (error) {
    console.error('❌ Error deleting page access:', error);
    
    if (error.message === 'Page not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete page access',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/page-access/:pageId
 * @desc    Get a specific page access by ID
 * @access  Public
 */
router.get('/:pageId', [
  optionalAuth,
  param('pageId').isMongoId().withMessage('Valid page ID is required')
], async (req, res) => {
  try {
    console.log('📥 GET /api/page-access/:pageId - Get specific page');
    console.log('🔍 Page ID:', req.params.pageId);
    
    const { pageId } = req.params;

    // Find document containing this page
    const pageAccessDoc = await PageAccessArray.findOne({ 'pageAccessList._id': pageId })
      .populate('theater', 'name location');

    if (!pageAccessDoc) {
      return res.status(404).json({
        success: false,
        message: 'Page access not found'
      });
    }

    const page = pageAccessDoc.pageAccessList.id(pageId);

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }

    res.json({
      success: true,
      data: {
        page,
        theater: pageAccessDoc.theater
      }
    });

  } catch (error) {
    console.error('❌ Error fetching page access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch page access',
      error: error.message
    });
  }
});

module.exports = router;
