# Archive Folder

This folder contains old, test, and utility files that are not actively used in production but kept for reference.

## Folder Structure

### 📂 test-files/
- All test scripts and test data files
- Files like `test-*.js`, `*-test.js`, `test-*.json`
- These were used for testing various features during development

### 📂 check-files/
- Database checking and verification scripts
- Files like `check-*.js`
- Used to check database state, user permissions, roles, etc.

### 📂 verify-files/
- Verification and validation scripts
- Files like `verify-*.js`
- Used to verify data integrity, configurations, and system state

### 📂 debug-files/
- Debugging and diagnostic scripts
- Files like `debug-*.js`, `diagnose-*.js`
- Used for troubleshooting issues during development

### 📂 utility-scripts/
- One-time utility scripts for data migration, seeding, updates
- Files like `create-*.js`, `update-*.js`, `migrate-*.js`, `seed-*.js`
- Batch files (`.bat`), report files (`.txt`)
- Scripts for adding permissions, creating users, fixing data, etc.

### 📂 old-html-tests/
- Old HTML test pages
- Files like `*-test.html`, `qr-fields-test.html`
- Static test pages used during development

### 📂 duplicate-files/
- Backup files and duplicates
- Files like `*_1.js`, `*_1.json`, `*.backup`, `*.corrupted.*`
- Old versions and copy files

## Important Notes

⚠️ **These files are archived and not actively used in production**

- Do not delete without review - they may contain important reference code
- If you need to run any of these scripts, test in development first
- Some scripts may be outdated and need updates to work with current codebase
- Check git history if you need to find when a specific file was last used

## Cleaning Policy

- Archive is created to keep the main project clean and organized
- Files moved here on: October 31, 2025
- Review and clean archive folder quarterly
