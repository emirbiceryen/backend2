const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

async function debugHobbies() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const Hobby = require('./models/Hobby');
    const User = require('./models/User');
    
    // Get all hobbies
    const hobbies = await Hobby.find({});
    console.log('\n=== ALL HOBBIES IN DATABASE ===');
    hobbies.forEach(hobby => {
      console.log(`ID: ${hobby._id}`);
      console.log(`Name: ${hobby.name}`);
      console.log(`Category: ${hobby.category}`);
      console.log('---');
    });
    
    // Get users with their hobbies
    const users = await User.find({}).select('name hobbies');
    console.log('\n=== USERS AND THEIR HOBBIES ===');
    users.forEach(user => {
      console.log(`User: ${user.name}`);
      console.log(`Hobby IDs: ${user.hobbies.join(', ')}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

debugHobbies(); 