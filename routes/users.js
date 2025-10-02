const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   PUT /api/users/hobbies
// @desc    Update user hobbies
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

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        hobbies,
        isProfileComplete: hobbies.length > 0
      },
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
      status: 'matched'
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

module.exports = router; 