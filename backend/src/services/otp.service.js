const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const VerificationCode = require('../models/verificationCode.model');
const emailService = require('./email.service');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Generates a 6-digit OTP, hashes it, stores it, and sends the email.
 */
const generateAndSendOtp = async (user, purpose) => {
    // 1. Generate a secure 6-digit code
    const rawOtp = crypto.randomInt(100000, 999999).toString();

    // 2. Hash the OTP using bcrypt
    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(rawOtp, salt);

    // 3. Set expiration
    const expiresAt = new Date();
    const expirationMinutes = parseInt(process.env.OTP_EXPIRATION_MINUTES || '15', 10);
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    // 4. Save to database
    // Invalidate any existing active OTPs for the same user and purpose to prevent confusion
    await VerificationCode.updateMany(
        { userId: user._id, purpose, isUsed: false },
        { isUsed: true }
    );

    await VerificationCode.create({
        userId: user._id,
        email: user.email,
        codeHash,
        purpose,
        expiresAt,
    });

    // Always log in development for easy testing — NEVER in production
    if (process.env.NODE_ENV !== 'production') {
        logger.info(`🔑 [OTP DEV] Generated OTP for ${user.email}: ${rawOtp} (Purpose: ${purpose})`);
    }

    // 5. Trigger email based on purpose (catch email errors so local development is not blocked)
    try {
        if (purpose === 'REGISTRATION_VERIFY') {
            await emailService.sendVerificationEmail(user.email, rawOtp);
        } else if (purpose === 'PASSWORD_RESET') {
            await emailService.sendPasswordResetEmail(user.email, rawOtp);
        } else if (purpose === 'PAT_ACTION') {
            await emailService.sendPatSecurityCodeEmail(user.email, rawOtp);
        } else if (purpose === 'REPO_DELETE') {
            await emailService.sendRepoDeleteEmail(user.email, rawOtp);
        } else {
            logger.warn(`Unknown OTP purpose: ${purpose}`);
        }
    } catch (emailErr) {
        logger.warn(`Could not dispatch email to ${user.email} (${emailErr.message}). OTP is: ${rawOtp}`);
    }
};

/**
 * Verifies an OTP provided by the user.
 */
const verifyOtp = async (userId, inputOtp, purpose) => {
    // Find the most recent unused OTP for this purpose
    const otpDocs = await VerificationCode.find({
        userId,
        purpose,
        isUsed: false,
        expiresAt: { $gt: new Date() } // Ensure it's not expired
    }).sort({ createdAt: -1 });

    if (otpDocs.length === 0) {
        throw new ApiError(400, 'Invalid or expired OTP');
    }

    const otpDoc = otpDocs[0];

    // Check rate limit
    if (otpDoc.attempts >= otpDoc.maxAttempts) {
        otpDoc.isUsed = true; // Lock it out permanently
        await otpDoc.save();
        throw new ApiError(400, 'Too many failed attempts. Please request a new verification code.');
    }

    // Verify bcrypt hash securely
    const isMatch = await bcrypt.compare(inputOtp, otpDoc.codeHash);

    if (!isMatch) {
        // Increment attempts and save
        otpDoc.attempts += 1;
        await otpDoc.save();
        throw new ApiError(400, 'Invalid verification code');
    }

    // Success! Mark as used to prevent replay attacks
    otpDoc.isUsed = true;
    await otpDoc.save();

    return true;
};

module.exports = {
    generateAndSendOtp,
    verifyOtp,
};
