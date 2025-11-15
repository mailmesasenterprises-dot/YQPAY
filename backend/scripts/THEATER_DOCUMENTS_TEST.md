# Theater Documents Testing Guide

This guide explains how to test theater document uploads to Google Cloud Storage and verify they are saved in the database.

## Summary

The system now properly saves theater documents (theaterPhoto, logo, aadharCard, panCard, gstCertificate, fssaiCertificate, agreementCopy) to:
1. **Google Cloud Storage (GCS)** - Files are uploaded to GCS bucket
2. **MongoDB Database** - GCS URLs are saved in the theater's `documents` field

## Testing Steps

### Step 1: Verify Current Database State

Run the verification script to check existing theaters and their documents:

```bash
cd backend
node scripts/verify-theater-documents.js
```

This script will:
- Connect to MongoDB
- Find all theaters
- Check which theaters have documents saved
- Report on document status (GCS URLs, base64, missing, etc.)

### Step 2: Create a Theater with Documents

#### Option A: Using the Frontend (Recommended)

1. Make sure the backend server is running:
   ```bash
   cd backend
   npm start
   # or
   npm run dev
   ```

2. Open the frontend application in your browser
3. Navigate to the "Add Theater" page (usually `/add-theater` or similar)
4. Fill in all required theater fields
5. **Upload all document types:**
   - Theater Photo
   - Logo
   - Aadhar Card
   - PAN Card
   - GST Certificate
   - FSSAI Certificate
   - Agreement Copy
6. Submit the form
7. **Watch the backend server logs** for:
   - `📤 [TheaterController] Starting file upload...`
   - `✅ [TheaterController] Files uploaded to GCS successfully`
   - `📄 [TheaterService] Documents to save:`
   - `✅ [TheaterService] Verification: Documents persisted correctly`

#### Option B: Using the Test Script (Requires Admin Credentials)

If you have admin credentials, you can use the automated test script:

```bash
cd backend
node scripts/test-theater-documents.js [username] [password]
```

Example:
```bash
node scripts/test-theater-documents.js admin your_password
```

Or use environment variables:
```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=your_password node scripts/test-theater-documents.js
```

This script will:
- Login as super admin
- Create a theater with all document types (dummy files)
- Upload files to GCS
- Verify documents are saved in the database
- Clean up the test theater (unless `KEEP_TEST_DATA=true`)

### Step 3: Verify Documents Were Saved

After creating a theater, run the verification script again:

```bash
cd backend
node scripts/verify-theater-documents.js
```

You should see:
- ✅ The new theater listed
- ✅ All document types marked as "SAVED"
- ✅ GCS URLs shown for each document
- ✅ Confirmation that documents are in Google Cloud Storage

## Checking Server Logs

When creating a theater with documents, watch for these log messages in the backend console:

### File Upload Logs:
```
📤 [TheaterController] Starting file upload...
   Files received: theaterPhoto: 1 file(s), logo: 1 file(s), ...
   Upload folder: theater list/Test Theater Name
   ✅ Uploaded theaterPhoto.png (field: theaterPhoto) -> https://...
✅ [TheaterController] Files uploaded to GCS successfully
   Uploaded file URLs: {
     "theaterPhoto": "https://storage.googleapis.com/...",
     "logo": "https://storage.googleapis.com/...",
     ...
   }
```

### Service Layer Logs:
```
🔵 [TheaterService] Creating theater with fileUrls: { ... }
📄 [TheaterService] Documents to save: {
  "theaterPhoto": "https://...",
  "logo": "https://...",
  ...
}
💾 [TheaterService] Saving theater to database...
✅ [TheaterService] Theater saved: Test Theater (ID: ...)
📄 [TheaterService] Saved documents: { ... }
📊 Non-null documents count: 7
✅ [TheaterService] Verification: Documents persisted correctly (7 non-null docs)
```

### GCS Upload Utility Logs:
```
📤 [gcsUploadUtil] Starting upload of 7 file(s) to folder: theater list/...
   File 1: { fieldname: 'theaterPhoto', originalname: 'theaterPhoto.png', ... }
   ✅ Uploaded theaterPhoto.png (field: theaterPhoto) -> https://...
✅ [gcsUploadUtil] Upload complete. URL map: [ ... ]
```

## Troubleshooting

### Issue: Documents not appearing in database

**Check:**
1. Server logs for errors during upload
2. GCS configuration is correct (Settings → GCS)
3. MongoDB connection is working
4. Documents field is being set in `TheaterService.createTheater`

**Solution:**
- Check server logs for specific error messages
- Verify GCS credentials in Settings
- Run verification script to see current state

### Issue: Files uploaded but URLs are base64

**Check:**
1. GCS is configured correctly
2. `GCS_MOCK_MODE` environment variable is not set to `true`
3. GCS bucket exists and is accessible

**Solution:**
- Configure GCS in Settings page
- Ensure `GCS_MOCK_MODE` is not set or is `false`
- Check GCS bucket permissions

### Issue: Some documents saved but not all

**Check:**
1. All files were actually uploaded (check server logs)
2. Field names match expected names (theaterPhoto, logo, etc.)
3. Files are valid and not corrupted

**Solution:**
- Check server logs for upload errors
- Verify all files were selected in the form
- Try uploading one document type at a time

## Expected Behavior

When working correctly:

1. ✅ Files are uploaded to GCS bucket: `theater-canteen-uploads/theater list/[Theater Name]/`
2. ✅ GCS URLs (or signed URLs) are returned
3. ✅ URLs are saved in theater document's `documents` field
4. ✅ All 7 document types are saved correctly
5. ✅ Documents can be retrieved and displayed
6. ✅ Old files are deleted from GCS when updating

## File Structure in GCS

Documents are organized as:
```
theater-canteen-uploads/
  └── theater list/
      └── [Theater Name]/
          ├── theaterPhoto-[timestamp].png
          ├── logo-[timestamp].png
          ├── aadharCard-[timestamp].pdf
          ├── panCard-[timestamp].pdf
          ├── gstCertificate-[timestamp].pdf
          ├── fssaiCertificate-[timestamp].pdf
          └── agreementCopy-[timestamp].pdf
```

## Verification Checklist

After creating a theater with documents, verify:

- [ ] All files uploaded to GCS (check Google Cloud Console)
- [ ] Theater appears in database with `documents` field
- [ ] All 7 document types have URLs saved
- [ ] URLs are GCS URLs (not base64)
- [ ] Server logs show successful upload and save
- [ ] Verification script confirms documents saved
- [ ] Documents can be viewed/accessed from frontend

## Additional Notes

- Documents are saved in the `documents` nested object in the Theater schema
- Logo is also saved in `branding.logo` and `branding.logoUrl` for compatibility
- Agreement copy is also saved in `agreementDetails.copy`
- When updating a theater, old files in GCS are automatically deleted
- Files are uploaded with unique timestamps to prevent conflicts

