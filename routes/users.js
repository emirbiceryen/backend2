const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   PUT /api/users/hobbies
// @desc    Update user hobbies
// @access  Private
router.put('/hobbies', auth, [
  body('hobbies').isArray().withMessage('Hobbies must be an array'),
  body('hobbies.*').isString().withMessage('Each hobby must be a string')
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

    const { hobbies } = req.body;
    const currentUser = req.user;

    // Check subscription type and enforce limits
    const isFreeUser = !currentUser.subscriptionType || currentUser.subscriptionType === 'free';
    
    if (isFreeUser && hobbies.length > 1) {
      return res.status(400).json({
        success: false,
        message: 'Free users can only select 1 hobby. Upgrade to Premium to select multiple hobbies.',
        requiresPremium: true
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        hobbies,
        isProfileComplete: hobbies.length > 0
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Hobbies updated successfully',
      user
    });
  } catch (error) {
    console.error('Update hobbies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during hobbies update'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user profile by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('hobbies', 'name category icon');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 