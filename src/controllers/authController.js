const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { sendVerificationEmail, generateVerificationCode } = require('../utils/email');

const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_VERIFICATION_ENABLED = process.env.ENABLE_EMAIL_VERIFICATION !== 'false';

exports.signup = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            console.error('Database not connected. Current state:', mongoose.connection.readyState);
            return res.status(500).json({ message: 'Database connection error. Please check server logs.' });
        }

        let { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Please provide username, email, and password' });
        }

        username = username.trim();
        email = email.trim().toLowerCase();

        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            if (!existingUser.isEmailVerified && existingUser.email === email) {
                if (!EMAIL_VERIFICATION_ENABLED) {
                    existingUser.isEmailVerified = true;
                    existingUser.verificationCode = null;
                    existingUser.verificationCodeExpires = null;
                    await existingUser.save();
                    const token = jwt.sign({ id: existingUser._id, username: existingUser.username }, JWT_SECRET, { expiresIn: '24h' });
                    return res.status(200).json({ token, username: existingUser.username, email: existingUser.email, message: 'Signup successful (verification disabled).' });
                }

                const verificationCode = generateVerificationCode();
                existingUser.verificationCode = verificationCode;
                existingUser.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
                await existingUser.save();

                const emailSent = await sendVerificationEmail(email, verificationCode);
                if (!emailSent) {
                    return res.status(500).json({ message: 'Failed to send verification email' });
                }

                const token = jwt.sign({ id: existingUser._id, username: existingUser.username }, JWT_SECRET, { expiresIn: '24h' });

                return res.status(200).json({
                    token,
                    username: existingUser.username,
                    email: existingUser.email,
                    message: 'Verification code resent. Please check your email.'
                });
            }
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        const verificationCode = generateVerificationCode();
        const user = new User({ 
            username, 
            email, 
            password,
            verificationCode: EMAIL_VERIFICATION_ENABLED ? verificationCode : null,
            verificationCodeExpires: EMAIL_VERIFICATION_ENABLED ? new Date(Date.now() + 10 * 60 * 1000) : null,
            isEmailVerified: !EMAIL_VERIFICATION_ENABLED
        });
        await user.save();

        let token;
        if (EMAIL_VERIFICATION_ENABLED) {
            const emailSent = await sendVerificationEmail(email, verificationCode);
            if (!emailSent) {
                await User.deleteOne({ _id: user._id });
                return res.status(500).json({ message: 'Failed to send verification email' });
            }
            token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
            res.status(201).json({ 
                token, 
                username: user.username,
                email: user.email,
                message: 'Signup successful! Check your email for verification code.'
            });
        } else {
            token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
            res.status(201).json({ 
                token, 
                username: user.username,
                email: user.email,
                message: 'Signup successful (verification disabled).' 
            });
        }
    } catch (err) {
        console.error('Signup error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }
        res.status(500).json({ message: err.message || 'Error creating user' });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { email, verificationCode } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'User not found' });

        if (!EMAIL_VERIFICATION_ENABLED) {
            user.isEmailVerified = true;
            user.verificationCode = null;
            user.verificationCodeExpires = null;
            await user.save();
            const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
            return res.status(200).json({ message: 'Verification disabled; user marked verified.', token, username: user.username });
        }

        if (user.isEmailVerified) {
            const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
            return res.status(200).json({ message: 'Email already verified', token, username: user.username });
        }

        if (!user.verificationCode || user.verificationCode !== verificationCode) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        if (new Date() > user.verificationCodeExpires) {
            return res.status(400).json({ message: 'Verification code expired' });
        }

        user.isEmailVerified = true;
        user.verificationCode = null;
        user.verificationCodeExpires = null;
        await user.save();

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ message: 'Email verified successfully', token, username: user.username });
    } catch (err) {
        console.error('Verification error:', err);
        res.status(500).json({ message: 'Error verifying email' });
    }
};

exports.resendCode = async (req, res) => {
    try {
        if (!EMAIL_VERIFICATION_ENABLED) {
            return res.status(200).json({ message: 'Verification disabled; no code sent.' });
        }

        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'User not found' });

        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }

        const verificationCode = generateVerificationCode();
        user.verificationCode = verificationCode;
        user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        const emailSent = await sendVerificationEmail(email, verificationCode);
        if (!emailSent) {
            return res.status(500).json({ message: 'Failed to send email' });
        }

        res.json({ message: 'Verification code resent' });
    } catch (err) {
        console.error('Resend error:', err);
        res.status(500).json({ message: 'Error resending code' });
    }
};

exports.login = async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ message: 'Database connection error' });
        }

        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ message: 'Invalid username or password' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid username or password' });

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

                sendVerificationEmail(user.email, verificationCode).catch(err => {
                    console.error('Deferred verification email failed:', err);
                });

                return res.status(403).json({ 
                    message: 'Email not verified. We just sent a fresh code.',
                    requiresVerification: true,
                    email: user.email,
                    username: user.username
                });
            }
        }

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, username: user.username });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: err.message || 'Login error' });
    }
};
