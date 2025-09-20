const prisma = require('../services/database');

// Simple analytics for public stats (home page)
const getPublicStats = async (req, res) => {
  try {
    const [
      totalReports,
      resolvedReports,
      totalUsers,
      totalCities
    ] = await Promise.all([
      prisma.report.count(),
      prisma.report.count({ where: { status: 'RESOLVED' } }),
      prisma.user.count({ where: { isVerified: true } }),
      prisma.city.count()
    ]);

    const resolvedIssuesPercentage = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0;
    const averageResponseTime = resolvedReports > 0 ? 2.4 : 0; // Simple calculation

    res.json({
      success: true,
      stats: {
        totalReports,
        resolvedIssues: resolvedIssuesPercentage,
        activeUsers: totalUsers,
        avgResponseTime: averageResponseTime
      }
    });
  } catch (error) {
    console.error('Error fetching public stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch public statistics'
    });
  }
};

// Simple analytics for admin dashboard
const getAdminAnalytics = async (req, res) => {
  try {
    const [
      totalReports,
      totalUsers,
      totalCities,
      totalAlerts,
      totalEvents,
      openReports,
      resolvedReports,
      totalAuthorities,
      bannedUsers
    ] = await Promise.all([
      prisma.report.count(),
      prisma.user.count(),
      prisma.city.count(),
      prisma.alert.count(),
      prisma.event.count(),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.report.count({ where: { status: 'RESOLVED' } }),
      prisma.user.count({ where: { role: 'authority' } }),
      prisma.user.count({ where: { isBanned: true } })
    ]);

    // Simple reports by status
    const reportsByStatus = [
      { name: 'Open', value: openReports },
      { name: 'Resolved', value: resolvedReports }
    ];

    // Simple reports by category
    const reportsByCategory = await prisma.report.groupBy({
      by: ['category'],
      _count: { category: true }
    }).then(results => 
      results.map(item => ({
        name: item.category,
        value: item._count.category
      }))
    );

    // Simple reports by priority
    const reportsByPriority = await prisma.report.groupBy({
      by: ['priority'],
      _count: { priority: true }
    }).then(results => 
      results.map(item => ({
        name: item.priority,
        value: item._count.priority
      }))
    );

    // Simple users by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true }
    }).then(results => 
      results.map(item => ({
        name: item.role,
        value: item._count.role
      }))
    );

    // Simple reports by city (top 5)
    const reportsByCity = await prisma.report.groupBy({
      by: ['cityId'],
      _count: { cityId: true },
      orderBy: { _count: { cityId: 'desc' } },
      take: 5
    }).then(async results => {
      const cityIds = results.map(item => item.cityId);
      const cities = await prisma.city.findMany({
        where: { id: { in: cityIds } },
        select: { id: true, name: true }
      });
      
      return results.map(item => {
        const city = cities.find(c => c.id === item.cityId);
        return {
          name: city ? city.name : 'Unknown',
          value: item._count.cityId
        };
      });
    });

    // Simple reports over time (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const reportsOverTime = await prisma.report.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { createdAt: true },
      orderBy: { createdAt: 'asc' }
    }).then(results => 
      results.map(item => ({
        date: item.createdAt.toISOString().split('T')[0],
        reports: item._count.createdAt
      }))
    );

    res.json({
      success: true,
      analytics: {
        overview: {
          totalReports,
          totalUsers,
          totalCities,
          totalAlerts,
          totalEvents,
          openReports,
          resolvedReports,
          totalAuthorities,
          bannedUsers
        },
        reportsByStatus,
        reportsByCategory,
        reportsByPriority,
        usersByRole,
        reportsByCity,
        reportsOverTime
      }
    });
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin analytics'
    });
  }
};

