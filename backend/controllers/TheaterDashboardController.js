const BaseController = require('./BaseController');
const theaterDashboardService = require('../services/TheaterDashboardService');

/**
 * Theater Dashboard Controller
 */
class TheaterDashboardController extends BaseController {
  /**
   * GET /api/theater-dashboard/:theaterId
   */
  static async getDashboard(req, res) {
    try {
      const result = await theaterDashboardService.getTheaterDashboard(req.params.theaterId);
      return BaseController.success(res, result);
    } catch (error) {
      console.error('Get theater dashboard error:', error);
      if (error.message === 'Theater not found') {
        return BaseController.error(res, error.message, 404);
      }
      return BaseController.error(res, 'Failed to fetch theater dashboard', 500, {
        message: error.message
      });
    }
  }
}

module.exports = TheaterDashboardController;

