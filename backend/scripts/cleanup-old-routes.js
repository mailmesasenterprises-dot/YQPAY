/**
 * Cleanup Script for Old Route Files
 * 
 * This script helps identify and optionally remove old route files
 * after MVC migration is complete and tested.
 * 
 * WARNING: Only run this after thorough testing!
 */

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../routes');
const oldRoutes = [
  'theaters.js',      // Replaced by theaters.mvc.js
  'orders.js',        // Replaced by orders.mvc.js
  // 'products.js',   // Keep for categories/productTypes
];

console.log('🔍 Checking for old route files...\n');

oldRoutes.forEach(routeFile => {
  const filePath = path.join(routesDir, routeFile);
  const mvcFile = routeFile.replace('.js', '.mvc.js');
  const mvcPath = path.join(routesDir, mvcFile);

  if (fs.existsSync(filePath)) {
    if (fs.existsSync(mvcPath)) {
      console.log(`✅ ${routeFile} - Has MVC replacement (${mvcFile})`);
      console.log(`   📝 Recommendation: Backup and remove after testing\n`);
    } else {
      console.log(`⚠️  ${routeFile} - No MVC replacement found\n`);
    }
  } else {
    console.log(`ℹ️  ${routeFile} - Already removed\n`);
  }
});

console.log('📋 Summary:');
console.log('   - Old routes are kept for safety');
console.log('   - Remove manually after confirming all endpoints work');
console.log('   - Or use: node scripts/remove-old-routes.js (after testing)');

