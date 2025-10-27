const mongoose = require('mongoose');
const PageAccess = require('../models/PageAccess'); // Old model
const PageAccessArray = require('../models/PageAccessArray'); // New model
const Theater = require('../models/Theater');

/**
 * Migration Script: Convert global page access to theater-based array structure
 * 
 * BEFORE: Individual documents per page (global)
 * AFTER: One document per theater with pageAccessList array
 */

async function migratePageAccessToTheaterBased() {
  try {
    console.log('🚀 Starting Page Access Migration...\n');
    
    // Connect to database
    await mongoose.connect('mongodb://localhost:27017/theater_canteen_db', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to database\n');

    // Step 1: Get all global pages
    const globalPages = await PageAccess.find();
    console.log(`📄 Found ${globalPages.length} global pages to migrate:`);
    globalPages.forEach(page => {
      console.log(`   - ${page.pageName} (${page.page})`);
    });
    console.log('');

    // Step 2: Get all active theaters
    const theaters = await Theater.find({ isActive: true });
    console.log(`🎭 Found ${theaters.length} active theaters:\n`);
    
    if (theaters.length === 0) {
      console.log('⚠️ No theaters found. Exiting...');
      process.exit(0);
    }

    // Step 3: Migrate for each theater
    let successCount = 0;
    let errorCount = 0;

    for (const theater of theaters) {
      console.log(`\n🏛️ Processing theater: ${theater.name} (${theater._id})`);
      
      try {
        // Find or create page access document for this theater
        let pageAccessDoc = await PageAccessArray.findOrCreateByTheater(theater._id);
        console.log(`   📋 Document found/created for theater`);

        // Check if theater already has pages
        if (pageAccessDoc.pageAccessList.length > 0) {
          console.log(`   ⚠️ Theater already has ${pageAccessDoc.pageAccessList.length} pages. Skipping...`);
          continue;
        }

        // Add all global pages to this theater
        let addedCount = 0;
        for (const globalPage of globalPages) {
          await pageAccessDoc.addPage({
            page: globalPage.page,
            pageName: globalPage.pageName,
            displayName: globalPage.displayName || globalPage.pageName,
            route: globalPage.route,
            category: globalPage.category || 'admin',
            description: globalPage.description || '',
            icon: globalPage.icon || '',
            requiredRoles: globalPage.requiredRoles || [],
            requiredPermissions: globalPage.requiredPermissions || [],
            showInMenu: globalPage.showInMenu !== undefined ? globalPage.showInMenu : true,
            showInSidebar: globalPage.showInSidebar !== undefined ? globalPage.showInSidebar : true,
            menuOrder: globalPage.menuOrder || 0,
            isActive: globalPage.isActive !== undefined ? globalPage.isActive : true,
            isBeta: globalPage.isBeta || false,
            requiresSubscription: globalPage.requiresSubscription || false,
            tags: globalPage.tags || [],
            version: globalPage.version || '1.0.0'
          });
          addedCount++;
        }

        console.log(`   ✅ Added ${addedCount} pages to theater`);
        console.log(`   📊 Metadata: ${pageAccessDoc.metadata.totalPages} total, ${pageAccessDoc.metadata.activePages} active`);
        successCount++;

      } catch (error) {
        console.error(`   ❌ Error migrating theater ${theater.name}:`, error.message);
        errorCount++;
      }
    }

    // Step 4: Summary
    console.log('\n\n📊 ===== MIGRATION SUMMARY =====');
    console.log(`✅ Successfully migrated: ${successCount} theaters`);
    console.log(`❌ Failed: ${errorCount} theaters`);
    console.log(`📄 Total pages per theater: ${globalPages.length}`);
    console.log('================================\n');

    // Step 5: Verification
    console.log('🔍 Verifying migration...\n');
    const allPageAccessDocs = await PageAccessArray.find().populate('theater', 'name');
    
    console.log(`📋 Total PageAccessArray documents: ${allPageAccessDocs.length}`);
    allPageAccessDocs.forEach(doc => {
      console.log(`   🎭 ${doc.theater?.name || 'Unknown'}: ${doc.metadata.totalPages} pages (${doc.metadata.activePages} active)`);
    });

    // Step 6: Optional - Backup old data
    console.log('\n💾 Old global pages are still in database (not deleted)');
    console.log('   You can manually delete them after verifying the migration');
    console.log('   Command: db.pageaccesses.deleteMany({ theater: { $exists: false } })\n');

    console.log('✅ Migration completed successfully!\n');
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migratePageAccessToTheaterBased();
