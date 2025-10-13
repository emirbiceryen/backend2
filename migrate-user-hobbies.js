const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });

const User = require('./models/User');
const Hobby = require('./models/Hobby');

async function migrateUserHobbies() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all users with hobbies
    const users = await User.find({ hobbies: { $exists: true, $ne: [] } });
    console.log(`Found ${users.length} users with hobbies`);

    // Get all current hobbies
    const allHobbies = await Hobby.find();
    console.log(`Found ${allHobbies.length} hobbies in database`);

    // Create a map of old hobby names to new hobby IDs
    const hobbyNameToIdMap = {};
    allHobbies.forEach(hobby => {
      hobbyNameToIdMap[hobby.name.toLowerCase()] = hobby._id.toString();
    });

    console.log('Hobby name to ID map:', hobbyNameToIdMap);

    let updatedCount = 0;

    for (const user of users) {
      console.log(`\nProcessing user: ${user.name} (${user._id})`);
      console.log(`Current hobbies:`, user.hobbies);

      // Check if user has old hobby IDs (ObjectId format)
      const hasOldIds = user.hobbies.some(hobbyId => 
        typeof hobbyId === 'string' && hobbyId.length === 24
      );

      if (hasOldIds) {
        console.log('User has old hobby IDs, clearing hobbies array');
        
        // Clear hobbies and hobbySkillLevels
        user.hobbies = [];
        user.hobbySkillLevels = {};
        
        await user.save();
        console.log('Cleared hobbies for user:', user.name);
        updatedCount++;
      }
    }

    console.log(`\nMigration completed. Updated ${updatedCount} users.`);
    console.log('Users will need to re-select their hobbies in the app.');

    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateUserHobbies();
