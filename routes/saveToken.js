const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Save Expo push token for a user
router.post('/', async (req, res) => {
  try {
    const { kullanici, token } = req.body || {};

    if (!kullanici || !token) {
      return res.status(400).json({
        success: false,
        message: 'kullanici and token are required',
      });
    }

    // Find user by username (fallback to email)
    const user = await User.findOne({
      $or: [{ username: kullanici.toLowerCase() }, { email: kullanici.toLowerCase() }],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.push_token = token;
    await user.save({ validateBeforeSave: false });

    return res.json({
      success: true,
      message: 'Push token saved',
    });
  } catch (error) {
    console.error('[saveToken] error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save push token',
    });
  }
});

module.exports = router;


