const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])(?=.{8,})/;

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    type: String,
    required: true,
    minlength: [8, 'Password must be at least 8 characters long'],
    validate: {
      validator: function (v) {
        return PASSWORD_REGEX.test(v);
      },
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol (!@#$%^&*)',
    },
  },
  profilePicture: {
    type: String,
    default: '', // Base64 or URL
  },
  accentColor: {
    type: String,
    default: '#8b5cf6',
  },
  bio: {
    type: String,
    default: '',
    maxlength: 500,
  },
  showOnlineStatus: {
    type: Boolean,
    default: true,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  verificationCode: {
    type: String,
    default: null,
  },
  verificationCodeExpires: {
    type: Date,
    default: null,
  },
  recentDocuments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Password Reset Fields
  passwordResetToken: String,
  passwordResetExpires: Date,

  // Account Lockout Fields
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: {
    type: Date,
  },
  sessions: [
    {
      sessionId: String,
      refreshToken: String,
      userAgent: String,
      ipAddress: String,
      lastActive: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  loginHistory: [Date],
  mfaEnabled: {
    type: Boolean,
    default: false,
  },
  mfaSecret: String,
});

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Expose Password Regex for Controller/Frontend usage consistency
userSchema.statics.PASSWORD_REGEX = PASSWORD_REGEX;

module.exports = mongoose.model('User', userSchema);
