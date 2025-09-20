const prisma = require('../services/database');
const { sendAuthorityCredentials } = require('../utils/mailer');

// Get all users with pagination
const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      city = '',
      banned = ''
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      where.role = role;
    }

    if (city) {
      where.cityId = city;
    }

    if (banned !== '') {
      where.isBanned = banned === 'true';
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          cityId: true,
          isBanned: true,
          createdAt: true,
          updatedAt: true,
          city: {
            select: {
              id: true,
              name: true,
              slug: true
            },
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminId = req.user.id;

    // Validate role
    if (!['citizen', 'authority', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, role: true }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      include: {
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          },
        }
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: id,
        actorRole: role,
        action: `User role changed from ${currentUser.role} to ${role}`,
        actionType: role === 'authority' ? 'USER_PROMOTE' : 'USER_DEMOTE',
        targetType: 'USER',
        targetId: id,
        performedById: adminId,
        reason: `Role changed by admin ${req.user.username}`
      },
    });

    res.json({
      message: 'User role updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
};

// Toggle user ban status
const toggleUserBan = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, isBanned: true }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Toggle ban status
    const newBanStatus = !currentUser.isBanned;
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isBanned: newBanStatus },
      include: {
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          },
        }
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: id,
        actorRole: updatedUser.role,
        action: `User ${newBanStatus ? 'banned' : 'unbanned'}`,
        actionType: 'USER_BAN',
        targetType: 'USER',
        targetId: id,
        performedById: adminId,
        reason: `User ${newBanStatus ? 'banned' : 'unbanned'} by admin ${req.user.username}`
      },
    });

    res.json({
      message: `User ${newBanStatus ? 'banned' : 'unbanned'} successfully`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Toggle user ban error:', error);
    res.status(500).json({ error: 'Failed to toggle user ban status' });
  }
};

// Create new admin user
const createAdmin = async (req, res) => {
  try {
    const { username, email, password, cityId } = req.body;
    const adminId = req.user.id;

    // Validate required fields
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }]
      },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: 'User with this username or email already exists' });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const newAdmin = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'admin',
        cityId: cityId || null,
        isBanned: false
      },
      include: {
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          },
        }
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: newAdmin.id,
        actorRole: 'admin',
        action: 'New admin user created',
        actionType: 'USER_PROMOTE',
        targetType: 'USER',
        targetId: newAdmin.id,
        performedById: adminId,
        reason: `Admin user created by ${req.user.username}`
      },
    });

    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        id: newAdmin.id,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        city: newAdmin.city,
        isBanned: newAdmin.isBanned,
        createdAt: newAdmin.createdAt
      },
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
};

// Get all reports with filters
const getReports = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = '',
      category = '',
      city = '',
      deleted = ''
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (city) {
      where.cityId = city;
    }

    if (deleted !== '') {
      where.deleted = deleted === 'true';
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          status: true,
          deleted: true,
          createdAt: true,
          updatedAt: true,
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
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.report.count({ where })
    ]);

    res.json({
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// Soft delete report
const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // Get current report
    const currentReport = await prisma.report.findUnique({
      where: { id },
      select: { id: true, title: true, deleted: true }
    });

    if (!currentReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Soft delete report
    const updatedReport = await prisma.report.update({
      where: { id },
      data: { deleted: true },
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: 'admin',
        action: 'Report soft deleted',
        actionType: 'REPORT_DELETE',
        targetType: 'REPORT',
        targetId: id,
        performedById: adminId,
        reason: `Report "${currentReport.title}" deleted by admin ${req.user.username}`
      },
    });

    res.json({
      message: 'Report deleted successfully',
      report: updatedReport
    });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
};

// Restore report
const restoreReport = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // Get current report
    const currentReport = await prisma.report.findUnique({
      where: { id },
      select: { id: true, title: true, deleted: true }
    });

    if (!currentReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Restore report
    const updatedReport = await prisma.report.update({
      where: { id },
      data: { deleted: false },
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: 'admin',
        action: 'Report restored',
        actionType: 'REPORT_RESTORE',
        targetType: 'REPORT',
        targetId: id,
        performedById: adminId,
        reason: `Report "${currentReport.title}" restored by admin ${req.user.username}`
      },
    });

    res.json({
      message: 'Report restored successfully',
      report: updatedReport
    });
  } catch (error) {
    console.error('Restore report error:', error);
    res.status(500).json({ error: 'Failed to restore report' });
  }
};

