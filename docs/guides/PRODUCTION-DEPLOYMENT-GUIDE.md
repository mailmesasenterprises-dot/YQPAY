# YQPayNow - Production Deployment Guide

## 🚀 Pre-Deployment Checklist

### 1. Environment Configuration

**CRITICAL:** Set the `FRONTEND_URL` before generating any QR codes!

```bash
# Create .env file in backend folder
cd backend
cp .env.example .env
```

Edit `.env` and set:
```env
FRONTEND_URL=https://yourdomain.com
NODE_ENV=production
MONGODB_URI=your-production-mongodb-uri
```

### 2. Database Setup

- [ ] Create production MongoDB database (MongoDB Atlas recommended)
- [ ] Update `MONGODB_URI` in `.env`
- [ ] Run database migrations if any
- [ ] Create initial Super Admin user

### 3. Firebase Configuration

- [ ] Create Firebase project
- [ ] Download service account key from Firebase Console
- [ ] Add Firebase credentials to `.env`
- [ ] Enable Firebase Authentication
- [ ] Set up Firestore security rules

### 4. Google Cloud Storage (GCS)

- [ ] Create GCS bucket for QR code images
- [ ] Make bucket public or set proper permissions
- [ ] Add GCS credentials to `.env`
- [ ] Test file upload functionality

### 5. Domain & SSL Setup

- [ ] Purchase domain name
- [ ] Point domain to your server IP
- [ ] Install SSL certificate (Let's Encrypt recommended)
- [ ] Configure HTTPS redirect
- [ ] Update `FRONTEND_URL` with https://

---

## 📦 Deployment Options

### Option 1: Deploy to Google Cloud Platform (GCP)

#### Using Google App Engine

```bash
# Install Google Cloud SDK
# Create app.yaml in backend folder
```

**app.yaml:**
```yaml
runtime: nodejs18
env: standard

env_variables:
  FRONTEND_URL: "https://yourdomain.com"
  NODE_ENV: "production"

handlers:
- url: /.*
  script: auto
  secure: always
```

Deploy:
```bash
gcloud app deploy
```

#### Using Google Cloud Run

```bash
# Build Docker image
docker build -t gcr.io/YOUR_PROJECT_ID/yqpaynow-backend .

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT_ID/yqpaynow-backend

# Deploy to Cloud Run
gcloud run deploy yqpaynow-backend \
  --image gcr.io/YOUR_PROJECT_ID/yqpaynow-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars FRONTEND_URL=https://yourdomain.com
```

---

### Option 2: Deploy to AWS

#### Using AWS Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize EB application
eb init

# Create environment
eb create production-env

# Set environment variables
eb setenv FRONTEND_URL=https://yourdomain.com NODE_ENV=production

# Deploy
eb deploy
```

#### Using AWS EC2

```bash
# SSH to EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone repository
git clone https://github.com/yourusername/yqpaynow.git
cd yqpaynow/backend

# Install dependencies
npm install --production

# Create .env file
nano .env
# (Add all environment variables)

# Start with PM2
pm2 start app.js --name yqpaynow-backend
pm2 startup
pm2 save

# Install Nginx
sudo apt-get install nginx

# Configure Nginx reverse proxy
sudo nano /etc/nginx/sites-available/yqpaynow
```

**Nginx configuration:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/yqpaynow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Install SSL with Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

### Option 3: Deploy to Heroku

```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create Heroku app
heroku create yqpaynow-backend

# Set environment variables
heroku config:set FRONTEND_URL=https://yourdomain.com
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=your-mongodb-uri

# Deploy
git push heroku master

# Scale dynos
heroku ps:scale web=1
```

---

### Option 4: Deploy to DigitalOcean

#### Using DigitalOcean App Platform

1. Connect your GitHub repository
2. Select Node.js environment
3. Add environment variables in App Platform console
4. Deploy automatically on push

#### Using DigitalOcean Droplet

Similar to AWS EC2 setup above.

---

## 🎯 Post-Deployment Tasks

### 1. Verify Environment Variables

```bash
# Check if FRONTEND_URL is set correctly
curl https://your-backend-url/api/health
```

### 2. **REGENERATE ALL QR CODES**

⚠️ **CRITICAL:** QR codes generated in development have local IP addresses embedded!

Steps:
1. Login to Super Admin panel
2. Go to QR Management for each theater
3. Delete old QR codes
4. Generate new QR codes (they will now use production URL)
5. Download and verify QR codes work correctly
6. Distribute new QR codes to theaters

### 3. Test Complete Flow

- [ ] Scan QR code with mobile phone
- [ ] Verify it opens correct menu page
- [ ] Test ordering process
- [ ] Test payment gateway
- [ ] Test order notifications
- [ ] Test admin dashboard

### 4. Configure Firewall

```bash
# Allow HTTP/HTTPS
sudo ufw allow 'Nginx Full'

# Allow SSH
sudo ufw allow ssh

# Enable firewall
sudo ufw enable
```

### 5. Set Up Monitoring

- [ ] Enable application logging
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Monitor server resources
- [ ] Set up uptime monitoring
- [ ] Configure backup strategy

### 6. Security Hardening

- [ ] Change all default passwords
- [ ] Use strong JWT secrets
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Keep dependencies updated
- [ ] Enable security headers

---

## 🔄 Continuous Deployment

### GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Deploy to Server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          cd /var/www/yqpaynow/backend
          git pull origin main
          npm install --production
          pm2 restart yqpaynow-backend
```

---

## 📊 Frontend Deployment

### Build React App

```bash
cd frontend
npm run build
```

### Deploy Frontend

#### Option 1: Same Server (Nginx)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/yqpaynow/frontend/build;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
    }
}
```

#### Option 2: Separate CDN (Netlify/Vercel)

```bash
# Netlify
npm install -g netlify-cli
cd frontend
npm run build
netlify deploy --prod

# Vercel
npm install -g vercel
cd frontend
vercel --prod
```

Update `.env` in frontend:
```env
REACT_APP_API_URL=https://api.yourdomain.com
```

---

## ⚠️ CRITICAL REMINDERS

1. **NEVER generate QR codes without setting FRONTEND_URL first**
2. **QR codes cannot be changed after generation** - the URL is permanent
3. **Always use HTTPS in production**
4. **Keep .env file secure** - never commit to git
5. **Backup database regularly**
6. **Test QR codes before printing**

---

## 🆘 Troubleshooting

### QR Code shows "Network IP" in production

**Solution:** 
1. Check `FRONTEND_URL` is set correctly in `.env`
2. Restart backend server
3. Regenerate ALL QR codes
4. Verify new QR codes contain production URL

### CORS Errors

**Solution:**
Update `CORS_ORIGIN` in `.env`:
```env
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

### Database Connection Failed

**Solution:**
1. Check MongoDB URI is correct
2. Whitelist server IP in MongoDB Atlas
3. Verify network connectivity

---

## 📞 Support

For deployment assistance, contact your development team or refer to:
- GCP Documentation: https://cloud.google.com/docs
- AWS Documentation: https://docs.aws.amazon.com
- MongoDB Atlas: https://docs.atlas.mongodb.com
