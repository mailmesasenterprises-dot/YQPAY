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

    // Try array-based structure first
    const db = mongoose.connection.db;
    const theaterObjectId = new mongoose.Types.ObjectId(theaterId);
    const productContainer = await db.collection('productlist').findOne({
      theater: theaterObjectId,
      productList: { $exists: true }
    });

    let allProducts = [];
    
    if (productContainer && productContainer.productList) {
      allProducts = productContainer.productList || [];
    } else {
      // Fallback to individual document structure
      const query = { theaterId: new mongoose.Types.ObjectId(theaterId) };
      allProducts = await Product.find(query).lean().maxTimeMS(20000);
    }

    // Apply filters
    let filtered = allProducts;

    if (categoryId) {
      filtered = filtered.filter(p => String(p.categoryId) === categoryId);
    }
    if (status) {
      filtered = filtered.filter(p => p.status === status);
    }
    if (isActive !== undefined) {
      filtered = filtered.filter(p => p.isActive === (isActive === 'true'));
    }
    if (isFeatured !== undefined) {
      filtered = filtered.filter(p => p.isFeatured === (isFeatured === 'true'));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p =>
        (p.name || '').toLowerCase().includes(searchLower) ||
        (p.description || '').toLowerCase().includes(searchLower)
      );
    }

    // Sort
    const sortMultiplier = sortOrder === 'desc' ? -1 : 1;
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === 'price') {
        aVal = a.pricing?.basePrice || a.sellingPrice || 0;
        bVal = b.pricing?.basePrice || b.sellingPrice || 0;
      }
      
      if (typeof aVal === 'string') {
        return aVal.localeCompare(bVal) * sortMultiplier;
      }
      return (aVal - bVal) * sortMultiplier;
    });

    // Paginate
    const skip = (page - 1) * limit;
    const paginated = filtered.slice(skip, skip + limit);
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);

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

    const newProduct = {
      _id: new mongoose.Types.ObjectId(),
      ...productData,
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

    updateData.updatedAt = new Date();

    const result = await db.collection('productlist').findOneAndUpdate(
      {
        theater: theaterObjectId,
        'productList._id': productObjectId
      },
      {
        $set: {
          'productList.$[elem]': { ...updateData, _id: productObjectId },
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
      p => String(p._id) === productId
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

