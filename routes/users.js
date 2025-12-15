const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Helper function to get notification title
const getNotificationTitle = (type) => {
  switch (type) {
    case 'match_request':
      return 'New Match Request';
    case 'match_accepted':
      return 'Match Accepted';
    case 'team_join_request':
      return 'Team Join Request';
    case 'team_request_approved':
      return 'Team Request Approved';
    case 'team_request_rejected':
      return 'Team Request Rejected';
    case 'business_event_application':
      return 'New Event Application';
    case 'business_event_application_approved':
      return 'Event Application Approved';
    case 'business_event_application_rejected':
      return 'Event Application Rejected';
    case 'business_event_participant_joined':
      return 'Participant Joined Event';
    default:
      return 'Notification';
  }
};

// @route   PUT /api/users/hobbies
// @desc    Update user hobbies and skill levels
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
    let { hobbySkillLevels } = req.body;

    // Parse hobbySkillLevels if sent as JSON string
    if (typeof hobbySkillLevels === 'string') {
      try {
        hobbySkillLevels = JSON.parse(hobbySkillLevels);
      } catch (e) {
        hobbySkillLevels = null;
      }
    }
    const currentUser = req.user;

    // Check if user has active premium subscription
    const isPremiumActive = currentUser.subscriptionType === 'premium' && 
      (!currentUser.premiumExpiresAt || new Date(currentUser.premiumExpiresAt) > new Date());
    const isFreeUser = !isPremiumActive;
    
    // Free users can select up to 1 hobby; more requires premium
    const FREE_HOBBY_LIMIT = 1;
    if (isFreeUser && hobbies.length > FREE_HOBBY_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `Free users can only select ${FREE_HOBBY_LIMIT} hobby. Upgrade to Premium to select more.`,
        requiresPremium: true
      });
    }

    const updateData = { 
      hobbies
    };
    if (hobbySkillLevels && typeof hobbySkillLevels === 'object') {
      updateData.hobbySkillLevels = hobbySkillLevels;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    const userObj = user.toObject();
    res.json({
      success: true,
      message: 'Hobbies updated successfully',
      user: {
        ...userObj,
        hobbySkillLevels: userObj.hobbySkillLevels instanceof Map
          ? Object.fromEntries(userObj.hobbySkillLevels)
          : (userObj.hobbySkillLevels || {})
      }
    });
  } catch (error) {
    console.error('Update hobbies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during hobbies update'
    });
  }
});

