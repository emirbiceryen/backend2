const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

const User = require('./models/User');
const Match = require('./models/Match');
const Chat = require('./models/Chat');
const ForumPost = require('./models/ForumPost');
const Rating = require('./models/Rating');
const Team = require('./models/Team');

async function clearAllUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Kullanıcı sayısını kontrol et
    const userCount = await User.countDocuments();
    console.log(`Found ${userCount} users`);

    if (userCount === 0) {
      console.log('No users to delete');
      return;
    }

    // Onay iste
    console.log('\n⚠️  WARNING: This will delete ALL users and related data!');
    console.log('This action cannot be undone.');
    console.log('\nProceeding with deletion...');
    
    // Tüm kullanıcıları sil
    await User.deleteMany({});
    console.log('✅ All users deleted');

    // İlgili verileri de sil
    await Match.deleteMany({});
    console.log('✅ All matches deleted');

    await Chat.deleteMany({});
    console.log('✅ All chats deleted');

    await ForumPost.deleteMany({});
    console.log('✅ All forum posts deleted');

    await Rating.deleteMany({});
    console.log('✅ All ratings deleted');

    await Team.deleteMany({});
    console.log('✅ All teams deleted');

    console.log('\n🎉 All user data cleared successfully!');
    console.log('You can now register new accounts.');

  } catch (error) {
    console.error('Error clearing users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

clearAllUsers();
