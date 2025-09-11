const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

async function debugUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const User = require('./models/User');
    const users = await User.find({}).select('name email hobbies');
    
    console.log('\n=== ALL USERS IN DATABASE ===');
    users.forEach(user => {
      console.log(`Name: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Hobbies: ${user.hobbies.join(', ')}`);
      console.log('---');
    });
    
    console.log(`\nTotal users: ${users.length}`);
    
    // Check for users with shared hobbies
    if (users.length >= 2) {
      const user1 = users[0];
      const user2 = users[1];
      
      const sharedHobbies = user1.hobbies.filter(hobby => 
        user2.hobbies.includes(hobby)
      );
      
      console.log(`\n=== SHARED HOBBIES TEST ===`);
      console.log(`${user1.name} hobbies: ${user1.hobbies.join(', ')}`);
      console.log(`${user2.name} hobbies: ${user2.hobbies.join(', ')}`);
      console.log(`Shared hobbies: ${sharedHobbies.join(', ')}`);
      console.log(`Number of shared hobbies: ${sharedHobbies.length}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

debugUsers(); 