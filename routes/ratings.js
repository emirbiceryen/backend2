const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Rating = require('../models/Rating');
const Match = require('../models/Match');

// Submit a rating for a user
router.post('/submit', auth, async (req, res) => {
  try {
    const { ratedUserId, score } = req.body;
    const raterId = req.user._id;
    
    console.log('Rating submission:', { ratedUserId, score, raterId }); // Debug log

    // Validate score
    if (!score || score < 1 || score > 10) {
      return res.status(400).json({ 
        success: false, 
        message: 'Score must be between 1 and 10' 
      });
    }

    // Check if users have matched (mutual or ended status)
    const match = await Match.findOne({
      $or: [
        { user1: raterId, user2: ratedUserId, status: { $in: ['mutual', 'ended'] } },
        { user1: ratedUserId, user2: raterId, status: { $in: ['mutual', 'ended'] } }
      ]
    });

    console.log('Match found for rating:', match); // Debug log
    console.log('Looking for match between:', raterId, 'and', ratedUserId); // Debug log

    if (!match) {
      // Let's also check if there's any match at all between these users
      const anyMatch = await Match.findOne({
        $or: [
          { user1: raterId, user2: ratedUserId },
          { user1: ratedUserId, user2: raterId }
        ]
      });
      console.log('Any match found:', anyMatch); // Debug log
      
      return res.status(400).json({ 
        success: false, 
        message: 'You can only rate users you have matched with' 
      });
    }

    // Check if the current user has already rated the other user
    const isUser1 = match.user1.equals(raterId);
    const hasRated = isUser1 ? match.ratings.user1Rated : match.ratings.user2Rated;
    
    if (hasRated) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already rated this user' 
      });
    }

    // Allow multiple ratings per match - no need to check for existing rating
    // const existingRating = await Rating.findOne({ raterId, ratedUserId });
    // console.log('Existing rating check:', existingRating); // Debug log
    // if (existingRating) {
    //   return res.status(400).json({ 
    //     success: false, 
    //     message: 'You have already rated this user' 
    //   });
    // }

    // Allow multiple ratings per match - users can rate each other after every new match

    // Create the rating
    const rating = new Rating({
      raterId,
      ratedUserId,
      score
    });

    await rating.save();

    // Update the rated user's average rating
    const ratings = await Rating.find({ ratedUserId });
    const totalScore = ratings.reduce((sum, r) => sum + r.score, 0);
    const averageRating = totalScore / ratings.length;

    await User.findByIdAndUpdate(ratedUserId, {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place for 1-10 scale
      totalRatings: ratings.length
    });

    // Update the match to mark that this user has rated
    const updateField = isUser1 ? 'ratings.user1Rated' : 'ratings.user2Rated';
    
    await Match.findByIdAndUpdate(match._id, {
      $set: { 
        [updateField]: true,
        status: 'ended',
        lastInteraction: new Date()
      }
    });

    const response = {
      success: true,
      message: 'Rating submitted successfully',
      averageRating: Math.round(averageRating * 10) / 10
    };
    console.log('Rating submission response:', response); // Debug log
    res.json(response);

  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Get a user's average rating
router.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      averageRating: user.averageRating,
      totalRatings: user.totalRatings
    });

  } catch (error) {
    console.error('Error getting user rating:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Check if a user can rate another user
router.get('/can-rate/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const raterId = req.user._id;

    // Check if users have matched (mutual or ended status)
    const match = await Match.findOne({
      $or: [
        { user1: raterId, user2: userId, status: { $in: ['mutual', 'ended'] } },
        { user1: userId, user2: raterId, status: { $in: ['mutual', 'ended'] } }
      ]
    });

    if (!match) {
      return res.json({
        success: true,
        canRate: false,
        reason: 'No match found'
      });
    }

    // Check if the current user has already rated the other user
    const isUser1CanRate = match.user1.equals(raterId);
    const hasRated = isUser1CanRate ? match.ratings.user1Rated : match.ratings.user2Rated;

    res.json({
      success: true,
      canRate: !hasRated,
      reason: hasRated ? 'Already rated' : 'Can rate'
    });

  } catch (error) {
    console.error('Error checking rating eligibility:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Get all ratings for a user (for admin purposes)
router.get('/user/:userId/all', auth, async (req, res) => {
  try {
    const ratings = await Rating.find({ ratedUserId: req.params.userId })
      .populate('raterId', 'firstName lastName')
      .sort({ timestamp: -1 });

    res.json({
      success: true,
      ratings: ratings.map(rating => ({
        id: rating._id,
        raterName: `${rating.raterId.firstName} ${rating.raterId.lastName}`,
        score: rating.score,
        timestamp: rating.timestamp
      }))
    });

  } catch (error) {
    console.error('Error getting all ratings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router; 