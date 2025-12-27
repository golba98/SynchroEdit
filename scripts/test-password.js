require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/syncroedit';

async function verifyPassword() {
  try {
    await mongoose.connect(MONGO_URI);
    
    const user = await User.findOne({ username: 'tester' });
    if (!user) {
        console.log('User not found');
        return;
    }

    const isMatch = await user.comparePassword('password123');
    console.log(`Password 'password123' match: ${isMatch ? 'YES ✅' : 'NO ❌'}`);
    
    // Also test with trimmed space just in case
    const isMatchSpace = await user.comparePassword('password123 ');
    console.log(`Password 'password123 ' match: ${isMatchSpace ? 'YES ✅' : 'NO ❌'}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

verifyPassword();
