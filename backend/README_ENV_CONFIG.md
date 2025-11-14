# Environment Configuration Guide

## Overview

All API URLs, database connections, and configuration settings are now centralized in the `.env` file. This guide explains how to configure your YQPAY backend.

## Quick Start

1. **Copy the example file:**
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Edit `.env` with your settings:**
   ```bash
   notepad .env  # Windows
   nano .env     # Linux/Mac
   ```

3. **Start the server:**
   ```bash
   npm run dev
   ```

## Configuration Files

- **`.env`** - Your actual environment variables (never commit this!)
- **`.env.example`** - Template with all available options
- **`config/env.js`** - Centralized configuration module

## Essential Settings

### Development Setup

```env
NODE_ENV=development
PORT=8080
FRONTEND_URL=http://localhost:3000
BASE_URL=http://localhost:3000
<!-- MONGODB_URI=mongodb://localhost:27017/yqpaynow -->
```

### Production Setup

```env
NODE_ENV=production
PORT=8080
FRONTEND_URL=https://yqpaynow.com
BASE_URL=https://yqpaynow.com
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/yqpay
```

## Configuration Categories

### 1. Server Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `8080` |
| `SERVER_HOST` | Bind address | `0.0.0.0` |

### 2. URL Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `FRONTEND_URL` | Frontend application URL | `http://localhost:3000` |
| `BASE_URL` | Base URL for QR codes | `http://localhost:3000` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | See below |

**CORS Origins Example:**
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://yqpaynow.com,http://192.168.1.2:3000
```

### 3. Database Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/yqpaynow` |

**MongoDB URI Formats:**
- Local: `mongodb://localhost:27017/database_name`
- Atlas: `mongodb+srv://user:pass@cluster.mongodb.net/database_name`

### 4. Authentication (JWT)

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for signing tokens | ⚠️ Change in production! |
| `JWT_EXPIRES_IN` | Token expiration | `24h` |
| `JWT_REFRESH_SECRET` | Refresh token secret | ⚠️ Change in production! |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration | `7d` |

### 5. File Uploads

| Variable | Description | Default |
|----------|-------------|---------|
| `MAX_FILE_SIZE` | Maximum upload size | `50mb` |
| `UPLOAD_DIR` | Local upload directory | `uploads` |
| `GCS_MOCK_MODE` | Use local storage instead of GCS | `true` |

### 6. Google Cloud Storage (Optional)

Only needed if `GCS_MOCK_MODE=false`:

| Variable | Description |
|----------|-------------|
| `GCS_PROJECT_ID` | GCP project ID |
| `GCS_BUCKET_NAME` | Storage bucket name |
| `GCS_KEY_FILE` | Path to service account key |

### 7. Rate Limiting

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_WINDOW_MS` | Time window (ms) | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `1000` |

## Testing on Mobile Devices

To test QR codes on your mobile device:

1. Find your computer's local IP:
   ```bash
   # Windows
   ipconfig
   
   # Linux/Mac
   ifconfig
   ```

2. Update your `.env`:
   ```env
   FRONTEND_URL=http://192.168.1.100:3000
   BASE_URL=http://192.168.1.100:3000
   CORS_ORIGINS=http://localhost:3000,http://192.168.1.100:3000
   ```

3. Make sure your mobile and computer are on the same network.

## Using the Configuration Module

Import the centralized config in your code:

```javascript
const { config, getQRBaseUrl, getFullUrl } = require('./config/env');

// Access configuration
console.log(config.server.port);
console.log(config.database.uri);

// Get QR code base URL
const qrUrl = getQRBaseUrl();

// Convert relative to full URL
const fullUrl = getFullUrl('/images/logo.png');
```

## Security Best Practices

### ⚠️ Never commit `.env` file!

Add to `.gitignore`:
```
.env
.env.local
.env.*.local
```

### 🔒 Production Checklist

- [ ] Use strong, unique JWT secrets
- [ ] Use HTTPS URLs for `FRONTEND_URL` and `BASE_URL`
- [ ] Use MongoDB Atlas with authentication
- [ ] Restrict CORS origins to trusted domains only
- [ ] Enable rate limiting
- [ ] Set `NODE_ENV=production`
- [ ] Use environment-specific `.env` files

### 🔐 Secret Management

For production, consider using:
- **Google Cloud Secret Manager**
- **AWS Secrets Manager**
- **Azure Key Vault**
- **HashiCorp Vault**

## Troubleshooting

### Server won't start

**Error:** `Missing required environment variables`

**Solution:** Ensure `MONGODB_URI` and `JWT_SECRET` are set in `.env`

### CORS errors in browser

**Error:** `Access to fetch blocked by CORS policy`

**Solution:** Add your frontend URL to `CORS_ORIGINS`:
```env
CORS_ORIGINS=http://localhost:3000,http://your-frontend-url.com
```

### QR codes have wrong URL

**Issue:** QR codes point to localhost instead of production domain

**Solution:** Update `BASE_URL` in `.env`:
```env
BASE_URL=https://your-production-domain.com
```

### MongoDB connection failed

**Error:** `MongooseServerSelectionError`

**Solution:** Check your `MONGODB_URI`:
- Local: Ensure MongoDB is running
- Atlas: Verify credentials and whitelist your IP

## Migration from Config Files

Previous hardcoded values have been replaced:

| Old Location | New Location | Variable |
|--------------|--------------|----------|
| `config/mongodb.json` | `.env` | `MONGODB_URI` |
| Hardcoded `http://localhost:3000` | `.env` | `FRONTEND_URL` |
| Hardcoded `https://yqpaynow.com` | `.env` | `BASE_URL` |
| CORS array in `server.js` | `.env` | `CORS_ORIGINS` |

## Support

For issues or questions:
1. Check this documentation
2. Review `.env.example` for all options
3. Check server logs for specific errors
4. Ensure all required variables are set

## Related Files

- `backend/.env` - Your environment variables
- `backend/.env.example` - Configuration template
- `backend/config/env.js` - Configuration module
- `backend/server.js` - Main server file
- `backend/README_ENV_CONFIG.md` - This file
