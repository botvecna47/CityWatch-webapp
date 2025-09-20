const jwt = require('jsonwebtoken');
const prisma = require('../services/database');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        error: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        cityId: true,
        isBanned: true,
        profilePicture: true,
        bio: true,
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

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token. User not found.'
      });
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({
        error: 'Account has been banned. Please contact support.'
      });
    }

    // Add full URL for profile picture if it exists
    if (user.profilePicture) {
      user.profilePictureUrl = `/assets/profiles/${user.profilePicture}`;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired.'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Internal server error.'
    });
  }
};

module.exports = authMiddleware;
