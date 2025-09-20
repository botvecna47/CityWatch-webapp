const prisma = require('../services/database');
const imageStorage = require('../services/imageStorage');
const { 
  createEventNotification, 
  createEventApprovalNotification 
} = require('../services/notificationService');

// Create a new event
const createEvent = async (req, res) => {
  try {
    const { title, description, dateTime, location } = req.body;
    const createdBy = req.user.id;
    const cityId = req.user.cityId;

    // Validation
    if (!title || !description || !dateTime) {
      return res.status(400).json({
        error: 'Title, description, and dateTime are required'
      });
    }

    if (title.trim().length < 3) {
      return res.status(400).json({
        error: 'Title must be at least 3 characters long'
      });
    }

    if (description.trim().length < 10) {
      return res.status(400).json({
        error: 'Description must be at least 10 characters long'
      });
    }

    // Validate date is in the future
    const eventDate = new Date(dateTime);
    const now = new Date();
    if (eventDate <= now) {
      return res.status(400).json({
        error: 'Event date must be in the future'
      });
    }

    // Ensure user has a city
    if (!cityId) {
      return res.status(400).json({
        error: 'You must be assigned to a city before creating events'
      });
    }

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      try {
        // Process and save image with optimization
        const processedImage = await imageStorage.processAndSaveImage(
          req.file.buffer,
          req.file.originalname,
          'event'
        );
        imageUrl = processedImage.url;
      } catch (error) {
        console.error('Error processing event image:', error);
        return res.status(500).json({
          error: 'Failed to process event image'
        });
      }
    }

    // Create the event
    const event = await prisma.event.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        dateTime: eventDate,
        location: location?.trim() || null,
        imageUrl,
        cityId,
        createdBy,
        status: 'PENDING'
      },
      include: {
        creator: {
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

    // Event is now pending approval - no immediate notifications

    // Image URL is already properly formatted by imageStorage

    res.status(201).json({
      success: true,
      message: 'Event submitted for approval. You will be notified once it is reviewed by an administrator.',
      data: event
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      error: 'Failed to create event'
    });
  }
};

// Get events for a city
const getEvents = async (req, res) => {
  try {
    const { cityId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};

    // If cityId is provided, filter by city
    if (cityId) {
      where.cityId = cityId;
    } else if (req.user && req.user.cityId) {
      // If user is logged in and has a city, show their city's events
      where.cityId = req.user.cityId;
    } else {
      // If no city specified and user has no city, return empty results
      return res.json({
        events: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        },
      });
    }

    // Get events with pagination - newest first
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          creator: {
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
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.event.count({ where })
    ]);

    // Image URLs are already properly formatted by imageStorage

    res.json({
      events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      error: 'Failed to fetch events'
    });
  }
};

// Get single event by ID
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        creator: {
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

    if (!event) {
      return res.status(404).json({
        error: 'Event not found'
      });
    }

    // Image URL is already properly formatted by imageStorage

    res.json({ event });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({
      error: 'Failed to fetch event'
    });
  }
};

// Delete event (only creator or admin)
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Find the event
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            username: true
          },
        }
      }
    });

    if (!event) {
      return res.status(404).json({
        error: 'Event not found'
      });
    }

    // Check permissions (creator or admin)
    if (event.createdBy !== userId && userRole !== 'admin') {
      return res.status(403).json({
        error: 'You can only delete your own events'
      });
    }

    // Delete the event image if it exists
    if (event.imageUrl) {
      const filename = path.basename(event.imageUrl);
      await imageStorage.deleteImage(filename, 'event');
    }

    // Delete the event
    await prisma.event.delete({
      where: { id }
    });

    res.json({
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({
      error: 'Failed to delete event'
    });
  }
};

// Get my events (events created by the current user)
const getMyEvents = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const userId = req.user.id;

    // Get user's events with pagination
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where: { createdBy: userId },
        include: {
          creator: {
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
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.event.count({ where: { createdBy: userId } })
    ]);

    // Image URLs are already properly formatted by imageStorage

    res.json({
      events: eventsWithUrls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
    });
  } catch (error) {
    console.error('Error fetching my events:', error);
    res.status(500).json({
      error: 'Failed to fetch your events'
    });
  }
};

// Approve an event (Admin only)
const approveEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // Check if event exists and is pending
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            isEmailVerified: true
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

    if (!event) {
      return res.status(404).json({
        error: 'Event not found'
      });
    }

    if (event.status !== 'PENDING') {
      return res.status(400).json({
        error: 'Event is not pending approval'
      });
    }

    // Update event status to approved
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: adminId,
        approvedAt: new Date()
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            role: true,
            profilePicture: true
          }
        },
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    // Send notifications to all users in the city
    try {
      await createEventNotification(id);
    } catch (notificationError) {
      console.error('Error creating event notifications:', notificationError);
    }

    // Send approval notification to event creator
    try {
      await createEventApprovalNotification(id, 'APPROVED');
    } catch (approvalNotificationError) {
      console.error('Error creating approval notification:', approvalNotificationError);
    }

    res.json({
      success: true,
      message: 'Event approved successfully',
      data: updatedEvent
    });

  } catch (error) {
    console.error('Error approving event:', error);
    res.status(500).json({
      error: 'Failed to approve event'
    });
  }
};

// Reject an event (Admin only)
const rejectEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user.id;

    // Check if event exists and is pending
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            isEmailVerified: true
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({
        error: 'Event not found'
      });
    }

    if (event.status !== 'PENDING') {
      return res.status(400).json({
        error: 'Event is not pending approval'
      });
    }

    // Update event status to rejected
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: adminId,
        approvedAt: new Date(),
        rejectionReason: rejectionReason || 'No reason provided'
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            role: true,
            profilePicture: true
          }
        },
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    // Send rejection notification to event creator
    try {
      await createEventApprovalNotification(id, 'REJECTED', rejectionReason);
    } catch (rejectionNotificationError) {
      console.error('Error creating rejection notification:', rejectionNotificationError);
    }

    res.json({
      success: true,
      message: 'Event rejected successfully',
      data: updatedEvent
    });

  } catch (error) {
    console.error('Error rejecting event:', error);
    res.status(500).json({
      error: 'Failed to reject event'
    });
  }
};

// Get pending events for admin approval
const getPendingEvents = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const events = await prisma.event.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: offset,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            profilePicture: true
          }
        },
        city: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    const totalCount = await prisma.event.count({
      where: { status: 'PENDING' }
    });

    // Image URLs are already properly formatted by imageStorage

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching pending events:', error);
    res.status(500).json({
      error: 'Failed to fetch pending events'
    });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  deleteEvent,
  getMyEvents,
  approveEvent,
  rejectEvent,
  getPendingEvents
};
