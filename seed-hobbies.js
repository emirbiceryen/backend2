const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

const Hobby = require('./models/Hobby');

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