const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

const User = require('./models/User');
const Match = require('./models/Match');
const Chat = require('./models/Chat');
const ForumPost = require('./models/ForumPost');
const Rating = require('./models/Rating');
const Team = require('./models/Team');

async function clearUsersSelective() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Korunacak kullanıcı email'leri (kendi hesabınızı korumak için)
    const keepEmails = [
      'your-email@example.com',  // Buraya kendi email'inizi yazın
      'admin@example.com'        // Diğer korunacak hesaplar
    ];

    // Tüm kullanıcıları listele
    const allUsers = await User.find({}, 'email name');
    console.log('\nCurrent users:');
    allUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email})`);
    });

    // Silinecek kullanıcıları bul
    const usersToDelete = await User.find({
      email: { $nin: keepEmails }
    });

    console.log(`\nUsers to delete: ${usersToDelete.length}`);
    usersToDelete.forEach(user => {
      console.log(`- ${user.name} (${user.email})`);
    });

    if (usersToDelete.length === 0) {
      console.log('No users to delete');
      return;
    }

    console.log('\n⚠️  WARNING: This will delete the above users and their data!');
    console.log('To proceed, uncomment the deletion code below and run again.');

    // Güvenlik için önce yorum satırında bırakıyoruz
    /*
    const userIdsToDelete = usersToDelete.map(user => user._id);

    // Kullanıcıları sil
    await User.deleteMany({ _id: { $in: userIdsToDelete } });
    console.log('✅ Users deleted');

    // İlgili verileri sil
    await Match.deleteMany({
      $or: [
        { user1: { $in: userIdsToDelete } },
        { user2: { $in: userIdsToDelete } }
      ]
    });
    console.log('✅ Related matches deleted');

    await Chat.deleteMany({
      $or: [
        { 'participants.user': { $in: userIdsToDelete } }
      ]
    });
    console.log('✅ Related chats deleted');

    await ForumPost.deleteMany({
      author: { $in: userIdsToDelete }
    });
    console.log('✅ Related forum posts deleted');

    await Rating.deleteMany({
      $or: [
        { ratedUser: { $in: userIdsToDelete } },
        { ratingUser: { $in: userIdsToDelete } }
      ]
    });
    console.log('✅ Related ratings deleted');

    await Team.deleteMany({
      $or: [
        { captain: { $in: userIdsToDelete } },
        { members: { $in: userIdsToDelete } }
      ]
    });
    console.log('✅ Related teams deleted');

    console.log('\n🎉 Selected users and their data cleared successfully!');
    */

  } catch (error) {
    console.error('Error clearing users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

clearUsersSelective();
