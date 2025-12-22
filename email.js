
const nodemailer = require('nodemailer');

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const EMAIL_VERIFICATION_ENABLED = process.env.ENABLE_EMAIL_VERIFICATION !== 'false';


// Setup email transporter
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
    },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    tls: {
        rejectUnauthorized: false
    }
});

async function sendVerificationEmail(email, code) {
    if (!EMAIL_VERIFICATION_ENABLED) {
        console.log('Email verification disabled; skipping send.');
        return true;
    }
    console.log(`Attempting to send email to: ${email}`);
    console.log(`Verification Code: ${code}`);
    console.log(`SMTP Config: Host=${SMTP_HOST}, Port=${SMTP_PORT}, Secure=${SMTP_SECURE}, User=${SMTP_USER ? SMTP_USER.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Not Set'}`);

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

    if (!SMTP_USER || !SMTP_PASS) {
        console.error('Email configuration missing: SMTP_USER or SMTP_PASS is not defined.');
        return false;
    }

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
        console.error(`SMTP email sending error to ${email} with code ${code}. Please check your SMTP credentials and configuration in the .env file. Full error: `, err);
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
