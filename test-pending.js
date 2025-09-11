const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

async function testPending() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const Match = require('./models/Match');
    const User = require('./models/User');
    
    // Get all users
    const users = await User.find({}).select('name _id');
    console.log('\n=== USERS ===');
    users.forEach(user => {
      console.log(`${user.name}: ${user._id}`);
    });
    
    // Test for each user
    for (const user of users) {
      console.log(`\n=== TESTING PENDING MATCHES FOR ${user.name} ===`);
      
      // Find all matches where current user is involved
      const allMatches = await Match.find({
        $or: [
          { user1: user._id },
          { user2: user._id }
        ],
        status: 'pending'
      })
      .populate('user1', 'name')
      .populate('user2', 'name');
      
      console.log(`All pending matches for ${user.name}:`, allMatches.length);
      
      // Filter matches where someone else liked the current user
      const pendingMatches = allMatches.filter(match => {
        const otherUserId = match.user1._id.equals(user._id) ? match.user2._id : match.user1._id;
        const otherUserHasLiked = match.likedBy.some(userId => userId.equals(otherUserId));
        const currentUserHasLiked = match.likedBy.some(userId => userId.equals(user._id));
        
        console.log(`Match ${match._id}:`);
        console.log(`  User1: ${match.user1.name} (${match.user1._id})`);
        console.log(`  User2: ${match.user2.name} (${match.user2._id})`);
        console.log(`  LikedBy: ${match.likedBy.join(', ')}`);
        console.log(`  Other user ID: ${otherUserId}`);
        console.log(`  Other user has liked: ${otherUserHasLiked}`);
        console.log(`  Current user has liked: ${currentUserHasLiked}`);
        console.log(`  Should show in pending: ${otherUserHasLiked && !currentUserHasLiked}`);
        
        return otherUserHasLiked && !currentUserHasLiked;
      });
      
      console.log(`Pending matches for ${user.name}:`, pendingMatches.length);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

testPending(); 