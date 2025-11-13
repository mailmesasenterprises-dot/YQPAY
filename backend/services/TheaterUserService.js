const BaseService = require('./BaseService');
const TheaterUserArray = require('../models/TheaterUserArray');
const bcrypt = require('bcryptjs');

/**
 * Theater User Service
 * Handles all theater user-related business logic
 */
class TheaterUserService extends BaseService {
  constructor() {
    super(TheaterUserArray);
  }

  /**
   * Get theater users
   */
  async getTheaterUsers(theaterId, queryParams) {
    const { page = 1, limit = 10, search, isActive } = queryParams;

    const result = await TheaterUserArray.getByTheater(theaterId, {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined
    });

    return {
      users: result.users,
      pagination: result.pagination,
      summary: result.summary,
      theater: result.theater
    };
  }

  /**
   * Create theater user
   */
  async createTheaterUser(userData) {
    console.log('🔵 [TheaterUserService] Creating user with data:', userData);
    
    const {
      theaterId,
      theater,
      username,
      email,
      password,
      fullName,
      phoneNumber,
      pin,
      role,
      permissions,
      isActive = true,
      isEmailVerified = false
    } = userData;

    const finalTheaterId = theaterId || theater;
    
    if (!finalTheaterId) {
      throw new Error('Theater ID is required');
    }

    console.log('✅ [TheaterUserService] Using theater ID:', finalTheaterId);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✅ [TheaterUserService] Password hashed');

    // DON'T hash PIN - let the model handle PIN generation or use raw PIN
    // The model stores PIN as plain text (4 digits) for easy validation
    const finalPin = pin || null; // If no pin provided, model will generate it

    let usersDoc = await TheaterUserArray.findOrCreateByTheater(finalTheaterId);
    console.log('✅ [TheaterUserService] Users document found/created:', usersDoc._id);

    const newUser = await usersDoc.addUser({
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      pin: finalPin, // Use raw PIN, not hashed
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      role: role || null,
      permissions: permissions || {},
      isActive,
      isEmailVerified
    });

    console.log('✅ [TheaterUserService] User added successfully:', newUser._id);

    // Populate theater info
    await usersDoc.populate('theaterId', 'name location address');
    console.log('✅ [TheaterUserService] Theater info populated');

    return {
      user: newUser,
      theater: usersDoc.theaterId,
      metadata: usersDoc.metadata
    };
  }

  /**
   * Update theater user
   */
  async updateTheaterUser(userId, updateData) {
    console.log('🔵 [TheaterUserService] Updating user:', userId);
    
    // Fix: Use correct field name 'users' not 'userList'
    const usersDoc = await TheaterUserArray.findOne({ 'users._id': userId }).maxTimeMS(5000);
    if (!usersDoc) {
      throw new Error('User not found');
    }

    const user = usersDoc.users.id(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (updateData.password) {
      user.password = await bcrypt.hash(updateData.password, 10);
    }
    if (updateData.pin) {
      // Store PIN as plain text (4 digits) - model validates it
      user.pin = updateData.pin;
    }
    if (updateData.fullName) user.fullName = updateData.fullName.trim();
    if (updateData.phoneNumber) user.phoneNumber = updateData.phoneNumber.trim();
    if (updateData.email) user.email = updateData.email.trim().toLowerCase();
    if (updateData.role !== undefined) user.role = updateData.role;
    if (updateData.permissions) user.permissions = updateData.permissions;
    if (updateData.isActive !== undefined) user.isActive = updateData.isActive;
    if (updateData.isEmailVerified !== undefined) user.isEmailVerified = updateData.isEmailVerified;

    user.updatedAt = new Date();
    await usersDoc.save();

    console.log('✅ [TheaterUserService] User updated successfully');
    
    return user;
  }

  /**
   * Delete theater user
   */
  async deleteTheaterUser(userId) {
    console.log('🔵 [TheaterUserService] Deleting user:', userId);
    
    // Fix: Use correct field name 'users' not 'userList'
    const usersDoc = await TheaterUserArray.findOne({ 'users._id': userId }).maxTimeMS(5000);
    if (!usersDoc) {
      throw new Error('User not found');
    }

    const user = usersDoc.users.id(userId);
    if (!user) {
      throw new Error('User not found');
    }

    usersDoc.users.pull(userId);
    await usersDoc.save();

    console.log('✅ [TheaterUserService] User deleted successfully');

    return true;
  }
}

module.exports = new TheaterUserService();

