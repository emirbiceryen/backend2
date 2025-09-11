const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Hobby = require('../models/Hobby');

// Get current user's profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('hobbies', 'name description icon');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        bio: user.bio,
        skills: user.skills,
        hobbies: user.hobbies,
        profileImage: user.profileImage,
        location: user.location,
        age: user.age,
        averageRating: user.averageRating,
        totalRatings: user.totalRatings,
        isProfileComplete: user.isProfileComplete
      }
    });

  } catch (error) {
    console.error('Error getting profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Get another user's profile
router.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('hobbies', 'name description icon');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio,
        skills: user.skills,
        hobbies: user.hobbies,
        profileImage: user.profileImage,
        location: user.location,
        age: user.age,
        averageRating: user.averageRating,
        totalRatings: user.totalRatings
      }
    });

  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Update current user's profile
router.put('/me', auth, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      bio,
      skills,
      hobbies,
      profileImage,
      location,
      age
    } = req.body;

    const updateData = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (bio !== undefined) updateData.bio = bio;
    if (skills !== undefined) updateData.skills = skills;
    if (hobbies !== undefined) {
      // Check subscription type and enforce limits
      const isFreeUser = !req.user.subscriptionType || req.user.subscriptionType === 'free';
      
      if (isFreeUser && hobbies.length > 1) {
        return res.status(400).json({
          success: false,
          message: 'Free users can only select 1 hobby. Upgrade to Premium to select multiple hobbies.',
          requiresPremium: true
        });
      }
      
      updateData.hobbies = hobbies;
    }
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (location !== undefined) updateData.location = location;
    if (age !== undefined) updateData.age = age;

    // Check if profile is complete
    const isComplete = !!(firstName && lastName && hobbies && hobbies.length > 0);
    updateData.isProfileComplete = isComplete;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).populate('hobbies', 'name description icon');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        bio: user.bio,
        skills: user.skills,
        hobbies: user.hobbies,
        profileImage: user.profileImage,
        location: user.location,
        age: user.age,
        averageRating: user.averageRating,
        totalRatings: user.totalRatings,
        isProfileComplete: user.isProfileComplete
      }
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Get all hobbies for profile editing
router.get('/hobbies', async (req, res) => {
  try {
    const hobbies = await Hobby.find().sort({ name: 1 });
    
    res.json({
      success: true,
      hobbies
    });

  } catch (error) {
    console.error('Error getting hobbies:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router; 