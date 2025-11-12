/**
 * Setup Script for Ultra Optimizations
 * Run this to set up all optimizations
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Ultra Optimizations for 10,000+ concurrent users...\n');

// Check if optimization directory exists
const optDir = path.join(__dirname, 'optimization');
if (!fs.existsSync(optDir)) {
  console.log('❌ Optimization directory not found!');
  console.log('   Make sure you\'re running this from the backend directory.');
  process.exit(1);
}

// Step 1: Check dependencies
console.log('📦 Step 1: Checking dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const required = ['redis', 'ioredis'];
  const missing = required.filter(dep => !deps[dep]);
  
  if (missing.length > 0) {
    console.log(`⚠️  Missing dependencies: ${missing.join(', ')}`);
    console.log('   Installing...');
    execSync(`npm install ${missing.join(' ')}`, { stdio: 'inherit', cwd: __dirname });
    console.log('✅ Dependencies installed\n');
  } else {
    console.log('✅ All dependencies installed\n');
  }
} catch (error) {
  console.error('❌ Error checking dependencies:', error.message);
}

// Step 2: Check Redis connection
console.log('📦 Step 2: Testing Redis connection...');
try {
  const redisCache = require('./redis-cache');
  redisCache.connect().then(connected => {
    if (connected) {
      console.log('✅ Redis connected successfully\n');
    } else {
      console.log('⚠️  Redis not available - will use in-memory fallback\n');
      console.log('   To enable Redis:');
      console.log('   1. Install Redis: https://redis.io/download');
      console.log('   2. Or use Redis Cloud: https://redis.com/try-free/');
      console.log('   3. Set REDIS_URL in .env file\n');
    }
  });
} catch (error) {
  console.log('⚠️  Redis module not available\n');
}

// Step 3: Create database indexes
console.log('📦 Step 3: Creating database indexes...');
try {
  const createIndexes = require('./create-all-indexes');
  createIndexes().then(() => {
    console.log('✅ Database indexes created\n');
  }).catch(err => {
    console.error('❌ Error creating indexes:', err.message);
    console.log('   Run manually: node optimization/create-all-indexes.js\n');
  });
} catch (error) {
  console.log('⚠️  Could not create indexes automatically');
  console.log('   Run manually: node optimization/create-all-indexes.js\n');
}

// Step 4: Check PM2
console.log('📦 Step 4: Checking PM2...');
try {
  execSync('pm2 --version', { stdio: 'ignore' });
  console.log('✅ PM2 is installed');
  console.log('   To start with PM2 clustering:');
  console.log('   npm run pm2:start\n');
} catch (error) {
  console.log('⚠️  PM2 not installed globally');
  console.log('   Install: npm install -g pm2');
  console.log('   Or use: npx pm2 start optimization/ecosystem.config.js\n');
}

// Step 5: Environment variables check
console.log('📦 Step 5: Checking environment variables...');
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  const hasRedis = envContent.includes('REDIS_URL');
  const hasMongo = envContent.includes('MONGODB_URI');
  
  if (!hasRedis) {
    console.log('⚠️  REDIS_URL not found in .env');
    console.log('   Add: REDIS_URL=redis://localhost:6379\n');
  } else {
    console.log('✅ REDIS_URL configured\n');
  }
  
  if (!hasMongo) {
    console.log('⚠️  MONGODB_URI not found in .env\n');
  }
} else {
  console.log('⚠️  .env file not found\n');
}

console.log('========================================');
console.log('✅ Setup complete!');
console.log('========================================\n');
console.log('Next steps:');
console.log('1. Ensure Redis is running (or use Redis Cloud)');
console.log('2. Update .env with REDIS_URL if needed');
console.log('3. Start server: npm start');
console.log('4. For production: npm run pm2:start');
console.log('\n');

