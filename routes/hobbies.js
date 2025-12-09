const express = require('express');
const router = express.Router();
const Hobby = require('../models/Hobby');
const auth = require('../middleware/auth');

// @route   GET /api/hobbies
// @desc    Get all hobbies
// @access  Public
router.get('/', async (req, res) => {
  try {
    const hobbies = await Hobby.find().sort({ order: 1 });
    res.json({
      success: true,
      hobbies
    });
  } catch (error) {
    console.error('Error fetching hobbies:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hobbies'
    });
  }
});

// @route   GET /api/hobbies/:id
// @desc    Get hobby by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const hobby = await Hobby.findById(req.params.id);
    if (!hobby) {
      return res.status(404).json({
        success: false,
        message: 'Hobby not found'
      });
    }
    res.json({
      success: true,
      hobby
    });
  } catch (error) {
    console.error('Error fetching hobby:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hobby'
    });
  }
});

// @route   POST /api/hobbies/seed
// @desc    Seed hobbies (for development)
// @access  Private (for development)
router.post('/seed', async (req, res) => {
  try {
    // Clear existing hobbies first
    await Hobby.deleteMany({});
    console.log('Cleared existing hobbies');

    const initialHobbies = [
      // First 10 visible (Snowboard & Football included)
      { name: 'Football', category: 'Sports & Fitness', icon: '🏈', order: 1 },
      { name: 'Soccer', category: 'Sports & Fitness', icon: '⚽', order: 2 },
      { name: 'Tennis', category: 'Sports & Fitness', icon: '🎾', order: 3 },
      { name: 'Basketball', category: 'Sports & Fitness', icon: '🏀', order: 4 },
      { name: 'Volleyball', category: 'Sports & Fitness', icon: '🏐', order: 5 },
      { name: 'Snowboard', category: 'Sports & Fitness', icon: '🏂', order: 6 },
      { name: 'Ski', category: 'Sports & Fitness', icon: '⛷️', order: 7 },
      { name: 'Kayaking', category: 'Sports & Fitness', icon: '🛶', order: 8 },
      { name: 'Cycling', category: 'Sports & Fitness', icon: '🚴‍♂️', order: 9 },
      { name: 'Surfing', category: 'Sports & Fitness', icon: '🏄‍♂️', order: 10 },

      // Remaining list
      { name: 'Baseball', category: 'Sports & Fitness', icon: '⚾', order: 11 },
      { name: 'Gym', category: 'Sports & Fitness', icon: '💪', order: 12 },
      { name: 'Fishing', category: 'Sports & Fitness', icon: '🎣', order: 13 },
      { name: 'Running', category: 'Sports & Fitness', icon: '🏃‍♂️', order: 14 },
      { name: 'Swimming', category: 'Sports & Fitness', icon: '🏊‍♂️', order: 15 },
      { name: 'Gaming', category: 'Technology', icon: '🎮', order: 16 },
      { name: 'Dancing', category: 'Creative Arts', icon: '💃', order: 17 },
      { name: 'Programming', category: 'Technology', icon: '💻', order: 18 },
      { name: 'Crafting', category: 'Creative Arts', icon: '🧶', order: 19 },
      { name: 'Painting', category: 'Creative Arts', icon: '🎨', order: 20 },
      { name: 'Board Games', category: 'Social Activities', icon: '🎲', order: 21 },
      { name: 'Photography', category: 'Creative Arts', icon: '📸', order: 22 },
      { name: 'Language Learning', category: 'Learning & Education', icon: '🗣️', order: 23 },
      { name: 'Reading', category: 'Learning & Education', icon: '📚', order: 24 },
      { name: 'Tea, Coffee', category: 'Social Activities', icon: '☕', order: 25 },
      { name: 'Cooking', category: 'Creative Arts', icon: '👨‍🍳', order: 26 },
      { name: 'Rock Climbing', category: 'Sports & Fitness', icon: '🧗‍♂️', order: 27 },
      { name: 'Hiking', category: 'Sports & Fitness', icon: '🏔️', order: 28 },
      { name: 'Concerts', category: 'Music & Entertainment', icon: '🎵', order: 29 },
      { name: 'Theater', category: 'Music & Entertainment', icon: '🎭', order: 30 },
      { name: 'Movies', category: 'Music & Entertainment', icon: '🎬', order: 31 },
      { name: 'Karaoke', category: 'Music & Entertainment', icon: '🎤', order: 32 },
      { name: 'Travel', category: 'Travel & Adventure', icon: '✈️', order: 33 },
      { name: 'Road Trips', category: 'Travel & Adventure', icon: '🚗', order: 34 }
    ];

    await Hobby.insertMany(initialHobbies);
    console.log(`Successfully seeded ${initialHobbies.length} hobbies`);

    res.json({
      success: true,
      message: `Successfully seeded ${initialHobbies.length} hobbies`,
      count: initialHobbies.length
    });
  } catch (error) {
    console.error('Error seeding hobbies:', error);
    res.status(500).json({
      success: false,
      message: 'Error seeding hobbies',
      error: error.message
    });
  }
});

module.exports = router;