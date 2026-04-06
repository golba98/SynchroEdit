require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/users/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/syncroedit';

async function createTestUser() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const testUser = {
      username: 'tester',
      email: 'tester@example.com',
      password: 'password123',
      isEmailVerified: true,
      bio: 'Automated Test User',
    };

    let user = await User.findOne({ email: testUser.email });

    if (user) {
      console.log('Test user already exists.');
      // Update password to be sure
      user.password = testUser.password;
      user.isEmailVerified = true;
      await user.save();
      console.log('Test user updated.');
    } else {
      user = new User(testUser);
      await user.save();
      console.log('Test user created.');
    }

    console.log(`
    --------------------------------------
    LOGIN CREDENTIALS:
    Email:    tester@example.com
    Password: password123
    --------------------------------------
    `);
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

createTestUser();
