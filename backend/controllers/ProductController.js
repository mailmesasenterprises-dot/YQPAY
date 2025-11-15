const BaseController = require('./BaseController');
const productService = require('../services/ProductService');
const { uploadFile, deleteFile } = require('../utils/gcsUploadUtil');

/**
 * Product Controller
 * Handles HTTP requests and responses for product endpoints
 */
class ProductController extends BaseController {
  /**
   * GET /api/theater-products/:theaterId
   * Get products for a theater
   */
  static async getByTheater(req, res) {
    try {
      if (!BaseController.checkDatabaseConnection()) {
        return res.status(503).json(
          BaseController.getDatabaseErrorResponse(req)
        );
      }

      const result = await productService.getProductsByTheater(
        req.params.theaterId,
        req.query
      );

      return BaseController.paginated(res, result.data, result.pagination);
    } catch (error) {
      console.error('Get products error:', error);
      return BaseController.error(res, 'Failed to fetch products', 500, {
        message: error.message
      });
    }
  }

  /**
   * GET /api/theater-products/:theaterId/:productId
   * Get a specific product
   */
  static async getById(req, res) {
    try {
      const product = await productService.getProductById(
        req.params.productId,
        req.params.theaterId
      );

      if (!product) {
        return BaseController.error(res, 'Product not found', 404, {
          code: 'PRODUCT_NOT_FOUND'
        });
      }

      return BaseController.success(res, product);
    } catch (error) {
      console.error('Get product error:', error);
      if (error.name === 'CastError') {
        return BaseController.error(res, 'Invalid product ID', 400, {
          code: 'INVALID_ID'
        });
      }
      return BaseController.error(res, 'Failed to fetch product', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/theater-products/:theaterId
   * Create a new product
   */
  static async create(req, res) {
    try {
      const { theaterId } = req.params;
      const mongoose = require('mongoose');

      // Handle image upload
      let imageUrl = null;
      if (req.file) {
        try {
          const sanitizedTheaterName = req.body.theaterName || 'theater';
          const folderPath = `theater-products/${sanitizedTheaterName}`;
          imageUrl = await uploadFile(req.file, folderPath);
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          return BaseController.error(res, 'Failed to upload image', 500, {
            message: uploadError.message
          });
        }
      }

      // Prepare product data
      const productData = {
        name: req.body.name.trim(),
        description: req.body.description || '',
        categoryId: req.body.categoryId,
        kioskType: req.body.kioskType || null,
        productTypeId: req.body.productTypeId || null,
        quantity: req.body.quantity || '',
        pricing: {
          basePrice: parseFloat(req.body.pricing?.basePrice || req.body.basePrice || 0),
          sellingPrice: parseFloat(req.body.pricing?.sellingPrice || req.body.sellingPrice || 0),
          discount: parseFloat(req.body.pricing?.discount || req.body.discount || 0)
        },
        inventory: {
          currentStock: parseInt(req.body.inventory?.currentStock || req.body.stockQuantity || 0),
          minStock: parseInt(req.body.inventory?.minStock || req.body.minStock || 0),
          maxStock: parseInt(req.body.inventory?.maxStock || req.body.maxStock || 0)
        },
        image: imageUrl,
        imageUrl: imageUrl,
        isActive: req.body.isActive !== undefined ? req.body.isActive === 'true' : true,
        isFeatured: req.body.isFeatured === 'true',
        status: req.body.status || 'active',
        sku: req.body.sku || `SKU-${Date.now()}`,
        barcode: req.body.barcode || null,
        tags: req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : req.body.tags.split(',')) : []
      };

      const product = await productService.createProduct(theaterId, productData);

      return res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product
      });
    } catch (error) {
      console.error('Create product error:', error);
      if (error.message === 'No categories found for this theater') {
        return BaseController.error(res, error.message, 400, {
          code: 'NO_CATEGORIES'
        });
      }
      if (error.message === 'Invalid category') {
        return BaseController.error(res, error.message, 400, {
          code: 'INVALID_CATEGORY'
        });
      }
      return BaseController.error(res, 'Failed to create product', 500, {
        message: error.message
      });
    }
  }

