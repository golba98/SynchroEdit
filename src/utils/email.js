require('dotenv').config();
const nodemailer = require('nodemailer');
const https = require('https');
const crypto = require('crypto');

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const EMAIL_VERIFICATION_ENABLED = process.env.ENABLE_EMAIL_VERIFICATION !== 'false';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const logger = require('./logger');

// Setup SMTP Transporter (Fallback)
let transporter = null;
if (!RESEND_API_KEY) {
  const isGmail = SMTP_HOST.includes('gmail');
  const port = isGmail ? 465 : SMTP_PORT; // Prefer 465 for Gmail

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: port,
    secure: port === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    connectionTimeout: 10000, // Fail faster (10s)
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
}

async function sendViaResend(email, html, subject) {
  return new Promise((resolve, reject) => {
    logger.debug(`Resend Request Details - From: ${SMTP_FROM}, To: ${email}, Subject: ${subject}`);
    const data = JSON.stringify({
      from: SMTP_FROM,
      to: [email],
      subject: subject,
      html: html,
    });

    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          logger.info('Email sent successfully via Resend API');
          resolve(true);
        } else {
          logger.error(`Resend API Error (${res.statusCode}):`, { responseBody });
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      logger.error('Resend Request Error:', error);
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

async function sendVerificationEmail(email, code) {
  // Only log the code in development mode
  if (process.env.NODE_ENV !== 'production') {
    console.log('=================================================');
    console.log(` TO: ${email}`);
    console.log(` VERIFICATION CODE: ${code}`);
    console.log('=================================================');
    logger.info(`DEV MODE: Verification code for ${email} is ${code}`);
  }

  if (!EMAIL_VERIFICATION_ENABLED) {
    logger.info('Email verification disabled; skipping send.');
    return true;
  }

  logger.info(`Attempting to send verification email to ${email}`);

  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; border-radius: 8px;">
            <h2 style="color: #8b5cf6; text-align: center;">SynchroEdit</h2>
            <p style="color: #333; font-size: 16px;">Welcome to SynchroEdit!</p>
            <p style="color: #666; font-size: 14px;">Your email verification code is:</p>
            <div style="text-align: center; margin: 30px 0;">
                <div style="font-size: 36px; font-weight: bold; color: #8b5cf6; letter-spacing: 8px; background: #fff; padding: 20px; border-radius: 8px; border: 2px solid #8b5cf6;">
                    ${code}
                </div>
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
            <p style="color: #999; font-size: 12px; text-align: center;">If you didn't sign up for SynchroEdit, please ignore this email.</p>
        </div>
    `;

  // 1. Try Resend if configured (Recommended for Cloud)
  if (RESEND_API_KEY) {
    logger.info('Using Resend API for delivery...');
    return await sendViaResend(email, html, 'SynchroEdit - Verification Code');
  }

  // 2. Fallback to SMTP
  if (!SMTP_USER || !SMTP_PASS) {
    logger.warn(
      'Email configuration missing: SMTP_USER/PASS not set. returning TRUE for DEV mode.'
    );
    return true; // Return true so the user can verify using the console log
  }

  logger.info(`Using SMTP (Host: ${SMTP_HOST})`);
  try {
    await transporter.sendMail({
      from: `"SynchroEdit" <${SMTP_FROM}>`,
      to: email,
      subject: 'SynchroEdit - Email Verification Code',
      html,
    });
    logger.info('Email sent via SMTP');
    return true;
  } catch (err) {
    logger.error(
      `SMTP sending failed. If you are on a cloud provider (like Render), SMTP ports may be blocked. Consider using RESEND_API_KEY. Error: ${err.message}`
    );
    // In dev, we still want to allow signup if SMTP fails but we logged the code
    return true;
  }
}

async function sendPasswordResetEmail(email, resetUrl) {
  if (process.env.NODE_ENV !== 'production') {
    logger.info(`DEV MODE: Password reset link for ${email}: ${resetUrl}`);
  }

  logger.info(`Attempting to send password reset email to ${email}`);

  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; border-radius: 8px;">
            <h2 style="color: #8b5cf6; text-align: center;">SynchroEdit</h2>
            <p style="color: #333; font-size: 16px;">Password Reset Request</p>
            <p style="color: #666; font-size: 14px;">We received a request to reset your password. Click the button below to proceed:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #8b5cf6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #666; font-size: 14px;">This link is valid for 10 minutes.</p>
            <p style="color: #999; font-size: 12px; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
        </div>
    `;

  if (RESEND_API_KEY) {
    return await sendViaResend(email, html, 'SynchroEdit - Password Reset');
  }

  if (!SMTP_USER || !SMTP_PASS) {
    logger.warn('SMTP config missing. Returning TRUE for DEV.');
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"SynchroEdit" <${SMTP_FROM}>`,
      to: email,
      subject: 'SynchroEdit - Password Reset',
      html,
    });
    return true;
  } catch (err) {
    logger.error(`SMTP Reset Password Failed: ${err.message}`);
    return true;
  }
}

async function sendPasswordChangedEmail(email) {
  logger.info(`Sending password change alert to ${email}`);

  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff0f0; border-radius: 8px; border: 1px solid #ffcccc;">
          <h2 style="color: #d32f2f; text-align: center;">Security Alert</h2>
          <p style="color: #333; font-size: 16px;">Your password for <strong>SynchroEdit</strong> was just changed.</p>
          <p style="color: #555; font-size: 14px;">If you performed this action, you can safely delete this email.</p>
          <p style="color: #d32f2f; font-weight: bold; font-size: 14px;">If you did NOT change your password, please contact support immediately and recover your account.</p>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">Timestamp: ${new Date().toUTCString()}</p>
      </div>
  `;

  if (RESEND_API_KEY) {
    return await sendViaResend(email, html, 'Security Alert: Password Changed');
  }

  if (!SMTP_USER || !SMTP_PASS) {
    logger.info('DEV MODE: Password change alert simulated.');
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"SynchroEdit Security" <${SMTP_FROM}>`,
      to: email,
      subject: 'Security Alert: Password Changed',
      html,
    });
    return true;
  } catch (err) {
    logger.error(`Failed to send password change alert: ${err.message}`);
    // Don't block the flow if alert fails, but log it critical
    return false;
  }
}

function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  generateVerificationCode,
};
