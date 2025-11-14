const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://localhost:27017/yqpaynow');
  
  try {
    // Get all roles
    const roles = await mongoose.connection.collection('roles').find({}).toArray();
    
    // Collect all unique page names across all theaters
    const allPageNames = new Set();
    
    roles.forEach(roleDoc => {
      roleDoc.roleList?.forEach(role => {
        if (role.name === 'Theater Admin') {
          role.permissions?.forEach(p => {
            if (p.hasAccess) {
              allPageNames.add(p.page);
            }
          });
        }
      });
    });
    
    console.log('\n=== ALL THEATER-ADMIN PAGES ACROSS ALL THEATERS ===\n');
    console.log(`Total unique pages: ${allPageNames.size}\n`);
    
    // Sort and display
    const sortedPages = Array.from(allPageNames).sort();
    sortedPages.forEach((page, index) => {
      console.log(`${index + 1}. ${page}`);
    });
    
    console.log('\n=== SIDEBAR ITEMS (from TheaterSidebar.jsx) ===\n');
    const sidebarItems = [
      'dashboard',
      'add-product',
      'products',
      'product-types',
      'categories',
      'kiosk-types',
      'online-pos',
      'offline-pos',
      'order-history',
      'online-order-history',
      'kiosk-order-history',
      'messages',
      'banner',
      'theater-roles',
      'theater-role-access',
      'qr-code-names',
      'generate-qr',
      'qr-management',
      'theater-users',
      'settings',
      'stock',
      'orders',
      'reports'
    ];
    
    console.log(`Total sidebar items: ${sidebarItems.length}\n`);
    sidebarItems.forEach((item, index) => {
      console.log(`${index + 1}. ${item}`);
    });
    
    // Find missing items
    console.log('\n=== ANALYSIS ===\n');
    
    // Normalize page names for comparison
    const normalizedDBPages = new Set();
    sortedPages.forEach(page => {
      // Convert PascalCase to lowercase with hyphens
      const normalized = page
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '')
        .replace(/with-id$/, '');
      normalizedDBPages.add(normalized);
    });
    
    console.log('Missing in sidebar:');
    let missingCount = 0;
    normalizedDBPages.forEach(page => {
      if (!sidebarItems.includes(page)) {
        missingCount++;
        console.log(`  ❌ ${page}`);
      }
    });
    
    if (missingCount === 0) {
      console.log('  ✅ No missing items - sidebar is complete!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
})();
