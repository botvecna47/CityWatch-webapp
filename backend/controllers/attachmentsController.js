const prisma = require('../services/database');
const imageStorage = require('../services/imageStorage');
const path = require('path');
const fs = require('fs');

// Upload files for a report
const uploadFiles = async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user.id;

    // Check if report exists and user has access to it
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        deleted: false,
        // Only citizens can upload files, and only to their own reports
        authorId: userId,
        ...(req.user.role !== 'admin' && {
          cityId: req.user.cityId
        }),
      }
    });

    if (!report) {
      return res
        .status(404)
        .json({ error: 'Report not found or access denied' });
    }

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Process uploaded files using image storage service
    const attachments = [];
    for (const file of req.files) {
      try {
        // Process and save image with optimization
        const processedImage = await imageStorage.processAndSaveImage(
          file.buffer,
          file.originalname,
          'report'
        );

        const attachment = await prisma.attachment.create({
          data: {
            filename: processedImage.filename,
            filepath: processedImage.filename, // Store only the filename
            mimetype: file.mimetype,
            size: processedImage.size,
            reportId
          },
        });
        attachments.push({
          ...attachment,
          url: processedImage.url
        });
      } catch (error) {
        console.error('Error processing file:', error);
        // Clean up any partially processed files
        if (processedImage && processedImage.filename) {
          await imageStorage.deleteImage(processedImage.filename, 'report');
        }
        throw error;
      }
    }

    res.status(201).json({
      message: 'Files uploaded successfully',
      attachments
    });
  } catch (error) {
    console.error('Upload files error:', error);

    // Clean up uploaded files if database operation fails
    if (req.files) {
      req.files.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({ error: 'Failed to upload files' });
  }
};

// Get attachments for a report
const getAttachments = async (req, res) => {
  try {
    const { reportId } = req.params;

    // Check if report exists and user has access to it
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        deleted: false,
        // User must be in the same city as the report (unless admin)
        ...(req.user.role !== 'admin' && {
          cityId: req.user.cityId
        }),
      }
    });

    if (!report) {
      return res
        .status(404)
        .json({ error: 'Report not found or access denied' });
    }

    // Get attachments
    const attachments = await prisma.attachment.findMany({
      where: { reportId },
      orderBy: { createdAt: 'asc' }
    });

    // Add full URLs to attachments
    const attachmentsWithUrls = attachments.map((attachment) => ({
      ...attachment,
      url: imageStorage.getImageUrl(attachment.filename, 'report')
    }));

    res.json(attachmentsWithUrls);
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
};

// Download/View an attachment
const getAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;

    // Get attachment info
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        report: true
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Check if user has access to the report
    const hasAccess =
      req.user.role === 'admin' || attachment.report.cityId === req.user.cityId;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Construct full file path
    const fullFilePath = path.join(
      __dirname,
      '../assets/reports',
      attachment.filepath
    );

    // Check if file exists
    if (!fs.existsSync(fullFilePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', attachment.mimetype);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${attachment.filename}"`
    );

    // Send file
    res.sendFile(fullFilePath);
  } catch (error) {
    console.error('Get attachment error:', error);
    res.status(500).json({ error: 'Failed to fetch attachment' });
  }
};

// Delete an attachment (admin only or report author)
const deleteAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;

    // Get attachment info
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        report: true
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Check if user has access
    const hasAccess =
      req.user.role === 'admin' || attachment.report.authorId === req.user.id;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete file from filesystem using image storage service
    await imageStorage.deleteImage(attachment.filename, 'report');

    // Delete from database
    await prisma.attachment.delete({
      where: { id: attachmentId }
    });

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
};

module.exports = {
  uploadFiles,
  getAttachments,
  getAttachment,
  deleteAttachment
};
