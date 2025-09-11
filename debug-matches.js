const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

async function debugMatches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const Match = require('./models/Match');
    const User = require('./models/User');
    
    // Get all matches
    const matches = await Match.find({}).populate('user1', 'name').populate('user2', 'name');
    console.log('\n=== ALL MATCHES IN DATABASE ===');
    matches.forEach(match => {
      console.log(`Match ID: ${match._id}`);
      console.log(`User1: ${match.user1.name} (${match.user1._id})`);
      console.log(`User2: ${match.user2.name} (${match.user2._id})`);
      console.log(`Status: ${match.status}`);
      console.log(`LikedBy: ${match.likedBy.join(', ')}`);
      console.log(`Shared Hobbies: ${match.sharedHobbies.join(', ')}`);
      console.log('---');
    });
    
    // Get all users
    const users = await User.find({}).select('name _id');
    console.log('\n=== ALL USERS ===');
    users.forEach(user => {
      console.log(`${user.name}: ${user._id}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

debugMatches(); 