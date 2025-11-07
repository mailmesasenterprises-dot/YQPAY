# 🚀 Google Cloud Run Deployment Guide

## Your Current Setup

**Backend URL:** `https://yqpay-78918378061.us-central1.run.app`  
**Frontend URL:** `https://yqpay-78918378061.us-central1.run.app`  
**Region:** `us-central1`

---

## ⚠️ CRITICAL: QR Code Configuration

### Current QR Code Status

**Before deployment, you MUST:**

1. Set the environment variable in Google Cloud Run:
   ```
   FRONTEND_URL=https://yqpay-78918378061.us-central1.run.app
   ```

2. **REGENERATE ALL QR CODES** after setting the environment variable

3. **DO NOT** use any QR codes generated in local development (they contain local IP addresses)

---

## 📋 Deployment Checklist

### Step 1: Prepare Backend Environment Variables

Set these in Google Cloud Run Console:

```bash
FRONTEND_URL=https://yqpay-78918378061.us-central1.run.app
NODE_ENV=production
MONGODB_URI=<your-mongodb-atlas-connection-string>
FIREBASE_PROJECT_ID=<your-firebase-project-id>
FIREBASE_PRIVATE_KEY=<your-firebase-private-key>
FIREBASE_CLIENT_EMAIL=<your-firebase-client-email>
GCS_BUCKET_NAME=<your-gcs-bucket-name>
GCS_PROJECT_ID=<your-gcp-project-id>
GCS_PRIVATE_KEY=<your-gcs-private-key>
GCS_CLIENT_EMAIL=<your-gcs-service-account-email>
JWT_SECRET=<generate-strong-random-secret>
SESSION_SECRET=<generate-strong-random-secret>
CORS_ORIGIN=https://yqpay-78918378061.us-central1.run.app
```

### Step 2: Set Environment Variables in Google Cloud Run

#### Option 1: Using Google Cloud Console (Web UI)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **Cloud Run** → Select your service: `yqpay`
3. Click **"EDIT & DEPLOY NEW REVISION"**
4. Scroll to **"Variables & Secrets"** section
5. Click **"+ ADD VARIABLE"** for each environment variable
6. Add all variables from the list above
7. Click **"DEPLOY"**

#### Option 2: Using gcloud CLI

```bash
# Set multiple environment variables at once
gcloud run services update yqpay \
  --region=us-central1 \
  --update-env-vars="FRONTEND_URL=https://yqpay-78918378061.us-central1.run.app,NODE_ENV=production,MONGODB_URI=your-mongodb-uri,FIREBASE_PROJECT_ID=your-project-id,JWT_SECRET=your-jwt-secret,CORS_ORIGIN=https://yqpay-78918378061.us-central1.run.app"
```

Or set from a file:

```bash
# Create env.yaml
cat > env.yaml << EOF
FRONTEND_URL: https://yqpay-78918378061.us-central1.run.app
NODE_ENV: production
MONGODB_URI: your-mongodb-uri
FIREBASE_PROJECT_ID: your-firebase-project-id
CORS_ORIGIN: https://yqpay-78918378061.us-central1.run.app
EOF

# Apply environment variables
gcloud run services update yqpay \
  --region=us-central1 \
  --env-vars-file=env.yaml
```

### Step 3: Deploy Backend

```bash
# Navigate to backend directory
cd backend

# Deploy to Cloud Run
gcloud run deploy yqpay \
  --source . \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars FRONTEND_URL=https://yqpay-78918378061.us-central1.run.app
```

### Step 4: Deploy Frontend

```bash
# Navigate to frontend directory
cd frontend

# Build production version
npm run build

# Deploy to Cloud Run (if frontend is also on Cloud Run)
gcloud run deploy yqpay-frontend \
  --source . \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated
```

---

## 🔍 Verify Deployment

### 1. Check Backend Health

```bash
curl https://yqpay-78918378061.us-central1.run.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-30T..."
}
```

### 2. Check Environment Variables

```bash
# View current environment variables
gcloud run services describe yqpay \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### 3. Check Logs

```bash
# View real-time logs
gcloud run services logs tail yqpay --region=us-central1

# Check for FRONTEND_URL in logs
gcloud run services logs read yqpay --region=us-central1 | grep "FRONTEND_URL"
```

---

## ⚠️ REGENERATE QR CODES

### Why You Must Regenerate

Old QR codes contain local development URLs like:
- `http://192.168.1.100:3001/menu/...`
- `http://localhost:3001/menu/...`

These will **NOT work** in production!

### Steps to Regenerate

1. **Login to Super Admin Panel:**
   ```
   https://yqpay-78918378061.us-central1.run.app/super-admin/login
   ```

2. **Navigate to QR Management:**
   - Go to "Generate QR" or "QR Management"
   - Select each theater

3. **Delete Old QR Codes:**
   - Delete all existing QR codes
   - They contain old local IP addresses

4. **Generate New QR Codes:**
   - Generate new QR codes for all theaters/screens
   - New QR codes will use: `https://yqpay-78918378061.us-central1.run.app/menu/...`

