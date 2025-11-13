# MVC API Migration Guide

## Overview
The backend has been migrated to MVC pattern. All API responses now follow a consistent format:
- **Success**: `{ success: true, message: '...', data: {...}, pagination: {...} }`
- **Error**: `{ success: false, error: '...', message: '...' }`

## New API Service Methods

### Using the Updated ApiService

```javascript
import apiService from '../services/apiService';

// For paginated lists (theaters, roles, products, orders, etc.)
const result = await apiService.getRoles(theaterId, { page: 1, limit: 10, search: '' });
// Returns: { items: [], pagination: {}, message: '' }

// For single items
const theater = await apiService.getTheater(theaterId);
// Returns: theater object or null

// For creating/updating
const newRole = await apiService.createRole({ theaterId, name: '...', ... });
// Returns: created role data

// For lists (non-paginated)
const roles = await apiService.getList('/roles', { theaterId });
// Returns: array of roles
```

## Migration Steps

### 1. Replace Direct Fetch Calls

**Before:**
```javascript
const response = await fetch(`${config.api.baseUrl}/roles?theaterId=${theaterId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const data = await response.json();
if (data.success && data.data) {
  setRoles(data.data.roles || []);
}
```

**After:**
```javascript
import apiService from '../services/apiService';

const result = await apiService.getRoles(theaterId, { page: 1, limit: 10 });
setRoles(result.items);
setPagination(result.pagination);
```

### 2. Handle Paginated Responses

**Before:**
```javascript
const response = await fetch(`${config.api.baseUrl}/theaters?page=${page}&limit=${limit}`);
const data = await response.json();
if (data.success && data.data) {
  setTheaters(data.data);
  setPagination(data.pagination);
}
```

**After:**
```javascript
const result = await apiService.getTheaters({ page, limit, search });
setTheaters(result.items);
setPagination(result.pagination);
```

### 3. Handle Single Item Responses

**Before:**
```javascript
const response = await fetch(`${config.api.baseUrl}/theaters/${theaterId}`);
const data = await response.json();
if (data.success && data.data) {
  setTheater(data.data);
}
```

**After:**
```javascript
const theater = await apiService.getTheater(theaterId);
if (theater) {
  setTheater(theater);
}
```

### 4. Handle Create/Update/Delete

**Before:**
```javascript
const response = await fetch(`${config.api.baseUrl}/roles`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify(roleData)
});
const data = await response.json();
if (data.success) {
  // Handle success
}
```

**After:**
```javascript
try {
  const newRole = await apiService.createRole(roleData);
  // newRole contains the created role data
  console.log('Role created:', newRole);
} catch (error) {
  console.error('Error creating role:', error.message);
}
```

## Response Handler Utilities

If you need more control, use the response handlers directly:

```javascript
import { 
  handleMVCResponse, 
  handlePaginatedResponse, 
  handleListResponse,
  handleItemResponse 
} from '../utils/mvcResponseHandler';

// For custom fetch calls
const response = await fetch(url, options);
const data = await response.json();
const result = handlePaginatedResponse(data);
// result.items, result.pagination, result.message
```

## Updated Endpoints

### Roles
- `GET /api/roles?theaterId=...` → `apiService.getRoles(theaterId, params)`
- `GET /api/roles/:id` → `apiService.getRole(roleId)`
- `POST /api/roles` → `apiService.createRole(data)`
- `PUT /api/roles/:id` → `apiService.updateRole(roleId, data)`
- `DELETE /api/roles/:id` → `apiService.deleteRole(roleId)`

### Theaters
- `GET /api/theaters` → `apiService.getTheaters(params)`
- `GET /api/theaters/:id` → `apiService.getTheater(id)`
- `POST /api/theaters` → `apiService.createTheater(data)`
- `PUT /api/theaters/:id` → `apiService.updateTheater(id, data)`
- `DELETE /api/theaters/:id` → `apiService.deleteTheater(id)`

### Products
- Use `apiService.getPaginated('/theater-products', params)`
- Use `apiService.getItem('/theater-products/:id')`
- Use `apiService.postData('/theater-products', data)`

### Orders
- Use `apiService.getPaginated('/orders', params)`
- Use `apiService.getItem('/orders/:id')`
- Use `apiService.postData('/orders', data)`

### Settings
- Use `apiService.getData('/settings')`
- Use `apiService.putData('/settings', data)`

### Stock
- Use `apiService.getPaginated('/theater-stock', params)`
- Use `apiService.postData('/theater-stock', data)`

## Error Handling

All methods throw errors on failure. Always use try-catch:

```javascript
try {
  const result = await apiService.getRoles(theaterId);
  setRoles(result.items);
} catch (error) {
  console.error('Error fetching roles:', error.message);
  setError(error.message);
  setRoles([]);
}
```

## Testing Checklist

For each updated page:
- [ ] Data loads correctly
- [ ] Pagination works
- [ ] Search/filter works
- [ ] Create/Update/Delete works
- [ ] Error messages display properly
- [ ] Loading states work
- [ ] Empty states display when no data

