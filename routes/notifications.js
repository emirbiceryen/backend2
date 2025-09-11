const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const firebaseService = require('../services/firebaseService');

// Update FCM token
router.put('/fcm-token', auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    
    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }

    // Validate token with Firebase
    const validation = await firebaseService.validateToken(fcmToken);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid FCM token'
      });
    }

    // Update user's FCM token
    await User.findByIdAndUpdate(req.user._id, { fcmToken });
    
    res.json({
      success: true,
      message: 'FCM token updated successfully'
    });
  } catch (error) {
    console.error('Error updating FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update FCM token'
    });
  }
});

// Remove FCM token (on logout)
router.delete('/fcm-token', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { fcmToken: null });
    
    res.json({
      success: true,
      message: 'FCM token removed successfully'
    });
  } catch (error) {
    console.error('Error removing FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove FCM token'
    });
  }
});

// Update notification settings
router.put('/settings', auth, async (req, res) => {
  try {
    const { notificationSettings } = req.body;
    
    if (!notificationSettings) {
      return res.status(400).json({
        success: false,
        message: 'Notification settings are required'
      });
    }

    // Validate notification settings
    const validTypes = ['likes', 'messages', 'events', 'general'];
    for (const [key, value] of Object.entries(notificationSettings)) {
      if (!validTypes.includes(key) || typeof value !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: `Invalid notification setting: ${key}`
        });
      }
    }

    await User.findByIdAndUpdate(req.user._id, { notificationSettings });
    
    res.json({
      success: true,
      message: 'Notification settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification settings'
    });
  }
});

// Get notification settings
router.get('/settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notificationSettings');
    
    res.json({
      success: true,
      notificationSettings: user.notificationSettings
    });
  } catch (error) {
    console.error('Error getting notification settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification settings'
    });
  }
});

// Test notification (for development)
router.post('/test', auth, async (req, res) => {
  try {
    const { title, body, type = 'general' } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Title and body are required'
      });
    }

    const result = await firebaseService.sendNotificationToUser(
      req.user._id,
      title,
      body,
      { type }
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification'
    });
  }
});

module.exports = router;