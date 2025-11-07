# Theater Banner CRUD Operations - Manual Testing Guide

## Prerequisites
- Backend server running on `localhost:8080`
- Valid authentication token
- Theater ID (from your URL: `68ff8837a541316c6ad54b79f`)

## API Endpoints

### Base URL
```
http://localhost:8080/api/theater-banners
```

---

## 1️⃣ GET - List All Banners

### Request
```http
GET /api/theater-banners/:theaterId?page=1&limit=10
Authorization: Bearer YOUR_TOKEN_HERE
```

### Example using curl:
```bash
curl -X GET "http://localhost:8080/api/theater-banners/68ff8837a541316c6ad54b79f?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response (200 OK):
```json
{
  "success": true,
  "data": {
    "banners": [
      {
        "_id": "...",
        "imageUrl": "https://storage.googleapis.com/...",
        "isActive": true,
        "sortOrder": 0,
        "createdAt": "2025-11-02T...",
        "updatedAt": "2025-11-02T..."
      }
    ],
    "pagination": {
      "totalItems": 1,
      "totalPages": 1,
      "currentPage": 1,
      "itemsPerPage": 10
    },
    "statistics": {
      "total": 1,
      "active": 1,
      "inactive": 0
    }
  }
}
```

---

## 2️⃣ POST - Create New Banner

### Request
```http
POST /api/theater-banners/:theaterId
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: multipart/form-data

Form Data:
- image: [FILE] (required - image file)
- isActive: true
- sortOrder: 0
```

### Example using curl:
```bash
curl -X POST "http://localhost:8080/api/theater-banners/68ff8837a541316c6ad54b79f" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/banner-image.jpg" \
  -F "isActive=true" \
  -F "sortOrder=0"
```

### Expected Response (201 Created):
```json
{
  "success": true,
  "message": "Banner created successfully",
  "data": {
    "banner": {
      "_id": "673652a1b2c3d4e5f6g7h8i9",
      "imageUrl": "https://storage.googleapis.com/...",
      "isActive": true,
      "sortOrder": 0,
      "createdAt": "2025-11-02T11:28:00.000Z",
      "updatedAt": "2025-11-02T11:28:00.000Z"
    }
  }
}
```

### Validation Errors (400 Bad Request):
```json
{
  "error": "Validation failed",
  "details": [
    {
      "msg": "Banner image is required",
      "param": "image"
    }
  ]
}
```

---

## 3️⃣ PUT - Update Existing Banner

### Request
```http
PUT /api/theater-banners/:theaterId/:bannerId
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: multipart/form-data

Form Data:
- image: [FILE] (optional - new image file)
- isActive: false
- sortOrder: 1
- removeImage: false
```

### Example using curl (Update status only):
```bash
curl -X PUT "http://localhost:8080/api/theater-banners/68ff8837a541316c6ad54b79f/673652a1b2c3d4e5f6g7h8i9" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "isActive=false"
```

### Example using curl (Update with new image):
```bash
curl -X PUT "http://localhost:8080/api/theater-banners/68ff8837a541316c6ad54b79f/673652a1b2c3d4e5f6g7h8i9" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/new-banner.jpg" \
  -F "isActive=true"
```

### Expected Response (200 OK):
```json
{
  "success": true,
  "message": "Banner updated successfully",
  "data": {
    "banner": {
      "_id": "673652a1b2c3d4e5f6g7h8i9",
      "imageUrl": "https://storage.googleapis.com/...",
      "isActive": false,
      "sortOrder": 1,
      "createdAt": "2025-11-02T11:28:00.000Z",
      "updatedAt": "2025-11-02T11:30:00.000Z"
    }
  }
}
```

### Error Response (404 Not Found):
```json
{
  "error": "Banner not found"
}
```

---

## 4️⃣ DELETE - Remove Banner

### Request
```http
DELETE /api/theater-banners/:theaterId/:bannerId
Authorization: Bearer YOUR_TOKEN_HERE
```

### Example using curl:
```bash
curl -X DELETE "http://localhost:8080/api/theater-banners/68ff8837a541316c6ad54b79f/673652a1b2c3d4e5f6g7h8i9" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response (200 OK):
```json
{
  "success": true,
  "message": "Banner deleted successfully"
}
```

### Error Response (404 Not Found):
```json
{
  "error": "Banner not found"
}
```

---

## Testing from Browser Console

Open your browser console on the banner management page and run:

### 1. Get Auth Token
```javascript
const token = localStorage.getItem('authToken');
console.log('Token:', token);
```

### 2. Get Theater ID
```javascript
const theaterId = window.location.pathname.split('/')[2];
console.log('Theater ID:', theaterId);
```

