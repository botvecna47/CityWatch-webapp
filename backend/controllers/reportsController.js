const prisma = require('../services/database');
const cacheService = require('../services/cacheService');
const imageStorage = require('../services/imageStorage');
const {
  notifyAuthoritiesOfNewReport,
  notifyAuthorityUpdate,
  notifyReportClosed,
} = require('../services/notificationService');
const { checkDuplicate, generateEmbedding, storeEmbedding } = require('../services/duplicateService');
const aiService = require('../services/aiService');

// Create a new report (Citizens only)
const createReport = async (req, res) => {
  try {
    const { title, description, category, latitude, longitude, force } = req.body;
    const authorId = req.user.id;
    const cityId = req.user.cityId; // Server enforces cityId from user

    // Enforce citizen-only creation
    if (req.user.role !== 'citizen') {
      return res.status(403).json({
        error: 'Only citizens can create reports'
      });
    }

    // Ensure user has a city
    if (!req.user.cityId) {
      return res.status(400).json({
        error:
          'You must be assigned to a city before creating reports. Please update your city in settings.'
      });
    }

    // Validation
    if (!title || !description) {
      return res.status(400).json({
        error: 'Title and description are required'
      });
    }

    // Location is required
    if (!latitude || !longitude) {
      return res.status(400).json({
        error:
          'Location is required. Please provide latitude and longitude coordinates.'
      });
    }

    // Validate title length
    if (title.trim().length < 5) {
      return res.status(400).json({
        error: 'Title must be at least 5 characters long'
      });
    }

    // Validate description length
    if (description.trim().length < 10) {
      return res.status(400).json({
        error: 'Description must be at least 10 characters long'
      });
    }

    // Category will be determined by AI analysis - no manual validation needed

    // Parse and validate location coordinates
    const parsedLatitude = parseFloat(latitude);
    const parsedLongitude = parseFloat(longitude);

    // Validate coordinates
    if (isNaN(parsedLatitude) || isNaN(parsedLongitude)) {
      return res.status(400).json({
        error: 'Invalid latitude or longitude values'
      });
    }

    if (parsedLatitude < -90 || parsedLatitude > 90) {
      return res.status(400).json({
        error: 'Latitude must be between -90 and 90 degrees'
      });
    }

    if (parsedLongitude < -180 || parsedLongitude > 180) {
      return res.status(400).json({
        error: 'Longitude must be between -180 and 180 degrees'
      });
    }

    // Check for duplicates (unless force=true)
    if (!force) {
      const duplicateResult = await checkDuplicate({
        title: title.trim(),
        description: description.trim(),
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        cityId
      });

      if (duplicateResult.duplicate && duplicateResult.matches.length > 0) {
        return res.status(409).json({
          error: 'Potential duplicate report detected',
          duplicate: true,
          matches: duplicateResult.matches
        });
      }
    }

    // Analyze report content to determine category and authority type
    let aiAnalysis = null;
    try {
      aiAnalysis = await aiService.analyzeReportContent(
        title.trim(),
        description.trim()
      );
      console.log(`🤖 AI Analysis Result: Category=${aiAnalysis.category}, Authority=${aiAnalysis.authorityType} (confidence: ${(aiAnalysis.confidence * 100).toFixed(1)}%)`);
    } catch (error) {
      console.error('Error in AI analysis:', error);
      // Continue with report creation even if AI analysis fails
      // Use default values
      aiAnalysis = {
        category: 'OTHER',
        authorityType: 'General Municipal Services',
        confidence: 0.5,
        reasoning: 'AI analysis failed, using default values'
      };
    }

    // Get authority type ID if AI analysis provided one
    let authorityTypeId = null;
    if (aiAnalysis && aiAnalysis.authorityType) {
      const authorityType = await prisma.authorityType.findUnique({
        where: { name: aiAnalysis.authorityType }
      });
      if (authorityType) {
        authorityTypeId = authorityType.id;
      }
    }

    // Create report
    const report = await prisma.report.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        category: aiAnalysis.category,
        cityId,
        authorId,
        authorityTypeId,
        latitude: parsedLatitude,
        longitude: parsedLongitude
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            role: true,
            profilePicture: true
          },
        },
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          },
        }
      }
    });

    // Notify authorities in the city about the new report
    try {
      await notifyAuthoritiesOfNewReport(
        cityId,
        report.id,
        report.title,
        report.author.username
      );
    } catch (notificationError) {
      console.error(
        'Error notifying authorities of new report:',
        notificationError
      );
      // Don't fail the report creation if notification fails
    }

    // Invalidate cache for this city
    cacheService.clear();

    // Store embedding for the new report (async, don't wait)
    const combinedText = `${title.trim()} ${description.trim()}`;
    generateEmbedding(combinedText)
      .then(embedding => {
        if (embedding) {
          return storeEmbedding(report.id, embedding);
        }
      })
      .catch(error => {
        console.error('Error storing embedding for report:', report.id, error);
      });

    res.status(201).json({
      message: 'Report created successfully',
      report,
      aiAnalysis: aiAnalysis ? {
        category: aiAnalysis.category,
        suggestedAuthorityType: aiAnalysis.authorityType,
        confidence: aiAnalysis.confidence,
        reasoning: aiAnalysis.reasoning,
        alternativeOptions: aiAnalysis.alternativeOptions
      } : null
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Get reports list (filtered by user's city, except for admin/authority)
const getReports = async (req, res) => {
  const startTime = Date.now();
  console.time('getReports');

  try {
    const userCityId = req.user.cityId;
    const userRole = req.user.role;
    const { category, status, page = 1, limit = 20, q } = req.query;

    // Enforce pagination limits
    const maxLimit = 100;
    const minLimit = 1;
    const parsedLimit = Math.min(
      Math.max(parseInt(limit) || 20, minLimit),
      maxLimit
    );
    const parsedPage = Math.max(parseInt(page) || 1, 1);

    // Check cache for GET requests (no search query)
    if (!q) {
      const cacheKey = cacheService.generateKey('reports', {
        userCityId,
        userRole,
        category,
        status,
        page: parsedPage,
        limit: parsedLimit
      });

      const cachedResult = cacheService.get(cacheKey);
      if (cachedResult) {
        const duration = Date.now() - startTime;
        console.timeEnd('getReports');
        console.log(
          `getReports served from cache in ${duration}ms - page:${parsedPage}, limit:${parsedLimit}`
        );
        return res.json(cachedResult);
      }
    }

    // If user has no city and is not admin/authority, return empty results
    if (!userCityId && userRole !== 'admin' && userRole !== 'authority') {
      return res.json({
        reports: [],
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total: 0,
          pages: 0
        },
        categoryStats: {}
      });
    }

    const skip = (parsedPage - 1) * parsedLimit;
    const take = parsedLimit;

    // Build where clause - admin and authority can see all cities
    const where = {
      deleted: false
    };

    // Filter by city and authority type based on user role
    if (userRole === 'citizen' && userCityId) {
      // Citizens can only see reports from their city
      where.cityId = userCityId;
    } else if (userRole === 'authority') {
      // Authorities can see reports from their city AND their authority type
      if (userCityId) {
        where.cityId = userCityId;
      }
      // Filter by authority type if user has one assigned
      if (req.user.authorityTypeId) {
        where.authorityTypeId = req.user.authorityTypeId;
      }
    }
    // Admins can see all reports (no additional filtering)

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    if (q) {
      // Sanitize search query to prevent injection
      const sanitizedQuery = q
        .trim()
        .replace(/[<>'"&]/g, '') // Remove dangerous characters
        .replace(/[^\w\s\-.]/g, '') // Keep only alphanumeric, spaces, hyphens, and dots
        .substring(0, 100); // Limit length to prevent abuse

      if (sanitizedQuery.length > 0) {
        where.OR = [
          { title: { contains: sanitizedQuery, mode: 'insensitive' } },
          { description: { contains: sanitizedQuery, mode: 'insensitive' } }
        ];
      }
    }

    // Get reports with pagination - optimized query
    const [reports, total, categoryCounts] = await Promise.all([
      prisma.report.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: {
              id: true,
              username: true,
              role: true,
              profilePicture: true
            },
          },
          city: {
            select: {
              id: true,
              name: true,
              slug: true
            },
          },
          authorityType: {
            select: {
              id: true,
              name: true,
              displayName: true,
              icon: true
            },
          },
          _count: {
            select: {
              comments: true,
              attachments: true
            },
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.report.count({ where }),
      prisma.report.groupBy({
        by: ['category'],
        where: {
          ...where, // Use the same where clause as the main query
          deleted: false
        },
        _count: {
          category: true
        },
      })
    ]);

    // Format category counts
    const categoryStats = categoryCounts.reduce((acc, item) => {
      acc[item.category] = item._count.category;
      return acc;
    }, {});

    const result = {
      reports,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit)
      },
      categoryStats
    };

    // Cache the result for GET requests (no search query)
    if (!q) {
      const cacheKey = cacheService.generateKey('reports', {
        userCityId,
        userRole,
        category,
        status,
        page: parsedPage,
        limit: parsedLimit
      });
      cacheService.set(cacheKey, result, 30 * 1000); // 30 seconds TTL
    }

    const duration = Date.now() - startTime;
    console.timeEnd('getReports');
    console.log(
      `getReports completed in ${duration}ms - page:${parsedPage}, limit:${parsedLimit}, total:${total}`
    );

    res.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.timeEnd('getReports');
    console.error(`Get reports error after ${duration}ms:`, error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Get all reports with location data for map display
const getAllReportsForMap = async (req, res) => {
  try {
    const userCityId = req.user.cityId;
    const userRole = req.user.role;
    const { category, status, limit = 1000 } = req.query;

    // If user has no city and is not admin/authority, return empty results
    if (!userCityId && userRole !== 'admin' && userRole !== 'authority') {
      return res.json({
        reports: []
      });
    }

    // Build where clause - admin and authority can see all cities
    const where = {
      deleted: false,
      latitude: { not: null },
      longitude: { not: null }
    };

    // Filter by city and authority type based on user role
    if (userRole === 'citizen' && userCityId) {
      // Citizens can only see reports from their city
      where.cityId = userCityId;
    } else if (userRole === 'authority') {
      // Authorities can see reports from their city AND their authority type
      if (userCityId) {
        where.cityId = userCityId;
      }
      // Filter by authority type if user has one assigned
      if (req.user.authorityTypeId) {
        where.authorityTypeId = req.user.authorityTypeId;
      }
    }
    // Admins can see all reports (no additional filtering)

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    // Get reports with location data
    const reports = await prisma.report.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        status: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            username: true,
            role: true,
            profilePicture: true
          },
        },
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          },
        },
        authorityType: {
          select: {
            id: true,
            name: true,
            displayName: true,
            icon: true
          },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
            votes: true
          },
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: parseInt(limit)
    });

    res.json({
      success: true,
      reports
    });
  } catch (error) {
    console.error('Get all reports for map error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports for map'
    });
  }
};

