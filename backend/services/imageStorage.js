const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

class ImageStorageService {
  constructor() {
    this.baseDir = path.join(__dirname, '../assets');
    this.reportsDir = path.join(this.baseDir, 'reports');
    this.profilesDir = path.join(this.baseDir, 'profiles');
    this.eventsDir = path.join(this.baseDir, 'events');

    // Ensure directories exist
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.reportsDir, this.profilesDir, this.eventsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Generate secure filename
  generateFilename(originalName, prefix = 'file') {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName).toLowerCase();
    return `${prefix}_${timestamp}_${randomBytes}${extension}`;
  }

  // Process and save image with optimization
  async processAndSaveImage(
    buffer,
    originalName,
    type = 'report',
    options = {}
  ) {
    try {
      const filename = this.generateFilename(originalName, type);
      const dir = this.getDirectory(type);
      const filepath = path.join(dir, filename);

      // Process image with Sharp
      let imageProcessor = sharp(buffer);

      // Resize if options provided
      if (options.width || options.height) {
        imageProcessor = imageProcessor.resize(options.width, options.height, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Convert to appropriate format and quality
      if (type === 'profile') {
        // Profile images: convert to JPEG, 80% quality, max 400x400
        imageProcessor = imageProcessor
          .resize(400, 400, { fit: 'cover' })
          .jpeg({ quality: 80 });
      } else if (type === 'event') {
        // Event images: convert to JPEG, 85% quality, max 800x600
        imageProcessor = imageProcessor
          .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 });
      } else {
        // Report images: convert to JPEG, 90% quality, max 1200x900
        imageProcessor = imageProcessor
          .resize(1200, 900, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90 });
      }

      // Save processed image
      await imageProcessor.toFile(filepath);

      return {
        filename,
        filepath,
        url: this.getImageUrl(filename, type),
        size: fs.statSync(filepath).size
      };
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Failed to process image');
    }
  }

  // Get directory based on type
  getDirectory(type) {
    switch (type) {
      case 'profile':
        return this.profilesDir;
      case 'event':
        return this.eventsDir;
      case 'report':
      default:
        return this.reportsDir;
    }
  }

  // Generate public URL for image
  getImageUrl(filename, type = 'report') {
    // Return just the path, not the full URL
    // The frontend will add the base URL
    return `/assets/${type}s/${filename}`;
  }

  // Delete image file
  async deleteImage(filename, type = 'report') {
    try {
      const dir = this.getDirectory(type);
      const filepath = path.join(dir, filename);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting image:', error);
      return false;
    }
  }

  // Get image info
  async getImageInfo(filename, type = 'report') {
    try {
      const dir = this.getDirectory(type);
      const filepath = path.join(dir, filename);

      if (!fs.existsSync(filepath)) {
        return null;
      }

      const stats = fs.statSync(filepath);
      const metadata = await sharp(filepath).metadata();

      return {
        filename,
        size: stats.size,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        url: this.getImageUrl(filename, type),
        createdAt: stats.birthtime
      };
    } catch (error) {
      console.error('Error getting image info:', error);
      return null;
    }
  }

  // Clean up orphaned files (files not referenced in database)
  async cleanupOrphanedFiles() {
    const prisma = require('./database');

    try {
      // Get all files in directories
      const allFiles = [];
      [this.reportsDir, this.profilesDir, this.eventsDir].forEach((dir) => {
        const files = fs.readdirSync(dir);
        files.forEach((file) => {
          allFiles.push({ filename: file, dir });
        });
      });

      // Get all referenced files from database
      const [reportAttachments, userProfiles, eventImages] = await Promise.all([
        prisma.attachment.findMany({ select: { filename: true } }),
        prisma.user.findMany({
          where: { profilePicture: { not: null } },
          select: { profilePicture: true }
        }),
        prisma.event.findMany({
          where: { imageUrl: { not: null } },
          select: { imageUrl: true }
        }),
      ]);

      const referencedFiles = new Set();

      // Add referenced files to set
      reportAttachments.forEach((att) => referencedFiles.add(att.filename));
      userProfiles.forEach((user) => referencedFiles.add(user.profilePicture));
      eventImages.forEach((event) => {
        if (event.imageUrl) {
          const filename = path.basename(event.imageUrl);
          referencedFiles.add(filename);
        }
      });

      // Delete orphaned files
      let deletedCount = 0;
      for (const file of allFiles) {
        if (!referencedFiles.has(file.filename)) {
          try {
            fs.unlinkSync(path.join(file.dir, file.filename));
            deletedCount++;
          } catch (error) {
            console.error(
              `Error deleting orphaned file ${file.filename}:`,
              error
            );
          }
        }
      }

      console.log(`Cleaned up ${deletedCount} orphaned files`);
      return deletedCount;
    } catch (error) {
      console.error('Error during cleanup:', error);
      return 0;
    }
  }
}

module.exports = new ImageStorageService();
