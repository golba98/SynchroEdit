require('dotenv').config();
const nodemailer = require('nodemailer');
const https = require('https');

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const EMAIL_VERIFICATION_ENABLED = process.env.ENABLE_EMAIL_VERIFICATION !== 'false';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

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
            pass: SMTP_PASS
        },
        connectionTimeout: 10000, // Fail faster (10s)
        greetingTimeout: 10000,
        socketTimeout: 10000
    });
}

async function sendViaResend(email, html, subject) {
    return new Promise((resolve, reject) => {
        console.log(`Resend Request Details - From: ${SMTP_FROM}, To: ${email}, Subject: ${subject}`);
        const data = JSON.stringify({
            from: SMTP_FROM,
            to: [email],
            subject: subject,
            html: html
        });

        const options = {
            hostname: 'api.resend.com',
            path: '/emails',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log('Email sent successfully via Resend API');
                    resolve(true);
                } else {
                    console.error(`Resend API Error (${res.statusCode}):`, responseBody);
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.error('Resend Request Error:', error);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

async function sendVerificationEmail(email, code) {
    if (!EMAIL_VERIFICATION_ENABLED) {
        console.log('Email verification disabled; skipping send.');
        return true;
    }
    
    console.log(`Attempting to send verification email to ${email}`);

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
        console.log('Using Resend API for delivery...');
        return await sendViaResend(email, html, 'SynchroEdit - Verification Code');
    }

    // 2. Fallback to SMTP
    if (!SMTP_USER || !SMTP_PASS) {
        console.error('Email configuration missing: SMTP_USER/PASS not set and RESEND_API_KEY not found.');
        return false;
    }

    console.log(`Using SMTP (Host: ${SMTP_HOST})`);
    try {
        await transporter.sendMail({
            from: `"SynchroEdit" <${SMTP_FROM}>`,
            to: email,
            subject: 'SynchroEdit - Email Verification Code',
            html
        });
        console.log('Email sent via SMTP');
        return true;
    } catch (err) {
        console.error(`SMTP sending failed. If you are on a cloud provider (like Render), SMTP ports may be blocked. Consider using RESEND_API_KEY. Error:`, err.message);
        return false;
    }
}

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = {
    sendVerificationEmail,
    generateVerificationCode
};