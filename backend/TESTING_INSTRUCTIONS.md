# 🧪 Testing Instructions for Migrated MVC Modules

## ✅ 8 Modules Migrated

1. Theaters
2. Products
3. Orders
4. Settings
5. Upload
6. Stock
7. Dashboard
8. Payments

## 🚀 How to Test

### Prerequisites
1. Start your backend server:
   ```bash
   cd backend
   npm start
   ```

2. (Optional) Set test token if needed:
   ```bash
   export TEST_TOKEN=your_auth_token_here
   ```

### Automated Testing

```bash
# Run the test script
cd backend
node test-migrated-modules.js
```

### Manual Testing

#### 1. Theaters
```bash
curl http://localhost:8080/api/theaters?page=1&limit=10
```

#### 2. Products
```bash
curl http://localhost:8080/api/theater-products/THEATER_ID?page=1&limit=10
```

#### 3. Orders
```bash
curl http://localhost:8080/api/orders/theater/THEATER_ID?page=1&limit=10
```

#### 4. Settings
```bash
curl http://localhost:8080/api/settings/general
```

#### 5. Upload
```bash
# Requires file upload - test via Postman or frontend
curl -X POST http://localhost:8080/api/upload/image
```

#### 6. Stock
```bash
curl http://localhost:8080/api/theater-stock/THEATER_ID/PRODUCT_ID
```

#### 7. Dashboard
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/api/dashboard/super-admin-stats
```

#### 8. Payments
```bash
curl http://localhost:8080/api/payments/config/THEATER_ID/kiosk
```

## ✅ Expected Results

- All endpoints should return 200 status (or 401/404 if auth/data missing)
- Response should have `success: true` or valid data structure
- No errors in server console

## 🗑️ After Testing - Remove Old Files

Once all tests pass:

```bash
# Use the cleanup script (safely moves to backup)
node backend/scripts/remove-old-routes.js
```

This will move old route files to `backend/routes/_old_backup/`

