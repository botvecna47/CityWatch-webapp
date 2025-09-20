const multer = require('multer');

// Configure multer for memory storage (for image processing)
const storage = multer.memoryStorage();

// File filter for event images
const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(
      new Error(
        'Only image files (JPG, PNG, WebP) are allowed for event images'
      )
    );
  }
};

// Configure multer
const eventUpload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Error handling middleware
const handleEventUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Event image file too large. Maximum size is 5MB.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected field name for event image upload.'
      });
    }
  }

  if (error.message.includes('Only image files')) {
    return res.status(400).json({
      error: error.message
    });
  }

  next(error);
};

module.exports = {
  eventUpload,
  handleEventUploadError
};
