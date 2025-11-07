# 🚀 Quick Production Deployment Checklist

## Before Going Live

### Step 1: Environment Setup
```bash
cd backend
cp .env.example .env
nano .env
```

**Set these CRITICAL variables:**
- ✅ `FRONTEND_URL=https://yourdomain.com` ⚠️ MOST IMPORTANT!
- ✅ `NODE_ENV=production`
- ✅ `MONGODB_URI=<production-database>`
- ✅ `JWT_SECRET=<strong-random-secret>`
- ✅ `FIREBASE_PROJECT_ID=<your-project>`
- ✅ `GCS_BUCKET_NAME=<your-bucket>`

### Step 2: Database
- [ ] MongoDB Atlas account created
- [ ] Database created
- [ ] Connection string added to `.env`
- [ ] Super Admin user created

### Step 3: Firebase
- [ ] Firebase project created
- [ ] Service account key downloaded
- [ ] Credentials added to `.env`
- [ ] Firestore initialized

### Step 4: Google Cloud Storage
- [ ] GCS bucket created
- [ ] Bucket made public
- [ ] Service account key added to `.env`

### Step 5: Domain & SSL
- [ ] Domain purchased
- [ ] DNS pointed to server
- [ ] SSL certificate installed (HTTPS)
- [ ] `FRONTEND_URL` updated with https://

### Step 6: Deploy Backend
- [ ] Code deployed to server
- [ ] Dependencies installed (`npm install --production`)
- [ ] PM2 or process manager configured
- [ ] Server restarted with production env

### Step 7: Deploy Frontend
- [ ] Build created (`npm run build`)
- [ ] Build deployed to server/CDN
- [ ] API URL configured correctly

### Step 8: **REGENERATE QR CODES** ⚠️
- [ ] Login to Super Admin panel
- [ ] Delete ALL old QR codes (they have local IP!)
- [ ] Generate NEW QR codes for each theater
- [ ] Download and test QR codes with mobile
- [ ] Verify QR codes open production URL
- [ ] Print/distribute new QR codes

### Step 9: Testing
- [ ] Scan QR code with mobile phone
- [ ] Menu loads correctly
- [ ] Can add items to cart
- [ ] Checkout works
- [ ] Payment gateway works (if integrated)
- [ ] Orders appear in admin panel
- [ ] Theater dashboard shows orders

### Step 10: Security
- [ ] All default passwords changed
- [ ] Firewall configured
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] Monitoring set up

---

## ⚠️ CRITICAL WARNINGS

### 🔴 QR Code URL is PERMANENT!
Once a QR code is generated, the URL is **embedded forever**. You **CANNOT** change it later.

**ALWAYS:**
1. Set `FRONTEND_URL` in production `.env` FIRST
2. Then generate QR codes
3. Test ONE QR code before printing all
4. Verify it opens production domain

**NEVER:**
- Generate QR codes in local development for production use
- Print QR codes before setting production URL
- Assume QR codes will "automatically update"

---

## 🎯 Deployment Commands (Quick Reference)

### Google Cloud Run
```bash
gcloud run deploy yqpaynow \
  --source . \
  --set-env-vars FRONTEND_URL=https://yourdomain.com
```

### AWS EC2 with PM2
```bash
pm2 start app.js --name yqpaynow
pm2 startup
pm2 save
```

### Heroku
```bash
heroku create yqpaynow
heroku config:set FRONTEND_URL=https://yourdomain.com
git push heroku master
```

---

## ✅ Post-Deployment Verification

```bash
# Test backend health
curl https://api.yourdomain.com/api/health

# Test QR code URL (check browser console)
# Open: https://yourdomain.com/menu/THEATER_ID?qrName=test

# Check environment
node -e "console.log(process.env.FRONTEND_URL)"
```

---

## 📱 Test QR Code Checklist

1. ✅ Scan QR code with phone camera
2. ✅ URL starts with `https://yourdomain.com`
3. ✅ NOT `http://192.168.x.x` or `localhost`
4. ✅ Menu page loads
5. ✅ Theater name shows correctly
6. ✅ Products load
7. ✅ Can add to cart
8. ✅ Checkout works

If QR code shows local IP, you MUST regenerate!

---

## 🆘 Emergency Rollback

If something goes wrong:

```bash
# Rollback code
git revert HEAD
git push

# Restart services
pm2 restart all

# Check logs
pm2 logs
tail -f /var/log/nginx/error.log
```

---

## 📞 Need Help?

1. Check logs: `pm2 logs` or server logs
2. Review environment variables: `printenv | grep FRONTEND_URL`
3. Test database connection
4. Verify DNS and SSL
5. Check firewall rules

**Remember:** Set `FRONTEND_URL` before generating QR codes! 🎯
