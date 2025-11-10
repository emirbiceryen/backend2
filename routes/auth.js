const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const MAX_LOGIN_ATTEMPTS = 7;
const LOGIN_LOCK_TIME = 60 * 1000; // 1 minute
const RESET_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
const googleClientIds = (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

const googleOAuthClient = googleClientIds.length ? new OAuth2Client() : null;

const generateUniqueUsername = async (baseName, fallback = 'user') => {
  const sanitize = (value) => {
    if (!value) return '';
    return value.toLowerCase().replace(/[^a-z0-9_]/g, '');
  };

  let base = sanitize(baseName);
  if (!base) {
    base = `${fallback}${Math.floor(Math.random() * 10000)}`;
  }

  let username = base;
  let suffix = 1;

  while (await User.findOne({ username })) {
    username = `${base}${suffix}`;
    suffix += 1;
  }

  return username;
};

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('username').trim().isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { 
      name, 
      email, 
      username, 
      password, 
      accountType,
      businessName,
      businessType,
      contactInfo,
      workingHours,
      description,
      location
    } = req.body;

    // Check if user already exists by email
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check if username already exists
    const existingUserByUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUserByUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username is already taken'
      });
    }

    // Create new user
    console.log('Creating user with data:', { name, email, username: username.toLowerCase(), accountType });
    
    const userData = {
      name,
      email,
      username: username.toLowerCase(),
      password,
      accountType: accountType || 'individual'
    };

    // Add business fields if accountType is business
    if (accountType === 'business') {
      if (businessName) userData.businessName = businessName;
      if (businessType) userData.businessType = businessType;
      if (contactInfo) userData.contactInfo = contactInfo;
      if (workingHours) userData.workingHours = workingHours;
      if (description) userData.description = description;
      if (location) {
        if (typeof location === 'object') {
          userData.location = location;
        } else if (typeof location === 'string') {
          try {
            userData.location = JSON.parse(location);
          } catch (e) {
            // If parsing fails, set as city only
            userData.location = { city: location, state: '', country: '' };
          }
        }
      }
    }
    
    const user = new User(userData);

    console.log('User object created, saving to database...');
    await user.save();
    console.log('User saved successfully with ID:', user._id);

    // Generate token
    const token = generateToken(user._id);

    // Populate hobbies before sending user data (if hobbies exist)
    try {
      if (user.hobbies && user.hobbies.length > 0) {
        await user.populate('hobbies', 'name');
      }
    } catch (populateError) {
      console.error('Error populating hobbies:', populateError);
      // Continue without populating hobbies
    }

    // Format profile image URL
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const formattedProfileImage = user.profileImage 
      ? (user.profileImage.startsWith('/uploads') ? `${host}${user.profileImage}` : user.profileImage)
      : null;

    const userResponse = {
      ...user.toObject(),
      profileImage: formattedProfileImage
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Signup error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const now = Date.now();

    // If lock has expired, reset counters
    if (user.lockUntil && user.lockUntil.getTime() <= now) {
      user.lockUntil = null;
      user.loginAttempts = 0;
      await user.save({ validateBeforeSave: false });
    }

    // Check if user is currently locked
    if (user.lockUntil && user.lockUntil.getTime() > now) {
      const remainingSeconds = Math.ceil((user.lockUntil.getTime() - now) / 1000);
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts. Please try again in ${remainingSeconds} seconds.`
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;

      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(now + LOGIN_LOCK_TIME);
        user.loginAttempts = 0;
      }

      await user.save({ validateBeforeSave: false });

      const locked = user.lockUntil && user.lockUntil.getTime() > now;
      return res.status(locked ? 429 : 400).json({
        success: false,
        message: locked
          ? 'Too many failed login attempts. Please try again later.'
          : 'Invalid credentials'
      });
    }

    // Successful login - reset attempts
    if (user.loginAttempts !== 0 || user.lockUntil) {
      user.loginAttempts = 0;
      user.lockUntil = null;
      await user.save({ validateBeforeSave: false });
    }

    // Generate token
    const token = generateToken(user._id);

    // Populate hobbies before sending user data
    await user.populate('hobbies', 'name');

    // Format profile image URL
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const formattedProfileImage = user.profileImage 
      ? (user.profileImage.startsWith('/uploads') ? `${host}${user.profileImage}` : user.profileImage)
      : null;

    const userData = {
      ...user.toObject(),
      profileImage: formattedProfileImage
    };

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Generate password reset token
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // For security, don't reveal that the email doesn't exist
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset token has been generated.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY);
    await user.save({ validateBeforeSave: false });

    // TODO: Send email with reset link containing resetToken

    res.json({
      success: true,
      message: 'Password reset token generated successfully.',
      // Return the raw token for now until email service is configured
      resetToken
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using token
// @access  Public
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { token, password } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.loginAttempts = 0;
    user.lockUntil = null;

    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
});

// @route   POST /api/auth/google
// @desc    Login or sign up using Google ID token
// @access  Public
router.post('/google', [
  body('idToken').notEmpty().withMessage('Google ID token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    if (!googleOAuthClient || googleClientIds.length === 0) {
      return res.status(503).json({
        success: false,
        message: 'Google authentication is not configured.'
      });
    }

    const { idToken } = req.body;

    let ticket;
    try {
      ticket = await googleOAuthClient.verifyIdToken({
        idToken,
        audience: googleClientIds,
      });
    } catch (error) {
      console.error('Google token verification error:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid Google token'
      });
    }

    const payload = ticket.getPayload();
    const email = payload?.email;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Google account does not have an email address'
      });
    }

    let user = await User.findOne({ email });

    if (!user) {
      const name = payload?.name || email;
      const givenName = payload?.given_name || '';
      const familyName = payload?.family_name || '';
      const preferredUsername = payload?.email ? payload.email.split('@')[0] : name;
      const username = await generateUniqueUsername(preferredUsername, 'googleuser');

      const randomPassword = crypto.randomBytes(32).toString('hex');

      user = new User({
        name,
        firstName: givenName,
        lastName: familyName,
        email,
        username,
        password: randomPassword,
        profileImage: payload?.picture || null,
        accountType: 'individual',
        isProfileComplete: false,
      });

      await user.save();
    } else if (!user.profileImage && payload?.picture) {
      user.profileImage = payload.picture;
      await user.save({ validateBeforeSave: false });
    }

    // Reset login attempts on successful external login
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    await user.populate('hobbies', 'name');

    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const formattedProfileImage = user.profileImage 
      ? (user.profileImage.startsWith('/uploads') ? `${host}${user.profileImage}` : user.profileImage)
      : null;

    const userData = {
      ...user.toObject(),
      profileImage: formattedProfileImage
    };

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userData
    });
  } catch (error) {
    console.error('Google authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during Google authentication'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    // Format profile image URL
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const formattedProfileImage = req.user.profileImage 
      ? (req.user.profileImage.startsWith('/uploads') ? `${host}${req.user.profileImage}` : req.user.profileImage)
      : null;

    const userData = {
      ...req.user.toObject(),
      profileImage: formattedProfileImage
    };

    res.json({
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('firstName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('First name must be between 1 and 50 characters'),
  body('lastName').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Last name must be between 1 and 50 characters'),
  body('username').optional().trim().isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio cannot be more than 500 characters'),
  body('location').optional().isLength({ max: 100 }).withMessage('Location cannot be more than 100 characters'),
  body('age').optional().isInt({ min: 13, max: 120 }).withMessage('Age must be between 13 and 120'),
  body('skills').optional().isArray().withMessage('Skills must be an array'),
  body('profileImage').optional().isString().withMessage('Profile image must be a string URL')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { name, firstName, lastName, username, bio, location, age, skills, profileImage } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (username !== undefined) {
      // Check if username is already taken by another user
      const existingUser = await User.findOne({ 
        username: username.toLowerCase(),
        _id: { $ne: req.user._id }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
      updateData.username = username.toLowerCase();
    }
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (age !== undefined) updateData.age = age;
    if (skills !== undefined) updateData.skills = skills;
    if (profileImage !== undefined) updateData.profileImage = profileImage;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    // Populate hobbies before sending user data
    await user.populate('hobbies', 'name');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
});

module.exports = router; 