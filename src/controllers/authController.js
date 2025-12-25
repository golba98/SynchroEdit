const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { sendVerificationEmail, generateVerificationCode } = require('../utils/email');
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
  // If we want lean here, we'd need a different way to check password.
  // Let's keep this non-lean since we need to potentially .save() if verification is disabled.
  const user = await User.findOne({ username });
  if (!user) return next(new AppError('Invalid username or password', 401));

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return next(new AppError('Invalid username or password', 401));

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
  const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
    expiresIn: '24h',
  });
  res.json({ token, username: user.username });
};