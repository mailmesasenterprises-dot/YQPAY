# 🎯 Theater Banner CRUD - Quick Reference

## API Endpoints

```
BASE: http://localhost:8080/api/theater-banners
```

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/:theaterId?page=1&limit=10` | List banners | Optional |
| POST | `/:theaterId` | Create banner | ✅ Yes |
| PUT | `/:theaterId/:bannerId` | Update banner | ✅ Yes |
| DELETE | `/:theaterId/:bannerId` | Delete banner | ✅ Yes |

## Request/Response Examples

### 📖 GET - List Banners
```bash
GET /api/theater-banners/68ff8837a541316c6ad54b79f?page=1&limit=10
```
**Response:**
```json
{
  "success": true,
  "data": {
    "banners": [...],
    "pagination": { "totalItems": 5, "currentPage": 1 },
    "statistics": { "total": 5, "active": 3, "inactive": 2 }
  }
}
```

### ➕ POST - Create Banner
```bash
POST /api/theater-banners/68ff8837a541316c6ad54b79f
Content-Type: multipart/form-data

image=[FILE] ← REQUIRED
isActive=true
sortOrder=0
```
**Response:**
```json
{
  "success": true,
  "message": "Banner created successfully",
  "data": { "banner": { "_id": "...", "imageUrl": "..." } }
}
```

### ✏️ PUT - Update Banner
```bash
PUT /api/theater-banners/68ff8837a541316c6ad54b79f/[bannerId]
Content-Type: multipart/form-data

isActive=false
image=[FILE] ← Optional
```

### 🗑️ DELETE - Remove Banner
```bash
DELETE /api/theater-banners/68ff8837a541316c6ad54b79f/[bannerId]
```

## Frontend Testing (Browser Console)

```javascript
// 1. Get credentials
const token = localStorage.getItem('authToken');
const theaterId = window.location.pathname.split('/')[2];

// 2. Test GET
fetch(`http://localhost:8080/api/theater-banners/${theaterId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(console.log);

// 3. Test POST (with file from UI)
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('isActive', 'true');

fetch(`http://localhost:8080/api/theater-banners/${theaterId}`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
}).then(r => r.json()).then(console.log);
```

## Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| 500 Internal | Server not restarted | Restart backend: `cd backend && npm start` |
| 400 Bad Request | Image missing | Ensure image file attached in FormData |
| 401 Unauthorized | Token invalid | Get fresh token from localStorage |
| 404 Not Found | Wrong ID | Verify theaterId and bannerId |

## Files Modified

### Backend
- ✅ `backend/models/Banner.js` - MongoDB model
- ✅ `backend/routes/theater-banners.js` - API routes  
- ✅ `backend/server.js` - Route registration (line 166)

### Frontend
- ✅ `frontend/src/pages/theater/TheaterBanner.js` - Main component
- ✅ `frontend/src/utils/pageExtractor.js` - Page access
- ✅ `frontend/src/App.js` - Routing
- ✅ `frontend/src/components/theater/TheaterSidebar.js` - Menu
- ✅ `frontend/src/utils/rolePermissions.js` - Permissions

## UI Test Steps

1. **CREATE**: Click "CREATE NEW BANNER" → Upload image → Click "CREATE BANNER"
2. **VIEW**: Click eye icon 👁️ → See details modal
3. **EDIT**: Click edit icon ✏️ → Change status → Click "SAVE CHANGES"
4. **DELETE**: Click delete icon 🗑️ → Confirm → Banner removed

## Success Indicators

✅ **Working:**
- Table shows banners with images
- Statistics cards show counts
- Pagination controls work
- All 4 modals open/close properly
- Create requires image
- Edit updates without requiring image
- Delete removes banner and image

❌ **Not Working:**
- Check backend console for errors
- Verify backend server running on port 8080
- Check MongoDB connection
- Verify GCS credentials in .env
- Restart backend server

## Quick Restart

```bash
# Backend
cd backend
npm start

# Frontend  
cd frontend
npm start
```

---

**Status:** ✅ READY - All CRUD operations implemented!