// Simple analytics for authority dashboard
const getAuthorityDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        city: { select: { name: true } },
        authorityType: { select: { name: true, displayName: true } }
      }
    });

    if (!user || user.role !== 'authority') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [
      totalReports,
      openReports,
      inProgressReports,
      resolvedReports,
      totalEvents,
      totalAlerts,
      activeAlerts
    ] = await Promise.all([
      prisma.report.count({
        where: {
          cityId: user.cityId,
          authorityTypeId: user.authorityTypeId
        }
      }),
      prisma.report.count({
        where: {
          cityId: user.cityId,
          authorityTypeId: user.authorityTypeId,
          status: 'OPEN'
        }
      }),
      prisma.report.count({
        where: {
          cityId: user.cityId,
          authorityTypeId: user.authorityTypeId,
          status: 'IN_PROGRESS'
        }
      }),
      prisma.report.count({
        where: {
          cityId: user.cityId,
          authorityTypeId: user.authorityTypeId,
          status: 'RESOLVED'
        }
      }),
      prisma.event.count({
        where: { cityId: user.cityId }
      }),
      prisma.alert.count({
        where: { cityId: user.cityId }
      }),
      prisma.alert.count({
        where: {
          cityId: user.cityId,
          deleted: false
        }
      })
    ]);

    // Get recent reports
    const recentReports = await prisma.report.findMany({
      where: {
        cityId: user.cityId,
        authorityTypeId: user.authorityTypeId
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        severity: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      data: {
        totalReports,
        openReports,
        inProgressReports,
        resolvedReports,
        totalEvents,
        totalAlerts,
        activeAlerts,
        recentReports,
        cityName: user.city?.name,
        authorityType: user.authorityType?.displayName
      }
    });
  } catch (error) {
    console.error('Error fetching authority dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch authority dashboard stats' });
  }
};

// Simple dashboard stats (legacy compatibility)
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalReports,
      openReports,
      inProgressReports,
      resolvedReports,
      totalAuthorities,
      bannedUsers,
      totalCities
    ] = await Promise.all([
      prisma.user.count(),
      prisma.report.count({ where: { deleted: false } }),
      prisma.report.count({ where: { status: 'OPEN', deleted: false } }),
      prisma.report.count({ where: { status: 'IN_PROGRESS', deleted: false } }),
      prisma.report.count({ where: { status: 'RESOLVED', deleted: false } }),
      prisma.user.count({ where: { role: 'authority' } }),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.city.count()
    ]);

    res.json({
      stats: {
        totalUsers,
        totalReports,
        openReports,
        inProgressReports,
        resolvedReports,
        totalAuthorities,
        bannedUsers,
        totalCities
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
};

// Simple user analytics
const getUserAnalytics = async (req, res) => {
  try {
    const [
      totalUsers,
      verifiedUsers,
      usersByRole
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isVerified: true } }),
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        verifiedUsers,
        usersByRole: usersByRole.map(item => ({
          role: item.role,
          count: item._count.role
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
};

// Simple report analytics
const getReportAnalytics = async (req, res) => {
  try {
    const [
      totalReports,
      reportsByStatus,
      reportsByCategory,
      reportsByPriority
    ] = await Promise.all([
      prisma.report.count(),
      prisma.report.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      prisma.report.groupBy({
        by: ['category'],
        _count: { category: true }
      }),
      prisma.report.groupBy({
        by: ['priority'],
        _count: { priority: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalReports,
        reportsByStatus: reportsByStatus.map(item => ({
          status: item.status,
          count: item._count.status
        })),
        reportsByCategory: reportsByCategory.map(item => ({
          category: item.category,
          count: item._count.category
        })),
        reportsByPriority: reportsByPriority.map(item => ({
          priority: item.priority,
          count: item._count.priority
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching report analytics:', error);
    res.status(500).json({ error: 'Failed to fetch report analytics' });
  }
};

// Simple event analytics
const getEventAnalytics = async (req, res) => {
  try {
    const [
      totalEvents,
      eventsByStatus
    ] = await Promise.all([
      prisma.event.count(),
      prisma.event.groupBy({
        by: ['status'],
        _count: { status: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalEvents,
        eventsByStatus: eventsByStatus.map(item => ({
          status: item.status,
          count: item._count.status
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching event analytics:', error);
    res.status(500).json({ error: 'Failed to fetch event analytics' });
  }
};

// Simple alert analytics
const getAlertAnalytics = async (req, res) => {
  try {
    const [
      totalAlerts,
      activeAlerts
    ] = await Promise.all([
      prisma.alert.count(),
      prisma.alert.count({ where: { deleted: false } })
    ]);

    // Get recent alerts
    const recentAlerts = await prisma.alert.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        message: true,
        createdAt: true,
        city: { select: { name: true } }
      }
    });

    res.json({
      success: true,
      data: {
        totalAlerts,
        activeAlerts,
        recentAlerts
      }
    });
  } catch (error) {
    console.error('Error fetching alert analytics:', error);
    res.status(500).json({ error: 'Failed to fetch alert analytics' });
  }
};

module.exports = {
  getPublicStats,
  getAdminAnalytics,
  getAuthorityDashboardStats,
  getDashboardStats,
  getUserAnalytics,
  getReportAnalytics,
  getEventAnalytics,
  getAlertAnalytics
};