### 3. Test GET Request
```javascript
fetch(`http://localhost:8080/api/theater-banners/${theaterId}?page=1&limit=10`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(r => r.json())
.then(data => console.log('Banners:', data))
.catch(e => console.error('Error:', e));
```

### 4. Test POST Request (with file from input)
```javascript
// Assuming you have a file input with id="bannerImage"
const fileInput = document.querySelector('input[type="file"]');
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('isActive', 'true');

fetch(`http://localhost:8080/api/theater-banners/${theaterId}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})
.then(r => r.json())
.then(data => console.log('Created:', data))
.catch(e => console.error('Error:', e));
```

---

## Common Errors & Solutions

### 500 Internal Server Error
**Possible Causes:**
1. Database connection issue
2. GCS (Google Cloud Storage) configuration missing
3. Theater ID format invalid

**Check:**
```javascript
// Check backend console logs
// Verify MongoDB connection
// Verify GCS credentials in .env file
```

### 401 Unauthorized
**Solution:**
```javascript
// Get fresh token
const token = localStorage.getItem('authToken');
// Verify token is not expired
```

### 400 Bad Request - Image Required
**Solution:**
```javascript
// Ensure file is attached in FormData
formData.append('image', fileBlob, 'banner.jpg');
```

### 404 Not Found - Banner not found
**Solution:**
```javascript
// Verify banner ID exists
// Use correct bannerId from GET response
```

---

## Complete CRUD Flow Example

```javascript
const theaterId = '68ff8837a541316c6ad54b79f';
const token = localStorage.getItem('authToken');
const baseUrl = 'http://localhost:8080/api/theater-banners';

// 1. LIST banners
async function listBanners() {
  const response = await fetch(`${baseUrl}/${theaterId}?page=1&limit=10`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await response.json();
}

// 2. CREATE banner
async function createBanner(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('isActive', 'true');
  
  const response = await fetch(`${baseUrl}/${theaterId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  return await response.json();
}

// 3. UPDATE banner
async function updateBanner(bannerId, updates) {
  const formData = new FormData();
  Object.entries(updates).forEach(([key, value]) => {
    formData.append(key, value);
  });
  
  const response = await fetch(`${baseUrl}/${theaterId}/${bannerId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  return await response.json();
}

// 4. DELETE banner
async function deleteBanner(bannerId) {
  const response = await fetch(`${baseUrl}/${theaterId}/${bannerId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await response.json();
}

// Run complete CRUD test
async function testCRUD() {
  console.log('1. Listing banners...');
  const list1 = await listBanners();
  console.log('Initial count:', list1.data.statistics.total);
  
  console.log('2. Creating banner...');
  // Get file from input or create test file
  const created = await createBanner(yourImageFile);
  console.log('Created ID:', created.data.banner._id);
  
  console.log('3. Updating banner...');
  const updated = await updateBanner(created.data.banner._id, { isActive: 'false' });
  console.log('Updated status:', updated.data.banner.isActive);
  
  console.log('4. Deleting banner...');
  const deleted = await deleteBanner(created.data.banner._id);
  console.log('Deleted:', deleted.success);
  
  console.log('5. Verifying deletion...');
  const list2 = await listBanners();
  console.log('Final count:', list2.data.statistics.total);
}
```

---

## Quick Frontend Test (From UI)

1. **Open Banner Management Page**
   - Navigate to: `http://localhost:3000/theater-banner/68ff8837a541316c6ad54b79f`

2. **Test CREATE**
   - Click "CREATE NEW BANNER" button
   - Select an image file
   - Set status to "Active"
   - Click "CREATE BANNER"
   - ✅ Should show success and refresh list

3. **Test VIEW**
   - Click the eye icon on any banner row
   - ✅ Should show banner details in modal

4. **Test UPDATE**
   - Click the edit icon on any banner row
   - Change status or upload new image
   - Click "SAVE CHANGES"
   - ✅ Should update and refresh list

5. **Test DELETE**
   - Click the delete icon on any banner row
   - Confirm deletion
   - ✅ Should remove banner and refresh list

---

## Backend Logs to Monitor

Watch backend console for these messages:

**Successful Operations:**
```
✅ Banner created successfully
✅ Banner updated successfully
✅ Banner deleted successfully
```

**Errors:**
```
❌ Create banner error: ...
❌ Update banner error: ...
❌ Delete banner error: ...
🔥 Validation errors: ...
```

---

## Status Codes Reference

| Code | Meaning | When It Occurs |
|------|---------|----------------|
| 200  | OK | GET, PUT, DELETE successful |
| 201  | Created | POST successful |
| 400  | Bad Request | Validation failed, missing required fields |
| 401  | Unauthorized | Invalid/missing auth token |
| 404  | Not Found | Banner or theater not found |
| 500  | Internal Server Error | Database/GCS/Server error |

