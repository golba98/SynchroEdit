const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const { sendVerificationEmail, sendPasswordResetEmail, generateVerificationCode } = require('../utils/email');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { createTicket } = require('../utils/ticketStore');

const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_VERIFICATION_ENABLED = process.env.ENABLE_EMAIL_VERIFICATION !== 'false';

exports.getWsTicket = (req, res, next) => {
    // req.user is set by authenticateToken middleware
    const userId = req.user.id;
    const ticket = createTicket(userId);
    res.json({ ticket });
};

exports.signup = async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return next(new AppError('Database connection error', 500));
  }

  let { username, email, password } = req.body;

  if (!username || !email || !password) {
    return next(new AppError('Please provide username, email, and password', 400));
  }

  // Password Complexity Policy
  // Min 8 chars, 1 Upper, 1 Lower, 1 Number, 1 Symbol
  const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])(?=.{8,})/;
  if (!complexityRegex.test(password)) {
      return next(new AppError('Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one symbol (!@#$%^&*).', 400));
  }

  username = username.trim();
  email = email.trim().toLowerCase();

  const existingUser = await User.findOne({ $or: [{ username }, { email }] }).lean();
  if (existingUser) {
    // Prevent enumeration: If user exists, we pretend success or return a generic message.
    // Simulate delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

    return res.status(200).json({
       message: 'If your email is not registered, you will receive a verification code.',
    });
  }

  const verificationCode = generateVerificationCode();
  const user = new User({
    username,
    email,
    password,
    verificationCode: EMAIL_VERIFICATION_ENABLED ? verificationCode : null,
    verificationCodeExpires: EMAIL_VERIFICATION_ENABLED
      ? new Date(Date.now() + 10 * 60 * 1000)
      : null,
    isEmailVerified: !EMAIL_VERIFICATION_ENABLED,
  });
  await user.save();

  if (EMAIL_VERIFICATION_ENABLED) {
    const emailSent = await sendVerificationEmail(email, verificationCode);
    if (!emailSent) {
      await User.deleteOne({ _id: user._id });
      return next(new AppError('Failed to send verification email', 500));
    }
    logger.info(`New user signed up (pending verification): ${user.username}`);
    res.status(200).json({
      message: 'If your email is not registered, you will receive a verification code.',
    });
  } else {
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    logger.info(`New user signed up: ${user.username}`);
    res.status(201).json({
      token,
      username: user.username,
      email: user.email,
      message: 'Signup successful (verification disabled).',
    });
  }
};

exports.verifyEmail = async (req, res, next) => {
  const { email, verificationCode } = req.body;

  const user = await User.findOne({ email });
  // Prevent user enumeration by returning generic error
  if (!user) return next(new AppError('Invalid verification code', 400));

  if (!EMAIL_VERIFICATION_ENABLED) {
    user.isEmailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
      expiresIn: '24h',
    });
    return res.status(200).json({
      message: 'Verification disabled; user marked verified.',
      token,
      username: user.username,
    });
  }

  if (user.isEmailVerified) {
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
      expiresIn: '24h',
    });
    return res
      .status(200)
      .json({ message: 'Email already verified', token, username: user.username });
  }

  if (!user.verificationCode || user.verificationCode !== verificationCode) {
    return next(new AppError('Invalid verification code', 400));
  }

  if (new Date() > user.verificationCodeExpires) {
    return next(new AppError('Verification code expired', 400));
  }

  user.isEmailVerified = true;
  user.verificationCode = null;
  user.verificationCodeExpires = null;
  await user.save();

  logger.info(`User email verified: ${user.username}`);
  const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
    expiresIn: '24h',
  });
  res.json({ message: 'Email verified successfully', token, username: user.username });
};

exports.resendCode = async (req, res, next) => {
  if (!EMAIL_VERIFICATION_ENABLED) {
    return res.status(200).json({ message: 'Verification disabled; no code sent.' });
  }

  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    // Prevent user enumeration: return success even if user not found
    return res.status(200).json({ message: 'If your email is registered, a code has been sent.' });
  }

  if (user.isEmailVerified) {
    return next(new AppError('Email already verified', 400));
  }

  const verificationCode = generateVerificationCode();
  user.verificationCode = verificationCode;
  user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  const emailSent = await sendVerificationEmail(email, verificationCode);
  if (!emailSent) {
    return next(new AppError('Failed to send email', 500));
  }

  logger.info(`Verification code resent to: ${email}`);
  res.json({ message: 'If your email is registered, a code has been sent.' });
};

