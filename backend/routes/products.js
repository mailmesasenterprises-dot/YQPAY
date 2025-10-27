const express = require('express');
const { body, validationResult, query } = require('express-validator');
const multer = require('multer');
const Product = require('../models/Product');
const Category = require('../models/Category');
const ProductType = require('../models/ProductType');
const Theater = require('../models/Theater');
const MonthlyStock = require('../models/MonthlyStock');  // ✅ Import MonthlyStock
const { authenticateToken, optionalAuth, requireTheaterAccess } = require('../middleware/auth');
const { uploadFile, deleteFile } = require('../utils/gcsUploadUtil');
const mongoose = require('mongoose');

// Configure multer for memory storage (for GCS uploads)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for category images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const router = express.Router();

// ==============================================
// PRODUCT ROUTES
// ==============================================

/**
 * GET /api/theater-products/:theaterId
 * Get products for a theater with pagination and filtering
 * SUPPORTS BOTH: Individual documents (old) and Array structure (new)
 */
router.get('/:theaterId', [
  optionalAuth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('categoryId').optional().isMongoId(),
  query('search').optional().isLength({ min: 1 }),
  query('status').optional().isIn(['active', 'inactive', 'out_of_stock', 'discontinued']),
  query('sortBy').optional().isIn(['name', 'price', 'createdAt', 'updatedAt', 'rating']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { theaterId } = req.params;
    console.log('🔍 Fetching products for theater:', theaterId);
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;
    const { categoryId, search, status, isActive, isFeatured, sortBy = 'name', sortOrder = 'asc' } = req.query;

    // Try NEW array-based structure first (like categories)
    const productContainer = await mongoose.connection.db.collection('productlist').findOne({
      theater: new mongoose.Types.ObjectId(theaterId),
      productList: { $exists: true }
    });

    let allProducts = [];
    
    if (productContainer && productContainer.productList) {
      console.log('✅ Using NEW array-based structure');
      allProducts = productContainer.productList || [];
    } else {
      // Fallback to OLD individual document structure
      console.log('⚠️  Falling back to OLD individual document structure');
      const query = { theaterId: new mongoose.Types.ObjectId(theaterId) };
      allProducts = await Product.find(query).lean();
    }

    console.log('📦 Total products found:', allProducts.length);

    // Apply filters
    let filtered = allProducts;

    // Filter by category
    if (categoryId) {
      filtered = filtered.filter(p => String(p.categoryId) === categoryId);
    }

    // Filter by status
    if (status) {
      filtered = filtered.filter(p => p.status === status);
    }

    // Filter by isActive
    if (isActive !== undefined) {
      const activeFilter = isActive === 'true';
      filtered = filtered.filter(p => p.isActive === activeFilter);
    }

    // Filter by isFeatured
    if (isFeatured !== undefined) {
      const featuredFilter = isFeatured === 'true';
      filtered = filtered.filter(p => p.isFeatured === featuredFilter);
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p => 
        (p.name || '').toLowerCase().includes(searchLower) ||
        (p.description || '').toLowerCase().includes(searchLower) ||
        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      // Handle nested pricing fields
      if (sortBy === 'price') {
        aVal = a.pricing?.basePrice || 0;
        bVal = b.pricing?.basePrice || 0;
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    // Pagination
    const total = filtered.length;
    const paginatedProducts = filtered.slice(skip, skip + limit);

    console.log('📊 Filtered:', filtered.length, '| Paginated:', paginatedProducts.length);

    // ✅ Fetch real stock balances from MonthlyStock for each product
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    console.log('📦 Fetching real stock balances from MonthlyStock...');
    const productsWithRealStock = await Promise.all(
      paginatedProducts.map(async (product) => {
        try {
          const monthlyDoc = await MonthlyStock.findOne({
            theaterId: new mongoose.Types.ObjectId(theaterId),
            productId: product._id,
            year,
            monthNumber: month
          });

          // Use closing balance from MonthlyStock, or fall back to inventory.currentStock
          const realStock = monthlyDoc?.closingBalance ?? product.inventory?.currentStock ?? 0;
          
          return {
            ...product,
            inventory: {
              ...product.inventory,
              currentStock: Math.max(0, realStock)  // Ensure non-negative
            }
          };
        } catch (err) {
          console.error(`  ⚠️ Error fetching stock for ${product.name}:`, err.message);
          // Return product with existing stock if MonthlyStock fetch fails
          return product;
        }
      })
    );

    console.log('✅ Stock balances updated from MonthlyStock');

    res.json({
      success: true,
      data: {
        products: productsWithRealStock,
        pagination: {
          current: page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Get products error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to fetch products',
      message: error.message
    });
  }
});

/**
 * POST /api/theater-products/:theaterId
 * Create a new product in the productList array
 */
router.post('/:theaterId', [
  authenticateToken,
  requireTheaterAccess,
  body('name').notEmpty().trim().withMessage('Product name is required'),
  body('categoryId').isMongoId().withMessage('Valid category ID is required'),
  body('pricing.basePrice').isFloat({ min: 0 }).withMessage('Base price must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { theaterId } = req.params;
    const theaterObjectId = new mongoose.Types.ObjectId(theaterId);
    const db = mongoose.connection.db;

    // Verify category exists
    const categoryDoc = await Category.findOne({ theater: theaterId });
    if (!categoryDoc) {
      return res.status(400).json({
        error: 'No categories found for this theater',
        code: 'NO_CATEGORIES'
      });
    }
    
    const categoryExists = categoryDoc.categoryList.id(req.body.categoryId);
    if (!categoryExists) {
      console.error('❌ Category not found:', req.body.categoryId);
      return res.status(400).json({
        error: 'Invalid category',
        code: 'INVALID_CATEGORY'
      });
    }

    console.log('✅ Creating product:', req.body.name, 'for theater:', theaterId);
    console.log('📦 Request body quantity:', req.body.quantity);
    console.log('📦 Full request body:', JSON.stringify(req.body, null, 2));

    // Prepare new product data
    const newProduct = {
      _id: new mongoose.Types.ObjectId(),
      name: req.body.name,
      description: req.body.description || '',
      categoryId: new mongoose.Types.ObjectId(req.body.categoryId),
      productTypeId: req.body.productTypeId ? new mongoose.Types.ObjectId(req.body.productTypeId) : undefined,
      sku: req.body.sku || `PRD-${Date.now()}`,
      quantity: req.body.quantity || '', // NEW: Accept quantity field from frontend
      pricing: {
        basePrice: req.body.pricing?.basePrice || 0,
        salePrice: req.body.pricing?.salePrice || 0,
        discountPercentage: req.body.pricing?.discountPercentage || 0,
        taxRate: req.body.pricing?.taxRate || 0,
        currency: req.body.pricing?.currency || 'INR',
        gstType: req.body.pricing?.gstType || 'EXCLUDE'
      },
      inventory: {
        trackStock: req.body.inventory?.trackStock !== false,
        currentStock: req.body.inventory?.currentStock || 0,
        minStock: req.body.inventory?.minStock || 0,
        maxStock: req.body.inventory?.maxStock || 1000,
        unit: req.body.inventory?.unit || 'piece'
      },
      images: req.body.images || [],
      specifications: req.body.specifications || {
        ingredients: [],
        dimensions: { unit: 'cm' },
        allergens: []
      },
      tags: req.body.tags || [],
      status: req.body.status || 'active',
      isActive: req.body.isActive !== false,
      isFeatured: req.body.isFeatured || false,
      sortOrder: req.body.sortOrder || 0,
      views: 0,
      orders: 0,
      rating: { average: 0, count: 0 },
      variants: req.body.variants || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Get or create product container for this theater
    let productContainer = await db.collection('productlist').findOne({
      theater: theaterObjectId,
      productList: { $exists: true }
    });

    if (!productContainer) {
      // Create new container
      productContainer = {
        theater: theaterObjectId,
        productList: [newProduct],
        metadata: {
          totalProducts: 1,
          activeProducts: newProduct.isActive ? 1 : 0,
          lastUpdatedAt: new Date()
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.collection('productlist').insertOne(productContainer);
      console.log('✅ Created new product container with first product');
    } else {
      // Add product to existing container
      await db.collection('productlist').updateOne(
        { theater: theaterObjectId },
        {
          $push: { productList: newProduct },
          $set: {
            'metadata.totalProducts': (productContainer.productList?.length || 0) + 1,
            'metadata.activeProducts': (productContainer.productList?.filter(p => p.isActive).length || 0) + (newProduct.isActive ? 1 : 0),
            'metadata.lastUpdatedAt': new Date(),
            updatedAt: new Date()
          }
        }
      );
      console.log('✅ Added product to existing container');
    }

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: newProduct
    });

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      error: 'Failed to create product',
      message: error.message
    });
  }
});

/**
 * PUT /api/theater-products/:theaterId/:productId
 * Update a product in the productList array
 */
router.put('/:theaterId/:productId', [
  authenticateToken,
  requireTheaterAccess,
  upload.single('productImage'), // Handle file upload
  body('name').optional().notEmpty().trim(),
  body('sellingPrice').optional().isFloat({ min: 0 }),
  body('pricing.basePrice').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { theaterId, productId } = req.params;
    const theaterObjectId = new mongoose.Types.ObjectId(theaterId);
    const productObjectId = new mongoose.Types.ObjectId(productId);
    const db = mongoose.connection.db;

    // If categoryId is being updated, verify it exists
    if (req.body.categoryId) {
      const categoryDoc = await Category.findOne({ theater: theaterId });
      if (!categoryDoc) {
        return res.status(400).json({
          error: 'No categories found for this theater',
          code: 'NO_CATEGORIES'
        });
      }
      
      const categoryExists = categoryDoc.categoryList.id(req.body.categoryId);
      if (!categoryExists) {
        return res.status(400).json({
          error: 'Invalid category',
          code: 'INVALID_CATEGORY'
        });
      }
    }

    // Find the product container
    const productContainer = await db.collection('productlist').findOne({
      theater: theaterObjectId,
      'productList._id': productObjectId
    });

    if (!productContainer) {
      return res.status(404).json({
        error: 'Product not found',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // Build update object with dot notation for nested fields
    const updateFields = {};
    const updateData = { ...req.body };
    delete updateData.theaterId; // Don't allow theater change
    delete updateData._id; // Don't allow ID change

    // Map frontend field names to backend schema
    const fieldMapping = {
      'sellingPrice': 'pricing.basePrice',
      'costPrice': 'pricing.salePrice',
      'discount': 'pricing.discountPercentage',
      'taxRate': 'pricing.taxRate',
      'gstType': 'pricing.gstType',
      'stockQuantity': 'inventory.currentStock',
      'unitOfMeasure': 'inventory.unit',
      'lowStockAlert': 'inventory.minStock',
      'productCode': 'sku',
      'category': 'categoryId',
      'productType': 'productTypeId'
    };

    // Process each field
    const processedData = {};
    for (const [key, value] of Object.entries(updateData)) {
      const mappedKey = fieldMapping[key] || key;
      processedData[mappedKey] = value;
    }

    // Convert categoryId to ObjectId if provided
    if (processedData.categoryId) {
      processedData.categoryId = new mongoose.Types.ObjectId(processedData.categoryId);
    }
    if (processedData['pricing.categoryId']) {
      processedData['pricing.categoryId'] = new mongoose.Types.ObjectId(processedData['pricing.categoryId']);
    }
    if (processedData.productTypeId) {
      processedData.productTypeId = new mongoose.Types.ObjectId(processedData.productTypeId);
    }
    if (processedData['pricing.productTypeId']) {
      processedData['pricing.productTypeId'] = new mongoose.Types.ObjectId(processedData['pricing.productTypeId']);
    }

    // Set updatedAt timestamp
    processedData.updatedAt = new Date();

    // Handle image upload if provided
    if (req.file) {
      try {
        const productName = processedData.name || productContainer.productList.find(p => p._id.equals(productObjectId))?.name || 'product';
        const folder = `products/${theaterId}/${productName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        console.log(`📤 Uploading product image to GCS folder: ${folder}`);
        const imageUrl = await uploadFile(
          req.file.buffer,
          req.file.originalname,
          folder,
          req.file.mimetype
        );
        
        // Get existing images array or create new one
        const existingProduct = productContainer.productList.find(p => p._id.equals(productObjectId));
        const existingImages = existingProduct?.images || [];
        
        // Add new image to the beginning of the array
        processedData.images = [imageUrl, ...existingImages];
        console.log(`✅ Image uploaded successfully: ${imageUrl}`);
      } catch (uploadError) {
        console.error('❌ Image upload error:', uploadError);
        return res.status(500).json({
          error: 'Failed to upload image',
          message: uploadError.message
        });
      }
    }

    // Build positional update for each field
    for (const [key, value] of Object.entries(processedData)) {
      // Handle nested updates properly
      if (value !== null && value !== undefined && value !== '') {
        updateFields[`productList.$.${key}`] = value;
      }
    }

    console.log('🔄 Update fields:', updateFields);

    // Update the product in the array
    const result = await db.collection('productlist').updateOne(
      {
        theater: theaterObjectId,
        'productList._id': productObjectId
      },
      {
        $set: updateFields
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        error: 'Product not found',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // Fetch the updated product
    const updatedContainer = await db.collection('productlist').findOne(
      {
        theater: theaterObjectId,
        'productList._id': productObjectId
      },
      { projection: { 'productList.$': 1 } }
    );

    const updatedProduct = updatedContainer?.productList[0];

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      error: 'Failed to update product',
      message: error.message
    });
  }
});

/**
 * DELETE /api/theater-products/:theaterId/:productId
 * HARD DELETE - Permanently remove product from the productList array
 */
router.delete('/:theaterId/:productId', [
  authenticateToken,
  requireTheaterAccess
], async (req, res) => {
  try {
    const { theaterId, productId } = req.params;
    const theaterObjectId = new mongoose.Types.ObjectId(theaterId);
    const productObjectId = new mongoose.Types.ObjectId(productId);
    const db = mongoose.connection.db;

    // Find the product container
    const productContainer = await db.collection('productlist').findOne({
      theater: theaterObjectId,
      'productList._id': productObjectId
    });

    if (!productContainer) {
      return res.status(404).json({
        error: 'Product not found',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // Get product details before deletion (for logging/backup)
    const productToDelete = productContainer.productList.find(p => p._id.equals(productObjectId));
    console.log('🗑️ Permanently deleting product:', productToDelete?.name, `(${productObjectId})`);

    // HARD DELETE - Permanently remove from array using $pull
    const result = await db.collection('productlist').updateOne(
      { theater: theaterObjectId },
      {
        $pull: { 
          productList: { _id: productObjectId } 
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        error: 'Product not found',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        error: 'Product not found or already deleted',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // Update metadata counts
    const updatedContainer = await db.collection('productlist').findOne({
      theater: theaterObjectId
    });

    if (updatedContainer) {
      const totalProducts = updatedContainer.productList?.length || 0;
      const activeCount = updatedContainer.productList?.filter(p => p.isActive).length || 0;

      await db.collection('productlist').updateOne(
        { theater: theaterObjectId },
        {
          $set: {
            'metadata.totalProducts': totalProducts,
            'metadata.activeProducts': activeCount,
            'metadata.lastUpdatedAt': new Date()
          }
        }
      );

      console.log('✅ Product deleted. Total products now:', totalProducts);
    }

    res.json({
      success: true,
      message: 'Product permanently deleted'
    });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      error: 'Failed to delete product',
      message: error.message
    });
  }
});

// ==============================================
// CATEGORY ROUTES
// ==============================================

const categoriesRouter = express.Router();

/**
 * GET /api/theater-categories/:theaterId
 * Get categories for a theater (from Category collection)
 */
categoriesRouter.get('/:theaterId', [
  optionalAuth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const { theaterId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const searchTerm = req.query.q || '';

    console.log('🔍 Fetching categories for theater:', theaterId);

    // Find category document for this theater
    const categoryDoc = await Category.findOne({ theater: theaterId });
    
    if (!categoryDoc) {
      console.log('⚠️  No categories found for theater:', theaterId);
      return res.json({
        success: true,
        data: {
          categories: [],
          pagination: {
            totalItems: 0,
            totalPages: 0,
            currentPage: page,
            itemsPerPage: limit
          },
          statistics: {
            total: 0,
            active: 0,
            inactive: 0
          }
        }
      });
    }

    let categories = categoryDoc.categoryList || [];

    // Apply search filter
    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm, 'i');
      categories = categories.filter(cat => 
        searchRegex.test(cat.categoryName) || searchRegex.test(cat.description || '')
      );
    }

    // Sort categories
    categories.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.categoryName.localeCompare(b.categoryName);
    });

    // Calculate statistics
    const total = categories.length;
    const active = categories.filter(cat => cat.isActive).length;
    const inactive = categories.filter(cat => !cat.isActive).length;

    // Apply pagination
    const paginatedCategories = categories.slice(skip, skip + limit);

    console.log(`✅ Found ${paginatedCategories.length} categories (${total} total)`);

    res.json({
      success: true,
      data: {
        categories: paginatedCategories,
        pagination: {
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          itemsPerPage: limit
        },
        statistics: {
          total: total,
          active: active,
          inactive: inactive
        }
      }
    });

  } catch (error) {
    console.error('❌ Get categories error:', error);
    res.status(500).json({
      error: 'Failed to fetch categories',
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/theater-categories/:theaterId
 * Create a new category with optional image upload
 */
categoriesRouter.post('/:theaterId', [
  authenticateToken,
  requireTheaterAccess,
  upload.single('image'),
  // Accept both 'name' and 'categoryName' for flexibility
  body('name').optional().notEmpty().trim(),
  body('categoryName').optional().notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('🔥 DEBUGGING: Validation errors:', errors.array());
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { theaterId } = req.params;
    // Accept both 'name' and 'categoryName' field names
    const categoryName = req.body.name || req.body.categoryName;
    const { description, isActive, categoryType, sortOrder } = req.body;

    // Validate that at least one name field is provided
    if (!categoryName) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{ msg: 'Category name is required', param: 'name' }]
      });
    }

    console.log('🔥 Creating category:', { theaterId, name: categoryName, hasImage: !!req.file });

    // Find or create category document for this theater
    let categoryDoc = await Category.findOne({ theater: theaterId });
    
    if (!categoryDoc) {
      categoryDoc = new Category({
        theater: theaterId,
        categoryList: [],
        isActive: true
      });
    }

    // Check for duplicate category name
    const existingCategory = categoryDoc.categoryList.find(
      cat => cat.categoryName.toLowerCase() === categoryName.toLowerCase()
    );
    if (existingCategory) {
      return res.status(400).json({
        error: 'Category name already exists',
        code: 'DUPLICATE_CATEGORY'
      });
    }

    // Create new category object
    const newCategory = {
      _id: new mongoose.Types.ObjectId(),
      categoryName: categoryName.trim(),
      categoryType: categoryType || 'Food',
      description: description || '',
      sortOrder: sortOrder || 0,
      isActive: isActive !== undefined ? isActive : true,
      imageUrl: null,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Handle image upload if provided
    if (req.file) {
      try {
        const folder = `categories/${theaterId}/${categoryName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        console.log(`📤 Uploading category image to GCS folder: ${folder}`);
        console.log(`   File: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);
        
        const imageUrl = await uploadFile(
          req.file.buffer,
          req.file.originalname,
          folder,
          req.file.mimetype
        );
        
        newCategory.imageUrl = imageUrl;
        console.log(`✅ Image uploaded successfully`);
      } catch (uploadError) {
        console.error('❌ Image upload error:', uploadError);
        return res.status(500).json({
          error: 'Failed to upload image',
          message: uploadError.message
        });
      }
    }

    // Add category to categoryList array
    categoryDoc.categoryList.push(newCategory);
    await categoryDoc.save();

    console.log('✅ Category created successfully:', newCategory._id);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: newCategory
    });

  } catch (error) {
    console.error('❌ Create category error:', error);
    res.status(500).json({
      error: 'Failed to create category',
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * PUT /api/theater-categories/:theaterId/:categoryId
 * Update a category with optional image upload
 */
categoriesRouter.put('/:theaterId/:categoryId', [
  authenticateToken,
  requireTheaterAccess,
  upload.single('image'),
  body('name').optional().notEmpty().trim(),
  body('categoryName').optional().notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { theaterId, categoryId } = req.params;
    // Accept both 'name' and 'categoryName' field names
    const categoryName = req.body.name || req.body.categoryName;
    const { description, isActive, categoryType, sortOrder, removeImage } = req.body;
    
    console.log('🔥 Updating category:', { categoryId, name: categoryName, hasImage: !!req.file, removeImage });
    
    // Find category document for this theater
    const categoryDoc = await Category.findOne({ theater: theaterId });
    if (!categoryDoc) {
      return res.status(404).json({
        error: 'No categories found for this theater',
        code: 'CATEGORY_DOC_NOT_FOUND'
      });
    }

    // Find category in categoryList
    const category = categoryDoc.categoryList.id(categoryId);
    if (!category) {
      return res.status(404).json({
        error: 'Category not found',
        code: 'CATEGORY_NOT_FOUND'
      });
    }

    // Check for duplicate name if name is being changed
    if (categoryName && categoryName.toLowerCase() !== category.categoryName.toLowerCase()) {
      const duplicateCategory = categoryDoc.categoryList.find(
        cat => cat._id.toString() !== categoryId && 
               cat.categoryName.toLowerCase() === categoryName.toLowerCase()
      );
      if (duplicateCategory) {
        return res.status(400).json({
          error: 'Category name already exists',
          code: 'DUPLICATE_CATEGORY'
        });
      }
    }

    // Update category fields
    if (categoryName) category.categoryName = categoryName.trim();
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;
    if (categoryType !== undefined) category.categoryType = categoryType;
    if (sortOrder !== undefined) category.sortOrder = sortOrder;
    category.updatedAt = new Date();

    // Handle image update
    if (removeImage === 'true' || removeImage === true) {
      // Remove existing image
      if (category.imageUrl) {
        try {
          await deleteFile(category.imageUrl);
          console.log('✅ Old image deleted from GCS');
        } catch (deleteError) {
          console.warn('⚠️  Could not delete old image:', deleteError.message);
        }
      }
      category.imageUrl = null;
    } else if (req.file) {
      // Upload new image
      try {
        // Delete old image if exists
        if (category.imageUrl) {
          try {
            await deleteFile(category.imageUrl);
            console.log('✅ Old image deleted from GCS');
          } catch (deleteError) {
            console.warn('⚠️  Could not delete old image:', deleteError.message);
          }
        }
        
        const folder = `categories/${theaterId}/${(categoryName || category.categoryName).replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        console.log(`📤 Uploading category image to GCS folder: ${folder}`);
        console.log(`   File: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);
        
        const imageUrl = await uploadFile(
          req.file.buffer,
          req.file.originalname,
          folder,
          req.file.mimetype
        );
        
        category.imageUrl = imageUrl;
        console.log(`✅ Image uploaded successfully`);
      } catch (uploadError) {
        console.error('❌ Image upload error:', uploadError);
        return res.status(500).json({
          error: 'Failed to upload image',
          message: uploadError.message
        });
      }
    }

    // Save category document with updated category
    await categoryDoc.save();

    console.log('✅ Category updated successfully:', categoryId);

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });

  } catch (error) {
    console.error('❌ Update category error:', error);
    res.status(500).json({
      error: 'Failed to update category',
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * DELETE /api/theater-categories/:theaterId/:categoryId
 * Delete a category
 */
categoriesRouter.delete('/:theaterId/:categoryId', [
  authenticateToken,
  requireTheaterAccess
], async (req, res) => {
  try {
    const { theaterId, categoryId } = req.params;
    
    console.log('🔥 Deleting category:', { theaterId, categoryId });

    // Find category document for this theater
    const categoryDoc = await Category.findOne({ theater: theaterId });
    if (!categoryDoc) {
      return res.status(404).json({
        error: 'No categories found for this theater',
        code: 'CATEGORY_DOC_NOT_FOUND'
      });
    }

    // Find category in categoryList
    const category = categoryDoc.categoryList.id(categoryId);
    if (!category) {
      return res.status(404).json({
        error: 'Category not found',
        code: 'CATEGORY_NOT_FOUND'
      });
    }

    // Delete image from GCS if exists
    if (category.imageUrl) {
      try {
        await deleteFile(category.imageUrl);
        console.log('✅ Category image deleted from GCS');
      } catch (deleteError) {
        console.warn('⚠️  Could not delete category image:', deleteError.message);
      }
    }

    // Remove category from categoryList using pull
    categoryDoc.categoryList.pull(categoryId);
    await categoryDoc.save();

    console.log('✅ Category deleted successfully');

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete category error:', error);
    res.status(500).json({
      error: 'Failed to delete category',
      message: error.message || 'Internal server error'
    });
  }
});

// ==============================================
// PRODUCT TYPE ROUTES
// ==============================================
// PRODUCT TYPE ROUTES (Array-based with GCS Integration)
// ==============================================

const productTypesRouter = express.Router();

/**
 * GET /api/theater-product-types/:theaterId
 * Get product types for a theater with pagination, search, and statistics
 */
productTypesRouter.get('/:theaterId', [
  optionalAuth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isLength({ min: 1 }),
  query('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const { theaterId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { search, isActive } = req.query;

    console.log('🔍 Fetching product types for theater:', theaterId);

    // Find product types document for this theater
    let productTypeDoc = await ProductType.findOne({ theater: theaterId });

    if (!productTypeDoc) {
      // Return empty result if no document exists
      return res.json({
        success: true,
        data: [],
        pagination: {
          totalItems: 0,
          totalPages: 0,
          currentPage: page,
          itemsPerPage: limit
        },
        statistics: {
          total: 0,
          active: 0,
          inactive: 0
        }
      });
    }

    let productTypeList = productTypeDoc.productTypeList || [];

    // Filter by isActive if specified
    if (isActive !== undefined) {
      const activeFilter = isActive === 'true';
      productTypeList = productTypeList.filter(pt => pt.isActive === activeFilter);
    }

    // Filter by search query
    if (search) {
      const searchLower = search.toLowerCase();
      productTypeList = productTypeList.filter(pt => 
        pt.productName.toLowerCase().includes(searchLower) ||
        pt.productCode.toLowerCase().includes(searchLower) ||
        (pt.description && pt.description.toLowerCase().includes(searchLower))
      );
    }

    // Calculate statistics
    const total = productTypeDoc.productTypeList.length;
    const active = productTypeDoc.productTypeList.filter(pt => pt.isActive).length;
    const inactive = total - active;

    // Pagination
    const totalFiltered = productTypeList.length;
    const paginatedList = productTypeList.slice(skip, skip + limit);

    console.log(`✅ Found ${paginatedList.length} product types (page ${page}/${Math.ceil(totalFiltered / limit)})`);

    res.json({
      success: true,
      data: paginatedList,
      pagination: {
        totalItems: totalFiltered,
        totalPages: Math.ceil(totalFiltered / limit),
        currentPage: page,
        itemsPerPage: limit
      },
      statistics: {
        total: total,
        active: active,
        inactive: inactive
      }
    });

  } catch (error) {
    console.error('❌ Get product types error:', error);
    res.status(500).json({
      error: 'Failed to fetch product types',
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/theater-product-types/:theaterId
 * Create a new product type with optional image upload
 */
productTypesRouter.post('/:theaterId', [
  authenticateToken,
  requireTheaterAccess,
  upload.single('image'),
  body('productCode').notEmpty().trim().withMessage('Product code is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('🔥 Validation errors:', errors.array());
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { theaterId } = req.params;
    const { productName, productCode, description, quantity, icon, color, sortOrder, isActive } = req.body;

    console.log('🔥 Creating product type:', { theaterId, productName, productCode, hasImage: !!req.file });

    // Find or create product type document for this theater
    let productTypeDoc = await ProductType.findOne({ theater: theaterId });
    
    if (!productTypeDoc) {
      productTypeDoc = new ProductType({
        theater: theaterId,
        productTypeList: []
      });
    }

    // Check for duplicate product code only (Product Name validation removed)
    const existingProduct = productTypeDoc.productTypeList.find(
      pt => pt.productCode.toUpperCase() === productCode.toUpperCase()
    );
    if (existingProduct) {
      return res.status(400).json({
        error: 'Product code already exists',
        code: 'DUPLICATE_PRODUCT_CODE'
      });
    }

    // Create new product type object
    const newProductType = {
      _id: new mongoose.Types.ObjectId(),
      productName: productName.trim(),
      productCode: productCode.trim().toUpperCase(),
      description: description || '',
      quantity: quantity || 0,
      icon: icon || '🥤',
      color: color || '#6B0E9B',
      sortOrder: sortOrder || 0,
      isActive: isActive !== undefined ? isActive : true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Handle image upload if provided
    if (req.file) {
      try {
        const folder = `product-types/${theaterId}/${productName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        console.log(`📤 Uploading product type image to GCS folder: ${folder}`);
        
        const imageUrl = await uploadFile(
          req.file.buffer,
          req.file.originalname,
          folder,
          req.file.mimetype
        );
        
        newProductType.image = imageUrl;
        console.log('✅ Image uploaded successfully:', imageUrl);
      } catch (uploadError) {
        console.error('❌ Image upload failed:', uploadError);
        return res.status(500).json({
          error: 'Image upload failed',
          message: uploadError.message
        });
      }
    }

    // Add to array
    productTypeDoc.productTypeList.push(newProductType);
    await productTypeDoc.save();

    console.log('✅ Product type created with ID:', newProductType._id);

    res.status(201).json({
      success: true,
      message: 'Product type created successfully',
      data: newProductType
    });

  } catch (error) {
    console.error('❌ Create product type error:', error);
    res.status(500).json({
      error: 'Failed to create product type',
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * PUT /api/theater-product-types/:theaterId/:productTypeId
 * Update a product type with optional image replacement
 */
productTypesRouter.put('/:theaterId/:productTypeId', [
  authenticateToken,
  requireTheaterAccess,
  upload.single('image')
], async (req, res) => {
  try {
    const { theaterId, productTypeId } = req.params;
    const { productName, productCode, description, quantity, icon, color, sortOrder, isActive } = req.body;

    console.log('🔄 Updating product type:', { theaterId, productTypeId });

    // Find product type document
    const productTypeDoc = await ProductType.findOne({ theater: theaterId });
    
    if (!productTypeDoc) {
      return res.status(404).json({
        error: 'Product type document not found',
        code: 'DOCUMENT_NOT_FOUND'
      });
    }

    // Find product type in array
    const productType = productTypeDoc.productTypeList.id(productTypeId);
    
    if (!productType) {
      return res.status(404).json({
        error: 'Product type not found',
        code: 'PRODUCT_TYPE_NOT_FOUND'
      });
    }

    // Store old image URL for cleanup
    const oldImageUrl = productType.image;

    // Update fields
    if (productName) productType.productName = productName.trim();
    if (productCode) productType.productCode = productCode.trim().toUpperCase();
    if (description !== undefined) productType.description = description;
    if (quantity !== undefined) productType.quantity = quantity;
    if (icon) productType.icon = icon;
    if (color) productType.color = color;
    if (sortOrder !== undefined) productType.sortOrder = sortOrder;
    if (isActive !== undefined) productType.isActive = isActive;
    productType.updatedAt = new Date();

    // Handle image update if new image provided
    if (req.file) {
      try {
        const folder = `product-types/${theaterId}/${productType.productName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        console.log(`📤 Uploading new product type image to GCS folder: ${folder}`);
        
        const newImageUrl = await uploadFile(
          req.file.buffer,
          req.file.originalname,
          folder,
          req.file.mimetype
        );
        
        productType.image = newImageUrl;
        console.log('✅ New image uploaded successfully:', newImageUrl);

        // Delete old image if it exists
        if (oldImageUrl) {
          try {
            await deleteFile(oldImageUrl);
            console.log('✅ Old image deleted from GCS');
          } catch (deleteError) {
            console.error('⚠️ Failed to delete old image:', deleteError.message);
          }
        }
      } catch (uploadError) {
        console.error('❌ Image upload failed:', uploadError);
        return res.status(500).json({
          error: 'Image upload failed',
          message: uploadError.message
        });
      }
    }

    await productTypeDoc.save();

    console.log('✅ Product type updated successfully');

    // Sync changes to all products that belong to this product type
    try {
      // Products are stored in array structure, need to update them differently
      const db = mongoose.connection.db;
      const productContainer = await db.collection('productlist').findOne({
        theater: new mongoose.Types.ObjectId(theaterId),
        productList: { $exists: true }
      });

      if (productContainer && productContainer.productList) {
        let productsUpdated = 0;
        const productList = productContainer.productList;
        
        // Update each product in the array that matches this productTypeId
        for (let i = 0; i < productList.length; i++) {
          const product = productList[i];
          
          // Check if product belongs to this product type
          if (product.productTypeId && product.productTypeId.toString() === productTypeId) {
            let needsUpdate = false;
            
            // Update product name if changed
            if (productName) {
              productList[i].name = productName.trim();
              needsUpdate = true;
            }
            
            // Update image if changed
            if (req.file && productType.image) {
              // Update first image in images array
              if (!productList[i].images) {
                productList[i].images = [];
              }
              if (productList[i].images.length > 0) {
                productList[i].images[0] = {
                  url: productType.image,
                  filename: productType.image.split('/').pop(),
                  isMain: true
                };
              } else {
                productList[i].images.push({
                  url: productType.image,
                  filename: productType.image.split('/').pop(),
                  isMain: true
                });
              }
              needsUpdate = true;
            }
            
            if (needsUpdate) {
              productList[i].updatedAt = new Date();
              productsUpdated++;
            }
          }
        }
        
        // Save the updated product list
        if (productsUpdated > 0) {
          await db.collection('productlist').updateOne(
            { _id: productContainer._id },
            { $set: { productList: productList, updatedAt: new Date() } }
          );
          console.log(`✅ Synced changes to ${productsUpdated} products in array structure`);
        } else {
          console.log('ℹ️  No products found with this productTypeId');
        }
      }
    } catch (syncError) {
      console.error('⚠️ Failed to sync changes to products:', syncError.message);
      // Don't fail the request, just log the error
    }

    res.json({
      success: true,
      message: 'Product type updated successfully',
      data: productType
    });

  } catch (error) {
    console.error('❌ Update product type error:', error);
    res.status(500).json({
      error: 'Failed to update product type',
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * DELETE /api/theater-product-types/:theaterId/:productTypeId
 * Hard delete a product type and its image from GCS
 */
productTypesRouter.delete('/:theaterId/:productTypeId', [
  authenticateToken,
  requireTheaterAccess
], async (req, res) => {
  try {
    const { theaterId, productTypeId } = req.params;

    console.log('🗑️ Deleting product type:', { theaterId, productTypeId });

    // Find product type document
    const productTypeDoc = await ProductType.findOne({ theater: theaterId });
    
    if (!productTypeDoc) {
      return res.status(404).json({
        error: 'Product type document not found',
        code: 'DOCUMENT_NOT_FOUND'
      });
    }

    // Find product type in array
    const productType = productTypeDoc.productTypeList.id(productTypeId);
    
    if (!productType) {
      return res.status(404).json({
        error: 'Product type not found',
        code: 'PRODUCT_TYPE_NOT_FOUND'
      });
    }

    // Store image URL before deletion
    const imageUrl = productType.image;

    // Remove from array using pull (Mongoose 6+ compatible)
    productTypeDoc.productTypeList.pull(productTypeId);
    await productTypeDoc.save();

    console.log('✅ Product type removed from array');

    // Delete image from GCS if exists
    if (imageUrl) {
      try {
        await deleteFile(imageUrl);
        console.log('✅ Image deleted from GCS');
      } catch (deleteError) {
        console.error('⚠️ Failed to delete image from GCS:', deleteError.message);
      }
    }

    res.json({
      success: true,
      message: 'Product type deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete product type error:', error);
    res.status(500).json({
      error: 'Failed to delete product type',
      message: error.message || 'Internal server error'
    });
  }
});

// Export all routers
module.exports = {
  products: router,
  categories: categoriesRouter,
  productTypes: productTypesRouter
};

// Trigger reload