// @route   GET /api/users/recent-activities
// @desc    Get user's recent activities for dashboard
// @access  Private
router.get('/recent-activities', auth, async (req, res) => {
  try {
    const currentUser = req.user;
    const activities = [];

    // Get recent matches
    const Match = require('../models/Match');
    const recentMatches = await Match.find({
      $or: [
        { user1: currentUser._id },
        { user2: currentUser._id }
      ],
      status: { $in: ['matched', 'mutual'] }
    })
    .populate('user1', 'firstName lastName name')
    .populate('user2', 'firstName lastName name')
    .sort({ matchedAt: -1 })
    .limit(3);

    recentMatches.forEach(match => {
      if (!match.user1 || !match.user2 || !match.user1._id || !match.user2._id) {
        return;
      }
      const otherUser = match.user1._id.toString() === currentUser._id.toString() 
        ? match.user2 
        : match.user1;
      
      if (!otherUser || !otherUser._id) {
        return;
      }
      
      activities.push({
        id: `match_${match._id}`,
        type: 'match',
        title: 'New Match!',
        subtitle: `You matched with ${otherUser.firstName || otherUser.name}`,
        time: getRelativeTime(match.matchedAt || match.createdAt),
        icon: '🤝',
        createdAt: match.matchedAt || match.createdAt
      });
    });

    // Get recent chats
    const Chat = require('../models/Chat');
    const recentChats = await Chat.find({
      participants: currentUser._id,
      'messages.0': { $exists: true }
    })
    .populate('participants', 'firstName lastName name')
    .sort({ lastMessage: -1 })
    .limit(3);

    recentChats.forEach(chat => {
      const otherParticipant = chat.participants.find(p => p._id.toString() !== currentUser._id.toString());
      const lastMessage = chat.messages[chat.messages.length - 1];
      
      if (!otherParticipant) {
        return;
      }
      
      if (lastMessage && lastMessage.sender.toString() !== currentUser._id.toString()) {
        activities.push({
          id: `chat_${chat._id}`,
          type: 'message',
          title: 'New Message',
          subtitle: `${otherParticipant.firstName || otherParticipant.name} sent you a message`,
          time: getRelativeTime(lastMessage.timestamp),
          icon: '💬',
          createdAt: lastMessage.timestamp
        });
      }
    });

    // Get recent team activities
    const Team = require('../models/Team');
    const recentTeams = await Team.find({
      $or: [
        { captain: currentUser._id },
        { members: currentUser._id }
      ],
      isActive: true
    })
    .populate('captain', 'firstName lastName name')
    .sort({ createdAt: -1 })
    .limit(2);

    recentTeams.forEach(team => {
      if (!team.captain) {
        return;
      }
      
      const isNewMember = team.members.some(member => 
        member._id && member._id.toString() === currentUser._id.toString()
      ) && team.captain._id.toString() !== currentUser._id.toString();

      if (isNewMember) {
        activities.push({
          id: `team_${team._id}`,
          type: 'team',
          title: 'Joined Team',
          subtitle: `You joined ${team.name}`,
          time: getRelativeTime(team.createdAt),
          icon: '👥',
          createdAt: team.createdAt
        });
      }
    });

    // Sort all activities by date and limit to 5
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const limitedActivities = activities.slice(0, 5);

    res.json({
      success: true,
      activities: limitedActivities
    });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to get relative time
function getRelativeTime(date) {
  const now = new Date();
  const diffInMs = now - new Date(date);
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  } else {
    return new Date(date).toLocaleDateString();
  }
}

// @route   GET /api/users/search
// @desc    Search users by exact username match
// @access  Private
router.get('/search', async (req, res) => {
  try {
    console.log('User search request received:', {
      query: req.query,
      note: 'Auth middleware disabled for testing'
    });

    const { username } = req.query;
    
    if (!username || username.trim().length < 3) {
      console.log('Search query too short:', username);
      return res.status(400).json({
        success: false,
        message: 'Username query must be at least 3 characters'
      });
    }

    console.log('Searching for exact username match:', username.trim().toLowerCase());

    // Search for exact username match (case-insensitive)
    const user = await User.findOne({
      username: username.trim().toLowerCase()
    })
    .select('_id name username profileImage averageRating age');

    console.log('Search result:', user ? 'User found' : 'No user found');

    res.json({
      success: true,
      users: user ? [user] : [] // Return array with single user or empty array
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user search'
    });
  }
});

// @route   GET /api/users/notifications
// @desc    Get user's notifications
// @access  Private
router.get('/notifications', auth, async (req, res) => {
  try {
    const currentUser = req.user;
    console.log('Notifications endpoint called for user:', currentUser._id, currentUser.name);
    const notifications = [];

    // Get recent forum post likes and comments
    const ForumPost = require('../models/ForumPost');
    const recentPosts = await ForumPost.find({ author: currentUser._id })
      .populate('likes', 'firstName lastName name profileImage')
      .populate('comments.user', 'firstName lastName name profileImage')
      .sort({ createdAt: -1 })
      .limit(10);
    
    console.log('Found recent posts:', recentPosts.length);

    recentPosts.forEach(post => {
      console.log('Processing post:', post._id, 'likes:', post.likes.length, 'comments:', post.comments.length);
      
      // Add like notifications
      post.likes.forEach(like => {
        console.log('Processing like from user:', like._id, 'name:', like.firstName || like.name);
        if (like._id.toString() !== currentUser._id.toString()) {
          notifications.push({
            id: `like_${post._id}_${like._id}`,
            type: 'like',
            title: 'Liked Your Post',
            message: `${like.firstName || like.name} liked your post`,
            user: {
              name: like.firstName || like.name,
              profileImage: like.profileImage
            },
            postId: post._id.toString(),
            time: new Date().toLocaleString('tr-TR'),
            read: false
          });
        }
      });

      // Add comment notifications
      post.comments.forEach(comment => {
        if (comment.authorId.toString() !== currentUser._id.toString()) {
          notifications.push({
            id: `comment_${post._id}_${comment._id}`,
            type: 'comment',
            title: 'Commented on Your Post',
            message: `${comment.authorName} commented on your post`,
            user: {
              name: comment.authorName,
              profileImage: null // Comment doesn't have profile image
            },
            postId: post._id.toString(),
            time: new Date().toLocaleString('tr-TR'),
            read: false
          });
        }
      });
    });

    // Get user's stored notifications (from User model)
    const user = await User.findById(currentUser._id).select('notifications');
    if (user && user.notifications) {
      user.notifications.forEach(notification => {
        notifications.push({
          id: `stored_${notification._id}`,
          type: notification.type,
          title: getNotificationTitle(notification.type),
          message: notification.message,
          user: notification.from ? {
            _id: notification.from._id,
            name: notification.from.name,
            username: notification.from.username,
            profileImage: notification.from.profileImage
          } : null,
          team: notification.team ? {
            _id: notification.team._id,
            name: notification.team.name,
            sport: notification.team.sport
          } : null,
          event: notification.event ? {
            _id: notification.event._id,
            title: notification.event.title,
            date: notification.event.date
          } : null,
          applicationId: notification.applicationId,
          time: notification.createdAt,
          read: notification.read,
          status: notification.status
        });
      });
    }

    // Sort notifications by time (most recent first)
    notifications.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({
      success: true,
      notifications: notifications.slice(0, 20) // Limit to 20 notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message
    });
  }
});

// @route   PUT /api/users/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/notifications/:id/read', auth, async (req, res) => {
  try {
    // For now, just return success since we're not storing read status in DB
    // In a real app, you'd store this in a notifications collection
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read'
    });
  }
});

