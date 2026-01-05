require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

// Check both, prefer MONGODB_URI (what server.js uses)
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/synchroedit';

console.log('Targeting DB URI:', MONGO_URI);

const usersToCreate = [
  {
    username: 'tester_arc',
    email: 'tester_arc@example.com',
    password: 'TesterPassword123!',
    isEmailVerified: true,
    bio: 'Arc Browser Test User'
  },
  {
    username: 'tester_edge',
    email: 'tester_edge@example.com',
    password: 'TesterPassword123!',
    isEmailVerified: true,
    bio: 'Edge Browser Test User'
  }
];

async function createBrowserTesters() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    for (const userInfo of usersToCreate) {
      let user = await User.findOne({ username: userInfo.username });
      
      if (user) {
        console.log(`User ${userInfo.username} already exists. Updating...`);
        user.password = userInfo.password;
        user.isEmailVerified = true;
        await user.save();
        console.log(`User ${userInfo.username} updated.`);
      } else {
        user = new User(userInfo);
        await user.save();
        console.log(`User ${userInfo.username} created.`);
      }
    }

  } catch (error) {
    console.error('Error creating browser test users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

createBrowserTesters();
