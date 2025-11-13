# Default QR Code Logo Configuration

## Overview
The "Default Logo" option in QR code generation uses the **Application Logo** from **Super Admin → Settings → General → Application Logo**.

This ensures a unified logo across your application and QR codes.

## How It Works

### Database Structure
The default logo is stored in the `settings` collection:
```javascript
{
  type: 'general',
  generalConfig: {
    logoUrl: '/images/logo.jpg',  // Application Logo from Settings page
    // ... other settings
  }
}
```

### Flow
1. **Upload Logo**: Super Admin uploads logo in Settings → General → Application Logo
2. **Storage**: Logo URL is saved to `generalConfig.logoUrl`
3. **QR Generation**: When "Default Logo" is selected, system uses this `logoUrl`
4. **Display**: Logo appears in both the app header and on generated QR codes

## Setting Up Default Logo

### Method 1: Through Settings UI (Recommended)
1. Login as Super Admin
2. Go to **Settings** → **General**
3. Find **Application Logo** section
4. Click "Choose Logo File"
5. Upload your logo (PNG, JPG, ICO, GIF supported)
6. Logo will be automatically saved and used for:
   - Browser tab icon (favicon)
   - Application header
   - Default QR code logo

### Method 2: Using the Script
1. Place your logo file in `frontend/public/images/logo.jpg`
2. Navigate to backend directory:
   ```bash
   cd backend
   ```
3. Run the initialization script:
   ```bash
   node scripts/init-default-logo.js
   ```

### Method 3: Manual Database Update
Use MongoDB Compass or command line:

```javascript
db.settings.updateOne(
  { type: 'general' },
  { 
    $set: { 
      'generalConfig.logoUrl': '/images/logo.jpg',
      lastUpdated: new Date()
    }
  },
  { upsert: true }
)
```

## Changing the Default Logo

### Option 1: Update the logo file
Replace `/frontend/public/images/logo.jpg` with your logo file

### Option 2: Update the logo URL
Edit `backend/scripts/init-default-logo.js`:
```javascript
const DEFAULT_LOGO_URL = '/your/logo/path.png';
```

Then run:
```bash
node scripts/init-default-logo.js
```

### Option 3: Use external URL
You can use any publicly accessible URL:
```javascript
const DEFAULT_LOGO_URL = 'https://your-domain.com/logo.png';
```

## Logo Requirements
- **Format**: PNG, JPG, or SVG
- **Size**: Recommended 512x512 pixels minimum
- **Location**: 
  - Local: Place in `frontend/public/images/`
  - External: Use full HTTPS URL
  - Cloud: Use Google Cloud Storage URL

## How It Works

1. **Settings Page** (`Settings.jsx`):
   - Super Admin uploads logo via "Application Logo" field
   - AutoUpload component handles file upload
   - Saves to `generalConfig.logoUrl` in settings collection
   - Updates favicon and app header automatically

2. **Frontend QR Generation** (`TheaterGenerateQR.jsx`):
   - Calls `/api/settings/general` on page load
   - Reads `logoUrl` field from response
   - Stores in `defaultLogoUrl` state
   - Uses this URL when "Default Logo" option is selected

3. **Backend Settings API** (`routes/settings.js`):
   - `GET /api/settings/general` returns all general settings
   - Includes `logoUrl` field from database
   - Falls back to empty string if not configured

4. **QR Code Generation** (`utils/singleQRGenerator.js`):
   - `getDefaultLogoUrl()` function fetches from settings
   - Reads `generalConfig.logoUrl` from database
   - Downloads logo image
   - Overlays it on the generated QR code

## Troubleshooting

### "No default logo configured" message
**Solution 1 - Upload via Settings (Easiest)**:
1. Login as Super Admin
2. Go to Settings → General
3. Upload logo in "Application Logo" section

**Solution 2 - Run the script**:
```bash
cd backend
node scripts/init-default-logo.js
```

**Solution 3 - Check database**:
```javascript
db.settings.findOne({ type: 'general' })
// Should show logoUrl field under generalConfig
```

### Logo not showing in QR code preview
- Clear browser cache and refresh page
- Check browser console for errors
- Verify logo file exists at the specified path
- Check that logo URL is accessible

### Logo uploaded but not showing
- Wait a few seconds and refresh the page
- Check that the logo was saved (Settings page should show current logo)
- Verify `logoUrl` is set in database:
  ```javascript
  db.settings.findOne({ type: 'general' }, { 'generalConfig.logoUrl': 1 })
  ```

## Files Modified
- `backend/scripts/init-default-logo.js` - Initialization script
- `backend/utils/singleQRGenerator.js` - Logo fetching logic
- `backend/routes/settings.js` - Settings API
- `frontend/src/pages/theater/TheaterGenerateQR.jsx` - Frontend UI

## Environment Variables
No additional environment variables needed. The logo URL is stored in the database.
