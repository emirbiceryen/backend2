const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Hobby = require('../models/Hobby');
const upload = require('../middleware/upload');
const firebaseUploadService = require('../utils/firebaseUploadService');

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

    // Profile image is already a Firebase URL
    const formattedProfileImage = user.profileImage || null;

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
        isProfileComplete: user.isProfileComplete,
        preferredLanguage: user.preferredLanguage || 'en'
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

    // Profile image is already a Firebase URL
    const formattedProfileImage = user.profileImage || null;

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
      birthDate,
      preferredLanguage
    } = req.body;

    const updateData = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (bio !== undefined) updateData.bio = bio;
    if (skills !== undefined) {
      // Handle skills as array or string
      if (Array.isArray(skills)) {
        updateData.skills = skills;
      } else if (typeof skills === 'string') {
        try {
          const parsedSkills = JSON.parse(skills);
          updateData.skills = Array.isArray(parsedSkills) ? parsedSkills : [parsedSkills];
        } catch (e) {
          updateData.skills = [skills];
        }
      }
    }
    if (hobbies !== undefined) {
      // Handle hobbies from FormData (array) or JSON (array)
      let hobbiesArray = hobbies;
      if (typeof hobbies === 'string') {
        // Try to parse as JSON array first
        try {
          hobbiesArray = JSON.parse(hobbies);
          if (!Array.isArray(hobbiesArray)) {
            hobbiesArray = [hobbiesArray];
          }
        } catch (e) {
          // If not JSON, treat as single hobby string
        hobbiesArray = [hobbies];
        }
      } else if (Array.isArray(hobbies)) {
        hobbiesArray = hobbies;
      }
      
      // Check if user has active premium subscription
      const isPremiumActive = req.user.subscriptionType === 'premium' && 
        (!req.user.premiumExpiresAt || new Date(req.user.premiumExpiresAt) > new Date());
      const isFreeUser = !isPremiumActive;

      // Free users can select up to 1 hobby; more requires premium
      const FREE_HOBBY_LIMIT = 1;
      if (isFreeUser && hobbiesArray.length > FREE_HOBBY_LIMIT) {
        return res.status(400).json({
          success: false,
          message: `Free users can only select ${FREE_HOBBY_LIMIT} hobby. Upgrade to Premium to select more.`,
          requiresPremium: true
        });
      }
      
      updateData.hobbies = hobbiesArray;
    }

    // Handle hobbySkillLevels if provided
    if (req.body.hobbySkillLevels !== undefined) {
      let skillLevels = req.body.hobbySkillLevels;
      if (typeof skillLevels === 'string') {
        try {
          skillLevels = JSON.parse(skillLevels);
        } catch (e) {
          skillLevels = null;
        }
      }
      if (skillLevels && typeof skillLevels === 'object') {
        updateData.hobbySkillLevels = skillLevels;
      }
    }
    
    // Handle profile image upload
    if (req.file) {
      // Check if Firebase is initialized
      if (!firebaseUploadService.isInitialized()) {
        console.error('[Profile Update] Firebase is not initialized');
        return res.status(500).json({
          success: false,
          message: 'File upload service is not configured',
          error: 'Firebase Storage is not initialized. Please check server configuration.',
          details: 'Check FIREBASE_SERVICE_ACCOUNT and FIREBASE_STORAGE_BUCKET environment variables.'
        });
      }

      console.log('[Profile Update] File uploaded successfully:', req.file.originalname);
      console.log('[Profile Update] File details:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        hasBuffer: !!req.file.buffer,
        bufferLength: req.file.buffer ? req.file.buffer.length : 0
      });
      try {
        const imageUrl = await firebaseUploadService.uploadFile(req.file, 'profile');
        updateData.profileImage = imageUrl;
        console.log('[Profile Update] ✅ Profile image uploaded to Firebase:', imageUrl);
      } catch (uploadError) {
        console.error('[Profile Update] ❌ Error uploading profile image to Firebase:', uploadError);
        console.error('[Profile Update] Error message:', uploadError.message);
        console.error('[Profile Update] Error stack:', uploadError.stack);
        
        // Provide more detailed error information
        let errorMessage = 'Failed to upload profile image';
        let errorDetails = null;
        
        if (uploadError.message && uploadError.message.includes('not initialized')) {
          errorMessage = 'File upload service is not configured';
          errorDetails = 'Firebase Storage is not initialized. Please check FIREBASE_SERVICE_ACCOUNT and FIREBASE_STORAGE_BUCKET environment variables.';
        } else if (uploadError.message && uploadError.message.includes('Invalid file')) {
          errorMessage = 'Invalid file format';
          errorDetails = uploadError.message;
        } else if (uploadError.code) {
          errorDetails = `Firebase error code: ${uploadError.code}`;
        }
        
        return res.status(500).json({
          success: false,
          message: errorMessage,
          error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined,
          details: errorDetails || (process.env.NODE_ENV === 'development' ? uploadError.message : 'Check server logs for details')
        });
      }
    } else {
      console.log('[Profile Update] No file uploaded');
    }
    
    if (location !== undefined && location !== null) {
      try {
        // Handle location as string (from JSON.stringify) or object
        let locationObj = location;
        if (typeof location === 'string') {
          try {
            locationObj = JSON.parse(location);
          } catch (e) {
            console.log('Location is not valid JSON string, trying to parse as object:', e.message);
            locationObj = null;
          }
        }
        
        // If locationObj is valid object with at least one property, convert to string
        if (locationObj && typeof locationObj === 'object' && (locationObj.city || locationObj.state || locationObj.country)) {
          // Convert location object to string format
          const locationParts = [];
          if (locationObj.city) locationParts.push(locationObj.city);
          if (locationObj.state) locationParts.push(locationObj.state);
          if (locationObj.country) locationParts.push(locationObj.country);
          updateData.location = locationParts.join(', ');
          console.log('Location set to:', updateData.location);
        } else if (typeof location === 'string' && location.trim()) {
          // If location is already a string, use it directly
          updateData.location = location.trim();
          console.log('Location set to string:', updateData.location);
        } else {
          console.log('Location object is invalid or empty, skipping');
        }
      } catch (error) {
        console.error('Error processing location:', error);
        // Don't fail the entire request if location parsing fails
      }
    }
    if (age !== undefined) updateData.age = age;
    if (preferredLanguage !== undefined && ['en', 'es', 'de', 'tr'].includes(preferredLanguage)) {
      updateData.preferredLanguage = preferredLanguage;
    }
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
    // Use updated values if provided, otherwise use current user's values
    const finalFirstName = updateData.firstName !== undefined ? updateData.firstName : currentUser.firstName;
    const finalLastName = updateData.lastName !== undefined ? updateData.lastName : currentUser.lastName;
    const finalHobbies = updateData.hobbies || currentUser.hobbies || [];
    const hasHobbies = Array.isArray(finalHobbies) && finalHobbies.length > 0;
    const finalAge = updateData.age !== undefined ? updateData.age : currentUser.age;
    const hasAge = finalAge !== undefined && finalAge !== null;
    const hasProfileImage = updateData.profileImage || currentUser.profileImage;
    const isComplete = !!(finalFirstName && finalLastName && hasHobbies && hasAge && hasProfileImage);
    
    // Remove undefined values from updateData to prevent MongoDB errors
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    // Only set isProfileComplete if we're actually updating it
    if (Object.keys(updateData).length > 0) {
    updateData.isProfileComplete = isComplete;
    }

    console.log('Final updateData:', updateData);
    console.log('Profile completion check:', {
      finalFirstName,
      finalLastName,
      hasHobbies,
      hasAge,
      hasProfileImage,
      isComplete
    });

    // If no data to update, return current user
    if (Object.keys(updateData).length === 0) {
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
        ? user.profileImage
        : null;

      return res.json({
        success: true,
        message: 'Profile retrieved successfully',
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
          hobbySkillLevels: user.hobbySkillLevels || {},
          isProfileComplete: user.isProfileComplete,
          preferredLanguage: user.preferredLanguage || 'en'
        }
      });
    }

    let user;
    try {
      user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).populate('hobbies', 'name description icon');
    } catch (validationError) {
      console.error('Validation error:', validationError);
      console.error('Validation error details:', validationError.message);
      console.error('Validation error stack:', validationError.stack);
      
      // Return more specific error message
      if (validationError.name === 'ValidationError') {
        const errors = Object.values(validationError.errors).map((err) => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: errors,
          validationError: process.env.NODE_ENV === 'development' ? validationError.message : undefined
        });
      }
      
      throw validationError; // Re-throw if it's not a validation error
    }

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Profile image is already a Firebase URL
    const formattedProfileImage = user.profileImage || null;

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
        hobbySkillLevels: user.hobbySkillLevels || {},
        isProfileComplete: user.isProfileComplete,
        preferredLanguage: user.preferredLanguage || 'en'
      }
    });

  } catch (error) {
    console.error('=== PROFILE UPDATE ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', error);
    
    // Return more detailed error information
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
      errorName: error.name,
      // Include validation errors if present
      ...(error.errors && {
        validationErrors: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      })
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

    // Check if Firebase is initialized
    if (!firebaseUploadService.isInitialized()) {
      console.error('[Profile Upload] Firebase is not initialized');
      return res.status(500).json({
        success: false,
        message: 'File upload service is not configured',
        error: 'Firebase Storage is not initialized. Please check server configuration.',
        details: 'Check FIREBASE_SERVICE_ACCOUNT and FIREBASE_STORAGE_BUCKET environment variables.'
      });
    }

    // Upload to Firebase Storage
    let imageUrl;
    try {
      console.log('[Profile Upload] File details for upload:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        hasBuffer: !!req.file.buffer,
        bufferLength: req.file.buffer ? req.file.buffer.length : 0
      });
      imageUrl = await firebaseUploadService.uploadFile(req.file, 'profile');
      console.log('[Profile Upload] ✅ Profile image uploaded to Firebase:', imageUrl);
    } catch (uploadError) {
      console.error('[Profile Upload] ❌ Error uploading profile image to Firebase:', uploadError);
      console.error('[Profile Upload] Error message:', uploadError.message);
      console.error('[Profile Upload] Error stack:', uploadError.stack);
      
      // Provide more detailed error information
      let errorMessage = 'Failed to upload profile image';
      let errorDetails = null;
      
      if (uploadError.message && uploadError.message.includes('not initialized')) {
        errorMessage = 'File upload service is not configured';
        errorDetails = 'Firebase Storage is not initialized. Please check FIREBASE_SERVICE_ACCOUNT and FIREBASE_STORAGE_BUCKET environment variables.';
      } else if (uploadError.message && uploadError.message.includes('Invalid file')) {
        errorMessage = 'Invalid file format';
        errorDetails = uploadError.message;
      } else if (uploadError.code) {
        errorDetails = `Firebase error code: ${uploadError.code}`;
      }
      
      return res.status(500).json({
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined,
        details: errorDetails || (process.env.NODE_ENV === 'development' ? uploadError.message : 'Check server logs for details')
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: imageUrl },
      { new: true, runValidators: true }
    ).populate('hobbies', 'name description icon');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Profile image is already a Firebase URL
    const formattedProfileImage = user.profileImage || null;

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
// Update password
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

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