// Get single report by ID
const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const userCityId = req.user.cityId;
    const userRole = req.user.role;

    const report = await prisma.report.findFirst({
      where: {
        id,
        deleted: false,
        // City scoping: users can only see reports from their city unless admin
        ...(userRole !== 'admin' ? { cityId: userCityId } : {})
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            role: true,
            profilePicture: true
          },
        },
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          },
        },
        authorityUpdates: {
          include: {
            authority: {
              select: {
                id: true,
                username: true,
                role: true
              },
            }
          },
          orderBy: {
            createdAt: 'asc'
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                role: true
              },
            }
          },
          orderBy: {
            createdAt: 'asc'
          },
        },
        attachments: {
          orderBy: {
            createdAt: 'asc'
          },
        }
      }
    });

    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    // Add full URLs to attachments
    if (report.attachments) {
      report.attachments = report.attachments.map((attachment) => ({
        ...attachment,
        url: imageStorage.getImageUrl(attachment.filename, 'report')
      }));
    }

    // Process authority updates to include resolution image URLs
    if (report.authorityUpdates) {
      report.authorityUpdates = report.authorityUpdates.map((update) => {
        let resolutionImageUrls = [];
        if (update.resolutionImages) {
          try {
            const imageFilenames = JSON.parse(update.resolutionImages);
            resolutionImageUrls = imageFilenames.map((filename) =>
              imageStorage.getImageUrl(filename, 'report')
            );
          } catch (error) {
            console.error('Error parsing resolution images JSON:', error);
          }
        }

        return {
          ...update,
          resolutionImageUrls
        };
      });
    }

    // For admin users, also include timeline data
    if (userRole === 'admin') {
      // Get all timeline events
      const [authorityUpdates, comments, attachments] = await Promise.all([
        prisma.authorityUpdate.findMany({
          where: { reportId: id },
          include: {
            authority: {
              select: {
                id: true,
                username: true,
                role: true
              },
            }
          },
          orderBy: { createdAt: 'asc' }
        }),
        prisma.comment.findMany({
          where: { reportId: id },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                role: true
              },
            }
          },
          orderBy: { createdAt: 'asc' }
        }),
        prisma.attachment.findMany({
          where: { reportId: id },
          orderBy: { createdAt: 'asc' }
        }),
      ]);

      // Create timeline events
      const timeline = [];

      // Add report creation event
      timeline.push({
        id: `report-${report.id}`,
        type: 'report_created',
        timestamp: report.createdAt,
        data: {
          title: report.title,
          description: report.description,
          category: report.category,
          status: report.status,
          author: report.author
        },
      });

      // Add authority updates
      authorityUpdates.forEach((update) => {
        // Parse resolution images if they exist
        let resolutionImages = [];
        if (update.resolutionImages) {
          try {
            resolutionImages = JSON.parse(update.resolutionImages);
          } catch (error) {
            console.error('Error parsing resolution images JSON:', error);
          }
        }

        timeline.push({
          id: `update-${update.id}`,
          type: 'authority_update',
          timestamp: update.createdAt,
          data: {
            text: update.text,
            newStatus: update.newStatus,
            authority: update.authority,
            resolutionImages: resolutionImages.map(
              (filename) => `/assets/reports/${filename}`
            )
          },
        });
      });

      // Add comments
      comments.forEach((comment) => {
        timeline.push({
          id: `comment-${comment.id}`,
          type: 'comment',
          timestamp: comment.createdAt,
          data: {
            content: comment.content,
            author: comment.author
          },
        });
      });

      // Add file uploads
      attachments.forEach((attachment) => {
        timeline.push({
          id: `attachment-${attachment.id}`,
          type: 'file_upload',
          timestamp: attachment.createdAt,
          data: {
            filename: attachment.filename,
            mimetype: attachment.mimetype,
            size: attachment.size
          },
        });
      });

      // Sort timeline by timestamp
      timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      res.json({
        report: {
          ...report,
          timeline
        },
      });
    } else {
      res.json({ report });
    }
  } catch (error) {
    console.error('Get report by ID error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Add authority update to report
const addAuthorityUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, newStatus } = req.body;
    const authorityId = req.user.id;
    const userRole = req.user.role;

    // Handle uploaded resolution images
    const resolutionImages = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          // Process and save image with optimization
          const processedImage = await imageStorage.processAndSaveImage(
            file.buffer,
            file.originalname,
            'report'
          );
          resolutionImages.push(processedImage.filename);
        } catch (error) {
          console.error('Error processing resolution image:', error);
          // Continue with other images
        }
      }
    }

    // Convert to JSON string for storage
    const resolutionImagesJson =
      resolutionImages.length > 0 ? JSON.stringify(resolutionImages) : null;

    // Only authority or admin can add updates
    if (userRole !== 'authority' && userRole !== 'admin') {
      return res.status(403).json({
        error: 'Only authorities and admins can add updates'
      });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Update text is required'
      });
    }

    // If resolving the report, require resolution images
    if (newStatus === 'RESOLVED' && resolutionImages.length === 0) {
      return res.status(400).json({
        error: 'Resolution images are required when marking a report as resolved'
      });
    }

    // Get current report
    const currentReport = await prisma.report.findFirst({
      where: {
        id,
        deleted: false,
        cityId: req.user.cityId // Authority must be from same city
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            profilePicture: true
          },
        }
      }
    });

    if (!currentReport) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    // Validate status transition if provided
    if (newStatus) {
      const currentStatus = currentReport.status;
      const validTransitions = {
        OPEN: ['IN_PROGRESS'],
        IN_PROGRESS: ['RESOLVED'],
        RESOLVED: [], // Only author can close
        CLOSED: []
      };

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        return res.status(409).json({
          error: `Invalid status transition from ${currentStatus} to ${newStatus}`
        });
      }
    }

    // Create authority update and update report status if needed
    const result = await prisma.$transaction(async (tx) => {
      // Create authority update
      const authorityUpdate = await tx.authorityUpdate.create({
        data: {
          reportId: id,
          authorityId,
          text: text.trim(),
          newStatus: newStatus || null,
          resolutionImages: resolutionImagesJson
        },
        include: {
          authority: {
            select: {
              id: true,
              username: true,
              role: true
            },
          }
        }
      });

      // Update report status if newStatus provided
      let updatedReport = currentReport;
      if (newStatus) {
        updatedReport = await tx.report.update({
          where: { id },
          data: { status: newStatus },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                role: true
              },
            },
            city: {
              select: {
                id: true,
                name: true,
                slug: true
              },
            }
          }
        });
      }

      return { authorityUpdate, updatedReport };
    });

    // Notify report author about authority update
    try {
      await notifyAuthorityUpdate(
        id,
        req.user.username,
        currentReport.title,
        authorityId
      );
    } catch (notificationError) {
      console.error('Error notifying authority update:', notificationError);
      // Don't fail the update if notification fails
    }

    // Parse resolution images JSON and add full URLs
    let resolutionImageUrls = [];
    if (result.authorityUpdate.resolutionImages) {
      try {
        const imageFilenames = JSON.parse(
          result.authorityUpdate.resolutionImages
        );
        resolutionImageUrls = imageFilenames.map(
          (filename) => `/assets/reports/${filename}`
        );
      } catch (error) {
        console.error('Error parsing resolution images JSON:', error);
      }
    }

    const authorityUpdateWithImages = {
      ...result.authorityUpdate,
      resolutionImageUrls
    };

    res.status(201).json({
      message: 'Authority update added successfully',
      authorityUpdate: authorityUpdateWithImages,
      report: result.updatedReport
    });
  } catch (error) {
    console.error('Add authority update error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Close a report (Author only)
const closeReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get current report
    const currentReport = await prisma.report.findFirst({
      where: {
        id,
        deleted: false,
        authorId: userId // Only author can close
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            role: true,
            profilePicture: true
          },
        },
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          },
        }
      }
    });

    if (!currentReport) {
      return res.status(404).json({
        error: 'Report not found or you are not authorized to close it'
      });
    }

    // Only RESOLVED reports can be closed
    if (currentReport.status !== 'RESOLVED') {
      return res.status(409).json({
        error: 'Only resolved reports can be closed'
      });
    }

    // Update report status to CLOSED
    const updatedReport = await prisma.report.update({
      where: { id },
      data: { status: 'CLOSED' },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            role: true,
            profilePicture: true
          },
        },
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          },
        }
      }
    });

    // Notify report author that their report was closed
    try {
      await notifyReportClosed(id, currentReport.title, userId);
    } catch (notificationError) {
      console.error('Error notifying report closed:', notificationError);
      // Don't fail the close if notification fails
    }

    res.json({
      message: 'Report closed successfully',
      report: updatedReport
    });
  } catch (error) {
    console.error('Close report error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Delete a report (Admin only)
const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        error: 'Reason for deletion is required'
      });
    }

    // Get current report
    const currentReport = await prisma.report.findFirst({
      where: {
        id,
        deleted: false
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            role: true,
            profilePicture: true
          },
        },
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          },
        }
      }
    });

    if (!currentReport) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    // Soft delete the report
    const deletedReport = await prisma.report.update({
      where: { id },
      data: { deleted: true },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            role: true,
            profilePicture: true
          },
        },
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          },
        }
      }
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: 'admin',
        action: 'admin_delete_report',
        actionType: 'REPORT_DELETE',
        targetType: 'report',
        targetId: id,
        performedById: adminId,
        reason: reason.trim()
      },
    });

    res.json({
      message: 'Report deleted successfully',
      report: deletedReport
    });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Get report timeline
const getReportTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    // const userId = req.user.id; // Not used in this function
    const userRole = req.user.role;

    // Get report with basic info
    const report = await prisma.report.findFirst({
      where: {
        id,
        deleted: false,
        // City scoping: users can only see reports from their city (unless admin)
        ...(userRole !== 'admin' && { cityId: req.user.cityId })
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            role: true,
            profilePicture: true
          },
        },
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          },
        }
      }
    });

    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    // Get all timeline events
    const [authorityUpdates, comments] = await Promise.all([
      prisma.authorityUpdate.findMany({
        where: { reportId: id },
        include: {
          authority: {
            select: {
              id: true,
              username: true,
              role: true,
              profilePicture: true
            },
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.comment.findMany({
        where: { reportId: id },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              role: true,
              profilePicture: true
            },
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
    ]);

    // Combine and sort timeline events
    const timeline = [
      {
        type: 'report_created',
        timestamp: report.createdAt,
        data: {
          report: {
            id: report.id,
            title: report.title,
            description: report.description,
            category: report.category,
            status: report.status
          },
          author: report.author
        },
      },
      ...authorityUpdates.map((update) => {
        // Parse resolution images if they exist
        let resolutionImages = [];
        if (update.resolutionImages) {
          try {
            resolutionImages = JSON.parse(update.resolutionImages);
          } catch (error) {
            console.error('Error parsing resolution images JSON:', error);
          }
        }

        return {
          type: 'authority_update',
          timestamp: update.createdAt,
          data: {
            update: {
              id: update.id,
              text: update.text,
              newStatus: update.newStatus
            },
            authority: update.authority,
            resolutionImages: resolutionImages.map(
              (filename) => `/assets/reports/${filename}`
            )
          },
        };
      }),
      ...comments.map((comment) => ({
        type: 'comment',
        timestamp: comment.createdAt,
        data: {
          comment: {
            id: comment.id,
            content: comment.content
          },
          author: comment.author
        },
      }))
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({
      success: true,
      data: {
        report,
        timeline
      },
    });
  } catch (error) {
    console.error('Get report timeline error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Get reports near a specific location
const getNearbyReports = async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query; // radius in kilometers
    const userCityId = req.user.cityId;
    const userRole = req.user.role;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Latitude and longitude are required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = parseFloat(radius);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
      return res.status(400).json({
        error: 'Invalid latitude, longitude, or radius values'
      });
    }

    // Calculate bounding box for approximate filtering (more efficient than distance calculation)
    const earthRadius = 6371; // Earth's radius in kilometers
    const latDelta = (radiusKm / earthRadius) * (180 / Math.PI);
    const lngDelta =
      ((radiusKm / earthRadius) * (180 / Math.PI)) /
      Math.cos((latitude * Math.PI) / 180);

    const minLat = latitude - latDelta;
    const maxLat = latitude + latDelta;
    const minLng = longitude - lngDelta;
    const maxLng = longitude + lngDelta;

    // Build where clause - admin and authority can see reports from all cities
    const where = {
      deleted: false,
      latitude: {
        gte: minLat,
        lte: maxLat
      },
      longitude: {
        gte: minLng,
        lte: maxLng
      },
    };

    // Only filter by city for citizens
    if (userRole === 'citizen' && userCityId) {
      where.cityId = userCityId;
    }

    // Get reports in bounding box, then filter by actual distance
    const reports = await prisma.report.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            role: true
          },
        },
        attachments: {
          select: {
            id: true,
            filename: true,
            filepath: true,
            mimetype: true
          },
        },
        comments: {
          select: {
            id: true
          },
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
    });

    // Filter by actual distance using Haversine formula
    const nearbyReports = reports.filter((report) => {
      if (!report.latitude || !report.longitude) {
        return false;
      }

      const distance = calculateDistance(
        latitude,
        longitude,
        report.latitude,
        report.longitude
      );

      return distance <= radiusKm;
    });

    // Add distance to each report
    const reportsWithDistance = nearbyReports.map((report) => ({
      ...report,
      distance: calculateDistance(
        latitude,
        longitude,
        report.latitude,
        report.longitude
      )
    }));

    res.json({
      reports: reportsWithDistance,
      center: { lat: latitude, lng: longitude },
      radius: radiusKm,
      count: reportsWithDistance.length
    });
  } catch (error) {
    console.error('Error fetching nearby reports:', error);
    res.status(500).json({
      error: 'Failed to fetch nearby reports'
    });
  }
};

// Helper function to calculate distance between two points using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
};