exports.login = async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return next(new AppError('Database connection error', 500));
  }

  const { username, password } = req.body;
  // We need password for comparePassword, but let's see if comparePassword is on instance
  // Since comparePassword is a method, we need the full document if we use it.
  const user = await User.findOne({ username });
  if (!user) return next(new AppError('Invalid username or password', 401));

  // Account Lockout Check
  if (user.lockUntil && user.lockUntil > Date.now()) {
      return next(new AppError('Account is temporarily locked due to multiple failed login attempts. Please try again later.', 403));
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
      // Increment failed attempts
      user.loginAttempts += 1;
      
      if (user.loginAttempts >= 5) {
          user.lockUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes
          await user.save();
          return next(new AppError('Account locked due to too many failed attempts. Try again in 15 minutes.', 403));
      }
      
      await user.save();
      return next(new AppError('Invalid username or password', 401));
  }

  // Reset login attempts on success
  if (user.loginAttempts !== 0 || user.lockUntil) {
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
  }

  if (!user.isEmailVerified) {
    if (!EMAIL_VERIFICATION_ENABLED) {
      user.isEmailVerified = true;
      user.verificationCode = null;
      user.verificationCodeExpires = null;
      await user.save();
    } else {
      const verificationCode = generateVerificationCode();
      user.verificationCode = verificationCode;
      user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      sendVerificationEmail(user.email, verificationCode).catch((err) => {
        logger.error('Deferred verification email failed:', err);
      });

      return res.status(403).json({
        message: 'Email not verified. We just sent a fresh code.',
        requiresVerification: true,
        email: user.email,
        username: user.username,
      });
    }
  }

  logger.info(`User logged in: ${user.username}`);
  
  // Dual-Token System
  const accessToken = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
    expiresIn: '15m', // Short-lived
  });

  const refreshToken = jwt.sign({ id: user._id }, JWT_SECRET, {
    expiresIn: '7d', // Long-lived
  });

  // Send Refresh Token as HTTP-Only Cookie
  res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({ token: accessToken, username: user.username });
};

exports.refreshToken = async (req, res, next) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token not found, please login again.' });
    }

    try {
        const decoded = jwt.verify(refreshToken, JWT_SECRET);
        
        // Check if user still exists (security best practice)
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: 'User no longer exists.' });
        }

        // Issue new Access Token
        const accessToken = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
            expiresIn: '15m',
        });

        res.json({ token: accessToken });
    } catch (err) {
        return res.status(403).json({ message: 'Invalid refresh token' });
    }
};

exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;
  if (!email) return next(new AppError('Please provide an email address', 400));

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    // Prevent enumeration
    return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
  }

  // Generate Token
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash token and save to DB
  user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  await user.save({ validateBeforeSave: false });

  // Create Reset URL
  // Assuming frontend is served from same domain or configured URL
  // For now, let's assume /reset-password?token=...
  // In production, use process.env.FRONTEND_URL
  const protocol = req.protocol;
  const host = req.get('host');
  // If running locally with separate frontend dev server, this might need adjustment
  const resetUrl = `${protocol}://${host}/pages/reset-password.html?token=${resetToken}`;

  try {
      await sendPasswordResetEmail(user.email, resetUrl);
      res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return next(new AppError('There was an error sending the email. Try again later!'), 500);
  }
};

exports.resetPassword = async (req, res, next) => {
    const { token, password } = req.body;
    if (!token || !password) return next(new AppError('Token and new password are required', 400));

    // Hash the token to compare with DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
    }

    // Password complexity check (Duplicate from signup, ideally helper function)
    const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])(?=.{8,})/;
    if (!complexityRegex.test(password)) {
        return next(new AppError('Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one symbol (!@#$%^&*).', 400));
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    // Unlock account if it was locked (optional: nice UX)
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    await user.save();

    // Log the user in immediately
    const newToken = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
        expiresIn: '24h',
    });

    res.status(200).json({
        message: 'Password successfully reset',
        token: newToken,
        username: user.username
    });
};

exports.logout = (req, res) => {
    res.cookie('refreshToken', '', {
        httpOnly: true,
        expires: new Date(0), // Expire immediately
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict'
    });
    res.status(200).json({ message: 'Logged out successfully' });
};