  /**
   * PUT /api/theater-products/:theaterId/:productId
   * Update a product
   */
  static async update(req, res) {
    try {
      const { theaterId, productId } = req.params;

      // Handle image upload if new image provided
      let imageUrl = null;
      if (req.file) {
        try {
          const sanitizedTheaterName = req.body.theaterName || 'theater';
          const folderPath = `theater-products/${sanitizedTheaterName}`;
          imageUrl = await uploadFile(req.file, folderPath);

          // Delete old image if exists
          const existingProduct = await productService.getProductById(productId, theaterId);
          if (existingProduct?.image) {
            await deleteFile(existingProduct.image).catch(err => 
              console.warn('Failed to delete old image:', err.message)
            );
          }
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          return BaseController.error(res, 'Failed to upload image', 500, {
            message: uploadError.message
          });
        }
      }

      // Prepare update data
      const updateData = {};
      if (req.body.name) updateData.name = req.body.name.trim();
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.categoryId) updateData.categoryId = req.body.categoryId;
      if (req.body.kioskType !== undefined) updateData.kioskType = req.body.kioskType || null;
      if (req.body.productTypeId !== undefined) updateData.productTypeId = req.body.productTypeId || null;
      if (req.body.quantity !== undefined) updateData.quantity = req.body.quantity || '';
      if (req.body.pricing) {
        updateData.pricing = {
          basePrice: parseFloat(req.body.pricing.basePrice || 0),
          sellingPrice: parseFloat(req.body.pricing.sellingPrice || 0),
          discount: parseFloat(req.body.pricing.discount || 0)
        };
      }
      if (req.body.inventory) {
        updateData.inventory = {
          currentStock: parseInt(req.body.inventory.currentStock || 0),
          minStock: parseInt(req.body.inventory.minStock || 0),
          maxStock: parseInt(req.body.inventory.maxStock || 0)
        };
      }
      if (imageUrl) {
        updateData.image = imageUrl;
        updateData.imageUrl = imageUrl;
      }
      if (req.body.isActive !== undefined) {
        updateData.isActive = req.body.isActive === 'true';
      }
      if (req.body.isFeatured !== undefined) {
        updateData.isFeatured = req.body.isFeatured === 'true';
      }
      if (req.body.status) updateData.status = req.body.status;
      if (req.body.sku) updateData.sku = req.body.sku;
      if (req.body.barcode) updateData.barcode = req.body.barcode;
      if (req.body.tags) {
        updateData.tags = Array.isArray(req.body.tags) 
          ? req.body.tags 
          : req.body.tags.split(',');
      }

      const updatedProduct = await productService.updateProduct(theaterId, productId, updateData);

      return BaseController.success(res, updatedProduct, 'Product updated successfully');
    } catch (error) {
      console.error('Update product error:', error);
      if (error.message === 'Product not found') {
        return BaseController.error(res, 'Product not found', 404, {
          code: 'PRODUCT_NOT_FOUND'
        });
      }
      if (error.name === 'CastError') {
        return BaseController.error(res, 'Invalid product ID', 400, {
          code: 'INVALID_ID'
        });
      }
      return BaseController.error(res, 'Failed to update product', 500, {
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/theater-products/:theaterId/:productId
   * Delete a product
   */
  static async delete(req, res) {
    try {
      const { theaterId, productId } = req.params;

      // Get product to delete image
      const product = await productService.getProductById(productId, theaterId);
      if (product?.image) {
        await deleteFile(product.image).catch(err => 
          console.warn('Failed to delete product image:', err.message)
        );
      }

      await productService.deleteProduct(theaterId, productId);

      return BaseController.success(res, null, 'Product deleted successfully');
    } catch (error) {
      console.error('Delete product error:', error);
      if (error.message === 'Product not found') {
        return BaseController.error(res, 'Product not found', 404, {
          code: 'PRODUCT_NOT_FOUND'
        });
      }
      if (error.name === 'CastError') {
        return BaseController.error(res, 'Invalid product ID', 400, {
          code: 'INVALID_ID'
        });
      }
      return BaseController.error(res, 'Failed to delete product', 500, {
        message: error.message
      });
    }
  }
}

module.exports = ProductController;

