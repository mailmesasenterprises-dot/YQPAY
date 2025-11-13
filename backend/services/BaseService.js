/**
 * Base Service Class
 * Provides common database operations and utilities
 */
class BaseService {
  constructor(model) {
    this.model = model;
  }

  /**
   * Find all with pagination and filtering
   */
  async findAll(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = { createdAt: -1 },
      select = null,
      populate = null,
      lean = true
    } = options;

    const skip = (page - 1) * limit;

    const query = this.model.find(filter);

    if (select) query.select(select);
    if (populate) query.populate(populate);
    if (sort) query.sort(sort);
    
    query.skip(skip).limit(limit);
    
    if (lean) query.lean();

    const [data, total] = await Promise.all([
      query.maxTimeMS(5000),
      this.model.countDocuments(filter).maxTimeMS(3000)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        current: page,
        limit,
        total,
        totalItems: total,
        pages: totalPages,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Find one by ID
   */
  async findById(id, options = {}) {
    const {
      select = null,
      populate = null,
      lean = true
    } = options;

    const query = this.model.findById(id);

    if (select) query.select(select);
    if (populate) query.populate(populate);
    if (lean) query.lean();

    return query.maxTimeMS(5000);
  }

  /**
   * Find one by filter
   */
  async findOne(filter, options = {}) {
    const {
      select = null,
      populate = null,
      lean = true
    } = options;

    const query = this.model.findOne(filter);

    if (select) query.select(select);
    if (populate) query.populate(populate);
    if (lean) query.lean();

    return query.maxTimeMS(5000);
  }

  /**
   * Create new document
   */
  async create(data) {
    const document = new this.model(data);
    return document.save();
  }

  /**
   * Update by ID
   */
  async updateById(id, data, options = {}) {
    const {
      new: returnNew = true,
      runValidators = true
    } = options;

    return this.model.findByIdAndUpdate(
      id,
      data,
      { new: returnNew, runValidators }
    );
  }

  /**
   * Delete by ID
   */
  async deleteById(id) {
    return this.model.findByIdAndDelete(id);
  }

  /**
   * Count documents
   */
  async count(filter = {}) {
    return this.model.countDocuments(filter).maxTimeMS(3000);
  }

  /**
   * Check if document exists
   */
  async exists(filter) {
    return this.model.exists(filter);
  }
}

module.exports = BaseService;

