const User = require('../models/User');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

exports.getProfile = async (req, res, next) => {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return next(new AppError('User not found', 404));
    res.json(user);
};

exports.updateProfile = async (req, res, next) => {
    const { profilePicture } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return next(new AppError('User not found', 404));

    if (profilePicture !== undefined) user.profilePicture = profilePicture;
    await user.save();

    logger.info(`Profile updated for user: ${req.user.id}`);
    res.json({ message: 'Profile updated successfully', profilePicture: user.profilePicture });
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

