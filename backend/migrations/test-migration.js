const mongoose = require('mongoose');
const TheaterUserMigration = require('./theater-user-migration');
const TheaterUserModel = require('../models/TheaterUserModel');
const TheaterUserArray = require('../models/TheaterUserArray');
const Theater = require('../models/Theater');
require('dotenv').config();
class MigrationTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  /**
   * Log test result
   */
  logTest(name, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    
    this.testResults.tests.push({ name, passed, details });
    if (passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }
  }

  /**
   * Test database connectivity
   */
  async testDatabaseConnection() {
    try {
      const state = mongoose.connection.readyState;
      this.logTest('Database Connection', state === 1, `Connection state: ${state}`);
      return state === 1;
    } catch (error) {
      this.logTest('Database Connection', false, error.message);
      return false;
    }
  }

  /**
   * Test model validation
   */
  async testModelValidation() {
    try {
      // Test TheaterUserArray model creation
      const testArray = new TheaterUserArray({
        theater: new mongoose.Types.ObjectId(),
        userList: [],
        metadata: {
          totalUsers: 0,
          activeUsers: 0,
          lastUpdated: new Date(),
          createdBy: 'test'
        }
      });

      const validationError = testArray.validateSync();
      this.logTest('TheaterUserArray Model Validation', !validationError, 
        validationError ? validationError.message : 'Model schema valid');

      return !validationError;
    } catch (error) {
      this.logTest('TheaterUserArray Model Validation', false, error.message);
      return false;
    }
  }

  /**
   * Test creating sample data
   */
  async createSampleData() {
    try {
      // Create test theater if it doesn't exist
      let testTheater = await Theater.findOne({ name: 'Test Theater Migration' });
      if (!testTheater) {
        testTheater = await Theater.create({
          name: 'Test Theater Migration',
          location: 'Test Location',
          address: 'Test Address',
          phone: '1234567890',
          email: 'test@theater.com'
        });
      }

      // Create sample users
      const sampleUsers = [
        {
          username: 'testuser1',
          email: 'testuser1@theater.com',
          password: 'hashedpassword1',
          fullName: 'Test User One',
          phoneNumber: '1111111111',
          theater: testTheater._id,
          isActive: true
        },
        {
          username: 'testuser2',
          email: 'testuser2@theater.com',
          password: 'hashedpassword2',
          fullName: 'Test User Two',
          phoneNumber: '2222222222',
          theater: testTheater._id,
          isActive: true
        },
        {
          username: 'testuser3',
          email: 'testuser3@theater.com',
          password: 'hashedpassword3',
          fullName: 'Test User Three',
          phoneNumber: '3333333333',
          theater: testTheater._id,
          isActive: false
        }
      ];

      // Clear existing test users
      await TheaterUserModel.deleteMany({ 
        theater: testTheater._id,
        username: { $in: ['testuser1', 'testuser2', 'testuser3'] }
      });

      // Create test users
      const createdUsers = await TheaterUserModel.insertMany(sampleUsers);

      this.logTest('Sample Data Creation', createdUsers.length === 3, 
        `Created ${createdUsers.length} test users`);

      return { theater: testTheater, users: createdUsers };
    } catch (error) {
      this.logTest('Sample Data Creation', false, error.message);
      return null;
    }
  }

  /**
   * Test migration process
   */
  async testMigration(testTheater) {
    try {
      const migration = new TheaterUserMigration();

      // Test backup creation
      const backupPath = await migration.createBackup();
      this.logTest('Backup Creation', !!backupPath, `Backup created at: ${backupPath}`);

      // Test migration for specific theater
      const result = await migration.migrate({
        createBackup: false, // We already created one
        specificTheaterId: testTheater._id.toString()
      });

      this.logTest('Migration Execution', result.success, 
        `Migrated ${result.stats.migratedUsers} users`);

      return { success: result.success, backupPath };
    } catch (error) {
      this.logTest('Migration Execution', false, error.message);
      return { success: false };
    }
  }

  /**
   * Test data integrity after migration
   */
  async testDataIntegrity(testTheater) {
    try {
      // Count original users
      const originalCount = await TheaterUserModel.countDocuments({ theater: testTheater._id });

      // Get migrated array
      const arrayDoc = await TheaterUserArray.findOne({ theater: testTheater._id });
      const migratedCount = arrayDoc ? arrayDoc.userList.length : 0;

      const integrityCheck = originalCount === migratedCount;
      this.logTest('Data Integrity Check', integrityCheck, 
        `Original: ${originalCount}, Migrated: ${migratedCount}`);

      // Test user data preservation
      if (arrayDoc && arrayDoc.userList.length > 0) {
        const firstUser = arrayDoc.userList[0];
        const hasRequiredFields = firstUser.username && firstUser.email && firstUser.fullName;
        this.logTest('User Data Preservation', hasRequiredFields, 
          'Required fields preserved');
      }

      return integrityCheck;
    } catch (error) {
      this.logTest('Data Integrity Check', false, error.message);
      return false;
    }
  }

  /**
   * Test array operations
   */
  async testArrayOperations(testTheater) {
    try {
      const arrayDoc = await TheaterUserArray.findOne({ theater: testTheater._id });
      if (!arrayDoc) {
        this.logTest('Array Operations', false, 'No array document found');
        return false;
      }

      // Test user addition
      const newUser = await arrayDoc.addUser({
        username: 'newtestuser',
        email: 'newtest@theater.com',
        password: 'hashedpassword',
        fullName: 'New Test User',
        phoneNumber: '9999999999',
        isActive: true
      });

      this.logTest('Add User Operation', !!newUser, 'Successfully added new user');

      // Test user update
      const updatedUser = await arrayDoc.updateUser(newUser._id, {
        fullName: 'Updated Test User'
      });

      this.logTest('Update User Operation', 
        updatedUser.fullName === 'Updated Test User', 
        'Successfully updated user');

      // Test user search
      const searchResults = await TheaterUserArray.getByTheater(testTheater._id, {
        search: 'Updated',
        limit: 10
      });

      this.logTest('Search Operation', 
        searchResults.users.some(u => u.fullName === 'Updated Test User'),
        'Search functionality working');

      return true;
    } catch (error) {
      this.logTest('Array Operations', false, error.message);
      return false;
    }
  }

  /**
   * Test rollback functionality
   */
  async testRollback(backupPath, testTheater) {
    try {
      const migration = new TheaterUserMigration();
      await migration.rollback(backupPath);

      // Verify rollback
      const arrayDoc = await TheaterUserArray.findOne({ theater: testTheater._id });
      const originalUsers = await TheaterUserModel.find({ theater: testTheater._id });

      this.logTest('Rollback Execution', 
        !arrayDoc && originalUsers.length > 0,
        'Array docs removed, original docs restored');

      return true;
    } catch (error) {
      this.logTest('Rollback Execution', false, error.message);
      return false;
    }
  }

  /**
   * Clean up test data
   */
  async cleanup(testTheater) {
    try {
      // Remove test users
      await TheaterUserModel.deleteMany({ theater: testTheater._id });
      await TheaterUserArray.deleteMany({ theater: testTheater._id });
      
      // Remove test theater
      await Theater.deleteOne({ _id: testTheater._id });
    } catch (error) {
    }
  }

  /**
   * Run complete test suite
   */
  async runTests() {
    try {
      // Basic tests
      await this.testDatabaseConnection();
      await this.testModelValidation();

      // Create sample data
      const sampleData = await this.createSampleData();
      if (!sampleData) {
        return;
      }

      // Migration tests
      const migrationResult = await this.testMigration(sampleData.theater);
      if (migrationResult.success) {
        await this.testDataIntegrity(sampleData.theater);
        await this.testArrayOperations(sampleData.theater);
        
        // Test rollback if backup was created
        if (migrationResult.backupPath) {
          await this.testRollback(migrationResult.backupPath, sampleData.theater);
        }
      }

      // Cleanup
      await this.cleanup(sampleData.theater);

    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      // Print summary
      if (this.testResults.failed > 0) {
        this.testResults.tests
          .filter(t => !t.passed)
          .forEach(t => {
            // Removed console.log for clean output
          });
      }

      const overallSuccess = this.testResults.failed === 0;
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  async function runTests() {
    try {
      // Connect to MongoDB
      if (!mongoose.connection.readyState) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater_canteen_db');
      }

      const tester = new MigrationTester();
      await tester.runTests();

      process.exit(0);
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    }
  }

  runTests();
}

module.exports = MigrationTester;