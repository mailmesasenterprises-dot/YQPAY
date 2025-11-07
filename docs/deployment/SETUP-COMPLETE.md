# ✅ QR Code Production Setup - CONFIGURED

## Configuration Complete!

Your QR code system is now configured to use your Google Cloud Run production URLs.

---

## 🎯 What Was Updated

### Backend Configuration
**File:** `backend/.env`
```env
FRONTEND_URL=https://yqpay-78918378061.us-central1.run.app
```

**Impact:** 
- All NEW QR codes will use this production URL
- QR codes will work from anywhere in the world
- No need for local network access

### Frontend Configuration
**File:** `frontend/.env`
```env
REACT_APP_API_URL=https://yqpay-78918378061.us-central1.run.app/api
REACT_APP_BACKEND_URL=https://yqpay-78918378061.us-central1.run.app
```

**Impact:**
- Frontend will connect to production backend
- API calls will use production endpoints

---

## 📱 How QR Codes Will Work Now

### When You Generate a QR Code:

**Before (Local Development):**
```
QR Code URL: http://172.20.10.2:3001/menu/theaterId?qrName=Screen1
❌ Only works on local network
❌ Breaks when network changes
❌ Cannot access from internet
```

**After (Production):**
```
QR Code URL: https://yqpay-78918378061.us-central1.run.app/menu/theaterId?qrName=Screen1
✅ Works from anywhere
✅ Accessible via internet
✅ Permanent URL
```

---

## ⚠️ CRITICAL: What You MUST Do Now

### Step 1: Restart Your Backend Server

The backend needs to reload the new environment variables.

**Stop current server** (if running):
- Press `Ctrl + C` in the terminal running backend

**Start backend again:**
```bash
cd backend
npm start
```

### Step 2: DELETE All Old QR Codes

**Why?** Old QR codes still have the local IP embedded: `http://172.20.10.2:3001`

**How:**
1. Login to Super Admin panel
2. Go to "Generate QR" or "QR Management"
3. Select each theater
4. Delete all existing QR codes

### Step 3: Generate NEW QR Codes

**Steps:**
1. In Super Admin panel, go to "Generate QR"
2. Select theater
3. Generate new QR codes
4. Download and check the URL

**Verify the QR code URL shows:**
```
https://yqpay-78918378061.us-central1.run.app/menu/...
```

### Step 4: Test One QR Code

Before printing all QR codes:

1. Download ONE test QR code
2. Scan with your mobile phone
3. Verify it opens the production URL
4. Check if menu loads correctly
5. Test adding items to cart
6. If everything works, proceed to generate all QR codes

### Step 5: Print and Distribute

Once verified:
1. Generate QR codes for all theaters/screens
2. Download all QR codes
3. Print QR codes
4. Distribute to theaters

---

## 🔍 How to Verify Configuration

### Check Backend Environment Variable:

```bash
cd backend
node -e "console.log('FRONTEND_URL:', process.env.FRONTEND_URL)"
```

**Expected output:**
```
FRONTEND_URL: https://yqpay-78918378061.us-central1.run.app
```

### Check QR Code Generation Logs:

When you generate a QR code, look for this log in backend terminal:

```
🌐 QR Code Base URL: https://yqpay-78918378061.us-central1.run.app (Production URL)
```

**NOT this:**
```
🌐 QR Code Base URL: http://172.20.10.2:3001 (Network IP: 172.20.10.2)
```

---

## 🎯 Testing Checklist

After restarting backend and before generating QR codes:

- [ ] Backend server restarted
- [ ] Environment variable loaded (check logs)
- [ ] Frontend can connect to backend
- [ ] Login to Super Admin works
- [ ] Can access QR Management page

After generating NEW QR codes:

- [ ] Old QR codes deleted
- [ ] New QR code generated
- [ ] Download test QR code
- [ ] Scan with mobile phone
- [ ] URL shows: `https://yqpay-78918378061.us-central1.run.app/menu/...`
- [ ] Menu page loads
- [ ] Can add items to cart
- [ ] Checkout works

---

## 🔧 Troubleshooting

### Problem: QR code still shows old URL (172.20.10.2)

**Solution:**
1. Check if backend server was restarted
2. Verify .env file has correct URL
3. Delete old QR codes
4. Generate fresh QR codes

### Problem: "Invalid QR Code" or "Page Not Found"

**Solution:**
1. Verify production backend is running
2. Check if domain is accessible
3. Test URL manually in browser

### Problem: Backend server won't start

**Solution:**
```bash
cd backend
npm install
npm start
```

Check for errors in terminal output.

---

## 📊 Current Configuration Summary

| Setting | Value |
|---------|-------|
| **Backend URL** | `https://yqpay-78918378061.us-central1.run.app` |
| **Frontend URL** | `https://yqpay-78918378061.us-central1.run.app` |
| **API Endpoint** | `https://yqpay-78918378061.us-central1.run.app/api` |
| **QR Code Base URL** | `https://yqpay-78918378061.us-central1.run.app` |
| **Region** | `us-central1` (USA - Iowa) |
| **Environment** | Production |

---

## 🎉 Next Steps

1. **Restart backend server** to load new configuration
2. **Delete all old QR codes** from admin panel
3. **Generate new QR codes** with production URL
4. **Test one QR code** before printing all
5. **Print and distribute** to theaters

---

## 📞 Quick Reference Commands

```bash
# Restart Backend
cd backend
npm start

# Check Environment Variable
node -e "console.log(process.env.FRONTEND_URL)"

# Start Frontend (if needed)
cd frontend
npm start
```

---

## ✅ You're All Set!

Your system is now configured to generate production-ready QR codes!

**Remember:** 
- Restart backend server
- Delete old QR codes
- Generate new QR codes
- Test before distributing

🎯 **The QR codes you generate now will work in production!**
