# Deploy QR Code Fix to All PCs

## 🎯 What Was Fixed
- QR codes now **ALWAYS** use Google Cloud URL: `https://yqpay-78918378061.us-central1.run.app`
- Network IP addresses (192.168.x.x, 169.254.x.x) are **COMPLETELY DISABLED**
- localhost fallback is **REMOVED**

## 📝 Files That Were Changed

### Backend Files (CRITICAL):
1. `backend/utils/singleQRGenerator.js` - Line 271-272
2. `backend/utils/qrCodeGenerator.js` - Lines 216, 311
3. `backend/.env` - FRONTEND_URL setting

---

## 🚀 METHOD 1: Using Git (RECOMMENDED)

### On THIS PC (192.168.1.6):
```powershell
# 1. Stage the critical files
cd "d:\YQPAY\10 - Copy"
git add backend/utils/singleQRGenerator.js
git add backend/utils/qrCodeGenerator.js
git add backend/.env

# 2. Commit the changes
git commit -m "Fix: QR codes now use Google Cloud URL only (no network IP)"

# 3. Push to repository
git push origin master
```

### On EVERY OTHER PC:
```powershell
# 1. Navigate to project folder
cd "d:\YQPAY\10 - Copy"

# 2. Pull latest changes
git pull origin master

# 3. Restart backend server
# Kill existing backend process first:
taskkill /F /IM node.exe

# Then start fresh:
cd backend
npm run dev
```

---

## 🚀 METHOD 2: Manual Copy (If No Git)

### Step 1: Copy Files FROM This PC

**Copy these 3 files:**
```
Source PC: d:\YQPAY\10 - Copy\backend\utils\singleQRGenerator.js
Source PC: d:\YQPAY\10 - Copy\backend\utils\qrCodeGenerator.js
Source PC: d:\YQPAY\10 - Copy\backend\.env
```

**Use USB drive, network share, or cloud storage (Google Drive, Dropbox, etc.)**

### Step 2: Paste Files TO Every Other PC

**Paste to EXACT same locations:**
```
Target PC: d:\YQPAY\10 - Copy\backend\utils\singleQRGenerator.js
Target PC: d:\YQPAY\10 - Copy\backend\utils\qrCodeGenerator.js
Target PC: d:\YQPAY\10 - Copy\backend\.env
```

**⚠️ IMPORTANT: Overwrite existing files!**

### Step 3: Restart Backend on Each PC

```powershell
# Open PowerShell or Command Prompt

# 1. Stop any running backend
taskkill /F /IM node.exe

# 2. Navigate to backend folder
cd "d:\YQPAY\10 - Copy\backend"

# 3. Start backend server
npm run dev
```

---

## ✅ VERIFICATION

### After deployment on each PC, verify:

1. **Check server logs** when backend starts:
   ```
   🎯 QR CODE CONFIGURATION:
      FRONTEND_URL:    https://yqpay-78918378061.us-central1.run.app
      ✅ QR codes will use: https://yqpay-78918378061.us-central1.run.app
   ```

2. **Generate a TEST QR code** and check database:
   - `qrCodeData` field should have: `https://yqpay-78918378061.us-central1.run.app`
   - Should NOT have: `192.168.x.x` or `169.254.x.x` or `localhost`

3. **Test the QR code** - scan it and verify it works

---

## 🔧 TROUBLESHOOTING

### If QR codes still use network IP:

**Problem:** Backend not restarted
```powershell
# Solution: Kill all node processes and restart
taskkill /F /IM node.exe
cd "d:\YQPAY\10 - Copy\backend"
npm run dev
```

**Problem:** Wrong files copied
```
# Solution: Verify file contents
# Open: backend/utils/singleQRGenerator.js
# Search for: "DEFAULT_PRODUCTION_URL"
# Should see: 'https://yqpay-78918378061.us-central1.run.app'
```

**Problem:** .env not updated
```
# Solution: Open backend/.env
# Verify this line exists:
FRONTEND_URL=https://yqpay-78918378061.us-central1.run.app
```

---

## 📊 DEPLOYMENT CHECKLIST

Use this checklist for each PC:

- [ ] Copy 3 files (singleQRGenerator.js, qrCodeGenerator.js, .env)
- [ ] Paste to correct locations (backend/utils/ and backend/)
- [ ] Stop existing backend server (taskkill)
- [ ] Start backend server (npm run dev)
- [ ] Verify server logs show Google Cloud URL
- [ ] Generate test QR code
- [ ] Check database - confirm Google Cloud URL
- [ ] Scan QR code - confirm it works

---

## 🎯 FINAL RESULT

After deploying to all PCs:
- ✅ ALL QR codes from ANY PC will use: `https://yqpay-78918378061.us-central1.run.app`
- ✅ QR codes will work on ALL 100+ cinema systems
- ✅ No more network IP issues
- ✅ Production-ready deployment

---

## 🆘 QUICK REFERENCE

**Files to copy:**
```
backend/utils/singleQRGenerator.js
backend/utils/qrCodeGenerator.js
backend/.env
```

**Command to restart backend:**
```powershell
taskkill /F /IM node.exe ; cd "d:\YQPAY\10 - Copy\backend" ; npm run dev
```

**What to verify:**
- Server logs show Google Cloud URL
- Test QR code has Google Cloud URL in database
- QR code works when scanned

---

## 📞 SUPPORT

If you encounter issues:
1. Check server logs for errors
2. Verify file contents match this PC
3. Ensure .env has FRONTEND_URL set
4. Restart backend server
5. Clear browser cache and reload frontend

---

**Created:** October 30, 2025  
**Version:** 1.0  
**Author:** GitHub Copilot
