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

      // Handle image upload - support both file upload (multer) and base64
      // Also supports images array structure (multiple images)
      let imageUrl = null;
      let imagesArray = [];
      
      // Helper function to upload base64 image to GCS
      const uploadBase64ToGCS = async (base64Data, productName, theaterName) => {
        let mimetype = 'image/png';
        let extension = 'png';
        
        // Parse base64 data URL (format: data:image/png;base64,iVBORw0KG...)
        if (base64Data.startsWith('data:')) {
          const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            mimetype = matches[1];
            base64Data = matches[2];
            // Extract extension from mimetype
            if (mimetype.includes('jpeg') || mimetype.includes('jpg')) {
              extension = 'jpg';
            } else if (mimetype.includes('png')) {
              extension = 'png';
            } else if (mimetype.includes('gif')) {
              extension = 'gif';
            } else if (mimetype.includes('webp')) {
              extension = 'webp';
            }
          }
        }
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // Generate filename
        const filename = `${productName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.${extension}`;
        const sanitizedTheaterName = theaterName || 'theater';
        const folderPath = `theater-products/${sanitizedTheaterName}`;
        
        // Upload to GCS
        return await uploadFile(imageBuffer, filename, folderPath, mimetype);
      };
      
      // Priority 1: Handle file upload via multer
      if (req.file) {
        try {
          const sanitizedTheaterName = req.body.theaterName || 'theater';
          const folderPath = `theater-products/${sanitizedTheaterName}`;
          imageUrl = await uploadFile(req.file.buffer, req.file.originalname, folderPath, req.file.mimetype);
          imagesArray = [imageUrl]; // Set as first image in array
          console.log('✅ Product image uploaded to GCS via file upload:', imageUrl);
        } catch (uploadError) {
          console.error('❌ File upload error:', uploadError);
          return BaseController.error(res, 'Failed to upload image', 500, {
            message: uploadError.message
          });
        }
      }
      // Priority 2: Handle images array (base64 or URLs)
      else if (req.body.images && Array.isArray(req.body.images) && req.body.images.length > 0) {
        try {
          const productName = req.body.name || 'product';
          const sanitizedTheaterName = req.body.theaterName || 'theater';
          
          // Process each image in the array
          for (const img of req.body.images) {
            if (typeof img === 'string' && img.startsWith('data:')) {
              // Base64 image - upload to GCS
              const gcsUrl = await uploadBase64ToGCS(img, productName, sanitizedTheaterName);
              imagesArray.push(gcsUrl);
              if (!imageUrl) imageUrl = gcsUrl; // First image is the main image
            } else if (typeof img === 'string' && (img.startsWith('http') || img.startsWith('https') || img.startsWith('gs://'))) {
              // Already a URL - use as-is (GCS URL or external URL)
              imagesArray.push(img);
              if (!imageUrl) imageUrl = img;
            } else if (typeof img === 'object' && img.url) {
              // Image object with URL
              if (img.url.startsWith('data:')) {
                // Base64 in object
                const gcsUrl = await uploadBase64ToGCS(img.url, productName, sanitizedTheaterName);
                imagesArray.push(gcsUrl);
                if (!imageUrl) imageUrl = gcsUrl;
              } else {
                // URL in object
                imagesArray.push(img.url);
                if (!imageUrl) imageUrl = img.url;
              }
            }
          }
          console.log('✅ Product images uploaded to GCS from images array:', imagesArray.length, 'images');
        } catch (uploadError) {
          console.error('❌ Images array upload to GCS failed:', uploadError);
          return BaseController.error(res, 'Failed to upload images to GCS', 500, {
            message: uploadError.message
          });
        }
      }
      // Priority 3: Handle single base64 image from request body
      else if (req.body.image) {
        try {
          const productName = req.body.name || 'product';
          const sanitizedTheaterName = req.body.theaterName || 'theater';
          imageUrl = await uploadBase64ToGCS(req.body.image, productName, sanitizedTheaterName);
          imagesArray = [imageUrl]; // Set as first image in array
          console.log('✅ Product image uploaded to GCS from base64:', imageUrl);
        } catch (uploadError) {
          console.error('❌ Base64 image upload to GCS failed:', uploadError);
          return BaseController.error(res, 'Failed to upload base64 image to GCS', 500, {
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
        // Set images array if available, otherwise use single image
        images: imagesArray.length > 0 ? imagesArray : (imageUrl ? [imageUrl] : []),
        image: imageUrl, // Main image (backward compatibility)
        imageUrl: imageUrl, // Main image URL (backward compatibility)
        isActive: req.body.isActive !== undefined ? req.body.isActive === 'true' : true,
        isAvailable: req.body.isAvailable !== undefined ? (req.body.isAvailable === 'true' || req.body.isAvailable === true) : true,
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

      // Handle image upload - support both file upload (multer) and base64
      // Also supports images array structure (multiple images)
      let imageUrl = null;
      let imagesArray = null; // null means don't update, empty array means clear images
      
      // Get existing product early to handle old image deletion
      const existingProduct = await productService.getProductById(productId, theaterId);
      
      // Helper function to upload base64 image to GCS
      const uploadBase64ToGCS = async (base64Data, productName, theaterName) => {
        let mimetype = 'image/png';
        let extension = 'png';
        
        // Parse base64 data URL (format: data:image/png;base64,iVBORw0KG...)
        if (base64Data.startsWith('data:')) {
          const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            mimetype = matches[1];
            base64Data = matches[2];
            // Extract extension from mimetype
            if (mimetype.includes('jpeg') || mimetype.includes('jpg')) {
              extension = 'jpg';
            } else if (mimetype.includes('png')) {
              extension = 'png';
            } else if (mimetype.includes('gif')) {
              extension = 'gif';
            } else if (mimetype.includes('webp')) {
              extension = 'webp';
            }
          }
        }
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // Generate filename
        const productNameToUse = productName || existingProduct?.name || 'product';
        const filename = `${productNameToUse.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.${extension}`;
        const sanitizedTheaterName = theaterName || 'theater';
        const folderPath = `theater-products/${sanitizedTheaterName}`;
        
        // Upload to GCS
        return await uploadFile(imageBuffer, filename, folderPath, mimetype);
      };
      
      // Helper function to delete old images
      const deleteOldImages = async (images) => {
        if (!images || !Array.isArray(images)) return;
        for (const img of images) {
          const imgUrl = typeof img === 'string' ? img : (img.url || img.path || img.src);
          if (imgUrl && (imgUrl.startsWith('http') || imgUrl.startsWith('gs://'))) {
            try {
              await deleteFile(imgUrl);
              console.log('✅ Deleted old image from GCS:', imgUrl);
            } catch (err) {
              console.warn('⚠️ Failed to delete old image:', imgUrl, err.message);
            }
          }
        }
      };
      
      // Priority 1: Handle file upload via multer
      if (req.file) {
        try {
          // Delete old images if exists
          if (existingProduct?.images && Array.isArray(existingProduct.images) && existingProduct.images.length > 0) {
            await deleteOldImages(existingProduct.images);
          } else if (existingProduct?.image) {
            await deleteFile(existingProduct.image).catch(err => 
              console.warn('Failed to delete old image:', err.message)
            );
          }
          
          const sanitizedTheaterName = req.body.theaterName || 'theater';
          const folderPath = `theater-products/${sanitizedTheaterName}`;
          imageUrl = await uploadFile(req.file.buffer, req.file.originalname, folderPath, req.file.mimetype);
          imagesArray = [imageUrl]; // Set as first image in array
          console.log('✅ Product image updated to GCS via file upload:', imageUrl);
        } catch (uploadError) {
          console.error('❌ File upload error:', uploadError);
          return BaseController.error(res, 'Failed to upload image', 500, {
            message: uploadError.message
          });
        }
      }
      // Priority 2: Handle images array (base64 or URLs)
      else if (req.body.images !== undefined) {
        try {
          // If images array is provided (even empty), update it
          imagesArray = [];
          const productName = req.body.name || existingProduct?.name || 'product';
          const sanitizedTheaterName = req.body.theaterName || 'theater';
          
          if (Array.isArray(req.body.images) && req.body.images.length > 0) {
            // Delete old images
            if (existingProduct?.images && Array.isArray(existingProduct.images) && existingProduct.images.length > 0) {
              await deleteOldImages(existingProduct.images);
            } else if (existingProduct?.image) {
              await deleteFile(existingProduct.image).catch(err => 
                console.warn('Failed to delete old image:', err.message)
              );
            }
            
            // Process each image in the array
            for (const img of req.body.images) {
              if (typeof img === 'string' && img.startsWith('data:')) {
                // Base64 image - upload to GCS
                const gcsUrl = await uploadBase64ToGCS(img, productName, sanitizedTheaterName);
                imagesArray.push(gcsUrl);
                if (!imageUrl) imageUrl = gcsUrl; // First image is the main image
              } else if (typeof img === 'string' && (img.startsWith('http') || img.startsWith('https') || img.startsWith('gs://'))) {
                // Already a URL - use as-is (GCS URL or external URL)
                imagesArray.push(img);
                if (!imageUrl) imageUrl = img;
              } else if (typeof img === 'object' && img.url) {
                // Image object with URL
                if (img.url.startsWith('data:')) {
                  // Base64 in object
                  const gcsUrl = await uploadBase64ToGCS(img.url, productName, sanitizedTheaterName);
                  imagesArray.push(gcsUrl);
                  if (!imageUrl) imageUrl = gcsUrl;
                } else {
                  // URL in object
                  imagesArray.push(img.url);
                  if (!imageUrl) imageUrl = img.url;
                }
              }
            }
          } else {
            // Empty array - clear images and delete old ones
            if (existingProduct?.images && Array.isArray(existingProduct.images) && existingProduct.images.length > 0) {
              await deleteOldImages(existingProduct.images);
            } else if (existingProduct?.image) {
              await deleteFile(existingProduct.image).catch(err => 
                console.warn('Failed to delete old image:', err.message)
              );
            }
            imagesArray = [];
            imageUrl = null;
          }
          
          console.log('✅ Product images updated to GCS from images array:', imagesArray.length, 'images');
        } catch (uploadError) {
          console.error('❌ Images array upload to GCS failed:', uploadError);
          return BaseController.error(res, 'Failed to upload images to GCS', 500, {
            message: uploadError.message
          });
        }
      }
      // Priority 3: Handle single base64 image from request body
      else if (req.body.image) {
        try {
          // Delete old images if exists
          if (existingProduct?.images && Array.isArray(existingProduct.images) && existingProduct.images.length > 0) {
            await deleteOldImages(existingProduct.images);
          } else if (existingProduct?.image) {
            await deleteFile(existingProduct.image).catch(err => 
              console.warn('Failed to delete old image:', err.message)
            );
          }
          
          const productName = req.body.name || existingProduct?.name || 'product';
          const sanitizedTheaterName = req.body.theaterName || 'theater';
          imageUrl = await uploadBase64ToGCS(req.body.image, productName, sanitizedTheaterName);
          imagesArray = [imageUrl]; // Set as first image in array
          console.log('✅ Product image updated to GCS from base64:', imageUrl);
        } catch (uploadError) {
          console.error('❌ Base64 image upload to GCS failed:', uploadError);
          return BaseController.error(res, 'Failed to upload base64 image to GCS', 500, {
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
      // Update images if provided
      if (imagesArray !== null) {
        // imagesArray is explicitly provided - update it
        updateData.images = imagesArray;
        updateData.image = imageUrl || (imagesArray.length > 0 ? imagesArray[0] : null);
        updateData.imageUrl = imageUrl || (imagesArray.length > 0 ? imagesArray[0] : null);
      } else if (imageUrl) {
        // Single image URL provided - update main image only
        updateData.image = imageUrl;
        updateData.imageUrl = imageUrl;
        // If existing product has images array, update first image
        if (existingProduct?.images && Array.isArray(existingProduct.images) && existingProduct.images.length > 0) {
          updateData.images = [imageUrl, ...existingProduct.images.slice(1)];
        }
      }
      
      // CRITICAL: Handle boolean fields correctly - handle both boolean and string values
      if (req.body.isActive !== undefined) {
        let boolValue;
        if (typeof req.body.isActive === 'boolean') {
          boolValue = req.body.isActive;
        } else if (typeof req.body.isActive === 'string') {
          boolValue = req.body.isActive.toLowerCase() === 'true';
        } else {
          boolValue = !!req.body.isActive;
        }
        updateData.isActive = boolValue;
        console.log('✅ Controller: Saving isActive:', boolValue, '(from:', req.body.isActive, typeof req.body.isActive, ')');
      }
      
      // CRITICAL: Handle isAvailable field - this was missing!
      if (req.body.isAvailable !== undefined) {
        let boolValue;
        if (typeof req.body.isAvailable === 'boolean') {
          boolValue = req.body.isAvailable;
        } else if (typeof req.body.isAvailable === 'string') {
          boolValue = req.body.isAvailable.toLowerCase() === 'true';
        } else {
          boolValue = !!req.body.isAvailable;
        }
        updateData.isAvailable = boolValue;
        console.log('✅ Controller: Saving isAvailable:', boolValue, '(from:', req.body.isAvailable, typeof req.body.isAvailable, ')');
      }
      
      if (req.body.isFeatured !== undefined) {
        let boolValue;
        if (typeof req.body.isFeatured === 'boolean') {
          boolValue = req.body.isFeatured;
        } else if (typeof req.body.isFeatured === 'string') {
          boolValue = req.body.isFeatured.toLowerCase() === 'true';
        } else {
          boolValue = !!req.body.isFeatured;
        }
        updateData.isFeatured = boolValue;
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

