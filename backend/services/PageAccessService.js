const BaseService = require('./BaseService');
const PageAccessArray = require('../models/PageAccessArray');

/**
 * Page Access Service
 * Handles all page access-related business logic
 */
class PageAccessService extends BaseService {
  constructor() {
    super(PageAccessArray);
  }

  /**
   * Get page access for theater
   */
  async getPageAccess(theaterId) {
    const pageAccessDoc = await PageAccessArray.findOne({ theater: theaterId })
      .populate('theater', 'name location contactInfo')
      .lean()
      .maxTimeMS(20000);

    if (!pageAccessDoc) {
      return {
        pageAccessList: [],
        theater: null,
        metadata: {
          totalPages: 0,
          activePages: 0,
          inactivePages: 0
        }
      };
    }

    return {
      pageAccessList: pageAccessDoc.pageAccessList || [],
      theater: pageAccessDoc.theater,
      metadata: pageAccessDoc.metadata || {
        totalPages: pageAccessDoc.pageAccessList?.length || 0,
        activePages: pageAccessDoc.pageAccessList?.filter(p => p.isActive).length || 0,
        inactivePages: pageAccessDoc.pageAccessList?.filter(p => !p.isActive).length || 0
      }
    };
  }

  /**
   * Create page access
   */
  async createPageAccess(theaterId, pageData) {
    console.log('🔵 [PageAccessService] Creating page access for theater:', theaterId);
    console.log('🔵 [PageAccessService] Page data:', pageData);
    
    let pageAccessDoc = await PageAccessArray.findOrCreateByTheater(theaterId);
    console.log('✅ [PageAccessService] Page access doc found/created:', pageAccessDoc._id);

    // Use addPage method (not addPageAccess)
    const newPage = await pageAccessDoc.addPage({
      page: pageData.page?.trim() || '',
      pageName: pageData.pageName?.trim() || '',
      displayName: pageData.displayName || pageData.pageName?.trim() || '',
      route: pageData.route?.trim() || '',
      category: pageData.category || 'admin',
      description: pageData.description || '',
      icon: pageData.icon || '',
      requiredRoles: pageData.requiredRoles || [],
      requiredPermissions: pageData.requiredPermissions || [],
      showInMenu: pageData.showInMenu !== false,
      showInSidebar: pageData.showInSidebar !== false,
      menuOrder: pageData.menuOrder || 0,
      isActive: pageData.isActive !== false,
      isBeta: pageData.isBeta || false,
      requiresSubscription: pageData.requiresSubscription || false,
      tags: pageData.tags || []
    });

    console.log('✅ [PageAccessService] Page access added successfully');

    await pageAccessDoc.populate('theater', 'name location contactInfo');

    return {
      pageAccessList: pageAccessDoc.pageAccessList,
      theater: pageAccessDoc.theater,
      metadata: pageAccessDoc.metadata
    };
  }

  /**
   * Update page access
   */
  async updatePageAccess(theaterId, pageId, updateData) {
    const pageAccessDoc = await PageAccessArray.findOne({ theater: theaterId }).maxTimeMS(20000);
    if (!pageAccessDoc) {
      throw new Error('Page access document not found');
    }

    const page = pageAccessDoc.pageAccessList.id(pageId);
    if (!page) {
      throw new Error('Page access not found');
    }

    Object.assign(page, updateData);
    page.updatedAt = new Date();
    await pageAccessDoc.save();

    return page;
  }

  /**
   * Delete page access
   */
  async deletePageAccess(theaterId, pageId) {
    const pageAccessDoc = await PageAccessArray.findOne({ theater: theaterId }).maxTimeMS(20000);
    if (!pageAccessDoc) {
      throw new Error('Page access document not found');
    }

    // Get the page name before deleting
    const pageToDelete = pageAccessDoc.pageAccessList.id(pageId);
    if (!pageToDelete) {
      throw new Error('Page not found in access list');
    }
    
    const deletedPageName = pageToDelete.page;
    console.log(`🗑️ [deletePageAccess] Deleting page "${deletedPageName}" from theater ${theaterId}`);

    // Remove from page access list
    pageAccessDoc.pageAccessList.pull(pageId);
    await pageAccessDoc.save();
    
    // ✅ FIX: Clean up this page from all role permissions for this theater
    console.log(`🧹 [deletePageAccess] Cleaning up "${deletedPageName}" from all role permissions...`);
    const RoleArray = require('../models/RoleArray');
    const roleDoc = await RoleArray.findOne({ theater: theaterId }).maxTimeMS(20000);
    
    if (roleDoc) {
      let cleanupCount = 0;
      roleDoc.roleList.forEach(role => {
        const initialLength = role.permissions.length;
        role.permissions = role.permissions.filter(permission => permission.page !== deletedPageName);
        const removed = initialLength - role.permissions.length;
        if (removed > 0) {
          cleanupCount++;
          console.log(`  🧹 Removed "${deletedPageName}" from role "${role.name}"`);
        }
      });
      
      if (cleanupCount > 0) {
        await roleDoc.save();
        console.log(`✅ [deletePageAccess] Cleaned up "${deletedPageName}" from ${cleanupCount} role(s)`);
      } else {
        console.log(`ℹ️ [deletePageAccess] No role permissions found for "${deletedPageName}"`);
      }
    } else {
      console.log(`ℹ️ [deletePageAccess] No role document found for theater ${theaterId}`);
    }

    return true;
  }
}

module.exports = new PageAccessService();

