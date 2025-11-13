# Backend MVC Structure - Complete Guide

## 📁 New Folder Structure

```
backend/
├── controllers/          # HTTP request/response handlers
│   ├── BaseController.js
│   └── TheaterController.js
├── services/            # Business logic layer
│   ├── BaseService.js
│   └── TheaterService.js
├── validators/          # Input validation rules
│   └── theaterValidator.js
├── routes/              # Route definitions (thin layer)
│   ├── theaters.js      # OLD (kept for reference)
│   └── theaters.mvc.js  # NEW MVC pattern
├── models/              # Database models (unchanged)
├── middleware/          # Express middleware (unchanged)
└── utils/              # Utility functions (unchanged)
```

## 🎯 MVC Pattern Benefits

### 1. **Separation of Concerns**
- **Routes**: Only routing, middleware, and validation
- **Controllers**: HTTP request/response handling
- **Services**: Business logic and database operations
- **Models**: Data structure definitions

### 2. **Code Reduction**
- **Before**: 955 lines in routes/theaters.js
- **After**: 
  - Routes: ~80 lines (theaters.mvc.js)
  - Controller: ~580 lines (TheaterController.js)
  - Service: ~300 lines (TheaterService.js)
  - **Total**: ~960 lines (similar, but much better organized)

### 3. **Reusability**
- BaseController: Common response methods (success, error, paginated)
- BaseService: Common database operations (findAll, findById, create, update, delete)
- Easy to extend for new modules

### 4. **Maintainability**
- Easy to find code (know where to look)
- Changes are localized
- Less code duplication
- Better error handling

### 5. **Testability**
- Services can be tested independently
- Controllers can be mocked easily
- Clear dependencies

## 🚀 Performance Optimizations

### Database Queries
- All queries use `maxTimeMS` for timeouts
- Parallel queries with `Promise.all`
- Proper indexing support
- Lean queries for better performance

### Error Handling
- Centralized error responses
- Consistent error format
- Development vs production error details

### Response Format
- Consistent success/error structure
- Proper HTTP status codes
- Pagination support

## 📝 Usage Example

### Old Way (routes/theaters.js):
```javascript
router.get('/', async (req, res) => {
  try {
    // 50+ lines of business logic here
    const filter = {};
    // ... build filter
    const theaters = await Theater.find(filter)...
    // ... process data
    res.json({ success: true, data: theaters });
  } catch (error) {
    // error handling
  }
});
```

### New Way (MVC):
```javascript
// routes/theaters.mvc.js (thin)
router.get('/', 
  theaterValidator.getAll, 
  validate, 
  BaseController.asyncHandler(TheaterController.getAll)
);

// controllers/TheaterController.js
static async getAll(req, res) {
  const result = await theaterService.getTheaters(req.query);
  return BaseController.paginated(res, result.data, result.pagination);
}

// services/TheaterService.js
async getTheaters(queryParams) {
  const filter = this.buildFilter(queryParams);
  return this.findAll(filter, options);
}
```

## ✅ What's Been Done

1. ✅ Created MVC folder structure
2. ✅ Refactored theaters module to MVC
3. ✅ Created BaseController and BaseService
4. ✅ Added proper validation
5. ✅ Optimized database queries
6. ✅ Updated server.js to use new routes

## 🔄 Migration Status

- ✅ **Theaters**: Fully migrated to MVC
- ⏳ **Products**: Next to migrate
- ⏳ **Orders**: Next to migrate
- ⏳ **Other modules**: To be migrated

## 🧪 Testing

All existing endpoints should work exactly the same:
- GET /api/theaters
- GET /api/theaters/:id
- POST /api/theaters
- PUT /api/theaters/:id
- DELETE /api/theaters/:id
- GET /api/theaters/expiring-agreements
- GET /api/theaters/:id/dashboard
- GET /api/theaters/:theaterId/agreement-status
- PUT /api/theaters/:id/password

## 📚 Next Steps

1. Test all theater endpoints
2. Migrate other modules following the same pattern
3. Remove old route files once migration is complete
4. Add unit tests for services and controllers

