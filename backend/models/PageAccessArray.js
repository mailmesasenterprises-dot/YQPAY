const mongoose = require('mongoose');

/**
 * PageAccessArray Model
 * Theater-based page access management with array structure
 * Similar to RoleArray model - stores all pages for a theater in an array
 */

const pageAccessItemSchema = new mongoose.Schema({
  page: {
    type: String,
    required: [true, 'Page identifier is required'],
    trim: true
  },
  pageName: {
    type: String,
    required: [true, 'Page name is required'],
    trim: true
  },
  displayName: {
    type: String,
    trim: true
  },
  route: {
    type: String,
    required: [true, 'Route is required'],
    trim: true
  },
  category: {
    type: String,
    enum: ['dashboard', 'products', 'orders', 'customers', 'reports', 'settings', 'admin', 'qr', 'users', 'stock'],
    default: 'admin'
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  icon: {
    type: String,
    trim: true
  },
  
  // Access control
  requiredRoles: [{
    type: String,
    enum: ['super_admin', 'theater_admin', 'theater_staff', 'customer']
  }],
  
  requiredPermissions: [String],
  
  // UI Configuration
  showInMenu: { 
    type: Boolean, 
    default: true 
  },
  showInSidebar: { 
    type: Boolean, 
    default: true 
  },
  menuOrder: { 
    type: Number, 
    default: 0 
  },
  
  // Feature flags
  isActive: { 
    type: Boolean, 
    default: true 
  },
  isBeta: { 
    type: Boolean, 
    default: false 
  },
  requiresSubscription: { 
    type: Boolean, 
    default: false 
  },
  
  // Metadata
  tags: [String],
  version: { 
    type: String, 
    default: '1.0.0' 
  },
  
  // Timestamps
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { _id: true });

const pageAccessArraySchema = new mongoose.Schema({
  // Theater reference (required, unique - one document per theater)
  theater: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: [true, 'Theater reference is required'],
    unique: true,
    index: true
  },
  
  // Array of page access configurations
  pageAccessList: [pageAccessItemSchema],
  
  // Metadata for tracking
  metadata: {
    totalPages: {
      type: Number,
      default: 0
    },
    activePages: {
      type: Number,
      default: 0
    },
    inactivePages: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  collection: 'pageaccesses'
});

// Indexes for performance
pageAccessArraySchema.index({ theater: 1 });
pageAccessArraySchema.index({ 'pageAccessList.page': 1 });
pageAccessArraySchema.index({ 'pageAccessList.isActive': 1 });
pageAccessArraySchema.index({ 'pageAccessList.category': 1 });

/**
 * Pre-save middleware to update metadata
 */
pageAccessArraySchema.pre('save', function(next) {
  // Update timestamps for modified pages
  this.pageAccessList.forEach(page => {
    if (page.isModified()) {
      page.updatedAt = new Date();
    }
  });
  
  // Calculate metadata
  const totalPages = this.pageAccessList.length;
  const activePages = this.pageAccessList.filter(page => page.isActive).length;
  const inactivePages = totalPages - activePages;
  
  this.metadata = {
    totalPages,
    activePages,
    inactivePages,
    lastUpdated: new Date()
  };
  
  next();
});

/**
 * Static method: Find or create by theater ID
 */
pageAccessArraySchema.statics.findOrCreateByTheater = async function(theaterId) {
  let pageAccessDoc = await this.findOne({ theater: theaterId });
  
  if (!pageAccessDoc) {
    pageAccessDoc = new this({
      theater: theaterId,
      pageAccessList: [],
      metadata: {
        totalPages: 0,
        activePages: 0,
        inactivePages: 0,
        lastUpdated: new Date()
      }
    });
    await pageAccessDoc.save();
  } else {
  }
  
  return pageAccessDoc;
};

/**
 * Static method: Get pages for theater with filtering
 */
pageAccessArraySchema.statics.getByTheater = async function(theaterId, options = {}) {
  const {
    page = 1,
    limit = 100,
    search = '',
    isActive,
    category
  } = options;

  const pageAccessDoc = await this.findOne({ theater: theaterId })
    .populate('theater', 'name location contactInfo');

  if (!pageAccessDoc) {
    return {
      pages: [],
      pagination: {
        currentPage: page,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: limit
      },
      theater: null,
      metadata: {
        totalPages: 0,
        activePages: 0,
        inactivePages: 0
      }
    };
  }

  // Filter pages
  let filteredPages = pageAccessDoc.pageAccessList;

  if (isActive !== undefined) {
    filteredPages = filteredPages.filter(p => p.isActive === isActive);
  }

  if (category) {
    filteredPages = filteredPages.filter(p => p.category === category);
  }

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    filteredPages = filteredPages.filter(p => 
      searchRegex.test(p.page) || 
      searchRegex.test(p.pageName) || 
      searchRegex.test(p.description)
    );
  }

  // Sort by menuOrder, then by pageName
  filteredPages.sort((a, b) => {
    if (a.menuOrder !== b.menuOrder) {
      return a.menuOrder - b.menuOrder;
    }
    return a.pageName.localeCompare(b.pageName);
  });

  // Pagination
  const skip = (page - 1) * limit;
  const paginatedPages = filteredPages.slice(skip, skip + limit);

  return {
    pages: paginatedPages,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(filteredPages.length / limit),
      totalItems: filteredPages.length,
      itemsPerPage: limit
    },
    theater: pageAccessDoc.theater,
    metadata: pageAccessDoc.metadata
  };
};

/**
 * Instance method: Add page to theater
 */
pageAccessArraySchema.methods.addPage = async function(pageData) {

  // Check if page already exists
  const exists = this.pageAccessList.find(p => 
    p.page === pageData.page
  );
  
  if (exists) {
    // Update existing page
    Object.assign(exists, pageData);
    exists.updatedAt = new Date();
  } else {
    // Add new page
    const newPage = {
      ...pageData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.pageAccessList.push(newPage);
  }
  
  await this.save();
  return this.pageAccessList[this.pageAccessList.length - 1];
};

/**
 * Instance method: Update page
 */
pageAccessArraySchema.methods.updatePage = async function(pageId, updateData) {
  const page = this.pageAccessList.id(pageId);
  if (!page) {
    throw new Error('Page not found');
  }
  // Update page properties
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      page[key] = updateData[key];
    }
  });
  
  page.updatedAt = new Date();
  
  await this.save();
  
  return page;
};

/**
 * Instance method: Remove page from theater
 */
pageAccessArraySchema.methods.removePage = async function(pageId) {
  const pageIndex = this.pageAccessList.findIndex(p => p._id.toString() === pageId.toString());
  if (pageIndex === -1) {
    throw new Error('Page not found');
  }
  
  this.pageAccessList.splice(pageIndex, 1);
  await this.save();
  
  return true;
};

/**
 * Instance method: Toggle page active status
 */
pageAccessArraySchema.methods.togglePage = async function(pageId, isActive) {
  const page = this.pageAccessList.id(pageId);
  if (!page) {
    throw new Error('Page not found');
  }
  
  page.isActive = isActive;
  page.updatedAt = new Date();
  
  await this.save();
  
  return page;
};

/**
 * Instance method: Find page by page identifier
 */
pageAccessArraySchema.methods.findPageByIdentifier = function(pageIdentifier) {
  return this.pageAccessList.find(p => p.page === pageIdentifier);
};

// IMPORTANT: Force collection name to be 'pageaccesses' (not 'pageaccessarrays')
const PageAccessArray = mongoose.model('PageAccessArray', pageAccessArraySchema, 'pageaccesses');

module.exports = PageAccessArray;
