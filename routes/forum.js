const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const upload = require('../middleware/upload');
const firebaseService = require('../services/firebaseService');

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
      .populate('authorId', 'name email firstName lastName profileImage');

    const total = await Post.countDocuments(query);

    const host = `${req.protocol}://${req.get('host')}`;
    const formattedPosts = posts.map((p) => {
      const po = p.toObject();
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

      return {
        ...po,
        authorName,
        authorAvatar,
        media,
      };
    });

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
  body('title').optional().trim().isLength({ max: 200 }).withMessage('Title must be less than 200 characters'),
  body('content').trim().isLength({ min: 1 }).withMessage('Content is required'),
  body('isPoll').optional().isBoolean(),
  body('pollOptions').optional().isArray().withMessage('Poll options must be an array'),
  body('isEvent').optional().isBoolean(),
  body('eventDetails.date').optional().trim().isLength({ min: 1 }).withMessage('Event date is required'),
  body('eventDetails.location').optional().trim().isLength({ min: 1 }).withMessage('Event location is required'),
  body('eventDetails.maxParticipants').optional().isInt({ min: 1 }).withMessage('Max participants must be at least 1')
], async (req, res) => {
  try {
    console.log('Received post data:', req.body);
    console.log('Uploaded files:', req.files);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { title, content, isPoll, pollOptions, isSingleChoice, isEvent, eventDetails } = req.body;

    // Parse boolean values from FormData (they come as strings)
    const parsedIsPoll = isPoll === 'true';
    const parsedIsSingleChoice = isSingleChoice === 'true';
    const parsedIsEvent = isEvent === 'true';

    // Use provided title or auto-generate from content
    const finalTitle = title || (content.length > 50 ? content.substring(0, 50) + '...' : content);
    console.log('Final title:', finalTitle);

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
      content,
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

    if (parsedIsEvent && eventDetails) {
      postData.eventDetails = {
        date: new Date(eventDetails.date),
        location: eventDetails.location,
        maxParticipants: parseInt(eventDetails.maxParticipants) || 10,
        currentParticipants: 0,
        applications: []
      };
    }

    const post = new Post(postData);
    console.log('Post object created:', post);
    console.log('Post category:', post.category);
    console.log('Post validation state:', post.validateSync());
    
    await post.save();
    console.log('Post saved successfully with ID:', post._id);

    const host = `${req.protocol}://${req.get('host')}`;
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
      : undefined;

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: { ...po, media, authorName, authorAvatar }
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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

    const host = `${req.protocol}://${req.get('host')}`;
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

      // Send notification to post author (if not the same user)
      if (post.authorId.toString() !== req.user._id.toString()) {
        try {
          const liker = await User.findById(req.user._id).select('firstName lastName name');
          const likerName = liker.firstName && liker.lastName 
            ? `${liker.firstName} ${liker.lastName}` 
            : liker.name;

          await firebaseService.sendNotificationToUser(
            post.authorId,
            'New Like! ❤️',
            `${likerName} liked your post`,
            {
              type: 'like',
              postId: post._id.toString(),
              senderId: req.user._id.toString(),
              senderName: likerName
            }
          );
        } catch (notificationError) {
          console.error('Error sending like notification:', notificationError);
          // Don't fail the like operation if notification fails
        }
      }

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