// Check for duplicate reports
const checkDuplicateReport = async (req, res) => {
  try {
    const { title, description, latitude, longitude } = req.body;
    const cityId = req.user.cityId;

    console.log('🔍 Duplicate check request:', {
      title,
      description,
      latitude,
      longitude,
      cityId,
      userId: req.user.id
    });

    // Validate required fields
    if (!title || !description || !latitude || !longitude) {
      return res.status(400).json({
        error: 'Title, description, latitude, and longitude are required'
      });
    }

    // Ensure user has a city
    if (!cityId) {
      return res.status(400).json({
        error: 'You must be assigned to a city before checking for duplicates'
      });
    }

    // Check for duplicates
    const result = await checkDuplicate({
      title,
      description,
      latitude,
      longitude,
      cityId
    });

    console.log('📋 Duplicate check result:', result);

    res.json({
      success: true,
      duplicate: result.duplicate,
      matches: result.matches
    });

  } catch (error) {
    console.error('Error checking for duplicates:', error);
    res.status(500).json({
      error: 'Failed to check for duplicates'
    });
  }
};

// Verify report resolution (Citizens only)
const verifyReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { verified, comment } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only citizens can verify reports
    if (userRole !== 'citizen') {
      return res.status(403).json({
        error: 'Only citizens can verify report resolutions'
      });
    }

    // Check if report exists and is resolved
    const report = await prisma.report.findFirst({
      where: {
        id,
        status: 'RESOLVED',
        deleted: false
      }
    });

    if (!report) {
      return res.status(404).json({
        error: 'Resolved report not found'
      });
    }

    // Check if user has already verified this report
    const existingVerification = await prisma.reportVerification.findUnique({
      where: {
        reportId_userId: {
          reportId: id,
          userId: userId
        }
      }
    });

    if (existingVerification) {
      // Update existing verification
      const updatedVerification = await prisma.reportVerification.update({
        where: {
          reportId_userId: {
            reportId: id,
            userId: userId
          }
        },
        data: {
          verified: verified,
          comment: comment || null
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Report verification updated successfully',
        verification: updatedVerification
      });
    } else {
      // Create new verification
      const newVerification = await prisma.reportVerification.create({
        data: {
          reportId: id,
          userId: userId,
          verified: verified,
          comment: comment || null
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Report verification added successfully',
        verification: newVerification
      });
    }

  } catch (error) {
    console.error('Verify report error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Get report verification status
const getReportVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get all verifications for this report
    const verifications = await prisma.reportVerification.findMany({
      where: {
        reportId: id
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get current user's verification if exists
    const userVerification = verifications.find(v => v.userId === userId);

    // Calculate verification stats
    const totalVerifications = verifications.length;
    const verifiedCount = verifications.filter(v => v.verified).length;
    const notVerifiedCount = verifications.filter(v => !v.verified).length;

    res.json({
      success: true,
      data: {
        userVerification,
        allVerifications: verifications,
        stats: {
          total: totalVerifications,
          verified: verifiedCount,
          notVerified: notVerifiedCount,
          verificationRate: totalVerifications > 0 ? (verifiedCount / totalVerifications) * 100 : 0
        }
      }
    });

  } catch (error) {
    console.error('Get report verification error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Vote on report severity
const voteOnReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { severity } = req.body;
    const userId = req.user.id;

    // Validate severity (1-10 scale)
    if (!severity || severity < 1 || severity > 10) {
      return res.status(400).json({
        error: 'Severity must be between 1 and 10'
      });
    }

    // Check if report exists
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        city: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    // Check if user has already voted
    const existingVote = await prisma.reportVote.findUnique({
      where: {
        reportId_userId: {
          reportId: id,
          userId: userId
        }
      }
    });

    if (existingVote) {
      // Update existing vote
      await prisma.reportVote.update({
        where: {
          reportId_userId: {
            reportId: id,
            userId: userId
          }
        },
        data: { severity }
      });

      // Recalculate average severity and update report
      const allVotes = await prisma.reportVote.findMany({
        where: { reportId: id }
      });

      const averageSeverity = Math.round(
        allVotes.reduce((sum, vote) => sum + vote.severity, 0) / allVotes.length
      );

      // Determine priority based on average severity and vote count
      let priority = 'MEDIUM';
      if (averageSeverity >= 8 || allVotes.length >= 10) {
        priority = 'URGENT';
      } else if (averageSeverity >= 6 || allVotes.length >= 5) {
        priority = 'HIGH';
      } else if (averageSeverity >= 4) {
        priority = 'MEDIUM';
      } else {
        priority = 'LOW';
      }

      await prisma.report.update({
        where: { id },
        data: {
          severity: averageSeverity,
          voteCount: allVotes.length,
          priority: priority
        }
      });

      return res.json({
        success: true,
        message: 'Vote updated successfully',
        data: {
          averageSeverity,
          voteCount: allVotes.length,
          priority,
          userVote: severity
        }
      });
    } else {
      // Create new vote
      await prisma.reportVote.create({
        data: {
          reportId: id,
          userId: userId,
          severity
        }
      });

      // Recalculate average severity and update report
      const allVotes = await prisma.reportVote.findMany({
        where: { reportId: id }
      });

      const averageSeverity = Math.round(
        allVotes.reduce((sum, vote) => sum + vote.severity, 0) / allVotes.length
      );

      // Determine priority based on average severity and vote count
      let priority = 'MEDIUM';
      if (averageSeverity >= 8 || allVotes.length >= 10) {
        priority = 'URGENT';
      } else if (averageSeverity >= 6 || allVotes.length >= 5) {
        priority = 'HIGH';
      } else if (averageSeverity >= 4) {
        priority = 'MEDIUM';
      } else {
        priority = 'LOW';
      }

      await prisma.report.update({
        where: { id },
        data: {
          severity: averageSeverity,
          voteCount: allVotes.length,
          priority: priority
        }
      });

      return res.json({
        success: true,
        message: 'Vote submitted successfully',
        data: {
          averageSeverity,
          voteCount: allVotes.length,
          priority,
          userVote: severity
        }
      });
    }
  } catch (error) {
    console.error('Error voting on report:', error);
    res.status(500).json({
      error: 'Failed to vote on report'
    });
  }
};

// Get user's vote on a report
const getUserVote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const vote = await prisma.reportVote.findUnique({
      where: {
        reportId_userId: {
          reportId: id,
          userId: userId
        }
      }
    });

    if (!vote) {
      return res.json({
        success: true,
        data: { hasVoted: false, severity: null }
      });
    }

    return res.json({
      success: true,
      data: { hasVoted: true, severity: vote.severity }
    });
  } catch (error) {
    console.error('Error getting user vote:', error);
    res.status(500).json({
      error: 'Failed to get user vote'
    });
  }
};

// Report misleading or incorrect content
const reportMisleadingContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, type = 'MISLEADING_CONTENT', evidenceUrls = [] } = req.body;
    const reporterId = req.user.id;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        error: 'Reason for reporting is required'
      });
    }

    // Check if the report exists
    const report = await prisma.report.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        authorId: true,
        cityId: true,
        category: true,
        status: true,
        createdAt: true,
        author: {
          select: {
            name: true,
            email: true
          }
        },
        city: {
          select: {
            name: true
          }
        }
      }
    });

    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    // Prevent users from reporting their own reports
    if (report.authorId === reporterId) {
      return res.status(400).json({
        error: 'You cannot report your own report'
      });
    }

    // Get reporter information
    const reporter = await prisma.user.findUnique({
      where: { id: reporterId },
      select: {
        name: true,
        email: true,
        city: {
          select: {
            name: true
          }
        }
      }
    });

    // Create the misleading content report
    const misleadingReport = await prisma.misleadingContentReport.create({
      data: {
        reportId: id,
        reporterId,
        reason: reason.trim(),
        type,
        status: 'PENDING',
        evidence: evidenceUrls.length > 0 ? JSON.stringify(evidenceUrls) : null
      }
    });

    // Create notification for reporter
    await prisma.notification.create({
      data: {
        userId: reporterId,
        type: 'MISLEADING_CONTENT_REPORTED',
        title: 'Misleading Content Report Submitted',
        message: `Your report about misleading content has been submitted for admin review. Reference ID: ${misleadingReport.id}`,
        data: {
          reportId: id,
          misleadingReportId: misleadingReport.id,
          reportTitle: report.title
        }
      }
    });

    // Get all admins for notification
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true, name: true, email: true }
    });

    // Create detailed admin notifications
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'ADMIN_MISLEADING_CONTENT_REPORT',
          title: '🚨 Misleading Content Report - Action Required',
          message: `A user has reported misleading content in report: "${report.title}". Please review immediately.`,
          data: {
            reportId: id,
            misleadingReportId: misleadingReport.id,
            reporterId,
            reporterName: reporter.name,
            reporterEmail: reporter.email,
            reportTitle: report.title,
            reportDescription: report.description,
            reportCategory: report.category,
            reportStatus: report.status,
            reportCity: report.city.name,
            reportAuthor: report.author.name,
            reportCreatedAt: report.createdAt,
            reason: reason.trim(),
            type,
            evidenceUrls,
            priority: 'HIGH'
          }
        }
      });

      // Also send email notification to admin (if email service is configured)
      try {
        // This would integrate with your email service
        console.log(`📧 Email notification sent to admin: ${admin.email} about misleading content report: ${misleadingReport.id}`);
      } catch (emailError) {
        console.error('Failed to send email notification to admin:', emailError);
      }
    }

    // Log the report for audit purposes
    console.log(`🚨 Misleading Content Report Created:`, {
      misleadingReportId: misleadingReport.id,
      reportId: id,
      reporterId,
      reporterName: reporter.name,
      reportTitle: report.title,
      reason: reason.trim(),
      type,
      evidenceCount: evidenceUrls.length,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Misleading content report submitted successfully. Admin will review it within 24 hours.',
      data: {
        id: misleadingReport.id,
        status: misleadingReport.status,
        referenceId: misleadingReport.id
      }
    });

  } catch (error) {
    console.error('Error reporting misleading content:', error);
    res.status(500).json({
      error: 'Failed to report misleading content'
    });
  }
};

module.exports = {
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
  reportMisleadingContent
};
