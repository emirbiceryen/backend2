const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Post = require('../models/Post');

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

    const events = await Post.find({
      authorId: req.user._id,
      isEvent: true,
      isBusinessEvent: true
    })
    .populate('authorId', 'businessName businessType profileImage accountType')
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

    // Get business name for authorName
    const businessUser = await User.findById(req.user._id);
    const authorName = businessUser.businessName || businessUser.name;

    const eventContent = (content && content.trim()) || (description && description.trim()) || `Event at ${location}`;
    const parsedMaxParticipants = Number.isFinite(Number(maxParticipants)) && Number(maxParticipants) > 0
      ? Number(maxParticipants)
      : 50;
    const normalizeDateInput = (input) => {
      if (!input || typeof input !== 'string') return null;
      const trimmed = input.trim();

      const tryParse = (value) => {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed;
      };

      // Try raw string
      let parsedDate = tryParse(trimmed);
      if (parsedDate) return parsedDate;

      // Replace space between date/time with 'T'
      if (trimmed.includes(' ')) {
        parsedDate = tryParse(trimmed.replace(' ', 'T'));
        if (parsedDate) return parsedDate;
      }

      // Handle DD.MM.YYYY HH:MM or DD/MM/YYYY variants
      const match = trimmed.match(/^(\d{2})[./-](\d{2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
      if (match) {
        const [, day, month, year, hour = '12', minute = '00'] = match;
        parsedDate = tryParse(`${year}-${month}-${day}T${hour.padStart(2, '0')}:${minute}`);
        if (parsedDate) return parsedDate;
      }

      return null;
    };

    const eventDate = normalizeDateInput(date);
    if (!eventDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event date'
      });
    }

    const event = new Post({
      authorId: req.user._id,
      authorName: authorName,
      title,
      content: eventContent,
      category: 'event',
      isEvent: true,
      isBusinessEvent: true,
      createdByType: 'business',
      eventDetails: {
        date: eventDate,
        location,
        maxParticipants: parsedMaxParticipants,
        currentParticipants: 0,
        hobbyType: hobbyType || '',
        price: price || '',
        applications: []
      }
    });

    await event.save();
    await event.populate('authorId', 'businessName businessType profileImage accountType');

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

    const event = await Post.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if the event belongs to this business
    if (event.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this event'
      });
    }

    // Get participants from applications
    const applications = (event.eventDetails && Array.isArray(event.eventDetails.applications))
      ? event.eventDetails.applications
      : [];

    const participantIds = applications
      .filter((app) => app.status === 'approved')
      .map((app) => app.userId);

    const participants = await User.find({ _id: { $in: participantIds } })
      .select('firstName lastName name profileImage email username bio age location hobbies averageRating totalRatings');

    res.json({
      success: true,
      participants: participants || []
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