// Get audit logs
const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, actionType = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};
    if (actionType) {
      where.actionType = actionType;
    }

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              role: true
            },
          },
          performedBy: {
            select: {
              id: true,
              username: true,
              role: true
            },
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      auditLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

// Get dashboard statistics
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
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
};

// Create authority account (admin only)
const createAuthority = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      firstName,
      lastName,
      phone,
      authorityType,
      department,
      badgeNumber,
      cityId
    } = req.body;

    // Validation
    if (!username || !email || !password || !firstName || !lastName || !phone || !authorityType || !department || !badgeNumber || !cityId) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Username or email already exists'
      });
    }

    // Check if badge number already exists for this authority type
    const existingBadge = await prisma.user.findFirst({
      where: {
        badgeNumber,
        authorityTypeId: authorityType
      }
    });

    if (existingBadge) {
      return res.status(400).json({
        success: false,
        error: 'Badge number already exists for this authority type'
      });
    }

    // Verify city exists
    const city = await prisma.city.findUnique({
      where: { id: cityId }
    });

    if (!city) {
      return res.status(400).json({
        success: false,
        error: 'Invalid city selected'
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create authority user
    const authorityUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: 'authority',
        authorityTypeId: authorityType,
        department,
        badgeNumber,
        cityId: cityId,
        isVerified: true, // Authority accounts are pre-verified
        isBanned: false
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        authorityTypeId: true,
        authorityType: {
          select: {
            id: true,
            name: true,
            displayName: true,
            icon: true
          }
        },
        department: true,
        badgeNumber: true,
        cityId: true,
        isVerified: true,
        isBanned: true,
        createdAt: true
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'CREATE_AUTHORITY',
        actionType: 'CREATE',
        targetType: 'USER',
        targetId: authorityUser.id,
        performedById: req.user.id,
        reason: `Created authority account for ${authorityUser.firstName} ${authorityUser.lastName} (${authorityUser.badgeNumber})`,
        metadata: {
          authorityType: authorityUser.authorityType?.name,
          city: authorityUser.city?.name,
          badgeNumber: authorityUser.badgeNumber,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      }
    });

    // Send credentials email
    try {
      const emailResult = await sendAuthorityCredentials(
        authorityUser.email,
        authorityUser.firstName,
        authorityUser.lastName,
        authorityUser.username,
        password, // Use the original password before hashing
        authorityUser.authorityType?.displayName || 'Authority',
        authorityUser.city?.name || 'Not assigned'
      );

      if (emailResult.success) {
        console.log(`✅ Credentials email sent successfully to ${authorityUser.email}`);
      } else {
        console.warn(`⚠️ Failed to send credentials email to ${authorityUser.email}:`, emailResult.error);
      }
    } catch (emailError) {
      console.error('❌ Error sending credentials email:', emailError);
      // Don't fail the entire operation if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Authority account created successfully',
      data: authorityUser
    });

  } catch (error) {
    console.error('Error creating authority:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create authority account'
    });
  }
};

// Get all authority types
const getAuthorityTypes = async (req, res) => {
  try {
    const authorityTypes = await prisma.authorityType.findMany({
      orderBy: { displayName: 'asc' }
    });

    res.json({
      success: true,
      data: authorityTypes
    });
  } catch (error) {
    console.error('Error fetching authority types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch authority types'
    });
  }
};

