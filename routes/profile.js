const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Hobby = require('../models/Hobby');
const upload = require('../middleware/upload');

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

    // Format profile image URL
    const host = `${req.protocol}://${req.get('host')}`;
    const formattedProfileImage = user.profileImage 
      ? (user.profileImage.startsWith('/uploads') ? `${host}${user.profileImage}` : user.profileImage)
      : null;

    res.json({
      success: true,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        bio: user.bio,
        skills: user.skills,
        hobbies: user.hobbies,
        profileImage: formattedProfileImage,
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

    // Format profile image URL
    const host = `${req.protocol}://${req.get('host')}`;
    const formattedProfileImage = user.profileImage 
      ? (user.profileImage.startsWith('/uploads') ? `${host}${user.profileImage}` : user.profileImage)
      : null;

    res.json({
      success: true,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio,
        skills: user.skills,
        hobbies: user.hobbies,
        profileImage: formattedProfileImage,
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
router.put('/me', auth, upload.single('profileImage'), async (req, res) => {
  try {
    console.log('=== PROFILE UPDATE DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    console.log('User ID:', req.user._id);
    
    const {
      firstName,
      lastName,
      bio,
      skills,
      hobbies,
      location,
      age
    } = req.body;

    const updateData = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (bio !== undefined) updateData.bio = bio;
    if (skills !== undefined) updateData.skills = skills;
    if (hobbies !== undefined) {
      // Handle hobbies from FormData (array) or JSON (array)
      let hobbiesArray = hobbies;
      if (typeof hobbies === 'string') {
        // If it's a single string, convert to array
        hobbiesArray = [hobbies];
      } else if (Array.isArray(hobbies)) {
        hobbiesArray = hobbies;
      }
      
      // Check if user has active premium subscription
      const isPremiumActive = req.user.subscriptionType === 'premium' && 
        (!req.user.premiumExpiresAt || new Date(req.user.premiumExpiresAt) > new Date());
      const isFreeUser = !isPremiumActive;
      
      if (isFreeUser && hobbiesArray.length > 1) {
        return res.status(400).json({
          success: false,
          message: 'Free users can only select 1 hobby. Upgrade to Premium to select multiple hobbies.',
          requiresPremium: true
        });
      }
      
      updateData.hobbies = hobbiesArray;
    }
    
    // Handle profile image upload
    if (req.file) {
      console.log('File uploaded successfully:', req.file);
      updateData.profileImage = `/uploads/${req.file.filename}`;
      console.log('Setting profileImage to:', updateData.profileImage);
    } else {
      console.log('No file uploaded');
    }
    
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

    // Format profile image URL
    const host = `${req.protocol}://${req.get('host')}`;
    const formattedProfileImage = user.profileImage 
      ? (user.profileImage.startsWith('/uploads') ? `${host}${user.profileImage}` : user.profileImage)
      : null;

    console.log('Final profileImage in response:', formattedProfileImage);
    console.log('User profileImage in DB:', user.profileImage);

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
        profileImage: formattedProfileImage,
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