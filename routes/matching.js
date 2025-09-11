const express = require('express');
const User = require('../models/User');
const Match = require('../models/Match');
const Hobby = require('../models/Hobby');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/matching/potential
// @desc    Get potential matches for user
// @access  Private
router.get('/potential', auth, async (req, res) => {
  try {
    const currentUser = req.user;
    
    // Get users who have hobbies and are not the current user

    
    const potentialMatches = await User.find({
      _id: { $ne: currentUser._id },
      hobbies: { $exists: true, $ne: [] }
    })
    .select('firstName lastName name bio location age hobbies profileImage averageRating totalRatings')
    .limit(10);
    


    // Calculate shared hobbies and filter matches
    const matchesWithSharedHobbies = potentialMatches
      .map(user => {
        // Get current user's hobby IDs
        const currentUserHobbyIds = currentUser.hobbies || [];
        // Get other user's hobby IDs
        const userHobbies = user.hobbies || [];
        
        // Find shared hobby IDs
        const sharedHobbyIds = currentUserHobbyIds.filter(hobbyId => 
          userHobbies.includes(hobbyId)
        );
        
        return {
          ...user.toObject(),
          sharedHobbies: sharedHobbyIds,
          sharedHobbyCount: sharedHobbyIds.length
        };
      })
      .filter(match => match.sharedHobbyCount > 0)
      .sort((a, b) => b.sharedHobbyCount - a.sharedHobbyCount);

    // Fetch hobby names for all shared hobby IDs
    const allHobbyIds = [...new Set(matchesWithSharedHobbies.flatMap(match => match.sharedHobbies))];
    const hobbies = await Hobby.find({ _id: { $in: allHobbyIds } }).select('name');
    const hobbyMap = {};
    hobbies.forEach(hobby => {
      hobbyMap[hobby._id.toString()] = hobby.name;
    });

    // Add hobby names to matches
    const matchesWithHobbyNames = matchesWithSharedHobbies.map(match => ({
      ...match,
      sharedHobbyNames: match.sharedHobbies.map(hobbyId => hobbyMap[hobbyId.toString()] || hobbyId)
    }));

    console.log('Hobby map:', hobbyMap);
    console.log('First match sharedHobbyNames:', matchesWithHobbyNames[0]?.sharedHobbyNames);



    res.json({
      success: true,
      matches: matchesWithHobbyNames
    });
  } catch (error) {
    console.error('Get potential matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/matching/accept/:userId
// @desc    Like a potential match (creates pending match)
// @access  Private
router.post('/accept/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Check if user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if match already exists
    const existingMatch = await Match.findOne({
      $or: [
        { user1: currentUserId, user2: userId },
        { user1: userId, user2: currentUserId }
      ]
    });

    if (existingMatch) {
      // If match exists, check if it's already mutual
      if (existingMatch.status === 'mutual') {
        return res.status(400).json({
          success: false,
          message: 'Already matched'
        });
      }

      // If the other user already liked this user, make it mutual
      if (existingMatch.likedBy.some(userId => userId.equals(targetUser._id))) {
        if (!existingMatch.likedBy.some(userId => userId.equals(currentUserId))) {
          existingMatch.likedBy.push(currentUserId);
        }
        existingMatch.status = 'mutual';
        existingMatch.matchedAt = new Date();
        await existingMatch.save();

        return res.json({
          success: true,
          message: 'It\'s a match! 🎉',
          isMutual: true,
          match: {
            id: existingMatch._id,
            sharedHobbies: existingMatch.sharedHobbies,
            matchedAt: existingMatch.matchedAt
          }
        });
      } else {
        // Add current user to likedBy array if not already there
        if (!existingMatch.likedBy.some(userId => userId.equals(currentUserId))) {
          existingMatch.likedBy.push(currentUserId);
        }
        await existingMatch.save();

        return res.json({
          success: true,
          message: 'Like sent! They\'ll see you in their pending matches.',
          isMutual: false
        });
      }
    }

    // Calculate shared hobbies (hobbies are stored as strings)
    const currentUserHobbies = req.user.hobbies || [];
    const targetUserHobbies = targetUser.hobbies || [];
    
    const sharedHobbies = currentUserHobbies.filter(hobby => 
      targetUserHobbies.includes(hobby)
    );

    // Create new pending match
    const match = new Match({
      user1: currentUserId,
      user2: userId,
      sharedHobbies,
      likedBy: [currentUserId], // Current user liked the target user
      status: 'pending'
    });

    await match.save();

    res.json({
      success: true,
      message: 'Like sent! They\'ll see you in their pending matches.',
      isMutual: false
    });
  } catch (error) {
    console.error('Accept match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/matching/reject/:userId
// @desc    Reject a potential match
// @access  Private
router.post('/reject/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Check if user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create or update match with rejected status
    const match = await Match.findOneAndUpdate(
      {
        $or: [
          { user1: currentUserId, user2: userId },
          { user1: userId, user2: currentUserId }
        ]
      },
      {
        user1: currentUserId,
        user2: userId,
        status: 'rejected',
        lastInteraction: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Match rejected'
    });
  } catch (error) {
    console.error('Reject match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});



// @route   GET /api/matching/pending
// @desc    Get people who liked you (pending matches)
// @access  Private
router.get('/pending', auth, async (req, res) => {
  try {
    // Find all matches where current user is involved
    const allMatches = await Match.find({
      $or: [
        { user1: req.user._id },
        { user2: req.user._id }
      ],
      status: 'pending'
    })
    .populate('user1', 'firstName lastName name bio location age profileImage averageRating totalRatings')
    .populate('user2', 'firstName lastName name bio location age profileImage averageRating totalRatings')
    .sort({ createdAt: -1 });



    // Filter matches where the other user liked the current user but current user hasn't liked back
    const pendingMatches = allMatches.filter(match => {
      const otherUserId = match.user1._id.equals(req.user._id) ? match.user2._id : match.user1._id;
      const otherUserHasLiked = match.likedBy.some(userId => userId.equals(otherUserId));
      const currentUserHasLiked = match.likedBy.some(userId => userId.equals(req.user._id));
      

      
      // Show matches where the other user liked this user, but this user hasn't liked back yet
      return otherUserHasLiked && !currentUserHasLiked;
    });



    // Fetch hobby names for all users
    const allUserHobbyIds = [...new Set(pendingMatches.flatMap(match => {
      const otherUser = match.user1._id.equals(req.user._id) ? match.user2 : match.user1;
      return otherUser.hobbies || [];
    }))];
    const hobbies = await Hobby.find({ _id: { $in: allUserHobbyIds } }).select('name');
    const hobbyMap = {};
    hobbies.forEach(hobby => {
      hobbyMap[hobby._id.toString()] = hobby.name;
    });

    const formattedPending = pendingMatches.map(match => {
      const otherUser = match.user1._id.equals(req.user._id) ? match.user2 : match.user1;
      const otherUserHobbies = match.user1._id.equals(req.user._id) ? match.user2.hobbies : match.user1.hobbies;
      
      // Calculate shared hobbies
      const currentUserHobbyIds = req.user.hobbies || [];
      const otherUserHobbiesArray = otherUserHobbies || [];
      
      // Find shared hobby IDs
      const sharedHobbyIds = currentUserHobbyIds.filter(hobbyId => 
        otherUserHobbiesArray.includes(hobbyId)
      );
      
      // Get hobby names
      const sharedHobbyNames = sharedHobbyIds.map(hobbyId => hobbyMap[hobbyId.toString()] || hobbyId);

      return {
        id: match._id,
        user: otherUser,
        sharedHobbies: sharedHobbyNames,
        likedAt: match.createdAt
      };
    });

    res.json({
      success: true,
      pendingMatches: formattedPending
    });
  } catch (error) {
    console.error('Get pending matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/matching/matches
// @desc    Get user's mutual matches
// @access  Private
router.get('/matches', auth, async (req, res) => {
  try {
    const matches = await Match.find({
      $or: [
        { user1: req.user._id },
        { user2: req.user._id }
      ],
      status: 'mutual',
      isActive: true
    })
    .populate('user1', 'firstName lastName name bio location age profileImage averageRating totalRatings')
    .populate('user2', 'firstName lastName name bio location age profileImage averageRating totalRatings')
    .sort({ lastInteraction: -1 });

    // Fetch hobby names for all users
    const allUserHobbyIds = [...new Set(matches.flatMap(match => {
      const otherUser = match.user1._id.equals(req.user._id) ? match.user2 : match.user1;
      return otherUser.hobbies || [];
    }))];
    const hobbies = await Hobby.find({ _id: { $in: allUserHobbyIds } }).select('name');
    const hobbyMap = {};
    hobbies.forEach(hobby => {
      hobbyMap[hobby._id.toString()] = hobby.name;
    });

    const formattedMatches = matches.map(match => {
      const otherUser = match.user1._id.equals(req.user._id) ? match.user2 : match.user1;
      const otherUserHobbies = match.user1._id.equals(req.user._id) ? match.user2.hobbies : match.user1.hobbies;
      
      // Calculate shared hobbies
      const currentUserHobbyIds = req.user.hobbies || [];
      const otherUserHobbiesArray = otherUserHobbies || [];
      
      // Find shared hobby IDs
      const sharedHobbyIds = currentUserHobbyIds.filter(hobbyId => 
        otherUserHobbiesArray.includes(hobbyId)
      );
      
      // Get hobby names
      const sharedHobbyNames = sharedHobbyIds.map(hobbyId => hobbyMap[hobbyId.toString()] || hobbyId);
      
      return {
        id: match._id,
        user: otherUser,
        sharedHobbies: sharedHobbyNames,
        matchedAt: match.matchedAt,
        lastInteraction: match.lastInteraction
      };
    });

    res.json({
      success: true,
      matches: formattedMatches
    });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 