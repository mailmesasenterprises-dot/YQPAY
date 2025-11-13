# Troubleshooting Theaters API - Complete Guide

## Issue: API Not Responding / Loading Forever

### Step 1: Verify Backend Server is Running

**Check if server is running:**
```bash
# In backend directory
node server.js
# OR
npm start
```

**Expected output:**
```
🚀 YQPayNow Server running on 0.0.0.0:8080
✅ MongoDB connected with optimized pooling
```

### Step 2: Test API Endpoint Directly

**Option A: Using the test script:**
```bash
# From project root
node backend/test-theaters-api.js
```

**Option B: Using curl (if available):**
```bash
curl http://localhost:8080/api/theaters?page=1&limit=10
```

**Option C: Using browser:**
Open: `http://localhost:8080/api/theaters?page=1&limit=10`

### Step 3: Check Backend Console Logs

When you make a request, you should see:
```
📥 [GET /api/theaters] Request received: { query: {...}, headers: {...} }
🔍 [GET /api/theaters] MongoDB connection state: 1
🔍 [GET /api/theaters] Query params: { page: 1, limit: 10, ... }
🔍 [GET /api/theaters] Executing database query (attempt 1/3)...
✅ [GET /api/theaters] Query successful: Found X theaters, Total: Y
📤 [GET /api/theaters] Sending response: { success: true, ... }
```

### Step 4: Check MongoDB Connection

**If you see connection state 0 (disconnected):**
- Check MongoDB Atlas connection string in `.env`
- Verify network connectivity
- Check MongoDB Atlas IP whitelist

**Connection states:**
- `0` = disconnected ❌
- `1` = connected ✅
- `2` = connecting ⏳
- `3` = disconnecting ⏳

### Step 5: Check Frontend Console

**Open browser DevTools (F12) and check Console tab:**

**Expected logs:**
```
🔄 [TheaterList] useEffect triggered, calling fetchTheaters
📡 [TheaterList] Making API request to /theaters
🌐 [TheaterList] API URL: http://localhost:8080/api/theaters?page=1&limit=10
🌐 [optimizedFetch] Cache MISS, fetching: http://localhost:8080/api/theaters?...
📡 [optimizedFetch] Making network request to: http://localhost:8080/api/theaters?...
📥 [optimizedFetch] Response received: 200 OK
✅ [optimizedFetch] Response parsed successfully: {...}
📥 [TheaterList] API Response received: Success
```

### Step 6: Check Network Tab

**In browser DevTools Network tab:**
1. Filter by "Fetch/XHR"
2. Look for request to `/api/theaters?page=1&limit=10`
3. Check status:
   - `200` = Success ✅
   - `404` = Route not found ❌
   - `500` = Server error ❌
   - `504` = Gateway timeout ⏱️
   - `(pending)` = Request hanging ⏳

### Common Issues & Solutions

#### Issue 1: "ECONNREFUSED" Error
**Problem:** Backend server is not running
**Solution:** Start the backend server
```bash
cd backend
node server.js
```

#### Issue 2: Request Shows "(pending)" Forever
**Problem:** Database query is hanging
**Solution:** 
- Check MongoDB connection
- Check backend console for errors
- The new timeout protection should return 504 after 30 seconds

#### Issue 3: "404 Not Found"
**Problem:** Route not registered
**Solution:** 
- Check `backend/server.js` has: `app.use('/api/theaters', theaterRoutes);`
- Restart server after changes

#### Issue 4: Empty Response `{ success: true, data: [] }`
**Problem:** No theaters in database OR query filter too restrictive
**Solution:**
- Check database has theater documents
- Verify query filters (page, limit, isActive, search)

#### Issue 5: MongoDB Connection Timeout
**Problem:** MongoDB Atlas connection issues
**Solution:**
- Check `.env` file has correct `MONGODB_URI`
- Verify MongoDB Atlas IP whitelist includes your IP
- Check MongoDB Atlas cluster is running
- Increase timeout settings (already done in recent fixes)

### Recent Fixes Applied

✅ **Request Timeout Protection** - 30 second timeout prevents hanging
✅ **Query Timeout Protection** - 25 second query timeout
✅ **Fallback Error Handling** - Returns empty array instead of hanging
✅ **Better Logging** - Comprehensive console logs for debugging
✅ **Request Deduplication** - Prevents duplicate API calls
✅ **MongoDB Atlas Optimizations** - Increased timeouts for Atlas

### Quick Diagnostic Commands

```bash
# Check if port 8080 is in use
netstat -ano | findstr :8080

# Check MongoDB connection (if using local MongoDB)
mongosh "mongodb://localhost:27017/yqpaynow"

# Test API with curl (if available)
curl -v http://localhost:8080/api/theaters?page=1&limit=10
```

### Next Steps

1. **Start backend server** if not running
2. **Check backend console** for connection status
3. **Test API endpoint** directly in browser or with test script
4. **Check frontend console** for request/response logs
5. **Verify MongoDB connection** is active

If issues persist, share:
- Backend console output
- Frontend console logs
- Network tab screenshot
- Error messages

