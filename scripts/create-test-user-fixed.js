require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

// Check both, prefer MONGODB_URI (what server.js uses)
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/syncroedit';

console.log('Targeting DB URI:', MONGO_URI);

async function createTestUser() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const testUser = {
      username: 'tester',
      email: 'tester@example.com',
      password: 'TesterPassword123!',
      isEmailVerified: true,
      bio: 'Automated Test User'
    };

    let user = await User.findOne({ username: 'tester' });
    
    if (user) {
      console.log('Test user already exists. Updating...');
      user.password = testUser.password;
      user.isEmailVerified = true;
      await user.save();
      console.log('Test user updated.');
    } else {
      user = new User(testUser);
      await user.save();
      console.log('Test user created.');
    }

  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

createTestUser();
