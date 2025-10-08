const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

const Hobby = require('./models/Hobby');

const initialHobbies = [
  // Popular Sports (Priority Order)
  { name: 'Soccer', category: 'Sports & Fitness', icon: '⚽' },
  { name: 'Tennis', category: 'Sports & Fitness', icon: '🎾' },
  { name: 'Badminton', category: 'Sports & Fitness', icon: '🏸' },
  { name: 'Skiing', category: 'Sports & Fitness', icon: '⛷️' },
  { name: 'Snowboarding', category: 'Sports & Fitness', icon: '🏂' },
  { name: 'Kayaking', category: 'Sports & Fitness', icon: '🛶' },
  { name: 'Fishing', category: 'Sports & Fitness', icon: '🎣' },
  { name: 'Baseball', category: 'Sports & Fitness', icon: '⚾' },
  { name: 'Basketball', category: 'Sports & Fitness', icon: '🏀' },
  { name: 'Volleyball', category: 'Sports & Fitness', icon: '🏐' },

  // Other Sports & Fitness
  { name: 'Running', category: 'Sports & Fitness', icon: '🏃‍♂️' },
  { name: 'Gym', category: 'Sports & Fitness', icon: '💪' },
  { name: 'Yoga', category: 'Sports & Fitness', icon: '🧘‍♀️' },
  { name: 'Swimming', category: 'Sports & Fitness', icon: '🏊‍♂️' },
  { name: 'Cycling', category: 'Sports & Fitness', icon: '🚴‍♂️' },
  { name: 'Hiking', category: 'Sports & Fitness', icon: '🏔️' },
  { name: 'Rock Climbing', category: 'Sports & Fitness', icon: '🧗‍♂️' },

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

  // Other
  { name: 'Meditation', category: 'Other', icon: '🧘‍♂️' },
  { name: 'Volunteering', category: 'Other', icon: '🤝' },
  { name: 'Pet Care', category: 'Other', icon: '🐕' },
  { name: 'Gardening', category: 'Other', icon: '🌱' }
];

async function seedHobbies() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Clear existing hobbies
    await Hobby.deleteMany({});
    console.log('Cleared existing hobbies');

    // Insert new hobbies
    const result = await Hobby.insertMany(initialHobbies);
    console.log(`Successfully seeded ${result.length} hobbies`);

    // Display some sample hobbies
    const sampleHobbies = await Hobby.find().limit(5);
    console.log('Sample hobbies:', sampleHobbies.map(h => ({ name: h.name, category: h.category })));

  } catch (error) {
    console.error('Error seeding hobbies:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedHobbies(); 