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

