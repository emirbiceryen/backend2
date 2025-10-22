const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Team = require('../models/Team');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');

// Configure multer for team profile image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'team-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// @route   GET /api/teams/all
// @desc    Get all teams (for team selection)
// @access  Public
router.get('/all', async (req, res) => {
  try {
    const teams = await Team.find({ isActive: true })
      .populate('captain', 'name username email profileImage')
      .populate('members', 'name username email profileImage')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      teams: teams
    });
  } catch (error) {
    console.error('Error fetching all teams:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/teams
// @desc    Create a new team
// @access  Private (Premium only)
router.post('/', [
  auth,
  upload.single('profileImage'),
  body('name').trim().isLength({ min: 1, max: 50 }).withMessage('Team name must be between 1 and 50 characters'),
  body('sport').isIn(['football', 'basketball', 'volleyball']).withMessage('Sport must be football, basketball, or volleyball'),
  body('description').optional().isLength({ max: 200 }).withMessage('Description cannot be more than 200 characters')
], async (req, res) => {
  try {
    console.log('Team creation request received:', {
      body: req.body,
      file: req.file,
      user: req.user ? { id: req.user._id, email: req.user.email } : null
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if user has active premium subscription
    const isPremiumActive = req.user.subscriptionType === 'premium' && 
      (!req.user.premiumExpiresAt || new Date(req.user.premiumExpiresAt) > new Date());
    
    if (!isPremiumActive) {
      return res.status(403).json({
        success: false,
        message: 'Active premium subscription required to create teams'
      });
    }

    const { name, sport, description } = req.body;

    // Check if user already has a team for this sport
    const existingTeam = await Team.findOne({
      captain: req.user._id,
      sport: sport,
      isActive: true
    });

    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: `You already have an active ${sport} team`
      });
    }

    // Create new team
    const teamData = {
      name,
      sport,
      captain: req.user._id,
      description: description || '',
      profileImage: req.file ? req.file.filename : null
    };

    const team = new Team(teamData);
    await team.save();

    // Add team to user's teams and captainOfTeams
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { 
        teams: team._id,
        captainOfTeams: team._id
      }
    });

    // Populate team data for response
    await team.populate('captain', 'firstName lastName name profileImage averageRating totalRatings age');
    await team.populate('members', 'firstName lastName name profileImage averageRating totalRatings age');

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      team
    });

  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/teams
// @desc    Get all teams for a specific sport
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { sport } = req.query;
    
    if (!sport || !['football', 'basketball', 'volleyball'].includes(sport)) {
      return res.status(400).json({
        success: false,
        message: 'Valid sport parameter is required (football, basketball, or volleyball)'
      });
    }

    const teams = await Team.find({
      sport: sport,
      isActive: true
    })
    .populate('captain', 'firstName lastName name profileImage averageRating totalRatings age')
    .populate('members', 'firstName lastName name profileImage averageRating totalRatings age')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      teams
    });

  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/teams/my-teams
