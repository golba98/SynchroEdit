const User = require('../models/User');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

exports.getProfile = async (req, res, next) => {
  const user = await User.findById(req.user.id).select('-password').lean();
  if (!user) return next(new AppError('User not found', 404));
  res.json(user);
};

exports.updateProfile = async (req, res, next) => {
  const { profilePicture, accentColor, bio } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) return next(new AppError('User not found', 404));

  if (profilePicture !== undefined) user.profilePicture = profilePicture;
  if (accentColor !== undefined) user.accentColor = accentColor;
  if (bio !== undefined) user.bio = bio;
  
  await user.save();

  logger.info(`Profile updated for user: ${req.user.id}`);
  res.json({ 
      message: 'Profile updated successfully', 
      profilePicture: user.profilePicture,
      accentColor: user.accentColor,
      bio: user.bio
  });
};

exports.updatePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) return next(new AppError('User not found', 404));

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) return next(new AppError('Current password incorrect', 400));

  user.password = newPassword;
  await user.save();

  logger.info(`Password updated for user: ${req.user.id}`);
  res.json({ message: 'Password updated successfully' });
};

exports.getSessions = async (req, res, next) => {
    const user = await User.findById(req.user.id).select('sessions');
    if (!user) return next(new AppError('User not found', 404));

    // Return sessions but exclude the refresh token hash for security
    const sessions = user.sessions.map(s => ({
        sessionId: s.sessionId,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        lastActive: s.lastActive,
        isCurrent: s.sessionId === req.user.sessionId
    }));

    res.json(sessions);
};
