const prisma = require('../services/database');
const aiService = require('../services/aiService');

// Create a new user report
const createUserReport = async (req, res) => {
  try {
    const { 
      reportedUserId, 
      authorityId, 
      type, 
      reason, 
      description, 
      evidenceUrls = [] 
    } = req.body;
    const reporterId = req.user.id;

    // Validation
    if (!type || !reason || !description) {
      return res.status(400).json({
        error: 'Type, reason, and description are required'
      });
    }

    // Must report either a user or authority, not both
    if ((!reportedUserId && !authorityId) || (reportedUserId && authorityId)) {
      return res.status(400).json({
        error: 'You must report either a user or an authority, not both or neither'
      });
    }

    // Cannot report yourself
    if (reportedUserId === reporterId) {
      return res.status(400).json({
        error: 'You cannot report yourself'
      });
    }

    // Validate report type
    const validTypes = [
      'USER_BEHAVIOR', 'SPAM', 'INAPPROPRIATE_CONTENT', 
      'HARASSMENT', 'FRAUD', 'OTHER'
    ];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid report type'
      });
    }

    // Check if reported user/authority exists
    if (reportedUserId) {
      const reportedUser = await prisma.user.findUnique({
        where: { id: reportedUserId },
        select: { id: true, username: true, role: true }
      });
      if (!reportedUser) {
        return res.status(404).json({
          error: 'Reported user not found'
        });
      }
    }

    // Use AI to analyze the report and determine priority
    const aiAnalysis = await aiService.analyzeUserReport({
      type,
      reason,
      description,
      evidenceUrls
    });

    // Create the user report
    const userReport = await prisma.userReport.create({
      data: {
        reporterId,
        reportedUserId,
        authorityId,
        type,
        reason: reason.trim(),
        description: description.trim(),
        evidence: evidenceUrls.length > 0 ? JSON.stringify(evidenceUrls) : null,
        priority: aiAnalysis.priority || 'MEDIUM',
        status: 'PENDING'
      },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true
          }
        },
        reportedUser: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true
          }
        }
      }
    });

    // Create notification for reporter
    await prisma.notification.create({
      data: {
        userId: reporterId,
        type: 'USER_REPORT_SUBMITTED',
        title: 'User Report Submitted',
        message: `Your report has been submitted for admin review. Reference ID: ${userReport.id}`,
        data: {
          reportId: userReport.id,
          type: type,
          priority: userReport.priority
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
          type: 'ADMIN_USER_REPORT',
          title: `🚨 User Report - ${userReport.priority} Priority`,
          message: `A user has submitted a ${type.toLowerCase().replace('_', ' ')} report. Please review immediately.`,
          data: {
            reportId: userReport.id,
            reporterId,
            reportedUserId,
            authorityId,
            type,
            priority: userReport.priority,
            reason: reason.trim(),
            description: description.trim(),
            evidenceUrls,
            aiAnalysis: aiAnalysis
          }
        }
      });
    }

    // Log the report for audit purposes
    console.log(`🚨 User Report Created:`, {
      reportId: userReport.id,
      reporterId,
      reportedUserId,
      authorityId,
      type,
      priority: userReport.priority,
      reason: reason.trim(),
      evidenceCount: evidenceUrls.length,
      aiAnalysis,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'User report submitted successfully. Admin will review it within 24 hours.',
      data: {
        id: userReport.id,
        status: userReport.status,
        priority: userReport.priority,
        referenceId: userReport.id,
        aiAnalysis: aiAnalysis
      }
    });

  } catch (error) {
    console.error('Error creating user report:', error);
    res.status(500).json({
      error: 'Failed to create user report'
    });
  }
};

// Get user reports (Admin only)
const getUserReports = async (req, res) => {
  try {
    const { status, priority, type, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (type) where.type = type;

    // Get reports with pagination
    const [reports, total] = await Promise.all([
      prisma.userReport.findMany({
        where,
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
              city: {
                select: {
                  name: true
                }
              }
            }
          },
          reportedUser: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
              city: {
                select: {
                  name: true
                }
              }
            }
          },
          assignedAdmin: {
            select: {
              id: true,
              username: true,
              email: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' }, // URGENT first, then HIGH, MEDIUM, LOW
          { createdAt: 'desc' }
        ],
        skip,
        take
      }),
      prisma.userReport.count({ where })
    ]);

    res.json({
      success: true,
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching user reports:', error);
    res.status(500).json({
      error: 'Failed to fetch user reports'
    });
  }
};

