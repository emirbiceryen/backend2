const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const generateUsername = (name, email, index = 0) => {
  // Clean the name and create a base username
  const baseName = name.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15);
  
  // Get email prefix
  const emailPrefix = email.split('@')[0].toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10);
  
  // Try different combinations
  const attempts = [
    baseName,
    emailPrefix,
    `${baseName}${index || ''}`,
    `${emailPrefix}${index || ''}`,
    `user${index || Math.floor(Math.random() * 1000)}`
  ];
  
  return attempts.find(attempt => attempt.length >= 3) || `user${Date.now()}`;
};

const migrateUsernames = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://yasincan1811_db_user:jrRxeAxyVdZnpEBS@cluster0.kzp73c3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
    console.log('Connected to MongoDB');

    // Find all users without usernames
    const usersWithoutUsernames = await User.find({ 
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: '' }
      ]
    });

    console.log(`Found ${usersWithoutUsernames.length} users without usernames`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of usersWithoutUsernames) {
      try {
        let username;
        let attempts = 0;
        let isUnique = false;

        // Try to generate a unique username
        while (!isUnique && attempts < 10) {
          username = generateUsername(user.name, user.email, attempts);
          
          // Check if username already exists
          const existingUser = await User.findOne({ username });
          if (!existingUser) {
            isUnique = true;
          } else {
            attempts++;
          }
        }

        if (!isUnique) {
          // Fallback to timestamp-based username
          username = `user${Date.now()}${Math.floor(Math.random() * 1000)}`;
        }

        // Update user with username
        await User.findByIdAndUpdate(user._id, { username });
        console.log(`✓ Updated user ${user.name} (${user.email}) with username: ${username}`);
        successCount++;

      } catch (error) {
        console.error(`✗ Error updating user ${user.name} (${user.email}):`, error.message);
        errorCount++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total users processed: ${usersWithoutUsernames.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

    // Verify all users now have usernames
    const remainingUsersWithoutUsernames = await User.find({ 
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: '' }
      ]
    });

    if (remainingUsersWithoutUsernames.length === 0) {
      console.log('✅ All users now have usernames!');
    } else {
      console.log(`⚠️  ${remainingUsersWithoutUsernames.length} users still without usernames`);
    }

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run migration
migrateUsernames();