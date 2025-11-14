const BaseService = require('./BaseService');
const Product = require('../models/Product');
const Category = require('../models/Category');
const mongoose = require('mongoose');

/**
 * Product Service
 * Handles all product-related business logic
 */
class ProductService extends BaseService {
  constructor() {
    super(Product);
  }

  /**
   * Get products for a theater (supports both array and individual document structures)
   * 🚀 OPTIMIZED: Use MongoDB aggregation for faster filtering, sorting, and pagination
   */
  async getProductsByTheater(theaterId, queryParams) {
    const {
      page = 1,
      limit = 100,
      categoryId,
      search,
      status,
      isActive,
      isFeatured,
      sortBy = 'name',
      sortOrder = 'asc'
    } = queryParams;

    const db = mongoose.connection.db;
    const theaterObjectId = new mongoose.Types.ObjectId(theaterId);
    
    // 🚀 OPTIMIZATION: Use aggregation pipeline for better performance
    const pipeline = [
      // Match theater document
      {
        $match: {
          theater: theaterObjectId,
          productList: { $exists: true }
        }
      },
      // Unwind product list
      { $unwind: '$productList' },
      // Replace root with product
      { $replaceRoot: { newRoot: '$productList' } }
    ];

    // 🚀 Add filters to pipeline (done in MongoDB, not JavaScript)
    const matchStage = {};
    
    if (categoryId) {
      matchStage.categoryId = new mongoose.Types.ObjectId(categoryId);
    }
    if (status) {
      matchStage.status = status;
    }
    if (isActive !== undefined) {
      matchStage.isActive = isActive === 'true';
    }
    if (isFeatured !== undefined) {
      matchStage.isFeatured = isFeatured === 'true';
    }
    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // 🚀 Add sorting to pipeline
    const sortField = sortBy === 'price' ? 'pricing.basePrice' : sortBy;
    const sortDir = sortOrder === 'desc' ? -1 : 1;
    pipeline.push({ $sort: { [sortField]: sortDir } });

    // 🚀 Add pagination using $facet for count and data in single query
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $skip: (page - 1) * limit },
          { $limit: parseInt(limit) }
        ]
      }
    });

    const startTime = Date.now();
    const results = await db.collection('productlist').aggregate(pipeline).maxTimeMS(10000).toArray();
    const duration = Date.now() - startTime;
    
    console.log(`⚡ ProductService: Fetched products in ${duration}ms using aggregation`);

    const metadata = results[0]?.metadata[0] || { total: 0 };
    const paginated = results[0]?.data || [];
    const total = metadata.total;
    const totalPages = Math.ceil(total / limit);

    // Fallback to individual documents if no array structure found
    if (paginated.length === 0 && total === 0) {
      console.log('📦 ProductService: No array structure found, using individual documents');
      const query = { theaterId: theaterObjectId };
      
      if (categoryId) query.categoryId = new mongoose.Types.ObjectId(categoryId);
      if (status) query.status = status;
      if (isActive !== undefined) query.isActive = isActive === 'true';
      if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const fallbackStart = Date.now();
      const [items, count] = await Promise.all([
        Product.find(query)
          .sort({ [sortField]: sortDir })
          .skip((page - 1) * limit)
          .limit(parseInt(limit))
          .lean()
          .maxTimeMS(10000),
        Product.countDocuments(query).maxTimeMS(5000)
      ]);
      
      console.log(`⚡ ProductService: Fallback query completed in ${Date.now() - fallbackStart}ms`);

      return {
        data: items,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalItems: count,
          pages: Math.ceil(count / limit),
          totalPages: Math.ceil(count / limit),
          hasNext: page < Math.ceil(count / limit),
          hasPrev: page > 1
        }
      };
    }

    return {
      data: paginated,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total,
        totalItems: total,
        pages: totalPages,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get product by ID
   */
  async getProductById(productId, theaterId) {
    // Try array structure first
    const db = mongoose.connection.db;
    const theaterObjectId = new mongoose.Types.ObjectId(theaterId);
    const productObjectId = new mongoose.Types.ObjectId(productId);
    const productContainer = await db.collection('productlist').findOne({
      theater: theaterObjectId,
      'productList._id': productObjectId
    });

    if (productContainer && productContainer.productList) {
      const product = productContainer.productList.find(
        p => String(p._id) === productId
      );
      if (product) return product;
    }

    // Fallback to individual document
    return this.findOne(
      { _id: productId, theaterId: new mongoose.Types.ObjectId(theaterId) },
      { lean: true }
    );
  }

  /**
   * Create product in array structure
   */
  async createProduct(theaterId, productData) {
    const db = mongoose.connection.db;
    const theaterObjectId = new mongoose.Types.ObjectId(theaterId);

    // Verify category exists
    const categoryDoc = await Category.findOne({ theater: theaterId }).maxTimeMS(15000);
    if (!categoryDoc) {
      throw new Error('No categories found for this theater');
    }
    
    const categoryExists = categoryDoc.categoryList.id(productData.categoryId);
    if (!categoryExists) {
      throw new Error('Invalid category');
    }

    // Create product with proper structure and defaults
    const newProduct = {
      _id: new mongoose.Types.ObjectId(),
      theaterId: theaterObjectId,
      name: productData.name,
      description: productData.description || '',
      categoryId: new mongoose.Types.ObjectId(productData.categoryId),
      productTypeId: productData.productTypeId ? new mongoose.Types.ObjectId(productData.productTypeId) : null,
      sku: productData.sku || `SKU-${Date.now()}`,
      barcode: productData.barcode || null,
      quantity: productData.quantity || '',
      pricing: {
        basePrice: productData.pricing?.basePrice || 0,
        salePrice: productData.pricing?.salePrice || productData.pricing?.sellingPrice || 0,
        discountPercentage: productData.pricing?.discount || productData.pricing?.discountPercentage || 0,
        taxRate: productData.pricing?.taxRate || 0,
        currency: productData.pricing?.currency || 'INR',
        gstType: productData.pricing?.gstType || 'EXCLUDE'
      },
      inventory: {
        trackStock: productData.inventory?.trackStock !== undefined ? productData.inventory.trackStock : true,
        currentStock: productData.inventory?.currentStock || 0,
        minStock: productData.inventory?.minStock || 0,
        maxStock: productData.inventory?.maxStock || 1000,
        unit: productData.inventory?.unit || 'piece'
      },
      images: productData.images || (productData.image ? [{
        url: productData.image,
        filename: productData.image.split('/').pop(),
        isMain: true
      }] : []),
      imageUrl: productData.imageUrl || productData.image || null,
      image: productData.image || productData.imageUrl || null,
      tags: productData.tags || [],
      status: productData.status || 'active',
      isActive: productData.isActive !== undefined ? productData.isActive : true,
      isFeatured: productData.isFeatured || false,
      sortOrder: productData.sortOrder || 0,
      views: 0,
      orders: 0,
      rating: {
        average: 0,
        count: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Update or create productList document
    const result = await db.collection('productlist').findOneAndUpdate(
      { theater: theaterObjectId },
      {
        $push: { productList: newProduct },
        $setOnInsert: { theater: theaterObjectId, createdAt: new Date() },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, returnDocument: 'after' }
    );

    return newProduct;
  }

  /**
   * Update product in array structure
   */
  async updateProduct(theaterId, productId, updateData) {
    const db = mongoose.connection.db;
    const theaterObjectId = new mongoose.Types.ObjectId(theaterId);
    const productObjectId = new mongoose.Types.ObjectId(productId);

    // First, get the existing product to merge with updates
    const existingDoc = await db.collection('productlist').findOne({
      theater: theaterObjectId,
      'productList._id': productObjectId
    });

    if (!existingDoc) {
      throw new Error('Product not found');
    }

    const existingProduct = existingDoc.productList.find(
      p => String(p._id) === String(productObjectId)
    );

    if (!existingProduct) {
      throw new Error('Product not found');
    }

    // Merge existing product with update data
    const mergedProduct = {
      ...existingProduct,
      ...updateData,
      _id: productObjectId,
      updatedAt: new Date()
    };

    // Handle nested objects (pricing, inventory) properly
    if (updateData.pricing) {
      mergedProduct.pricing = {
        ...existingProduct.pricing,
        ...updateData.pricing
      };
    }

    if (updateData.inventory) {
      mergedProduct.inventory = {
        ...existingProduct.inventory,
        ...updateData.inventory
      };
    }

    const result = await db.collection('productlist').findOneAndUpdate(
      {
        theater: theaterObjectId,
        'productList._id': productObjectId
      },
      {
        $set: {
          'productList.$[elem]': mergedProduct,
          updatedAt: new Date()
        }
      },
      {
        arrayFilters: [{ 'elem._id': productObjectId }],
        returnDocument: 'after'
      }
    );

    if (!result.value) {
      throw new Error('Product not found');
    }

    const updatedProduct = result.value.productList.find(
      p => String(p._id) === String(productId)
    );

    return updatedProduct;
  }

  /**
   * Delete product from array structure
   */
  async deleteProduct(theaterId, productId) {
    const db = mongoose.connection.db;
    const theaterObjectId = new mongoose.Types.ObjectId(theaterId);
    const productObjectId = new mongoose.Types.ObjectId(productId);

    const result = await db.collection('productlist').findOneAndUpdate(
      { theater: theaterObjectId },
      {
        $pull: { productList: { _id: productObjectId } },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      throw new Error('Product not found');
    }

    return true;
  }
}

module.exports = new ProductService();

