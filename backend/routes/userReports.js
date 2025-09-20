const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleAuth');
const { postLimiter, heavyGetLimiter } = require('../middleware/rateLimiter');
const {
  createUserReport,
  getUserReports,
  updateUserReportStatus,
  getUserReportAnalytics
} = require('../controllers/userReportsController');

// All routes require authentication
router.use(authMiddleware);

// POST /api/user-reports - Create new user report (All users)
router.post('/', postLimiter, createUserReport);

// GET /api/user-reports - Get user reports (Admin only)
router.get('/', heavyGetLimiter, requireAdmin, getUserReports);

// GET /api/user-reports/analytics - Get user report analytics (Admin only)
router.get('/analytics', heavyGetLimiter, requireAdmin, getUserReportAnalytics);

// PATCH /api/user-reports/:id/status - Update user report status (Admin only)
router.patch('/:id/status', postLimiter, requireAdmin, updateUserReportStatus);

module.exports = router;
