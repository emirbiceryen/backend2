require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get email and password from command line arguments
    const email = process.argv[2];
    const password = process.argv[3];
    
    if (!email) {
      console.error('❌ Usage: node createAdmin.js <email> [password]');
      console.error('Example: node createAdmin.js admin@example.com mypassword123');
      process.exit(1);
    }

    // Find user by email
    let user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      // User doesn't exist, create new admin user
      if (!password) {
        console.error('❌ Password is required to create a new user!');
        console.error('Usage: node createAdmin.js <email> <password>');
        process.exit(1);
      }

      console.log(`📝 Creating new admin user with email: ${email}`);
      
      // Create new user (password will be hashed by pre-save hook)
      user = new User({
        email: email.toLowerCase().trim(),
        password: password, // Will be hashed by pre-save hook
        username: email.split('@')[0], // Use email prefix as username
        firstName: 'Admin',
        lastName: 'User',
        name: 'Admin User',
        role: 'admin',
        accountType: 'individual',
        isProfileComplete: true,
        emailVerified: true,
      });
      
      await user.save();
      console.log(`✅ New admin user created successfully!`);
    } else {
      // User exists, update to admin
      if (password) {
        // Update password (will be hashed by pre-save hook)
        user.password = password;
        console.log(`🔑 Password will be updated.`);
      }
      
      // Check if already admin
      if (user.role === 'admin') {
        console.log(`ℹ️  User "${email}" is already an admin.`);
        if (password) {
          await user.save();
          console.log(`✅ Password updated.`);
        }
        process.exit(0);
      }

      // Update user role to admin
      user.role = 'admin';
      await user.save();
      console.log(`✅ Existing user "${email}" is now an admin.`);
    }

    console.log(`\n📋 Admin Account Details:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`\n✅ You can now login to the admin panel with this account.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

createAdmin();

