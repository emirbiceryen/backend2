const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const ForumPost = require('../models/ForumPost');

// Get business events
router.get('/events', auth, async (req, res) => {
  try {
    // Check if user is a business account
    if (req.user.accountType !== 'business') {
      return res.status(403).json({
        success: false,
        message: 'Only business accounts can access this endpoint'
      });
    }

    const events = await ForumPost.find({
      author: req.user._id,
      isEvent: true,
      isBusinessEvent: true
    })
    .populate('author', 'businessName businessType profileImage')
    .populate('eventDetails.currentParticipants', 'firstName lastName name profileImage')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Error fetching business events:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create business event
router.post('/events', auth, async (req, res) => {
  try {
    // Check if user is a business account
    if (req.user.accountType !== 'business') {
      return res.status(403).json({
        success: false,
        message: 'Only business accounts can create events'
      });
    }

    const {
      title,
      content,
      date,
      location,
      description,
      maxParticipants,
      hobbyType,
      price
    } = req.body;

    if (!title || !date || !location) {
      return res.status(400).json({
        success: false,
        message: 'Title, date, and location are required'
      });
    }

    const event = new ForumPost({
      author: req.user._id,
      title,
      content: content || description || '',
      category: 'event',
      isEvent: true,
      isBusinessEvent: true,
      createdByType: 'business',
      eventDetails: {
        title,
        date: new Date(date),
        location,
        description: description || '',
        maxParticipants: maxParticipants || 50,
        hobbyType: hobbyType || '',
        price: price || ''
      }
    });

    await event.save();
    await event.populate('author', 'businessName businessType profileImage');

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event
    });
  } catch (error) {
    console.error('Error creating business event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get event participants
router.get('/participants/:eventId', auth, async (req, res) => {
  try {
    // Check if user is a business account
    if (req.user.accountType !== 'business') {
      return res.status(403).json({
        success: false,
        message: 'Only business accounts can access this endpoint'
      });
    }

    const { eventId } = req.params;

    const event = await ForumPost.findById(eventId)
      .populate('eventDetails.currentParticipants', 'firstName lastName name profileImage email username bio age location hobbies');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if the event belongs to this business
    if (event.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this event'
      });
    }

    res.json({
      success: true,
      participants: event.eventDetails.currentParticipants || []
    });
  } catch (error) {
    console.error('Error fetching event participants:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get business profile
router.get('/profile', auth, async (req, res) => {
  try {
    if (req.user.accountType !== 'business') {
      return res.status(403).json({
        success: false,
        message: 'Only business accounts can access this endpoint'
      });
    }

    const user = await User.findById(req.user._id)
      .select('-password');

    // Format profile image URL
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const formattedProfileImage = user.profileImage 
      ? (user.profileImage.startsWith('/uploads') ? `${host}${user.profileImage}` : user.profileImage)
      : null;

    res.json({
      success: true,
      business: {
        ...user.toObject(),
        profileImage: formattedProfileImage
      }
    });
  } catch (error) {
    console.error('Error fetching business profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update business profile
router.put('/profile', auth, async (req, res) => {
  try {
    if (req.user.accountType !== 'business') {
      return res.status(403).json({
        success: false,
        message: 'Only business accounts can update this profile'
      });
    }

    const {
      businessName,
      businessType,
      contactInfo,
      workingHours,
      description,
      location
    } = req.body;

    const updateData = {};

    if (businessName !== undefined) updateData.businessName = businessName;
    if (businessType !== undefined) updateData.businessType = businessType;
    if (contactInfo !== undefined) updateData.contactInfo = contactInfo;
    if (workingHours !== undefined) updateData.workingHours = workingHours;
    if (description !== undefined) updateData.description = description;
    if (location !== undefined) {
      if (typeof location === 'object') {
        updateData.location = location;
      } else if (typeof location === 'string') {
        try {
          updateData.location = JSON.parse(location);
        } catch (e) {
          updateData.location = { city: location, state: '', country: '' };
        }
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    // Format profile image URL
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const formattedProfileImage = user.profileImage 
      ? (user.profileImage.startsWith('/uploads') ? `${host}${user.profileImage}` : user.profileImage)
      : null;

    res.json({
      success: true,
      message: 'Business profile updated successfully',
      business: {
        ...user.toObject(),
        profileImage: formattedProfileImage
      }
    });
  } catch (error) {
    console.error('Error updating business profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

