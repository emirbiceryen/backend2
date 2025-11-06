const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const upload = require('../middleware/upload');

// Get all posts with optional filtering
router.get('/posts', auth, async (req, res) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (category && category !== 'all') {
      query.category = category;
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('authorId', 'name email firstName lastName profileImage accountType businessName businessType');

    console.log('Found posts:', posts.length);
    console.log('First post author:', posts[0]?.authorId);

    const total = await Post.countDocuments(query);

    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const formattedPosts = await Promise.all(posts.map(async (p) => {
      const po = p.toObject();
      const populatedAuthor = po.authorId && typeof po.authorId === 'object' ? po.authorId : null;

      // For business accounts, use businessName; for individuals, use name
      const authorName = po.authorName || (populatedAuthor ? (
        populatedAuthor.accountType === 'business' && populatedAuthor.businessName
          ? populatedAuthor.businessName
          : (populatedAuthor.firstName && populatedAuthor.lastName
            ? `${populatedAuthor.firstName} ${populatedAuthor.lastName}`
            : populatedAuthor.name)
      ) : undefined);

      const rawAvatar = po.authorAvatar || (populatedAuthor ? populatedAuthor.profileImage : undefined);
      const authorAvatar = rawAvatar
        ? (rawAvatar.startsWith('/uploads') ? `${host}${rawAvatar}` : rawAvatar)
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName || 'User')}&background=3C0270&color=ffffff&size=44`;

      const media = Array.isArray(po.media)
        ? po.media.map((m) => (typeof m === 'string' && m.startsWith('/uploads') ? `${host}${m}` : m))
        : po.media;

      // Add participants data for events
      let participants = [];
      if (po.isEvent && po.eventDetails && po.eventDetails.applications) {
        // Get all approved participant user IDs
        const approvedUserIds = po.eventDetails.applications
          .filter(app => app.status === 'approved')
          .map(app => app.userId);
        
        // Fetch full user data for participants
        const User = require('../models/User');
        const participantUsers = await User.find({ _id: { $in: approvedUserIds } })
          .select('firstName lastName name username profileImage bio age location averageRating totalRatings');
        
        participants = participantUsers.map(user => {
          // Format profile image URL
          let profileImageUrl = user.profileImage;
          if (profileImageUrl && !profileImageUrl.startsWith('http')) {
            // If it's a local file path, construct the full URL
            profileImageUrl = `${req.protocol}://${req.get('host')}${profileImageUrl}`;
          }
          
          
          return {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
            username: user.username,
            profileImage: profileImageUrl,
            bio: user.bio,
            age: user.age,
            location: user.location,
            averageRating: user.averageRating,
            totalRatings: user.totalRatings
          };
        });
      }

      return {
        ...po,
        authorName,
        authorAvatar,
        media,
        isBusinessEvent: po.isBusinessEvent || (populatedAuthor && populatedAuthor.accountType === 'business'),
        createdByType: po.createdByType || (populatedAuthor && populatedAuthor.accountType === 'business' ? 'business' : 'individual'),
        businessInfo: populatedAuthor && populatedAuthor.accountType === 'business' ? {
          businessName: populatedAuthor.businessName,
          businessType: populatedAuthor.businessType
        } : undefined,
        eventDetails: po.isEvent && po.eventDetails ? {
          ...po.eventDetails,
          participants
        } : po.eventDetails
      };
    }));

    console.log('Formatted posts:', formattedPosts.map(p => ({ 
      authorName: p.authorName, 
      authorAvatar: p.authorAvatar 
    })));

    res.json({
      success: true,
      posts: formattedPosts,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasMore: skip + posts.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a new post
router.post('/posts', auth, upload.array('media', 5), [
  body('title').notEmpty().trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be between 1-200 characters'),
  body('content').notEmpty().trim().isLength({ min: 1 }).withMessage('Content is required and must be at least 1 character'),
  body('isPoll').optional(),
  body('pollOptions').optional(),
  body('isEvent').optional(),
  body('eventDetails.date').optional(),
  body('eventDetails.location').optional(),
  body('eventDetails.maxParticipants').optional()
], async (req, res) => {
  try {
    console.log('Received post data:', req.body);
    console.log('Uploaded files:', req.files);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { title, content, isPoll, pollOptions, isSingleChoice, isEvent, eventDetails } = req.body;

    // Parse boolean values from FormData (they come as strings)
    const parsedIsPoll = isPoll === 'true';
    const parsedIsSingleChoice = isSingleChoice === 'true';
    const parsedIsEvent = isEvent === 'true';
    
    console.log('Raw isEvent value:', isEvent);
    console.log('Parsed isEvent value:', parsedIsEvent);
    console.log('Event details:', eventDetails);
    console.log('Request body keys:', Object.keys(req.body));

    // Auto-generate content for event posts if empty
    let finalContent = content;
    if (parsedIsEvent && (!content || content.trim() === '')) {
      // Get event details for auto-content generation
      let eventData = eventDetails;
      if (!eventData) {
        eventData = {
          topic: req.body['eventDetails[topic]'] || 'Event',
          location: req.body['eventDetails[location]'] || 'Location TBD',
          date: req.body['eventDetails[date]'] || new Date().toISOString()
        };
      }
      
      finalContent = `Event: ${eventData.topic || 'Event'} at ${eventData.location || 'Location TBD'}`;
      console.log('Auto-generated content for event:', finalContent);
    }

    // Use provided title or auto-generate from content
    const finalTitle = title || (finalContent && finalContent.length > 50 ? finalContent.substring(0, 50) + '...' : finalContent);
    console.log('Final title:', finalTitle);
    console.log('Final content:', finalContent);

    // Process uploaded files
    let mediaUrls = [];
    if (req.files && req.files.length > 0) {
      mediaUrls = req.files.map(file => `/uploads/${file.filename}`);
      console.log('Media URLs:', mediaUrls);
    }

    const postData = {
      authorId: req.user._id,
      authorName: req.user.name,
      title: finalTitle,
      content: finalContent,
      category: 'general',
      tags: [],
      media: mediaUrls.length > 0 ? mediaUrls : undefined,
      isPoll: parsedIsPoll,
      isEvent: parsedIsEvent
    };

    console.log('Post data to save:', postData);

    if (parsedIsPoll && pollOptions && pollOptions.length >= 2) {
      // Handle both array and FormData array formats
      const options = Array.isArray(pollOptions) ? pollOptions : [pollOptions];
      postData.pollOptions = options.filter(option => option && option.trim()).map(option => ({
        text: option,
        votes: 0
      }));
    }

    if (parsedIsEvent) {
      // Handle both JSON and FormData formats
      let eventData = eventDetails;
      if (!eventData) {
        // Try to get from nested FormData format
        eventData = {
          date: req.body['eventDetails[date]'],
          location: req.body['eventDetails[location]'],
          topic: req.body['eventDetails[topic]'],
          maxParticipants: req.body['eventDetails[maxParticipants]']
        };
      }
      
      console.log('Event data from request:', eventData);
      console.log('Request body keys:', Object.keys(req.body));
      console.log('eventDetails[date]:', req.body['eventDetails[date]']);
      console.log('eventDetails[location]:', req.body['eventDetails[location]']);
      
      console.log('Creating event details:', eventData);
      if (eventData && eventData.date && eventData.location) {
        // Parse the date properly - handle DD.MM.YYYY HH.mm format
        let parsedDate;
        try {
          // Try to parse the date format DD.MM.YYYY HH.mm
          const dateStr = eventData.date;
          if (dateStr.includes('.')) {
            // Convert DD.MM.YYYY HH.mm to YYYY-MM-DDTHH:mm format
            const [datePart, timePart] = dateStr.split(' ');
            const [day, month, year] = datePart.split('.');
            const [hour, minute] = timePart.split('.');
            const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
            parsedDate = new Date(isoDate);
          } else {
            parsedDate = new Date(eventData.date);
          }
          
          // Validate the date
          if (isNaN(parsedDate.getTime())) {
            console.log('Invalid date, using current date');
            parsedDate = new Date();
          }
        } catch (error) {
          console.log('Date parsing error, using current date:', error.message);
          parsedDate = new Date();
        }
        
        postData.eventDetails = {
          date: parsedDate,
          location: eventData.location,
          topic: eventData.topic || '',
          maxParticipants: parseInt(eventData.maxParticipants) || 10,
          currentParticipants: 0,
          applications: []
        };
        console.log('Event details created:', postData.eventDetails);
      } else {
        console.log('Event details missing or invalid:', eventData);
      }
    }

    const post = new Post(postData);
    console.log('Post object created:', post);
    console.log('Post isEvent:', post.isEvent);
    console.log('Post eventDetails:', post.eventDetails);
    console.log('Post category:', post.category);
    
    // Validate the post
    const validationErrors = post.validateSync();
    if (validationErrors) {
      console.log('Post validation errors:', validationErrors);
      return res.status(400).json({ 
        success: false, 
        message: 'Post validation failed', 
        errors: validationErrors 
      });
    }
    
    try {
      await post.save();
      console.log('Post saved successfully with ID:', post._id);
    } catch (saveError) {
      console.error('Error saving post:', saveError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to save post', 
        error: saveError.message 
      });
    }

    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const po = post.toObject();
    const media = Array.isArray(po.media)
      ? po.media.map((m) => (typeof m === 'string' && m.startsWith('/uploads') ? `${host}${m}` : m))
      : po.media;

    const author = await User.findById(req.user._id).select('name firstName lastName profileImage');
    const authorName = po.authorName || (author ? (
      author.firstName && author.lastName ? `${author.firstName} ${author.lastName}` : author.name
    ) : undefined);
    const rawAvatar = author ? author.profileImage : undefined;
    const authorAvatar = rawAvatar
      ? (rawAvatar.startsWith('/uploads') ? `${host}${rawAvatar}` : rawAvatar)
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName || 'User')}&background=3C0270&color=ffffff&size=44`;

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: { ...po, media, authorName, authorAvatar }
    });
  } catch (error) {
    console.error('Error creating post:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get a specific post
router.get('/posts/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('authorId', 'name email firstName lastName profileImage');

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const po = post.toObject();
    const populatedAuthor = po.authorId && typeof po.authorId === 'object' ? po.authorId : null;
    const authorName = po.authorName || (populatedAuthor ? (
      populatedAuthor.firstName && populatedAuthor.lastName
        ? `${populatedAuthor.firstName} ${populatedAuthor.lastName}`
        : populatedAuthor.name
    ) : undefined);
    const rawAvatar = po.authorAvatar || (populatedAuthor ? populatedAuthor.profileImage : undefined);
    const authorAvatar = rawAvatar
      ? (rawAvatar.startsWith('/uploads') ? `${host}${rawAvatar}` : rawAvatar)
      : undefined;
    const media = Array.isArray(po.media)
      ? po.media.map((m) => (typeof m === 'string' && m.startsWith('/uploads') ? `${host}${m}` : m))
      : po.media;

    res.json({
      success: true,
      post: { ...po, authorName, authorAvatar, media }
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Like/unlike a post (toggle functionality)
router.post('/posts/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const userLiked = post.likedBy.includes(req.user._id);

    if (userLiked) {
      // Unlike the post
      post.likedBy = post.likedBy.filter(id => id.toString() !== req.user._id.toString());
      post.likes = Math.max(0, post.likes - 1);
      await post.save();

      res.json({
        success: true,
        message: 'Post unliked successfully',
        likes: post.likes,
        isLiked: false
      });
    } else {
      // Like the post
      post.likedBy.push(req.user._id);
      post.likes += 1;
      await post.save();

      res.json({
        success: true,
        message: 'Post liked successfully',
        likes: post.likes,
        isLiked: true
      });
    }
  } catch (error) {
    console.error('Error toggling post like:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add a comment to a post
router.post('/posts/:id/comments', auth, [
  body('content').trim().isLength({ min: 1 }).withMessage('Comment content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const comment = {
      authorId: req.user._id,
      authorName: req.user.name,
      content: req.body.content
    };

    post.comments.push(comment);
    await post.save();

    res.json({
      success: true,
      message: 'Comment added successfully',
      comment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Apply to an event
router.post('/events/:id/apply', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (!post.isEvent) {
      return res.status(400).json({ success: false, message: 'This post is not an event' });
    }

    if (post.authorId.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot apply to your own event' });
    }

    // Check if user has already applied
    const existingApplication = post.eventDetails.applications.find(
      app => app.userId.toString() === req.user._id.toString()
    );

    if (existingApplication) {
      return res.status(400).json({ success: false, message: 'You have already applied to this event' });
    }

    // Check if event is full
    if (post.eventDetails.currentParticipants >= post.eventDetails.maxParticipants) {
      return res.status(400).json({ success: false, message: 'This event is full' });
    }

    const application = {
      userId: req.user._id,
      userName: req.user.name,
      status: 'pending'
    };

    post.eventDetails.applications.push(application);
    await post.save();

    res.json({
      success: true,
      message: 'Application submitted successfully',
      application
    });
  } catch (error) {
    console.error('Error applying to event:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user's event applications (for event creators)
router.get('/events/applications', auth, async (req, res) => {
  try {
    const events = await Post.find({
      authorId: req.user._id,
      isEvent: true
    }).populate('eventDetails.applications.userId', 'name email');

    const applications = [];
    events.forEach(event => {
      event.eventDetails.applications.forEach(app => {
        applications.push({
          eventId: event._id,
          eventTitle: event.title,
          application: app
        });
      });
    });

    res.json({
      success: true,
      applications
    });
  } catch (error) {
    console.error('Error fetching event applications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Approve/reject event application (for event creators)
router.put('/events/:eventId/applications/:applicationId', auth, [
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const post = await Post.findById(req.params.eventId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (post.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage this event' });
    }

    const application = post.eventDetails.applications.id(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    application.status = req.body.status;

    // If approved, increment participant count
    if (req.body.status === 'approved') {
      post.eventDetails.currentParticipants += 1;
    }

    await post.save();

    res.json({
      success: true,
      message: `Application ${req.body.status}`,
      application
    });
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user's posts
router.get('/user/posts', auth, async (req, res) => {
  try {
    const posts = await Post.find({ authorId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      posts
    });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a post (only by author)
router.delete('/posts/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Only allow post author to delete their own post
    if (post.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
    }

    await Post.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Vote on a poll
router.post('/posts/:id/poll/vote', auth, [
  body('optionId').isMongoId().withMessage('Invalid option ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (!post.isPoll) {
      return res.status(400).json({ success: false, message: 'This post is not a poll' });
    }

    const { optionId } = req.body;
    const option = post.pollOptions.id(optionId);
    
    if (!option) {
      return res.status(404).json({ success: false, message: 'Poll option not found' });
    }

    // Check if user already voted
    const existingVote = post.pollOptions.find(opt => 
      opt.votedBy && opt.votedBy.includes(req.user._id)
    );

    if (existingVote) {
      return res.status(400).json({ success: false, message: 'You have already voted on this poll' });
    }

    // Add vote
    option.votes += 1;
    if (!option.votedBy) option.votedBy = [];
    option.votedBy.push(req.user._id);

    await post.save();

    res.json({
      success: true,
      message: 'Vote recorded successfully',
      pollOptions: post.pollOptions
    });
  } catch (error) {
    console.error('Error voting on poll:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Join an event
router.post('/posts/:id/event/join', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (!post.isEvent) {
      return res.status(400).json({ success: false, message: 'This post is not an event' });
    }

    if (post.eventDetails.currentParticipants >= post.eventDetails.maxParticipants) {
      return res.status(400).json({ success: false, message: 'Event is full' });
    }

    // Check if user already joined
    const existingApplication = post.eventDetails.applications.find(
      app => app.userId.toString() === req.user._id.toString()
    );

    if (existingApplication) {
      return res.status(400).json({ success: false, message: 'You have already joined this event' });
    }

    // Add application
    post.eventDetails.applications.push({
      userId: req.user._id,
      userName: req.user.name,
      username: req.user.username,
      userProfileImage: req.user.profileImage,
      status: 'approved' // Auto-approve for now
    });

    post.eventDetails.currentParticipants += 1;

    await post.save();

    res.json({
      success: true,
      message: 'Successfully joined the event',
      eventDetails: post.eventDetails
    });
  } catch (error) {
    console.error('Error joining event:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Leave an event
router.post('/posts/:id/event/leave', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (!post.isEvent) {
      return res.status(400).json({ success: false, message: 'This post is not an event' });
    }

    // Find and remove user's application
    const applicationIndex = post.eventDetails.applications.findIndex(
      app => app.userId.toString() === req.user._id.toString()
    );

    if (applicationIndex === -1) {
      return res.status(400).json({ success: false, message: 'You are not part of this event' });
    }

    post.eventDetails.applications.splice(applicationIndex, 1);
    post.eventDetails.currentParticipants = Math.max(0, post.eventDetails.currentParticipants - 1);

    await post.save();

    res.json({
      success: true,
      message: 'Successfully left the event',
      eventDetails: post.eventDetails
    });
  } catch (error) {
    console.error('Error leaving event:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router; 