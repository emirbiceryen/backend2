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
    
    // Get rejected user IDs for this user
    const rejectedMatches = await Match.find({
      $or: [
        { user1: currentUser._id },
        { user2: currentUser._id }
      ],
      status: 'rejected'
    });
    
    const rejectedUserIds = rejectedMatches.map(match => 
      match.user1.equals(currentUser._id) ? match.user2 : match.user1
    );
    
    // Get users who have hobbies, are not the current user, and haven't been rejected
    const potentialMatches = await User.find({
      _id: { 
        $ne: currentUser._id,
        $nin: rejectedUserIds
      },
      hobbies: { $exists: true, $ne: [] }
    })
    .select('firstName lastName name bio location age hobbies hobbySkillLevels profileImage averageRating totalRatings')
    .limit(10);

    console.log('=== MATCHING DEBUG ===');
    console.log('Current user ID:', currentUser._id);
    console.log('Current user name:', currentUser.name);
    console.log('Current user hobbies:', currentUser.hobbies);
    console.log('Rejected user IDs:', rejectedUserIds);
    console.log('Found potential matches:', potentialMatches.length);
    potentialMatches.forEach(match => {
      console.log(`User ${match.name} (${match._id}) hobbies:`, match.hobbies);
    });
    console.log('=== END DEBUG ===');
    


    // Calculate shared hobbies and filter matches
    const matchesWithSharedHobbies = potentialMatches
      .map(user => {
        // Get current user's hobby IDs
        const currentUserHobbyIds = currentUser.hobbies || [];
        // Get other user's hobby IDs
        const userHobbies = user.hobbies || [];
        
        console.log(`Checking user ${user.name}:`);
        console.log(`  Current user hobbies:`, currentUserHobbyIds);
        console.log(`  Other user hobbies:`, userHobbies);
        
        // Find shared hobby IDs
        const sharedHobbyIds = currentUserHobbyIds.filter(hobbyId => 
          userHobbies.includes(hobbyId)
        );
        
        console.log(`  Shared hobbies:`, sharedHobbyIds);
        
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
    console.log('All hobby IDs to fetch:', allHobbyIds);
    const hobbies = await Hobby.find({ _id: { $in: allHobbyIds } }).select('name');
    console.log('Fetched hobbies:', hobbies);
    const hobbyMap = {};
    hobbies.forEach(hobby => {
      hobbyMap[hobby._id.toString()] = hobby.name;
    });
    console.log('Hobby map created:', hobbyMap);

    // Add hobby names to matches and format profile images
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const matchesWithHobbyNames = matchesWithSharedHobbies.map(match => {
      // Format profile image URL
      const formattedProfileImage = match.profileImage 
        ? (match.profileImage.startsWith('/uploads') ? `${host}${match.profileImage}` : match.profileImage)
        : null;

      // Get skill level for the first shared hobby (the one that will be displayed)
      const firstSharedHobbyId = match.sharedHobbies[0];
      const sharedHobbySkillLevel = match.hobbySkillLevels && firstSharedHobbyId 
        ? match.hobbySkillLevels.get(firstSharedHobbyId) 
        : null;

      return {
        ...match,
        profileImage: formattedProfileImage,
        sharedHobbyNames: match.sharedHobbies.map(hobbyId => hobbyMap[hobbyId.toString()] || hobbyId),
        sharedHobbySkillLevel: sharedHobbySkillLevel
      };
    });

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
    .populate('user1', 'firstName lastName name bio location age profileImage averageRating totalRatings hobbies hobbySkillLevels')
    .populate('user2', 'firstName lastName name bio location age profileImage averageRating totalRatings hobbies hobbySkillLevels')
    .sort({ createdAt: -1 });

    console.log(`Found ${allMatches.length} pending matches for user ${req.user._id}`);



    // Filter matches where the other user liked the current user but current user hasn't liked back
    const pendingMatches = allMatches.filter(match => {
      const otherUserId = match.user1._id.equals(req.user._id) ? match.user2._id : match.user1._id;
      const otherUserHasLiked = match.likedBy.some(userId => userId.equals(otherUserId));
      const currentUserHasLiked = match.likedBy.some(userId => userId.equals(req.user._id));
      
      console.log(`Match ${match._id}: otherUser=${otherUserId}, currentUser=${req.user._id}`);
      console.log(`likedBy:`, match.likedBy.map(id => id.toString()));
      console.log(`otherUserHasLiked: ${otherUserHasLiked}, currentUserHasLiked: ${currentUserHasLiked}`);
      
      // Show matches where the other user liked this user, but this user hasn't liked back yet
      return otherUserHasLiked && !currentUserHasLiked;
    });

    console.log(`Filtered to ${pendingMatches.length} pending matches`);



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

    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
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

      // Get skill level for the first shared hobby
      const firstSharedHobbyId = sharedHobbyIds[0];
      const sharedHobbySkillLevel = otherUser.hobbySkillLevels && firstSharedHobbyId 
        ? otherUser.hobbySkillLevels.get(firstSharedHobbyId) 
        : null;

      // Format profile image URL
      const formattedProfileImage = otherUser.profileImage 
        ? (otherUser.profileImage.startsWith('/uploads') ? `${host}${otherUser.profileImage}` : otherUser.profileImage)
        : null;

      return {
        id: match._id,
        user: {
          ...otherUser.toObject(),
          profileImage: formattedProfileImage,
          sharedHobbySkillLevel: sharedHobbySkillLevel
        },
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
      status: { $in: ['mutual', 'ended'] },
      isActive: true
    })
    .populate('user1', 'firstName lastName name bio location age profileImage averageRating totalRatings hobbies')
    .populate('user2', 'firstName lastName name bio location age profileImage averageRating totalRatings hobbies')
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

    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const formattedMatches = matches
      .filter(match => {
        // Filter out matches where both users have already rated each other
        const bothRated = match.ratings && match.ratings.user1Rated && match.ratings.user2Rated;
        return !bothRated;
      })
      .map(match => {
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
        
        // Format profile image URL
        const formattedProfileImage = otherUser.profileImage 
          ? (otherUser.profileImage.startsWith('/uploads') ? `${host}${otherUser.profileImage}` : otherUser.profileImage)
          : null;
        
        return {
          id: match._id,
          user: {
            ...otherUser.toObject(),
            profileImage: formattedProfileImage
          },
          sharedHobbies: sharedHobbyIds,
          sharedHobbyNames: sharedHobbyNames,
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

// Get user's matches (for dashboard)
router.get('/matches', auth, async (req, res) => {
  try {
    const currentUser = req.user;
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app/uploads/'
      : `${req.protocol}://${req.get('host')}/uploads/`;

    // Find confirmed matches
    const matches = await Match.find({
      $or: [
        { user1: currentUser._id },
        { user2: currentUser._id }
      ],
      status: 'matched'
    })
    .populate('user1', 'firstName lastName name username profileImage bio age location averageRating totalRatings')
    .populate('user2', 'firstName lastName name username profileImage bio age location averageRating totalRatings')
    .sort({ matchedAt: -1 });

    // Format matches
    const formattedMatches = matches.map(match => {
      const otherUser = match.user1._id.toString() === currentUser._id.toString() 
        ? match.user2 
        : match.user1;
      
      // Format profile image URL
      const formattedProfileImage = otherUser.profileImage 
        ? (otherUser.profileImage.startsWith('/uploads') ? `${host}${otherUser.profileImage}` : otherUser.profileImage)
        : null;
      
      return {
        id: match._id,
        user: {
          ...otherUser.toObject(),
          profileImage: formattedProfileImage
        },
        matchedAt: match.matchedAt || match.createdAt
      };
    });

    res.json({
      success: true,
      matches: formattedMatches
    });
  } catch (error) {
    console.error('Get user matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router; 