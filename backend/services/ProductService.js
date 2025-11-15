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
    let paginated = results[0]?.data || [];
    const total = metadata.total;
    const totalPages = Math.ceil(total / limit);

    // Populate kioskType, category, productType, and ensure images/quantity
    if (paginated.length > 0) {
      const mongoose = require('mongoose');
      const KioskType = require('../models/KioskType');
      const Category = require('../models/Category');
      const ProductType = require('../models/ProductType');

      // Create maps for quick lookup
      const kioskTypeIds = [...new Set(paginated.map(p => p.kioskType).filter(Boolean))];
      const categoryIds = [...new Set(paginated.map(p => p.categoryId).filter(Boolean))];
      const productTypeIds = [...new Set(paginated.map(p => p.productTypeId).filter(Boolean))];

      // Fetch categories and productTypes (they also use array structure)
      const [kioskTypeDocs, categoryDocs, productTypeDocs] = await Promise.all([
        kioskTypeIds.length > 0 ? KioskType.find({ theater: new mongoose.Types.ObjectId(theaterId) }).lean() : [],
        categoryIds.length > 0 ? Category.find({ theater: new mongoose.Types.ObjectId(theaterId) }).lean() : [],
        productTypeIds.length > 0 ? ProductType.find({ theater: new mongoose.Types.ObjectId(theaterId) }).lean() : []
      ]);

      // Build maps from array structures
      const kioskTypeMap = new Map();
      if (kioskTypeDocs.length > 0 && kioskTypeDocs[0].kioskTypeList) {
        kioskTypeDocs[0].kioskTypeList.forEach(kt => {
          kioskTypeMap.set(kt._id.toString(), kt);
        });
      }

      const categoryMap = new Map();
      if (categoryDocs.length > 0 && categoryDocs[0].categoryList) {
        categoryDocs[0].categoryList.forEach(cat => {
          categoryMap.set(cat._id.toString(), cat);
        });
      }

      const productTypeMap = new Map();
      if (productTypeDocs.length > 0 && productTypeDocs[0].productTypeList) {
        productTypeDocs[0].productTypeList.forEach(pt => {
          productTypeMap.set(pt._id.toString(), pt);
        });
      }

      // Populate data for each product
      paginated = paginated.map(product => {
        // Get kioskType data
        let kioskTypeData = null;
        if (product.kioskType) {
          kioskTypeData = kioskTypeMap.get(product.kioskType.toString());
        }

        // Get category data
        let categoryData = null;
        if (product.categoryId) {
          categoryData = categoryMap.get(product.categoryId.toString());
        }

        // Get quantity from productType if not directly stored
        let quantity = product.quantity || '';
        if (!quantity && product.productTypeId) {
          const productTypeData = productTypeMap.get(product.productTypeId.toString());
          if (productTypeData) {
            quantity = productTypeData.quantity || '';
          }
        }

        // Ensure images array exists and is properly formatted
        let images = [];
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
          // Normalize image array - extract URLs from objects if needed
          images = product.images.map(img => {
            if (typeof img === 'string') {
              return img;
            } else if (img && typeof img === 'object') {
              return img.url || img.path || img.src || img;
            }
            return img;
          }).filter(Boolean);
        } else if (product.productImage) {
          // If old single image field exists, convert to array
          const imgUrl = typeof product.productImage === 'string' 
            ? product.productImage 
            : (product.productImage.url || product.productImage.path || product.productImage.src || product.productImage);
          if (imgUrl) images = [imgUrl];
        } else if (product.imageUrl) {
          images = [product.imageUrl];
        } else if (product.image) {
          const imgUrl = typeof product.image === 'string' 
            ? product.image 
            : (product.image.url || product.image.path || product.image.src || product.image);
          if (imgUrl) images = [imgUrl];
        }

        // Format kioskTypeData to match frontend expectations
        const formattedKioskTypeData = kioskTypeData ? {
          _id: kioskTypeData._id,
          name: kioskTypeData.name
        } : null;

        // Format categoryData to match frontend expectations
        const formattedCategoryData = categoryData ? {
          _id: categoryData._id,
          name: categoryData.categoryName || categoryData.name
        } : null;

        // Format imageData to match frontend expectations (similar to kioskTypeData)
        // Use first image from normalized images array, or null if no images
        const imageData = images && images.length > 0 ? images[0] : null;

        return {
          ...product,
          kioskTypeData: formattedKioskTypeData,
          categoryData: formattedCategoryData,
          quantity: quantity,
          images: images,
          imageData: imageData // Add imageData for easy frontend access (like kioskTypeData)
        };
      });
    }

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
          .populate('kioskType', 'name')
          .populate('categoryId', 'name')
          .populate('productTypeId', 'quantity name')
          .sort({ [sortField]: sortDir })
          .skip((page - 1) * limit)
          .limit(parseInt(limit))
          .lean()
          .maxTimeMS(10000),
        Product.countDocuments(query).maxTimeMS(5000)
      ]);
      
      console.log(`⚡ ProductService: Fallback query completed in ${Date.now() - fallbackStart}ms`);

      // Process fallback items to match structure
      const processedItems = items.map(product => {
        // Get quantity from productType if not directly stored
        let quantity = product.quantity || '';
        if (!quantity && product.productTypeId) {
          quantity = product.productTypeId.quantity || '';
        }

        // Ensure images array exists
        let images = [];
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
          // Normalize image array - extract URLs from objects if needed
          images = product.images.map(img => {
            if (typeof img === 'string') {
              return img;
            } else if (img && typeof img === 'object') {
              return img.url || img.path || img.src || img;
            }
            return img;
          }).filter(Boolean);
        } else if (product.productImage) {
          const imgUrl = typeof product.productImage === 'string' 
            ? product.productImage 
            : (product.productImage.url || product.productImage.path || product.productImage.src || product.productImage);
          if (imgUrl) images = [imgUrl];
        } else if (product.imageUrl) {
          images = [product.imageUrl];
        } else if (product.image) {
          const imgUrl = typeof product.image === 'string' 
            ? product.image 
            : (product.image.url || product.image.path || product.image.src || product.image);
          if (imgUrl) images = [imgUrl];
        }

        // Format imageData to match frontend expectations (similar to kioskTypeData)
        // Use first image from normalized images array, or null if no images
        const imageData = images && images.length > 0 ? images[0] : null;

        return {
          ...product,
          kioskTypeData: product.kioskType ? { _id: product.kioskType._id, name: product.kioskType.name } : null,
          categoryData: product.categoryId ? { _id: product.categoryId._id, name: product.categoryId.name } : null,
          quantity: quantity,
          images: images,
          imageData: imageData // Add imageData for easy frontend access (like kioskTypeData)
        };
      });

      return {
        data: processedItems,
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
      kioskType: productData.kioskType ? new mongoose.Types.ObjectId(productData.kioskType) : null,
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

    // Convert ObjectId fields if provided
    const processedUpdateData = { ...updateData };
    if (processedUpdateData.categoryId) {
      processedUpdateData.categoryId = new mongoose.Types.ObjectId(processedUpdateData.categoryId);
    }
    if (processedUpdateData.kioskType !== undefined) {
      processedUpdateData.kioskType = processedUpdateData.kioskType 
        ? new mongoose.Types.ObjectId(processedUpdateData.kioskType) 
        : null;
    }
    if (processedUpdateData.productTypeId !== undefined) {
      processedUpdateData.productTypeId = processedUpdateData.productTypeId 
        ? new mongoose.Types.ObjectId(processedUpdateData.productTypeId) 
        : null;
    }

    // Merge existing product with update data
    const mergedProduct = {
      ...existingProduct,
      ...processedUpdateData,
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

