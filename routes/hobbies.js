const express = require('express');
const router = express.Router();
const Hobby = require('../models/Hobby');
const auth = require('../middleware/auth');

// @route   GET /api/hobbies
// @desc    Get all hobbies
// @access  Public
router.get('/', async (req, res) => {
  try {
    const hobbies = await Hobby.find().sort({ name: 1 });
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
      // Exact 32 hobbies in specified order
      { name: 'Tennis', category: 'Sports & Fitness', icon: '🎾' },
      { name: 'Soccer', category: 'Sports & Fitness', icon: '⚽' },
      { name: 'Basketball', category: 'Sports & Fitness', icon: '🏀' },
      { name: 'Volleyball', category: 'Sports & Fitness', icon: '🏐' },
      { name: 'Kayaking', category: 'Sports & Fitness', icon: '🛶' },
      { name: 'Cycling', category: 'Sports & Fitness', icon: '🚴‍♂️' },
      { name: 'Surfing', category: 'Sports & Fitness', icon: '🏄‍♂️' },
      { name: 'Baseball', category: 'Sports & Fitness', icon: '⚾' },
      { name: 'Gym', category: 'Sports & Fitness', icon: '💪' },
      { name: 'Ski', category: 'Sports & Fitness', icon: '⛷️' },
      { name: 'Fishing', category: 'Sports & Fitness', icon: '🎣' },
      { name: 'Running', category: 'Sports & Fitness', icon: '🏃‍♂️' },
      { name: 'Swimming', category: 'Sports & Fitness', icon: '🏊‍♂️' },
      { name: 'Gaming', category: 'Technology', icon: '🎮' },
      { name: 'Dancing', category: 'Creative Arts', icon: '💃' },
      { name: 'Programming', category: 'Technology', icon: '💻' },
      { name: 'Crafting', category: 'Creative Arts', icon: '🧶' },
      { name: 'Painting', category: 'Creative Arts', icon: '🎨' },
      { name: 'Board Games', category: 'Social Activities', icon: '🎲' },
      { name: 'Photography', category: 'Creative Arts', icon: '📸' },
      { name: 'Language Learning', category: 'Learning & Education', icon: '🗣️' },
      { name: 'Reading', category: 'Learning & Education', icon: '📚' },
      { name: 'Tea, Coffee', category: 'Social Activities', icon: '☕' },
      { name: 'Cooking', category: 'Creative Arts', icon: '👨‍🍳' },
      { name: 'Rock Climbing', category: 'Sports & Fitness', icon: '🧗‍♂️' },
      { name: 'Hiking', category: 'Sports & Fitness', icon: '🏔️' },
      { name: 'Concerts', category: 'Music & Entertainment', icon: '🎵' },
      { name: 'Theater', category: 'Music & Entertainment', icon: '🎭' },
      { name: 'Movies', category: 'Music & Entertainment', icon: '🎬' },
      { name: 'Karaoke', category: 'Music & Entertainment', icon: '🎤' },
      { name: 'Travel', category: 'Travel & Adventure', icon: '✈️' },
      { name: 'Road Trips', category: 'Travel & Adventure', icon: '🚗' }
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