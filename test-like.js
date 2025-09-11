const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

async function testLike() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const Match = require('./models/Match');
    const User = require('./models/User');
    
    // Clear existing matches
    await Match.deleteMany({});
    console.log('Cleared existing matches');
    
    // Get users
    const users = await User.find({}).select('name _id');
    const user1 = users[0]; // Emir
    const user2 = users[1]; // Nazlı
    
    console.log(`\nUser1: ${user1.name} (${user1._id})`);
    console.log(`User2: ${user2.name} (${user2._id})`);
    
    // Simulate User1 liking User2
    console.log('\n=== USER1 LIKES USER2 ===');
    const match1 = new Match({
      user1: user1._id,
      user2: user2._id,
      sharedHobbies: ['hobby1', 'hobby2'],
      likedBy: [user1._id], // User1 liked User2
      status: 'pending'
    });
    await match1.save();
    console.log('Created match:', match1._id);
    console.log('LikedBy:', match1.likedBy);
    
    // Check pending matches for User2 (should see User1)
    console.log('\n=== CHECKING PENDING MATCHES FOR USER2 ===');
    const allMatchesForUser2 = await Match.find({
      $or: [
        { user1: user2._id },
        { user2: user2._id }
      ],
      status: 'pending'
    });
    
    console.log('All pending matches for User2:', allMatchesForUser2.length);
    
    const pendingForUser2 = allMatchesForUser2.filter(match => {
      const otherUserId = match.user1._id.equals(user2._id) ? match.user2._id : match.user1._id;
      const otherUserHasLiked = match.likedBy.some(userId => userId.equals(otherUserId));
      const currentUserHasLiked = match.likedBy.some(userId => userId.equals(user2._id));
      
      console.log(`Match ${match._id}:`);
      console.log(`  Other user has liked: ${otherUserHasLiked}`);
      console.log(`  Current user has liked: ${currentUserHasLiked}`);
      console.log(`  Should show in pending: ${otherUserHasLiked && !currentUserHasLiked}`);
      
      return otherUserHasLiked && !currentUserHasLiked;
    });
    
    console.log('Pending matches for User2:', pendingForUser2.length);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

testLike(); 