// Create new authority type
const createAuthorityType = async (req, res) => {
  try {
    const { name, displayName, icon, description } = req.body;

    // Validation
    if (!name || !displayName) {
      return res.status(400).json({
        success: false,
        error: 'Name and display name are required'
      });
    }

    // Check if authority type already exists
    const existingType = await prisma.authorityType.findFirst({
      where: {
        OR: [
          { name },
          { displayName }
        ]
      }
    });

    if (existingType) {
      return res.status(400).json({
        success: false,
        error: 'Authority type with this name or display name already exists'
      });
    }

    // Create authority type
    const authorityType = await prisma.authorityType.create({
      data: {
        name,
        displayName,
        icon,
        description
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'CREATE_AUTHORITY_TYPE',
        actionType: 'CREATE',
        targetType: 'AUTHORITY_TYPE',
        targetId: authorityType.id,
        performedById: req.user.id,
        reason: `Created authority type: ${authorityType.displayName}`,
        metadata: {
          authorityTypeName: authorityType.name,
          displayName: authorityType.displayName,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Authority type created successfully',
      data: authorityType
    });

  } catch (error) {
    console.error('Error creating authority type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create authority type'
    });
  }
};

// Update authority type
const updateAuthorityType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, displayName, icon, description, isActive } = req.body;

    // Check if authority type exists
    const existingType = await prisma.authorityType.findUnique({
      where: { id }
    });

    if (!existingType) {
      return res.status(404).json({
        success: false,
        error: 'Authority type not found'
      });
    }

    // Check for duplicate names (excluding current record)
    if (name || displayName) {
      const duplicateType = await prisma.authorityType.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                name ? { name } : {},
                displayName ? { displayName } : {}
              ]
            }
          ]
        }
      });

      if (duplicateType) {
        return res.status(400).json({
          success: false,
          error: 'Authority type with this name or display name already exists'
        });
      }
    }

    // Update authority type
    const updatedType = await prisma.authorityType.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(displayName && { displayName }),
        ...(icon !== undefined && { icon }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive })
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'UPDATE_AUTHORITY_TYPE',
        actionType: 'UPDATE',
        targetType: 'AUTHORITY_TYPE',
        targetId: updatedType.id,
        performedById: req.user.id,
        reason: `Updated authority type: ${updatedType.displayName}`,
        metadata: {
          authorityTypeName: updatedType.name,
          displayName: updatedType.displayName,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      }
    });

    res.json({
      success: true,
      message: 'Authority type updated successfully',
      data: updatedType
    });

  } catch (error) {
    console.error('Error updating authority type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update authority type'
    });
  }
};

// Delete authority type
const deleteAuthorityType = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if authority type exists
    const existingType = await prisma.authorityType.findUnique({
      where: { id },
      include: {
        users: true
      }
    });

    if (!existingType) {
      return res.status(404).json({
        success: false,
        error: 'Authority type not found'
      });
    }

    // Check if any users are using this authority type
    if (existingType.users.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete authority type that is in use by existing users'
      });
    }

    // Delete authority type
    await prisma.authorityType.delete({
      where: { id }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'DELETE_AUTHORITY_TYPE',
        actionType: 'DELETE',
        targetType: 'AUTHORITY_TYPE',
        targetId: existingType.id,
        performedById: req.user.id,
        reason: `Deleted authority type: ${existingType.displayName}`,
        metadata: {
          authorityTypeName: existingType.name,
          displayName: existingType.displayName,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      }
    });

    res.json({
      success: true,
      message: 'Authority type deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting authority type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete authority type'
    });
  }
};

// Update user city
const updateUserCity = async (req, res) => {
  try {
    const { id } = req.params;
    const { cityId } = req.body;

    // Validation
    if (!cityId) {
      return res.status(400).json({
        success: false,
        error: 'City ID is required'
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        city: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify city exists
    const city = await prisma.city.findUnique({
      where: { id: cityId }
    });

    if (!city) {
      return res.status(400).json({
        success: false,
        error: 'Invalid city selected'
      });
    }

    // Update user city
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        cityId: cityId
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        cityId: true,
        city: {
          select: {
            id: true,
            name: true
          }
        },
        updatedAt: true
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'UPDATE_USER_CITY',
        actionType: 'UPDATE',
        targetType: 'USER',
        targetId: user.id,
        performedById: req.user.id,
        reason: `Changed city for user ${user.username} from ${user.city?.name || 'None'} to ${city.name}`,
        metadata: {
          previousCity: user.city?.name || 'None',
          newCity: city.name,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      }
    });

    res.json({
      success: true,
      message: 'User city updated successfully',
      data: updatedUser
    });

  } catch (error) {
    console.error('Error updating user city:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user city'
    });
  }
};

module.exports = {
  getUsers,
  updateUserRole,
  toggleUserBan,
  updateUserCity,
  createAdmin,
  createAuthority,
  getAuthorityTypes,
  createAuthorityType,
  updateAuthorityType,
  deleteAuthorityType,
  getReports,
  deleteReport,
  restoreReport,
  getAuditLogs,
  getDashboardStats
};
