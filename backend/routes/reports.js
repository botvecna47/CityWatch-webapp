const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
// const { requireAdmin } = require('../middleware/roleAuth'); // Not used in this file
const { heavyGetLimiter, postLimiter } = require('../middleware/rateLimiter');
const multer = require('multer');

// Configure multer for memory storage (for image processing)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});
const {
  createReport,
  getReports,
  getAllReportsForMap,
  getReportById,
  addAuthorityUpdate,
  closeReport,
  deleteReport,
  getReportTimeline,
  getNearbyReports,
  checkDuplicateReport,
  verifyReport,
  getReportVerification,
  voteOnReport,
  getUserVote,
  reportMisleadingContent,
} = require('../controllers/reportsController');

// All routes require authentication
router.use(authMiddleware);

// POST /api/reports - Create new report (Citizens only - enforced in controller)
router.post('/', postLimiter, createReport);

// POST /api/reports/check-duplicate - Check for duplicate reports
router.post('/check-duplicate', postLimiter, checkDuplicateReport);

// GET /api/reports - Get reports list (filtered by user's city)
router.get('/', heavyGetLimiter, getReports);

// GET /api/reports/nearby - Get reports near a location
router.get('/nearby', heavyGetLimiter, getNearbyReports);

// GET /api/reports/map/all - Get all reports with location data for map display
router.get('/map/all', heavyGetLimiter, getAllReportsForMap);

// GET /api/reports/:id - Get single report
router.get('/:id', heavyGetLimiter, getReportById);

// GET /api/reports/:id/timeline - Get report timeline
router.get('/:id/timeline', heavyGetLimiter, getReportTimeline);

// POST /api/reports/:id/updates - Add authority update (Authority/Admin only - enforced in controller)
router.post(
  '/:id/updates',
  postLimiter,
  upload.array('resolutionImages', 5),
  addAuthorityUpdate
);

// PATCH /api/reports/:id/close - Close report (Author only - enforced in controller)
router.patch('/:id/close', postLimiter, closeReport);

// DELETE /api/reports/:id - Delete report (Admin only - enforced in controller)
router.delete('/:id', postLimiter, deleteReport);

// POST /api/reports/:id/verify - Verify report resolution (Citizens only)
router.post('/:id/verify', postLimiter, verifyReport);

// GET /api/reports/:id/verification - Get report verification status
router.get('/:id/verification', getReportVerification);

// POST /api/reports/:id/vote - Vote on report severity (Citizens only)
router.post('/:id/vote', postLimiter, voteOnReport);

// GET /api/reports/:id/vote - Get user's vote on report
router.get('/:id/vote', getUserVote);

// POST /api/reports/:id/report-misleading - Report misleading content
router.post('/:id/report-misleading', postLimiter, reportMisleadingContent);

module.exports = router;