// @route   POST /api/users/clear-hobbies
// @desc    Clear user's hobbies (for migration)
// @access  Private
router.post('/clear-hobbies', auth, async (req, res) => {
  try {
    const currentUser = req.user;
    
    // Clear hobbies
    currentUser.hobbies = [];
    
    await currentUser.save();
    
    res.json({
      success: true,
      message: 'Hobbies cleared successfully. Please re-select your hobbies.'
    });
  } catch (error) {
    console.error('Error clearing hobbies:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing hobbies'
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

// @route   PUT /api/users/equipment
// @desc    Update user equipment
// @access  Private
router.put('/equipment', auth, async (req, res) => {
  try {
    const { equipment } = req.body;
    
    if (!Array.isArray(equipment)) {
      return res.status(400).json({
        success: false,
        message: 'Equipment must be an array'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { equipment: equipment },
      { new: true }
    ).select('equipment');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      equipment: user.equipment
    });
  } catch (error) {
    console.error('Error updating user equipment:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user equipment'
    });
  }
});

// @route   GET /api/users/:userId
// @desc    Get user profile by ID
// @access  Private
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .populate('hobbies', 'name description icon')
      .select('-password -email -__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile'
    });
  }
});

// @route   GET /api/users/:userId/gallery
// @desc    Get user gallery by ID
// @access  Private
router.get('/:userId/gallery', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('gallery profileImage');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Combine profile image and gallery
    const gallery = user.gallery || [];
    const allImages = [user.profileImage, ...gallery].filter(Boolean);

    // Format image URLs
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    
    const formattedImages = allImages.map(image => {
      if (!image) return null;
      return image.startsWith('http') ? image : `${host}${image}`;
    }).filter(Boolean);

    res.json({
      success: true,
      gallery: formattedImages
    });
  } catch (error) {
    console.error('Error fetching user gallery:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error fetching user gallery',
      error: error.message
    });
  }
});

// @route   PUT /api/users/gallery
// @desc    Update user gallery
// @access  Private
router.put('/gallery', auth, async (req, res) => {
  try {
    const { gallery } = req.body;
    
    if (!Array.isArray(gallery)) {
      return res.status(400).json({
        success: false,
        message: 'Gallery must be an array'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { gallery: gallery },
      { new: true }
    ).select('gallery profileImage');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Combine profile image and gallery
    const allImages = [user.profileImage, ...user.gallery].filter(Boolean);

    res.json({
      success: true,
      gallery: allImages
    });
  } catch (error) {
    console.error('Error updating user gallery:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user gallery'
    });
  }
});

module.exports = router; 