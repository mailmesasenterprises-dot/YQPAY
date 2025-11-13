# Environment Configuration Guide

This guide explains how to configure the YQPAY application using environment variables.

## Overview

Both the **backend** and **frontend** use `.env` files to manage configuration. This makes it easy to switch between development and production environments without changing code.

---

## Backend Configuration

### Location
`backend/.env`

### Quick Start
1. Copy the example file:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit `.env` with your settings

### Key Configuration Options

#### Environment & Server
```env
NODE_ENV=development              # development | production
PORT=8080                          # Server port
SERVER_HOST=0.0.0.0               # Bind address
```

#### URLs
```env
# Frontend URL - where your React app is hosted
FRONTEND_URL=http://localhost:3000

# Base URL for QR codes and API responses
BASE_URL=http://localhost:3000

# CORS allowed origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://192.168.1.2:3000
```

#### Database
```env
# Local Development
MONGODB_URI=mongodb://localhost:27017/yqpaynow

# Production (MongoDB Atlas)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
```

#### JWT Authentication
```env
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d
```

#### File Uploads
```env
MAX_FILE_SIZE=50mb
UPLOAD_DIR=uploads
```

#### Google Cloud Storage (Optional)
```env
GCS_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name
GCS_KEY_FILE=path/to/service-account.json
GCS_MOCK_MODE=true                # true for local storage, false for GCS
```

---

## Frontend Configuration

### Location
`frontend/.env`

### Quick Start
1. Copy the example file:
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. Edit `.env` with your settings

> **Important:** Vite requires all environment variables to start with `VITE_`

### Key Configuration Options

#### API Configuration
```env
# Backend API URL
VITE_API_URL=http://localhost:8080/api
VITE_API_TIMEOUT=10000
VITE_API_RETRY_ATTEMPTS=3
```

#### Application
```env
VITE_APP_NAME=YQPayNow
VITE_APP_VERSION=2.0.0
VITE_APP_BASE_URL=http://localhost:3000
```

#### Branding
```env
VITE_PRIMARY_COLOR=#6B0E9B
VITE_COMPANY_NAME=YQPayNow
VITE_LOGO_URL=/logo.png
```

#### Authentication
```env
VITE_TOKEN_KEY=yqpaynow_token
VITE_SESSION_TIMEOUT=3600000      # 1 hour in milliseconds
```

#### Payment Gateways
```env
VITE_RAZORPAY_KEY_ID=your_razorpay_key
VITE_STRIPE_PUBLIC_KEY=your_stripe_key
VITE_PAYPAL_CLIENT_ID=your_paypal_client_id
```

#### Feature Flags
```env
VITE_ENABLE_NOTIFICATIONS=true
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_CHAT=false
```

---

## Environment Profiles

### Development (Local)

**Backend (`backend/.env`):**
```env
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
BASE_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/yqpaynow
```

**Frontend (`frontend/.env`):**
```env
VITE_API_URL=http://localhost:8080/api
VITE_APP_BASE_URL=http://localhost:3000
```

### Production

**Backend (`backend/.env`):**
```env
NODE_ENV=production
FRONTEND_URL=https://yqpaynow.com
BASE_URL=https://yqpaynow.com
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/yqpay
CORS_ORIGINS=https://yqpaynow.com
```

**Frontend (`frontend/.env`):**
```env
VITE_API_URL=https://yqpaynow.com/api
VITE_APP_BASE_URL=https://yqpaynow.com
```

---

## Testing on Mobile/Network Devices

To test QR code scanning on mobile devices on your local network:

1. Find your local IP address:
   ```bash
   # Windows
   ipconfig
   
   # Linux/Mac
   ifconfig
   ```

2. Update backend `.env`:
   ```env
   CORS_ORIGINS=http://localhost:3000,http://192.168.1.2:3000,http://192.168.1.2:3001
   ```

3. Access from mobile:
   - Frontend: `http://192.168.1.2:3001`
   - Backend API: `http://192.168.1.2:8080/api`

---

## Configuration Access in Code

### Backend (Node.js)
```javascript
// Direct access
const dbUri = process.env.MONGODB_URI;
const port = process.env.PORT || 8080;

// Using config helper (recommended)
const { config } = require('./config/env');
const baseUrl = config.urls.base;
```

### Frontend (React/Vite)
```javascript
// Import config
import config from './config';

// Access configuration
const apiUrl = config.api.baseUrl;
const appName = config.app.name;
const isProd = config.app.isProduction;

// Using helpers
const fullUrl = config.helpers.getApiUrl('/theaters');
const token = config.helpers.getAuthToken();
```

---

## Security Best Practices

1. **Never commit `.env` files** - They're already in `.gitignore`
2. **Use different secrets** for development and production
3. **Rotate JWT secrets** periodically in production
4. **Use HTTPS** in production (`VITE_ENABLE_HTTPS=true`)
5. **Restrict CORS origins** to known domains in production
6. **Use environment variables** for all sensitive data (API keys, passwords, etc.)

---

## Common Issues

### Backend not connecting to frontend
- Check `CORS_ORIGINS` includes your frontend URL
- Verify `FRONTEND_URL` and `BASE_URL` are correct

### QR codes showing wrong URL
- Check `BASE_URL` in backend `.env`
- Ensure `VITE_APP_BASE_URL` in frontend `.env` matches

### API calls failing
- Verify `VITE_API_URL` points to running backend
- Check backend `PORT` matches frontend API URL

### Database connection failed
- Verify `MONGODB_URI` is correct
- Check MongoDB is running (local) or accessible (cloud)

---

## Quick Reference

| Purpose | Backend Variable | Frontend Variable |
|---------|------------------|-------------------|
| API URL | N/A | `VITE_API_URL` |
| Frontend URL | `FRONTEND_URL` | `VITE_APP_BASE_URL` |
| Database | `MONGODB_URI` | N/A |
| JWT Secret | `JWT_SECRET` | N/A |
| App Name | N/A | `VITE_APP_NAME` |
| Port | `PORT` | N/A |
| CORS | `CORS_ORIGINS` | N/A |

---

## Support

For more information:
- Backend config: `backend/config/env.js`
- Frontend config: `frontend/src/config/index.js`
- Example files: `.env.example` in both directories