5. **Download and Test:**
   - Download one QR code
   - Scan with mobile phone
   - Verify it opens: `https://yqpay-78918378061.us-central1.run.app/menu/...`
   - If correct, download all QR codes

6. **Print and Distribute:**
   - Print new QR codes
   - Distribute to theaters

---

## 🔧 Troubleshooting

### QR Code Still Shows Local IP

**Problem:** QR code URL is `http://192.168.x.x` instead of Cloud Run URL

**Solution:**
```bash
# 1. Verify FRONTEND_URL is set
gcloud run services describe yqpay \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)" | grep FRONTEND_URL

# 2. If not found, set it:
gcloud run services update yqpay \
  --region=us-central1 \
  --update-env-vars FRONTEND_URL=https://yqpay-78918378061.us-central1.run.app

# 3. Wait for deployment to complete (about 1 minute)

# 4. Regenerate all QR codes in admin panel
```

### CORS Errors

**Problem:** Frontend can't connect to backend

**Solution:**
```bash
# Set CORS_ORIGIN environment variable
gcloud run services update yqpay \
  --region=us-central1 \
  --update-env-vars CORS_ORIGIN=https://yqpay-78918378061.us-central1.run.app
```

### Database Connection Failed

**Problem:** Can't connect to MongoDB

**Solution:**
1. Check MongoDB Atlas whitelist:
   - Add `0.0.0.0/0` to IP whitelist (allows all IPs)
   - Or use VPC connector for Cloud Run

2. Verify connection string:
   ```bash
   gcloud run services update yqpay \
     --region=us-central1 \
     --update-env-vars MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/db"
   ```

### Service Not Accessible

**Problem:** 403 Forbidden or service unavailable

**Solution:**
```bash
# Make service public
gcloud run services add-iam-policy-binding yqpay \
  --region=us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

---

## 📊 Monitoring

### View Service Status

```bash
# Service details
gcloud run services describe yqpay --region=us-central1

# Recent deployments
gcloud run revisions list --service=yqpay --region=us-central1

# Traffic routing
gcloud run services describe yqpay \
  --region=us-central1 \
  --format="value(status.traffic)"
```

### View Logs

```bash
# Real-time logs
gcloud run services logs tail yqpay --region=us-central1

# Filter for errors
gcloud run services logs read yqpay \
  --region=us-central1 \
  --filter="severity=ERROR"

# Filter for QR code generation
gcloud run services logs read yqpay \
  --region=us-central1 \
  --filter="textPayload:QR Code"
```

### Metrics

View in Google Cloud Console:
- Navigate to **Cloud Run** → `yqpay`
- Click **"METRICS"** tab
- Monitor:
  - Request count
  - Request latency
  - Container CPU utilization
  - Container memory utilization

---

## 🔐 Security Best Practices

### 1. Use Secret Manager (Recommended)

Instead of environment variables, use Google Secret Manager for sensitive data:

```bash
# Create secret
echo -n "your-secret-value" | gcloud secrets create jwt-secret --data-file=-

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update service to use secret
gcloud run services update yqpay \
  --region=us-central1 \
  --update-secrets=JWT_SECRET=jwt-secret:latest
```

### 2. Restrict Access

```bash
# Remove public access (if needed)
gcloud run services remove-iam-policy-binding yqpay \
  --region=us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker"

# Add specific users
gcloud run services add-iam-policy-binding yqpay \
  --region=us-central1 \
  --member="user:admin@yourdomain.com" \
  --role="roles/run.invoker"
```

---

## ✅ Final Verification Checklist

Before going live:

- [ ] `FRONTEND_URL` environment variable set in Cloud Run
- [ ] Backend deployed and accessible
- [ ] Frontend deployed and accessible
- [ ] Database connection working
- [ ] Firebase authentication working
- [ ] GCS bucket accessible for QR code storage
- [ ] **ALL old QR codes deleted**
- [ ] **ALL new QR codes generated with Cloud Run URL**
- [ ] Test QR code scanned and verified
- [ ] QR code opens: `https://yqpay-78918378061.us-central1.run.app/menu/...`
- [ ] Can add items to cart
- [ ] Checkout process works
- [ ] Order appears in admin panel
- [ ] Logs show no errors

---

## 🎯 Quick Commands Reference

```bash
# Deploy backend
gcloud run deploy yqpay --source . --region=us-central1

# Update environment variable
gcloud run services update yqpay \
  --region=us-central1 \
  --update-env-vars FRONTEND_URL=https://yqpay-78918378061.us-central1.run.app

# View logs
gcloud run services logs tail yqpay --region=us-central1

# Describe service
gcloud run services describe yqpay --region=us-central1

# List revisions
gcloud run revisions list --service=yqpay --region=us-central1

# Rollback to previous revision
gcloud run services update-traffic yqpay \
  --to-revisions=REVISION_NAME=100 \
  --region=us-central1
```

---

## 📞 Support

For issues specific to Google Cloud Run:
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Troubleshooting Guide](https://cloud.google.com/run/docs/troubleshooting)
- [Community Support](https://stackoverflow.com/questions/tagged/google-cloud-run)

**Remember:** Always set `FRONTEND_URL` before generating QR codes! 🎯