// @desc    Get user's teams (as captain or member)
// @access  Private
router.get('/my-teams', auth, async (req, res) => {
  try {
    const teams = await Team.find({
      $or: [
        { captain: req.user._id },
        { members: req.user._id }
      ],
      isActive: true
    })
    .populate('captain', 'firstName lastName name profileImage averageRating totalRatings age')
    .populate('members', 'firstName lastName name profileImage averageRating totalRatings age')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      teams
    });

  } catch (error) {
    console.error('Error fetching user teams:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get user's teams
router.get('/user', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find teams where user is captain or member
    const teams = await Team.find({
      $or: [
        { captain: userId },
        { members: userId }
      ],
      isActive: true
    })
    .populate('captain', 'firstName lastName name username profileImage')
    .populate('members', 'firstName lastName name username profileImage')
    .sort({ createdAt: -1 });

    // Format teams with additional info
    const formattedTeams = teams.map(team => {
      const teamObj = team.toObject();
      
      // Add current member count
      teamObj.currentMemberCount = team.members ? team.members.length : 0;
      
      // Add available spots
      teamObj.availableSpots = (team.maxMembers || 5) - teamObj.currentMemberCount;
      
      // Add user role
      teamObj.userRole = team.captain._id.toString() === userId.toString() ? 'captain' : 'member';
      
      return teamObj;
    });

    res.json({
      success: true,
      teams: formattedTeams
    });
  } catch (error) {
    console.error('Error fetching user teams:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/teams/:id
// @desc    Get team details by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('captain', 'firstName lastName name profileImage averageRating totalRatings age bio location')
      .populate('members', 'firstName lastName name profileImage averageRating totalRatings age bio location');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    res.json({
      success: true,
      team
    });

  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/teams/:id/join
// @desc    Join a team
// @access  Private
router.post('/:id/join', auth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    if (!team.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Team is not active'
      });
    }

    // Check if user has the required hobby
    const user = await User.findById(req.user._id);
    const sportHobbyMap = {
      'football': 'Football (Soccer)',
      'basketball': 'Basketball',
      'volleyball': 'Volleyball'
    };

    const requiredHobby = sportHobbyMap[team.sport];
    if (!user.hobbies.includes(requiredHobby)) {
      return res.status(400).json({
        success: false,
        message: `You must have ${requiredHobby} as a hobby to join this team`
      });
    }

    // Check if user can join
    const canJoin = team.canUserJoin(req.user._id);
    if (!canJoin.canJoin) {
      return res.status(400).json({
        success: false,
        message: canJoin.reason
      });
    }

    // Add user to team
    await team.addMember(req.user._id);

    // Add team to user's teams
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { teams: team._id }
    });

    // Populate team data for response
    await team.populate('captain', 'firstName lastName name profileImage averageRating totalRatings age');
    await team.populate('members', 'firstName lastName name profileImage averageRating totalRatings age');

    res.json({
      success: true,
      message: 'Successfully joined team',
      team
    });

  } catch (error) {
    console.error('Error joining team:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/teams/:id/leave
// @desc    Leave a team
// @access  Private
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is a member
    if (!team.members.includes(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this team'
      });
    }

    // Remove user from team
    await team.removeMember(req.user._id);

    // Remove team from user's teams
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { teams: team._id }
    });

    res.json({
      success: true,
      message: 'Successfully left team'
    });

  } catch (error) {
    console.error('Error leaving team:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/teams/:id/add-member
// @desc    Add a member to team (captain only)
// @access  Private
router.post('/:id/add-member', auth, [
  body('userId').isMongoId().withMessage('Valid user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is the captain
    if (team.captain.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain can add members'
      });
    }

    // Check if user exists
    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has the required hobby
    const sportHobbyMap = {
      'football': 'Football (Soccer)',
      'basketball': 'Basketball',
      'volleyball': 'Volleyball'
    };

    const requiredHobby = sportHobbyMap[team.sport];
    if (!userToAdd.hobbies.includes(requiredHobby)) {
      return res.status(400).json({
        success: false,
        message: `User must have ${requiredHobby} as a hobby to join this team`
      });
    }

    // Check if user can join
    const canJoin = team.canUserJoin(userId);
    if (!canJoin.canJoin) {
      return res.status(400).json({
        success: false,
        message: canJoin.reason
      });
    }

    // Add user to team
    await team.addMember(userId);

    // Add team to user's teams
    await User.findByIdAndUpdate(userId, {
      $addToSet: { teams: team._id }
    });

    // Populate team data for response
    await team.populate('captain', 'firstName lastName name profileImage averageRating totalRatings age');
    await team.populate('members', 'firstName lastName name profileImage averageRating totalRatings age');

    res.json({
      success: true,
      message: 'Member added successfully',
      team
    });

  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/teams/:id
// @desc    Update team details (captain only)
// @access  Private
router.put('/:id', [
  auth,
  upload.single('profileImage'),
  body('name').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Team name must be between 1 and 50 characters'),
  body('description').optional().isLength({ max: 200 }).withMessage('Description cannot be more than 200 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is the captain
    if (!team.captain.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain can update team details'
      });
    }

    const updateData = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.file) updateData.profileImage = req.file.filename;

    const updatedTeam = await Team.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
    .populate('captain', 'firstName lastName name profileImage averageRating totalRatings age')
    .populate('members', 'firstName lastName name profileImage averageRating totalRatings age');

    res.json({
      success: true,
      message: 'Team updated successfully',
      team: updatedTeam
    });

  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   DELETE /api/teams/:id
// @desc    Delete team (captain only)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is the captain
    if (!team.captain.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the team captain can delete the team'
      });
    }

    // Mark team as inactive instead of deleting
    team.isActive = false;
    await team.save();

    // Remove team from all members' teams
    await User.updateMany(
      { teams: team._id },
      { $pull: { teams: team._id } }
    );

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});


// Join team request
router.post('/:teamId/join-request', auth, async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user._id;

    // Check if team exists
    const team = await Team.findById(teamId).populate('captain', 'name username email');
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    // Check if user is already a member
    const isAlreadyMember = team.members.some(member => member.toString() === userId.toString());
    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this team'
      });
    }

    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'This team is full'
      });
    }

    // Get user info
    const user = await User.findById(userId).select('name username email profileImage');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create join request notification for captain
    const notification = {
      type: 'team_join_request',
      from: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage
      },
      team: {
        _id: team._id,
        name: team.name,
        sport: team.sport
      },
      message: `${user.name} wants to join your ${team.sport} team "${team.name}"`,
      createdAt: new Date(),
      status: 'pending'
    };

    // Add notification to captain's notifications
    await User.findByIdAndUpdate(
      team.captain._id,
      { $push: { notifications: notification } }
    );

    res.json({
      success: true,
      message: 'Join request sent to team captain'
    });
  } catch (error) {
    console.error('Error sending join request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Approve join request
router.post('/:teamId/approve-request', auth, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId } = req.body;
    const captainId = req.user._id;

    // Check if team exists and user is captain
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    if (team.captain.toString() !== captainId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only team captain can approve join requests'
      });
    }

    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'Team is full'
      });
    }

    // Add user to team
    await Team.findByIdAndUpdate(
      teamId,
      { $addToSet: { members: userId } }
    );

    // Add team to user's teams
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { teams: teamId } }
    );

    // Remove the notification
    await User.findByIdAndUpdate(
      captainId,
      { $pull: { notifications: { type: 'team_join_request', 'from._id': userId } } }
    );

    res.json({
      success: true,
      message: 'User added to team successfully'
    });
  } catch (error) {
    console.error('Error approving join request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Reject join request
router.post('/:teamId/reject-request', auth, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId } = req.body;
    const captainId = req.user._id;

    // Check if team exists and user is captain
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found'
      });
    }

    if (team.captain.toString() !== captainId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only team captain can reject join requests'
      });
    }

    // Remove the notification
    await User.findByIdAndUpdate(
      captainId,
      { $pull: { notifications: { type: 'team_join_request', 'from._id': userId } } }
    );

    res.json({
      success: true,
      message: 'Join request rejected'
    });
  } catch (error) {
    console.error('Error rejecting join request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;