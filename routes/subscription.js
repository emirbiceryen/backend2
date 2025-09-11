const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/subscription/upgrade
// @desc    Upgrade user to premium subscription
// @access  Private
router.post('/upgrade', auth, async (req, res) => {
  try {
    const { cardNumber, expiryDate, cvv, cardholderName } = req.body;

    // Basic validation
    if (!cardNumber || !expiryDate || !cvv || !cardholderName) {
      return res.status(400).json({
        success: false,
        message: 'All payment fields are required'
      });
    }

    // In a real application, you would integrate with a payment processor like Stripe
    // For now, we'll simulate a successful payment
    const currentUser = req.user;
    
    // Calculate premium expiration date (1 month from now)
    const premiumExpiresAt = new Date();
    premiumExpiresAt.setMonth(premiumExpiresAt.getMonth() + 1);

    // Update user subscription
    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
      {
        subscriptionType: 'premium',
        premiumExpiresAt: premiumExpiresAt
      },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Successfully upgraded to premium!',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error upgrading to premium:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during upgrade'
    });
  }
});

// @route   GET /api/subscription/status
// @desc    Get user's subscription status
// @access  Private
router.get('/status', auth, async (req, res) => {
  try {
    const currentUser = req.user;
    
    // Check if premium subscription is still valid
    let subscriptionType = currentUser.subscriptionType || 'free';
    let isPremiumActive = false;

    if (subscriptionType === 'premium' && currentUser.premiumExpiresAt) {
      isPremiumActive = new Date() < new Date(currentUser.premiumExpiresAt);
      
      // If premium has expired, downgrade to free
      if (!isPremiumActive) {
        await User.findByIdAndUpdate(currentUser._id, {
          subscriptionType: 'free',
          premiumExpiresAt: null
        });
        subscriptionType = 'free';
      }
    }

    res.json({
      success: true,
      subscription: {
        type: subscriptionType,
        isActive: isPremiumActive,
        expiresAt: currentUser.premiumExpiresAt
      }
    });

  } catch (error) {
    console.error('Error getting subscription status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting subscription status'
    });
  }
});

// @route   POST /api/subscription/cancel
// @desc    Cancel premium subscription
// @access  Private
router.post('/cancel', auth, async (req, res) => {
  try {
    const currentUser = req.user;

    // Update user subscription to free
    const updatedUser = await User.findByIdAndUpdate(
      currentUser._id,
      {
        subscriptionType: 'free',
        premiumExpiresAt: null
      },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Premium subscription cancelled successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during cancellation'
    });
  }
});

module.exports = router;