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
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
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
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
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
      age,
      birthDate
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
    
    if (location !== undefined && location && (location.city || location.state || location.country)) {
      updateData.location = location;
    }
    if (age !== undefined) updateData.age = age;
    if (birthDate !== undefined) {
      console.log('Processing birthDate:', birthDate);
      updateData.birthDate = birthDate;
      // Also compute age from birthDate when provided
      const birth = new Date(birthDate);
      console.log('Parsed birth date:', birth);
      if (!isNaN(birth.getTime())) {
        const today = new Date();
        let computedAge = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          computedAge--;
        }
        console.log('Computed age:', computedAge);
        updateData.age = computedAge;
      } else {
        console.log('Invalid birth date format');
      }
    }

    // Get current user first to check existing profile image
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if profile is complete (hobbies, age, and profile image)
    const hasHobbies = hobbies && hobbies.length > 0;
    const hasAge = age !== undefined && age !== null;
    const hasProfileImage = req.file || currentUser.profileImage;
    const isComplete = !!(firstName && lastName && hasHobbies && hasAge && hasProfileImage);
    updateData.isProfileComplete = isComplete;

    console.log('Final updateData:', updateData);

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
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
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
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Upload profile image only
router.post('/upload-image', auth, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: `/uploads/${req.file.filename}` },
      { new: true, runValidators: true }
    ).populate('hobbies', 'name description icon');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Format profile image URL
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const formattedProfileImage = user.profileImage 
      ? (user.profileImage.startsWith('/uploads') ? `${host}${user.profileImage}` : user.profileImage)
      : null;

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
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
    console.error('Error uploading profile image:', error);
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

// Delete user account
router.delete('/me', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Delete user and all related data
    await User.findByIdAndDelete(userId);
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 