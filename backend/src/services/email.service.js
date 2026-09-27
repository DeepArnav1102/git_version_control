const transporter = require('../config/email.config');
const logger = require('../utils/logger');

const FROM_EMAIL = process.env.EMAIL_FROM || process.env.SMTP_USER || 'vcs-auth@example.com';

/**
 * Sends a 6-digit OTP for email verification during registration.
 */
const sendVerificationEmail = async (toEmail, otpCode) => {
    try {
        await transporter.sendMail({
            from: FROM_EMAIL,
            to: toEmail,
            subject: 'Verify your email address',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #333;">Welcome to VCS Auth!</h2>
                    <p style="color: #555;">Please use the following 6-digit code to verify your email address. This code will expire in 15 minutes.</p>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 4px; margin: 20px 0;">
                        ${otpCode}
                    </div>
                    <p style="color: #555; font-size: 12px;">If you did not request this, please ignore this email.</p>
                </div>
            `,
        });
        logger.info(`Verification email sent to ${toEmail}`);
    } catch (error) {
        logger.error(`Failed to send verification email to ${toEmail}: ${error.message}`);
        throw error;
    }
};

/**
 * Sends a 6-digit OTP for password reset.
 */
const sendPasswordResetEmail = async (toEmail, otpCode) => {
    try {
        await transporter.sendMail({
            from: FROM_EMAIL,
            to: toEmail,
            subject: 'Reset your password',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #333;">Password Reset Request</h2>
                    <p style="color: #555;">We received a request to reset your password. Use the following 6-digit code to reset it. This code will expire in 15 minutes.</p>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 4px; margin: 20px 0;">
                        ${otpCode}
                    </div>
                    <p style="color: #d9534f; font-weight: bold;">If you did not request a password reset, please secure your account immediately.</p>
                </div>
            `,
        });
        logger.info(`Password reset email sent to ${toEmail}`);
    } catch (error) {
        logger.error(`Failed to send password reset email to ${toEmail}: ${error.message}`);
        throw error;
    }
};

/**
 * Sends a 6-digit OTP for Step-Up Authentication (e.g., generating a PAT).
 */
const sendPatSecurityCodeEmail = async (toEmail, otpCode) => {
    try {
        await transporter.sendMail({
            from: FROM_EMAIL,
            to: toEmail,
            subject: 'Security Alert: PAT Generation Requested',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #333;">Action Required</h2>
                    <p style="color: #555;">You requested to generate or modify a Personal Access Token (PAT). Please use the following 6-digit security code to proceed.</p>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 4px; margin: 20px 0;">
                        ${otpCode}
                    </div>
                    <p style="color: #d9534f; font-weight: bold;">If you did not initiate this action, someone may have compromised your session.</p>
                </div>
            `,
        });
        logger.info(`PAT security code email sent to ${toEmail}`);
    } catch (error) {
        logger.error(`Failed to send PAT security code email to ${toEmail}: ${error.message}`);
        throw error;
    }
};

const sendRepoDeleteEmail = async (toEmail, otpCode) => {
    try {
        await transporter.sendMail({
            from: FROM_EMAIL,
            to: toEmail,
            subject: 'Security Alert: Repository Deletion Requested',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #333;">Action Required</h2>
                    <p style="color: #555;">You requested to permanently delete a repository. Please use the following 6-digit security code to proceed. This action cannot be undone.</p>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 4px; margin: 20px 0;">
                        ${otpCode}
                    </div>
                    <p style="color: #d9534f; font-weight: bold;">If you did not initiate this action, please secure your account immediately.</p>
                </div>
            `,
        });
        logger.info(`Repo deletion security code email sent to ${toEmail}`);
    } catch (error) {
        logger.error(`Failed to send Repo deletion email to ${toEmail}: ${error.message}`);
        throw error;
    }
};

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendPatSecurityCodeEmail,
    sendRepoDeleteEmail,
};
