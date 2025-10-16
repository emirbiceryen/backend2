const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

const Hobby = require('./models/Hobby');

const initialHobbies = [
  // Exact 32 hobbies in specified order with order field
  { name: 'Tennis', category: 'Sports & Fitness', icon: '🎾', order: 1 },
  { name: 'Soccer', category: 'Sports & Fitness', icon: '⚽', order: 2 },
  { name: 'Basketball', category: 'Sports & Fitness', icon: '🏀', order: 3 },
  { name: 'Volleyball', category: 'Sports & Fitness', icon: '🏐', order: 4 },
  { name: 'Kayaking', category: 'Sports & Fitness', icon: '🛶', order: 5 },
  { name: 'Cycling', category: 'Sports & Fitness', icon: '🚴‍♂️', order: 6 },
  { name: 'Surfing', category: 'Sports & Fitness', icon: '🏄‍♂️', order: 7 },
  { name: 'Baseball', category: 'Sports & Fitness', icon: '⚾', order: 8 },
  { name: 'Gym', category: 'Sports & Fitness', icon: '💪', order: 9 },
  { name: 'Ski', category: 'Sports & Fitness', icon: '⛷️', order: 10 },
  { name: 'Fishing', category: 'Sports & Fitness', icon: '🎣', order: 11 },
  { name: 'Running', category: 'Sports & Fitness', icon: '🏃‍♂️', order: 12 },
  { name: 'Swimming', category: 'Sports & Fitness', icon: '🏊‍♂️', order: 13 },
  { name: 'Gaming', category: 'Technology', icon: '🎮', order: 14 },
  { name: 'Dancing', category: 'Creative Arts', icon: '💃', order: 15 },
  { name: 'Programming', category: 'Technology', icon: '💻', order: 16 },
  { name: 'Crafting', category: 'Creative Arts', icon: '🧶', order: 17 },
  { name: 'Painting', category: 'Creative Arts', icon: '🎨', order: 18 },
  { name: 'Board Games', category: 'Social Activities', icon: '🎲', order: 19 },
  { name: 'Photography', category: 'Creative Arts', icon: '📸', order: 20 },
  { name: 'Language Learning', category: 'Learning & Education', icon: '🗣️', order: 21 },
  { name: 'Reading', category: 'Learning & Education', icon: '📚', order: 22 },
  { name: 'Tea, Coffee', category: 'Social Activities', icon: '☕', order: 23 },
  { name: 'Cooking', category: 'Creative Arts', icon: '👨‍🍳', order: 24 },
  { name: 'Rock Climbing', category: 'Sports & Fitness', icon: '🧗‍♂️', order: 25 },
  { name: 'Hiking', category: 'Sports & Fitness', icon: '🏔️', order: 26 },
  { name: 'Concerts', category: 'Music & Entertainment', icon: '🎵', order: 27 },
  { name: 'Theater', category: 'Music & Entertainment', icon: '🎭', order: 28 },
  { name: 'Movies', category: 'Music & Entertainment', icon: '🎬', order: 29 },
  { name: 'Karaoke', category: 'Music & Entertainment', icon: '🎤', order: 30 },
  { name: 'Travel', category: 'Travel & Adventure', icon: '✈️', order: 31 },
  { name: 'Road Trips', category: 'Travel & Adventure', icon: '🚗', order: 32 }
];

async function seedHobbies() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing hobbies first
    await Hobby.deleteMany({});
    console.log('Cleared existing hobbies');

    // Insert new hobbies
    await Hobby.insertMany(initialHobbies);
    console.log(`Successfully seeded ${initialHobbies.length} hobbies`);

    // Verify the data
    const count = await Hobby.countDocuments();
    console.log(`Total hobbies in database: ${count}`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding hobbies:', error);
    process.exit(1);
  }
}

seedHobbies();