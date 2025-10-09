const express = require('express');
const Hobby = require('../models/Hobby');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/hobbies
// @desc    Get all hobbies
// @access  Public
router.get('/', async (req, res) => {
  try {
    const hobbies = await Hobby.find({ isActive: true })
      .sort({ updatedAt: 1 });

    res.json({
      success: true,
      hobbies
    });
  } catch (error) {
    console.error('Get hobbies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/hobbies/seed
// @desc    Seed initial hobby data
// @access  Private (for development)
router.post('/seed', async (req, res) => {
  try {
    // Check if hobbies already exist
    const existingHobbies = await Hobby.countDocuments();
    if (existingHobbies > 0) {
      return res.json({
        success: true,
        message: 'Hobbies already seeded'
      });
    }

    const initialHobbies = [
      // Priority Sports & Fitness (moved to top)
      { name: 'Tennis', category: 'Sports & Fitness', icon: '🎾' },
      { name: 'Soccer', category: 'Sports & Fitness', icon: '⚽' },
      { name: 'Basketball', category: 'Sports & Fitness', icon: '🏀' },
      { name: 'Volleyball', category: 'Sports & Fitness', icon: '🏐' },
      { name: 'Swimming', category: 'Sports & Fitness', icon: '🏊‍♂️' },
      { name: 'Cycling', category: 'Sports & Fitness', icon: '🚴‍♂️' },
      { name: 'Gym', category: 'Sports & Fitness', icon: '💪' },
      { name: 'Board Games', category: 'Social Activities', icon: '🎲' },
      { name: 'Running', category: 'Sports & Fitness', icon: '🏃‍♂️' },

      // Other Sports & Fitness
      { name: 'Yoga', category: 'Sports & Fitness', icon: '🧘‍♀️' },

      // Creative Arts
      { name: 'Photography', category: 'Creative Arts', icon: '📸' },
      { name: 'Painting', category: 'Creative Arts', icon: '🎨' },
      { name: 'Drawing', category: 'Creative Arts', icon: '✏️' },
      { name: 'Crafting', category: 'Creative Arts', icon: '🧶' },
      { name: 'Writing', category: 'Creative Arts', icon: '✍️' },
      { name: 'Music', category: 'Creative Arts', icon: '🎵' },
      { name: 'Dancing', category: 'Creative Arts', icon: '💃' },

      // Technology
      { name: 'Programming', category: 'Technology', icon: '💻' },
      { name: 'Gaming', category: 'Technology', icon: '🎮' },
      { name: 'AI/ML', category: 'Technology', icon: '🤖' },
      { name: 'Web Development', category: 'Technology', icon: '🌐' },
      { name: 'Mobile Apps', category: 'Technology', icon: '📱' },

      // Outdoor Activities
      { name: 'Hiking', category: 'Outdoor Activities', icon: '🏔️' },
      { name: 'Camping', category: 'Outdoor Activities', icon: '⛺' },
      { name: 'Fishing', category: 'Outdoor Activities', icon: '🎣' },
      { name: 'Rock Climbing', category: 'Outdoor Activities', icon: '🧗‍♂️' },
      { name: 'Surfing', category: 'Outdoor Activities', icon: '🏄‍♂️' },

      // Social Activities
      { name: 'Cooking', category: 'Social Activities', icon: '👨‍🍳' },
      { name: 'Wine Tasting', category: 'Social Activities', icon: '🍷' },
      { name: 'Coffee', category: 'Social Activities', icon: '☕' },
      { name: 'Tea', category: 'Social Activities', icon: '🫖' },

      // Learning & Education
      { name: 'Reading', category: 'Learning & Education', icon: '📚' },
      { name: 'Language Learning', category: 'Learning & Education', icon: '🗣️' },
      { name: 'Online Courses', category: 'Learning & Education', icon: '🎓' },
      { name: 'Podcasts', category: 'Learning & Education', icon: '🎧' },

      // Food & Cooking
      { name: 'Baking', category: 'Food & Cooking', icon: '🍰' },
      { name: 'BBQ', category: 'Food & Cooking', icon: '🍖' },
      { name: 'Vegan Cooking', category: 'Food & Cooking', icon: '🥬' },
      { name: 'Food Photography', category: 'Food & Cooking', icon: '📸' },

      // Music & Entertainment
      { name: 'Concerts', category: 'Music & Entertainment', icon: '🎤' },
      { name: 'Theater', category: 'Music & Entertainment', icon: '🎭' },
      { name: 'Movies', category: 'Music & Entertainment', icon: '🎬' },
      { name: 'Karaoke', category: 'Music & Entertainment', icon: '🎤' },

      // Travel & Adventure
      { name: 'Travel', category: 'Travel & Adventure', icon: '✈️' },
      { name: 'Road Trips', category: 'Travel & Adventure', icon: '🚗' },
      { name: 'Backpacking', category: 'Travel & Adventure', icon: '🎒' },
      { name: 'Photography', category: 'Travel & Adventure', icon: '📸' },

      // Other
      { name: 'Meditation', category: 'Other', icon: '🧘‍♂️' },
      { name: 'Volunteering', category: 'Other', icon: '🤝' },
      { name: 'Pet Care', category: 'Other', icon: '🐕' },
      { name: 'Gardening', category: 'Other', icon: '🌱' }
    ];

    await Hobby.insertMany(initialHobbies);

    res.json({
      success: true,
      message: 'Hobbies seeded successfully',
      count: initialHobbies.length
    });
  } catch (error) {
    console.error('Seed hobbies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during seeding'
    });
  }
});

module.exports = router; 