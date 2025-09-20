const express = require('express');
const router = express.Router();
const {
  uploadFiles,
  getAttachments,
  getAttachment,
  deleteAttachment,
} = require('../controllers/attachmentsController');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');

// Configure multer for memory storage (for image processing)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Maximum 10 files per request
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

// Apply auth middleware to all routes
router.use(authMiddleware);

// POST /api/attachments/:reportId/upload - Upload files for a report
router.post(
  '/:reportId/upload',
  upload.array('files', 10),
  uploadFiles
);

// GET /api/attachments/:reportId - Get attachments for a report
router.get('/:reportId', getAttachments);

// GET /api/attachments/file/:attachmentId - Download/view an attachment
router.get('/file/:attachmentId', getAttachment);

// DELETE /api/attachments/:attachmentId - Delete an attachment
router.delete('/:attachmentId', deleteAttachment);

module.exports = router;
