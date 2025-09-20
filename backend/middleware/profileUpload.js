const multer = require('multer');

// Configure multer for memory storage (for image processing)
const storage = multer.memoryStorage();

// File filter for profile pictures with enhanced validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Check file extension
  if (!allowedExtensions.includes(fileExtension)) {
    return cb(
      new Error(
        'Invalid file extension. Only JPG, PNG, and WebP images are allowed for profile pictures.'
      ),
      false
    );
  }

  // Check MIME type
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error(
        'Invalid file type. Only JPG, PNG, and WebP images are allowed for profile pictures.'
      ),
      false
    );
  }

  // Additional validation - ensure it's actually an image
  if (!file.mimetype.startsWith('image/')) {
    return cb(
      new Error('Only image files are allowed for profile pictures.'),
      false
    );
  }

  cb(null, true);
};

// Create multer instance for profile pictures
const profileUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only one file at a time
  },
});

// Error handling middleware
const handleProfileUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Profile picture file too large. Maximum size is 5MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Only one profile picture file is allowed.'
      });
    }
  }

  if (error.message === 'Only image files are allowed for profile pictures') {
    return res.status(400).json({
      error: 'Only image files are allowed for profile pictures.'
    });
  }

  next(error);
};

module.exports = {
  profileUpload,
  handleProfileUploadError
};