// Update user report status (Admin only)
const updateUserReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, assignedTo } = req.body;
    const adminId = req.user.id;

    // Validate status
    const validStatuses = ['PENDING', 'REVIEWED', 'APPROVED', 'DISMISSED', 'ACTION_TAKEN'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status'
      });
    }

    // Check if report exists
    const existingReport = await prisma.userReport.findUnique({
      where: { id },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    if (!existingReport) {
      return res.status(404).json({
        error: 'User report not found'
      });
    }

    // Update the report
    const updateData = {
      adminNotes: adminNotes?.trim() || null,
      assignedTo: assignedTo || null
    };

    if (status) {
      updateData.status = status;
      if (status === 'APPROVED' || status === 'DISMISSED' || status === 'ACTION_TAKEN') {
        updateData.resolvedAt = new Date();
      }
    }

    const updatedReport = await prisma.userReport.update({
      where: { id },
      data: updateData,
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        reportedUser: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        assignedAdmin: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    // Notify the reporter about status update
    await prisma.notification.create({
      data: {
        userId: existingReport.reporterId,
        type: 'USER_REPORT_STATUS_UPDATE',
        title: 'Report Status Updated',
        message: `Your report has been ${status.toLowerCase()}. ${adminNotes ? 'Admin notes: ' + adminNotes : ''}`,
        data: {
          reportId: id,
          status: status,
          adminNotes: adminNotes
        }
      }
    });

    res.json({
      success: true,
      message: 'User report status updated successfully',
      data: updatedReport
    });

  } catch (error) {
    console.error('Error updating user report status:', error);
    res.status(500).json({
      error: 'Failed to update user report status'
    });
  }
};

// Get user report analytics (Admin only)
const getUserReportAnalytics = async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get analytics data
    const [
      totalReports,
      reportsByStatus,
      reportsByType,
      reportsByPriority,
      reportsByTime,
      topReporters,
      topReportedUsers
    ] = await Promise.all([
      // Total reports
      prisma.userReport.count({
        where: { createdAt: { gte: startDate } }
      }),
      
      // Reports by status
      prisma.userReport.groupBy({
        by: ['status'],
        where: { createdAt: { gte: startDate } },
        _count: { status: true }
      }),
      
      // Reports by type
      prisma.userReport.groupBy({
        by: ['type'],
        where: { createdAt: { gte: startDate } },
        _count: { type: true }
      }),
      
      // Reports by priority
      prisma.userReport.groupBy({
        by: ['priority'],
        where: { createdAt: { gte: startDate } },
        _count: { priority: true }
      }),
      
      // Reports by time (daily for last 30 days)
      prisma.userReport.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: startDate } },
        _count: { createdAt: true }
      }),
      
      // Top reporters
      prisma.userReport.groupBy({
        by: ['reporterId'],
        where: { createdAt: { gte: startDate } },
        _count: { reporterId: true },
        orderBy: { _count: { reporterId: 'desc' } },
        take: 10
      }),
      
      // Top reported users
      prisma.userReport.groupBy({
        by: ['reportedUserId'],
        where: { 
          createdAt: { gte: startDate },
          reportedUserId: { not: null }
        },
        _count: { reportedUserId: true },
        orderBy: { _count: { reportedUserId: 'desc' } },
        take: 10
      })
    ]);

    // Get user details for top reporters and reported users
    const reporterIds = topReporters.map(r => r.reporterId);
    const reportedUserIds = topReportedUsers.map(r => r.reportedUserId).filter(Boolean);
    
    const [reporters, reportedUsers] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: reporterIds } },
        select: { id: true, username: true, email: true, role: true }
      }),
      prisma.user.findMany({
        where: { id: { in: reportedUserIds } },
        select: { id: true, username: true, email: true, role: true }
      })
    ]);

    const reportersMap = new Map(reporters.map(u => [u.id, u]));
    const reportedUsersMap = new Map(reportedUsers.map(u => [u.id, u]));

    res.json({
      success: true,
      analytics: {
        totalReports,
        timeRange,
        reportsByStatus: reportsByStatus.map(r => ({
          status: r.status,
          count: r._count.status
        })),
        reportsByType: reportsByType.map(r => ({
          type: r.type,
          count: r._count.type
        })),
        reportsByPriority: reportsByPriority.map(r => ({
          priority: r.priority,
          count: r._count.priority
        })),
        reportsByTime: reportsByTime.map(r => ({
          date: r.createdAt.toISOString().split('T')[0],
          count: r._count.createdAt
        })),
        topReporters: topReporters.map(r => ({
          user: reportersMap.get(r.reporterId),
          count: r._count.reporterId
        })),
        topReportedUsers: topReportedUsers.map(r => ({
          user: reportedUsersMap.get(r.reportedUserId),
          count: r._count.reportedUserId
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching user report analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch user report analytics'
    });
  }
};

module.exports = {
  createUserReport,
  getUserReports,
  updateUserReportStatus,
  getUserReportAnalytics
};
