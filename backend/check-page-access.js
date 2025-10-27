const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater_canteen_db')
  .then(async () => {
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Check pageaccesses collection
    const pageAccesses = await db.collection('pageaccesses').find({}).toArray();
    
    console.log('=' .repeat(80));
    console.log('📋 PAGE ACCESS MANAGEMENT REPORT');
    console.log('=' .repeat(80));
    console.log(`Total Pages in Database: ${pageAccesses.length}\n`);
    
    if (pageAccesses.length === 0) {
      console.log('⚠️  NO PAGE ACCESS CONFIGURATIONS FOUND IN DATABASE');
      console.log('   This means all pages are accessible by default (commonly set)\n');
    } else {
      console.log('📊 PAGE ACCESS STATUS:\n');
      
      // Group by isActive status
      const activePages = pageAccesses.filter(p => p.isActive);
      const inactivePages = pageAccesses.filter(p => !p.isActive);
      
      console.log(`✅ Active Pages: ${activePages.length}`);
      console.log(`❌ Inactive Pages: ${inactivePages.length}\n`);
      
      // Show detailed list
      console.log('-'.repeat(80));
      console.log('DETAILED PAGE ACCESS LIST:');
      console.log('-'.repeat(80));
      console.log(`${'#'.padEnd(4)} ${'PAGE NAME'.padEnd(35)} ${'STATUS'.padEnd(10)} ${'ROLES'.padEnd(25)}`);
      console.log('-'.repeat(80));
      
      pageAccesses.forEach((page, index) => {
        const status = page.isActive ? '✅ Active' : '❌ Inactive';
        const roles = page.allowedRoles?.join(', ') || page.requiredRoles?.join(', ') || 'N/A';
        console.log(
          `${String(index + 1).padEnd(4)} ${(page.pageName || page.page || 'N/A').padEnd(35)} ${status.padEnd(10)} ${roles.substring(0, 25)}`
        );
      });
      
      console.log('-'.repeat(80));
      console.log('\n📝 CONFIGURATION ANALYSIS:\n');
      
      // Check if all pages have the same status
      const allActive = pageAccesses.every(p => p.isActive);
      const allInactive = pageAccesses.every(p => !p.isActive);
      
      if (allActive) {
        console.log('✅ ALL PAGES ARE ACTIVE (COMMONLY ACCESSIBLE)');
        console.log('   Every page in the database is marked as active');
        console.log('   This means access is granted based on roles\n');
      } else if (allInactive) {
        console.log('❌ ALL PAGES ARE INACTIVE (RESTRICTED)');
        console.log('   Every page in the database is marked as inactive');
        console.log('   This means no access is granted to any pages\n');
      } else {
        console.log('⚡ MIXED ACCESS CONFIGURATION');
        console.log(`   ${activePages.length} pages are accessible`);
        console.log(`   ${inactivePages.length} pages are restricted\n`);
      }
      
      // Check role distribution
      console.log('👥 ROLE DISTRIBUTION:\n');
      const roleCount = {};
      pageAccesses.forEach(page => {
        const roles = page.allowedRoles || page.requiredRoles || [];
        roles.forEach(role => {
          roleCount[role] = (roleCount[role] || 0) + 1;
        });
      });
      
      Object.entries(roleCount).forEach(([role, count]) => {
        console.log(`   ${role.padEnd(25)}: ${count} pages`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 RECOMMENDATION:');
    console.log('='.repeat(80));
    
    if (pageAccesses.length === 0) {
      console.log('✅ Pages are set as COMMONLY ACCESSIBLE (default behavior)');
      console.log('   - No database records = No restrictions');
      console.log('   - Access controlled only by route-level role checks');
      console.log('   - This is the most permissive configuration\n');
    } else {
      const allActive = pageAccesses.every(p => p.isActive);
      if (allActive) {
        console.log('✅ Pages are configured as COMMONLY ACCESSIBLE');
        console.log('   - All pages marked as active in database');
        console.log('   - Access granted based on role configuration');
        console.log('   - Standard configuration for open access\n');
      } else {
        console.log('⚠️  Pages have RESTRICTED ACCESS configuration');
        console.log('   - Some pages are marked as inactive');
        console.log('   - Access is selectively granted');
        console.log('   - Review individual page settings for proper access\n');
      }
    }
    
    console.log('=' .repeat(80));
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
