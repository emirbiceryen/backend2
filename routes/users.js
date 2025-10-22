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
    default:
      return 'Notification';
  }
};

// @route   PUT /api/users/hobbies
// @desc    Update user hobbies and skill levels
// @access  Private
router.put('/hobbies', auth, [
  body('hobbies').isArray().withMessage('Hobbies must be an array'),
  body('hobbies.*').isString().withMessage('Each hobby must be a string'),
  body('hobbySkillLevels').optional().isObject().withMessage('Hobby skill levels must be an object')
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

    const { hobbies, hobbySkillLevels } = req.body;
    const currentUser = req.user;

    // Check if user has active premium subscription
    const isPremiumActive = currentUser.subscriptionType === 'premium' && 
      (!currentUser.premiumExpiresAt || new Date(currentUser.premiumExpiresAt) > new Date());
    const isFreeUser = !isPremiumActive;
    
    if (isFreeUser && hobbies.length > 1) {
      return res.status(400).json({
        success: false,
        message: 'Free users can only select 1 hobby. Upgrade to Premium to select multiple hobbies.',
        requiresPremium: true
      });
    }

    // Validate skill levels if provided
    if (hobbySkillLevels) {
      for (const [hobbyId, skillLevel] of Object.entries(hobbySkillLevels)) {
        if (typeof skillLevel !== 'number' || skillLevel < 1 || skillLevel > 10) {
          return res.status(400).json({
            success: false,
            message: `Skill level for hobby ${hobbyId} must be a number between 1 and 10`
          });
        }
      }
    }

    const updateData = { 
      hobbies,
      isProfileComplete: false // Profile is not complete until user goes through all registration steps
    };

    // Add hobby skill levels if provided
    if (hobbySkillLevels) {
      updateData.hobbySkillLevels = hobbySkillLevels;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
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
      const otherUser = match.user1._id.toString() === currentUser._id.toString() 
        ? match.user2 
        : match.user1;
      
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
    res.status(500).json({
      success: false,
      message: 'Server error'
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
    
    // Clear hobbies and hobbySkillLevels
    currentUser.hobbies = [];
    currentUser.hobbySkillLevels = {};
    
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

module.exports = router; 