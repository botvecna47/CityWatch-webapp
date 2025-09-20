const prisma = require('../services/database');
const imageStorage = require('../services/imageStorage');

// Update user's city
const updateUserCity = async (req, res) => {
  try {
    const { cityId } = req.body;
    const userId = req.user.id;

    if (!cityId) {
      return res.status(400).json({
        error: 'cityId is required'
      });
    }

    // Verify city exists
    const city = await prisma.city.findUnique({
      where: { id: cityId }
    });

    if (!city) {
      return res.status(404).json({
        error: 'City not found'
      });
    }

    // Get current user city for audit
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        city: {
          select: {
            id: true,
            name: true,
            slug: true,
            latitude: true,
            longitude: true
          },
        }
      }
    });

    // Update user's city
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { cityId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        cityId: true,
        city: {
          select: {
            id: true,
            name: true,
            slug: true,
            latitude: true,
            longitude: true
          },
        },
        createdAt: true,
        updatedAt: true
      },
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        actorRole: req.user.role,
        action: 'change_city',
        actionType: 'USER_UPDATE',
        targetType: 'user',
        targetId: userId,
        performedById: userId,
        reason: `Changed city from ${currentUser.city?.name || 'None'} to ${city.name}`,
        metadata: {
          previousCityId: currentUser.cityId,
          previousCityName: currentUser.city?.name || 'None',
          newCityId: cityId,
          newCityName: city.name,
          changedAt: new Date().toISOString()
        },
      }
    });

    res.json({
      message: 'City updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user city error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Get current user profile
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        cityId: true,
        profilePicture: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
        city: {
          select: {
            id: true,
            name: true,
            slug: true,
            latitude: true,
            longitude: true
          },
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Add full URL for profile picture if it exists
    if (user.profilePicture) {
      user.profilePictureUrl = imageStorage.getImageUrl(user.profilePicture, 'profile');
    }

    res.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, bio, cityId } = req.body;
    const profilePictureFile = req.file;

    // Validate bio length
    if (bio && bio.length > 200) {
      return res.status(400).json({
        error: 'Bio must be 200 characters or less'
      });
    }

    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        city: {
          select: {
            id: true,
            name: true,
            slug: true,
            latitude: true,
            longitude: true
          },
        }
      }
    });

    if (!currentUser) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check username uniqueness if username is being changed
    if (username && username !== currentUser.username) {
      const existingUser = await prisma.user.findUnique({
        where: { username }
      });

      if (existingUser) {
        return res.status(400).json({
          error: 'Username already taken'
        });
      }
    }

    // Verify city exists if cityId is provided
    let city = null;
    if (cityId) {
      city = await prisma.city.findUnique({
        where: { id: cityId }
      });

      if (!city) {
        return res.status(404).json({
          error: 'City not found'
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (username) {
      updateData.username = username;
    }
    if (bio !== undefined) {
      updateData.bio = bio;
    }
    if (cityId) {
      updateData.cityId = cityId;
    }

    // Handle profile picture upload
    if (profilePictureFile) {
      try {
        // Delete old profile picture if it exists
        if (currentUser.profilePicture) {
          await imageStorage.deleteImage(currentUser.profilePicture, 'profile');
        }

        // Process and save new profile picture with optimization
        const processedImage = await imageStorage.processAndSaveImage(
          profilePictureFile.buffer,
          profilePictureFile.originalname,
          'profile'
        );

        // Save new profile picture filename
        updateData.profilePicture = processedImage.filename;
      } catch (error) {
        console.error('Error processing profile picture:', error);
        return res.status(500).json({
          error: 'Failed to process profile picture'
        });
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        cityId: true,
        profilePicture: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
        city: {
          select: {
            id: true,
            name: true,
            slug: true,
            latitude: true,
            longitude: true
          },
        }
      }
    });

    // Add full URL for profile picture if it exists
    if (updatedUser.profilePicture) {
      updatedUser.profilePictureUrl = imageStorage.getImageUrl(updatedUser.profilePicture, 'profile');
    }

    // Create audit log entry for significant changes
    const changes = [];
    if (username && username !== currentUser.username) {
      changes.push(`username from "${currentUser.username}" to "${username}"`);
    }
    if (cityId && cityId !== currentUser.cityId) {
      changes.push(
        `city from "${currentUser.city?.name || 'None'}" to "${city?.name || 'None'}"`
      );
    }
    if (bio !== undefined && bio !== currentUser.bio) {
      changes.push('bio');
    }
    if (profilePictureFile) {
      changes.push('profile picture');
    }

    if (changes.length > 0) {
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          actorRole: req.user.role,
          action: 'update_profile',
          actionType: 'USER_UPDATE',
          targetType: 'user',
          targetId: userId,
          performedById: userId,
          reason: `Updated profile: ${changes.join(', ')}`,
          metadata: {
            changes: changes,
            updatedAt: new Date().toISOString()
          },
        }
      });
    }

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

module.exports = {
  updateUserCity,
  getCurrentUser,
  updateUserProfile
};
