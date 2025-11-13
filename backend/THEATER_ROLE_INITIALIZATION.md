# Theater Role Initialization Documentation

## Overview
This document describes the automatic role creation system for theaters in the YQPAY application.

## Default Roles Created

When a new theater is created, **TWO default roles** are automatically initialized:

### 1. Theater Admin Role
- **Name:** "Theater Admin"
- **Priority:** 1 (Highest)
- **Permissions:** Full access to all theater management features
- **Properties:**
  - `isDefault: true` - Protected default role
  - `canDelete: false` - Cannot be deleted
  - `canEdit: false` - Cannot be edited
  - `isActive: true` - Active by default

**Permissions Include:**
- Theater Dashboard
- Theater Settings
- Theater Messages
- Categories Management
- Kiosk Types Management
- Product Types Management
- Order History
- Banner Management
- Theater Roles Management
- QR Code Names Management
- Theater QR Management
- User Management
- Product List
- Stock Management
- Simple Product List
- Online POS Interface
- Offline POS Interface
- Products
- Orders
- Stock Management

### 2. Kiosk Screen Role
- **Name:** "Kiosk Screen"
- **Priority:** 10 (Lower than Theater Admin)
- **Permissions:** Limited to kiosk-specific pages only
- **Properties:**
  - `isDefault: true` - Protected default role
  - `canDelete: false` - Cannot be deleted
  - `canEdit: false` - Cannot be edited
  - `isActive: true` - Active by default

**Permissions Include:**
- Kiosk Product List
- Kiosk Cart
- Kiosk Checkout
- Kiosk Payment
- Kiosk View Cart

## Implementation Details

### Theater Creation Flow

File: `backend/services/theaterService.js`

```javascript
async createTheater(theaterData, fileUrls = {}) {
  // ... create theater document ...
  const savedTheater = await theater.save();

  // Initialize defaults (non-blocking)
  Promise.all([
    Settings.initializeDefaults(savedTheater._id).catch(err => 
      console.warn('Settings init failed:', err.message)
    ),
    roleService.createDefaultTheaterAdminRole(savedTheater._id, savedTheater.name).catch(err => 
      console.warn('Role creation failed:', err.message)
    ),
    roleService.createDefaultKioskRole(savedTheater._id, savedTheater.name).catch(err => 
      console.warn('Kiosk role creation failed:', err.message)
    )
  ]);

  return savedTheater;
}
```

### Role Service Functions

File: `backend/services/roleService.js`

#### createDefaultTheaterAdminRole(theaterId, theaterName)
- Creates Theater Admin role with full permissions
- Checks if role already exists to prevent duplicates
- Uses array-based RoleArray model structure
- Returns the created role object

#### createDefaultKioskRole(theaterId, theaterName)
- Creates Kiosk Screen role with limited permissions
- Checks if role already exists to prevent duplicates
- Uses array-based RoleArray model structure
- Returns the created role object

### Role Storage Structure

Roles are stored in the `roles` collection using an array-based structure:

```javascript
{
  theater: ObjectId,           // Reference to theater
  roleList: [                  // Array of roles
    {
      _id: ObjectId,
      name: "Theater Admin",
      description: "...",
      permissions: [...],
      isDefault: true,
      canDelete: false,
      canEdit: false,
      priority: 1,
      isActive: true,
      // ... other fields
    },
    {
      _id: ObjectId,
      name: "Kiosk Screen",
      // ... same structure
    }
  ],
  metadata: {
    totalRoles: Number,
    activeRoles: Number,
    inactiveRoles: Number,
    defaultRoles: Number,
    lastUpdated: Date
  }
}
```

## Migration for Existing Theaters

For theaters created before the Kiosk Screen role feature was implemented, use the migration script:

### Running the Migration

```bash
cd backend
node migrations/add-kiosk-role-to-theaters.js
```

This script:
- ✅ Adds Kiosk Screen role to all theaters that don't have it
- ⏭️ Skips theaters that already have the role
- 📊 Provides detailed progress and summary
- 🔒 Safe to run multiple times (idempotent)

### Verification Script

To verify that all theaters have both required roles:

```bash
cd backend
node scripts/verify-theater-roles.js
```

This script:
- 🔍 Checks all theaters in the database
- ✅ Verifies presence of Theater Admin role
- ✅ Verifies presence of Kiosk Screen role
- 📋 Lists all other custom roles
- 📊 Provides comprehensive summary

## Current Status

**Last Verified:** November 14, 2025

### Theater Role Status:
- **Total Theaters:** 2
- **Theaters with Theater Admin Role:** 2 ✅
- **Theaters with Kiosk Screen Role:** 2 ✅
- **Status:** All theaters have both required default roles

### Details:
1. **MANOJKUMAR (ID: 6914a3db5627d93f862c933e)**
   - Theater Admin: ✅ (20 permissions, Priority 1)
   - Kiosk Screen: ✅ (5 permissions, Priority 10)
   - Additional Roles: 3 custom roles (Manager, creating, h fnm)

2. **MANOJKUMAR (ID: 691648b2e32d6ed8048668ba)**
   - Theater Admin: ✅ (11 permissions, Priority 1)
   - Kiosk Screen: ✅ (5 permissions, Priority 10)
   - Additional Roles: None

## Best Practices

### When Creating a Theater
- Both roles are created automatically ✅
- No manual intervention required
- Roles are created asynchronously (non-blocking)
- Errors are caught and logged without breaking theater creation

### Role Protection
- Default roles cannot be deleted (UI and API validation)
- Default roles cannot be edited (name, permissions protected)
- Only custom roles can be modified or deleted
- Priority system ensures Theater Admin has highest access

### Troubleshooting

**If a theater is missing roles:**
1. Run the migration script: `node migrations/add-kiosk-role-to-theaters.js`
2. Verify with: `node scripts/verify-theater-roles.js`
3. Check logs for role creation errors during theater creation

**Common Issues:**
- MongoDB connection timeout: Increase maxTimeMS in roleService.js
- Duplicate role names: Check normalizedName field for case-insensitive matches
- Permission sync: Ensure permission lists match frontend routes

## Related Files

### Backend
- `backend/services/theaterService.js` - Theater creation logic
- `backend/services/roleService.js` - Role creation and management
- `backend/models/RoleArray.js` - Role data model
- `backend/migrations/add-kiosk-role-to-theaters.js` - Migration script
- `backend/scripts/verify-theater-roles.js` - Verification script

### Frontend
- `frontend/src/App.jsx` - Route definitions and permissions
- `frontend/src/utils/pageExtractor.js` - Page permission mappings
- `frontend/src/contexts/AuthContext.jsx` - Role-based access control

## Future Enhancements

Potential improvements:
- Add Manager role as third default role
- Implement role templates for quick custom role creation
- Add role inheritance/hierarchy system
- Create role cloning feature
- Add role permission audit logs
