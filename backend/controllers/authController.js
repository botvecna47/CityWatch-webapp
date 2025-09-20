const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../services/database');
const { generateOTP, sendOTPEmail } = require('../utils/mailer');
const { generateOTP: generatePhoneOTP, sendOTPSMS } = require('../utils/smsService');
const { blacklistToken } = require('../middleware/tokenBlacklist');

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '15m'
  });

  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d'
  });

  return { accessToken, refreshToken };
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password strength
const isValidPassword = (password) => {
  // At least 8 characters, 1 number, 1 special character
  const passwordRegex =
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
  return passwordRegex.test(password);
};

// Validate mobile number (Indian format)
const isValidMobile = (mobile) => {
  const mobileRegex = /^[6-9]\d{9}$/;
  return mobileRegex.test(mobile);
};

// Validate date of birth (must be at least 13 years old)
const isValidDOB = (dob) => {
  const birthDate = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    return age - 1 >= 13;
  }
  return age >= 13;
};

// Validate signup data (without saving to DB)
const validateSignupData = async (req, res) => {
  try {
    const { 
      username, 
      email, 
      password, 
      cityId, 
      firstName, 
      lastName, 
      dob, 
      mobile, 
      agreedTos 
    } = req.body;

    // Validation
    if (
      !username ||
      !email ||
      !password ||
      !cityId ||
      !firstName ||
      !lastName ||
      !dob ||
      !mobile ||
      !agreedTos
    ) {
      return res.status(400).json({
        error:
          'All fields are required: username, email, password, cityId, firstName, lastName, dob, mobile, and you must agree to terms and conditions'
      });
    }

    // Validate terms and conditions agreement
    if (!agreedTos) {
      return res.status(400).json({
        error: 'You must agree to the terms and conditions'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Please provide a valid email address'
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        error:
          'Password must be at least 8 characters long and contain at least 1 number and 1 special character'
      });
    }

    if (!isValidMobile(mobile)) {
      return res.status(400).json({
        error: 'Please provide a valid 10-digit Indian mobile number'
      });
    }

    if (!isValidDOB(dob)) {
      return res.status(400).json({
        error: 'You must be at least 13 years old to register'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: email }, { username: username }, { mobile: mobile }]
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({
          error: 'Email already registered'
        });
      } else if (existingUser.username === username) {
        return res.status(400).json({
          error: 'Username already taken'
        });
      } else if (existingUser.mobile === mobile) {
        return res.status(400).json({
          error: 'Mobile number already registered'
        });
      }
    }

    // Check if city exists
    const city = await prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true, name: true, slug: true }
    });

    if (!city) {
      return res.status(400).json({
        error: 'Invalid city selected'
      });
    }

    // If all validations pass, return success without saving to DB
    res.json({
      message:
        'Data validation successful. Please proceed with email verification.',
      valid: true,
      city: city
    });
  } catch (error) {
    console.error('Validate signup data error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Send verification email (without creating user)
const sendVerificationEmail = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      cityId,
      firstName,
      middleName,
      lastName,
      dob,
      mobile
    } = req.body;

    // Re-validate data
    if (
      !username ||
      !email ||
      !password ||
      !cityId ||
      !firstName ||
      !lastName ||
      !dob ||
      !mobile
    ) {
      return res.status(400).json({
        error: 'All fields are required'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: email }, { username: username }, { mobile: mobile }]
      },
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists'
      });
    }

    // Generate OTP and expiry
    const otpCode = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Store signup data temporarily in memory (in production, use Redis or similar)
    const signupData = {
      username,
      email,
      password,
      cityId,
      firstName,
      middleName,
      lastName,
      dob,
      mobile,
      otpCode,
      otpExpires,
      createdAt: new Date()
    };

    // In production, store this in Redis with expiration
    // For now, we'll store it in a simple in-memory cache
    global.tempSignupData = global.tempSignupData || new Map();
    global.tempSignupData.set(email, signupData);

    // Send OTP email
    const fullName =
      `${firstName} ${middleName ? `${middleName} ` : ''}${lastName}`.trim();
    const emailResult = await sendOTPEmail(email, fullName, otpCode);

    if (!emailResult.success) {
      // Clean up temporary data
      global.tempSignupData.delete(email);
      return res.status(500).json({
        error: 'Failed to send verification email. Please try again.'
      });
    }

    res.json({
      message:
        'Verification email sent successfully. Please check your email for the verification code.',
      email: email,
      emailSent: emailResult.success,
      developmentMode: emailResult.developmentMode || false,
      otpCode: emailResult.developmentMode ? otpCode : undefined
    });
  } catch (error) {
    console.error('Send verification email error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Complete signup after email verification
const completeSignup = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        error: 'Email and OTP code are required'
      });
    }

    // Get temporary signup data
    global.tempSignupData = global.tempSignupData || new Map();
    const signupData = global.tempSignupData.get(email);

    if (!signupData) {
      return res.status(400).json({
        error:
          'No pending signup found for this email. Please start the signup process again.'
      });
    }

    // Check if OTP is expired
    if (new Date() > signupData.otpExpires) {
      global.tempSignupData.delete(email);
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new one.'
      });
    }

    // Verify OTP
    if (signupData.otpCode !== otp) {
      return res.status(400).json({
        error: 'Invalid verification code'
      });
    }

    // Check if user was created in the meantime
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: signupData.email },
          { username: signupData.username },
          { mobile: signupData.mobile }
        ],
      }
    });

    if (existingUser) {
      global.tempSignupData.delete(email);
      return res.status(400).json({
        error: 'User already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(signupData.password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: signupData.username,
        email: signupData.email,
        password: hashedPassword,
        firstName: signupData.firstName,
        middleName: signupData.middleName,
        lastName: signupData.lastName,
        dob: new Date(signupData.dob),
        mobile: signupData.mobile,
        agreedTos: true,
        isVerified: true, // Mark as verified since OTP was confirmed
        otpCode: null,
        otpExpires: null,
        cityId: signupData.cityId,
        role: 'citizen'
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        mobile: true,
        isVerified: true,
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

    // Clean up temporary data
    global.tempSignupData.delete(email);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    res.status(201).json({
      message: 'Account created successfully! Welcome to CityWatch.',
      user: user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Complete signup error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    // Validation
    if (!emailOrUsername || !password) {
      return res.status(400).json({
        error: 'Email/Username and password are required'
      });
    }

    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { username: emailOrUsername }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email/username or password'
      });
    }

    // Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({
        error: 'Account banned'
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Please verify your email first.',
        requiresVerification: true
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Return user data (without password)
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      cityId: user.cityId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({
      message: 'Login successful',
      user: userData,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Refresh access token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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

    if (!user) {
      return res.status(401).json({
        error: 'Invalid refresh token'
      });
    }

    // Blacklist the old refresh token
    blacklistToken(refreshToken);

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user.id
    );

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      user
    });
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return res.status(401).json({
        error: 'Invalid or expired refresh token'
      });
    }

    console.error('Refresh token error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      blacklistToken(token);
    }

    res.json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    // User is already attached to req by authMiddleware
    res.json({
      user: req.user
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validation
    if (!email || !otp) {
      return res.status(400).json({
        error: 'Email and OTP code are required'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Please provide a valid email address'
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        error: 'OTP must be a 6-digit number'
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check if user is already verified
    if (user.isVerified) {
      return res.status(400).json({
        error: 'Email is already verified'
      });
    }

    // Check if OTP exists and is not expired
    if (!user.otpCode || !user.otpExpires) {
      return res.status(400).json({
        error: 'No verification code found. Please request a new one.'
      });
    }

    if (new Date() > user.otpExpires) {
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new one.'
      });
    }

    // Verify OTP
    if (user.otpCode !== otp) {
      return res.status(400).json({
        error: 'Invalid verification code'
      });
    }

    // Mark user as verified and clear OTP
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otpCode: null,
        otpExpires: null
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        mobile: true,
        isVerified: true,
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

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(updatedUser.id);

    res.json({
      message: 'Email verified successfully! Welcome to CityWatch.',
      user: updatedUser,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Please provide a valid email address'
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check if user is already verified
    if (user.isVerified) {
      return res.status(400).json({
        error: 'Email is already verified'
      });
    }

    // Generate new OTP
    const otpCode = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Update user with new OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode,
        otpExpires
      },
    });

    // Send OTP email
    const fullName =
      `${user.firstName} ${user.middleName ? `${user.middleName} ` : ''}${user.lastName}`.trim();
    const { sendResendOTPEmail } = require('../utils/mailer');
    const emailResult = await sendResendOTPEmail(email, fullName, otpCode);

    if (!emailResult.success) {
      return res.status(500).json({
        error: 'Failed to send verification email. Please try again.'
      });
    }

    res.json({
      message: 'New verification code sent to your email.',
      emailSent: emailResult.success,
      developmentMode: emailResult.developmentMode || false,
      otpCode: emailResult.developmentMode ? otpCode : undefined
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Send phone verification OTP
const sendPhoneVerificationOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const userId = req.user.id;

    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Phone number is required'
      });
    }

    if (!isValidMobile(phoneNumber)) {
      return res.status(400).json({
        error: 'Please provide a valid 10-digit Indian mobile number'
      });
    }

    // Check if phone number is already verified for another user
    const existingUser = await prisma.user.findFirst({
      where: {
        mobile: phoneNumber,
        isPhoneVerified: true,
        id: { not: userId }
      }
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'This phone number is already verified for another account'
      });
    }

    // Generate OTP
    const otp = generatePhoneOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with phone OTP
    await prisma.user.update({
      where: { id: userId },
      data: {
        phoneOtpCode: otp,
        phoneOtpExpires: otpExpires
      }
    });

    // Send SMS
    const smsResult = await sendOTPSMS(phoneNumber, otp);
    
    if (!smsResult.success) {
      return res.status(500).json({
        error: 'Failed to send verification SMS'
      });
    }

    const response = {
      message: 'Phone verification OTP sent successfully'
    };

    // If in demo mode, include the OTP in the response
    if (smsResult.demo) {
      response.demo = true;
      response.otp = otp;
      response.note = 'SMS service not configured. Use the OTP above for testing.';
    }

    res.json(response);

  } catch (error) {
    console.error('Send phone OTP error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Verify phone OTP
const verifyPhoneOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.user.id;

    if (!otp) {
      return res.status(400).json({
        error: 'OTP is required'
      });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check if OTP exists and is not expired
    if (!user.phoneOtpCode || !user.phoneOtpExpires) {
      return res.status(400).json({
        error: 'No verification OTP found. Please request a new one.'
      });
    }

    if (new Date() > user.phoneOtpExpires) {
      return res.status(400).json({
        error: 'OTP has expired. Please request a new one.'
      });
    }

    // Verify OTP
    if (user.phoneOtpCode !== otp) {
      return res.status(400).json({
        error: 'Invalid OTP'
      });
    }

    // Mark phone as verified and clear OTP
    await prisma.user.update({
      where: { id: userId },
      data: {
        isPhoneVerified: true,
        phoneOtpCode: null,
        phoneOtpExpires: null
      }
    });

    res.json({
      message: 'Phone number verified successfully'
    });

  } catch (error) {
    console.error('Verify phone OTP error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

module.exports = {
  validateSignupData,
  sendVerificationEmail,
  completeSignup,
  login,
  logout,
  refreshToken,
  getMe,
  verifyOTP,
  resendOTP,
  sendPhoneVerificationOTP,
  verifyPhoneOTP
};
