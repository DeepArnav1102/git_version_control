const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const { registerLocalUser, loginLocalUser, handleGoogleOAuth } = require('../services/auth.service');
const { generateAuthTokens } = require('../services/token.service');
const Token = require('../models/Token.model');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const User = require('../models/User.model');
const { generateAndSendOtp, verifyOtp } = require('../services/otp.service');

// Helper to set HttpOnly Secure cookie for Refresh Token
const setRefreshTokenCookie = (res, token) => {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 6 * 30 * 24 * 60 * 60 * 1000, // 6 months
    });
};


// Helper to keep only the most recent 5 active refresh tokens to prevent DB bloat
const cleanupOldSessions = async (userId) => {
    const activeTokens = await Token.find({ userId, type: 'REFRESH_TOKEN', isRevoked: false })
        .sort({ createdAt: -1 }); // Newest first

    if (activeTokens.length >= 5) {
        // Keep the 4 most recent ones (plus the 1 we are about to create = 5)
        const tokensToRevoke = activeTokens.slice(4).map(t => t._id);
        if (tokensToRevoke.length > 0) {
            await Token.updateMany(
                { _id: { $in: tokensToRevoke } },
                { $set: { isRevoked: true, expiresAt: new Date() } } // TTL index will delete them immediately
            );
        }
    }
};

// Helper to set HttpOnly Secure cookie for Access Token
const setAccessTokenCookie = (res, token) => {
    // We match the cookie maxAge to the JWT expiration (default 6h)
    // If JWT_EXPIRES_IN is '6h', it is 6 * 60 * 60 * 1000 ms.
    let maxAge = 6 * 60 * 60 * 1000; 
    if (process.env.JWT_EXPIRES_IN) {
        const match = process.env.JWT_EXPIRES_IN.match(/^(\d+)(h|m|d)$/);
        if (match) {
            const val = parseInt(match[1]);
            const unit = match[2];
            if (unit === 'm') maxAge = val * 60 * 1000;
            if (unit === 'h') maxAge = val * 60 * 60 * 1000;
            if (unit === 'd') maxAge = val * 24 * 60 * 60 * 1000;
        }
    }
    res.cookie('accessToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge,
    });
};

const register = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await registerLocalUser(email, password);

    // Dispatch Registration OTP
    await generateAndSendOtp(user, 'REGISTRATION_VERIFY');

    res.status(201).json({
        success: true,
        message: 'User created. Please check your email for the verification code.',
        data: { user: { id: user._id, email: user.email, username: user.username, isEmailVerified: user.isEmailVerified } }
    });
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await loginLocalUser(email, password);

    if (!user.isEmailVerified) {
        throw new ApiError(403, 'Email not verified. Please verify your email first.');
    }

    await cleanupOldSessions(user._id);

    const { accessToken, refreshToken } = await generateAuthTokens(user);

    setRefreshTokenCookie(res, refreshToken);
    setAccessTokenCookie(res, accessToken);

    res.status(200).json({
        success: true,
        message: 'Login successful',
        data: { user: { id: user._id, email: user.email, username: user.username, isEmailVerified: true } }
    });
});

const verifyEmail = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) throw new ApiError(404, 'User not found');
    if (user.isEmailVerified) throw new ApiError(400, 'Email is already verified');

    await verifyOtp(user._id, otp, 'REGISTRATION_VERIFY');

    user.isEmailVerified = true;
    await user.save({ validateModifiedOnly: true });

    await cleanupOldSessions(user._id);

    // Issue tokens after successful verification
    const { accessToken, refreshToken } = await generateAuthTokens(user);
    setRefreshTokenCookie(res, refreshToken);
    setAccessTokenCookie(res, accessToken);

    res.status(200).json({
        success: true,
        message: 'Email verified successfully. You are now logged in.',
        data: { user: { id: user._id, email: user.email, username: user.username, isEmailVerified: true } }
    });
});

const resendVerification = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) throw new ApiError(404, 'User not found');
    if (user.isEmailVerified) throw new ApiError(400, 'Email is already verified');

    await generateAndSendOtp(user, 'REGISTRATION_VERIFY');

    res.status(200).json({
        success: true,
        message: 'Verification code resent successfully'
    });
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Don't reveal if user exists or not for security, unless it's a social login error
    if (user) {
        if (user.googleId && !user.passwordHash) {
            throw new ApiError(400, 'This account uses Google Sign-In. Please log in with Google.');
        }
        await generateAndSendOtp(user, 'PASSWORD_RESET');
    }

    res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset code has been sent.'
    });
});

const resetPassword = asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) throw new ApiError(404, 'User not found');

    await verifyOtp(user._id, otp, 'PASSWORD_RESET');

    // Update password (pre-save hook hashes it)
    user.passwordHash = newPassword;
    await user.save();

    // Revoke all existing sessions globally!
    await user.invalidateAllSessions();

    res.status(200).json({
        success: true,
        message: 'Password reset successfully. All other sessions have been signed out. Please log in.'
    });
});

const googleCallback = asyncHandler(async (req, res) => {
    const { code, redirectUri } = req.body;
    if (!code || !redirectUri) {
        throw new ApiError(400, 'Missing code or redirectUri in payload');
    }

    const user = await handleGoogleOAuth(code, redirectUri);

    await cleanupOldSessions(user._id);

    const { accessToken, refreshToken } = await generateAuthTokens(user);

    setRefreshTokenCookie(res, refreshToken);
    setAccessTokenCookie(res, accessToken);

    res.status(200).json({
        success: true,
        message: 'Google login successful',
        data: { user: { id: user._id, email: user.email, username: user.username } }
    });
});

const refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.cookies;
    if (!refreshToken) throw new ApiError(401, 'No refresh token provided');

    // Hash the token from cookie to match DB
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const tokenDoc = await Token.findOne({ tokenHash, type: 'REFRESH_TOKEN' });

    if (!tokenDoc) throw new ApiError(401, 'Invalid refresh token');
    if (tokenDoc.expiresAt < new Date()) throw new ApiError(401, 'Refresh token expired');
    
    // If it's revoked but still within the 30-second grace window, allow the refresh
    // to proceed gracefully (handles race conditions from multiple browser tabs).
    // If it's revoked AND the grace period has passed, reject it as replayed/stolen.
    if (tokenDoc.isRevoked) {
        throw new ApiError(401, 'Refresh token has already been used or revoked');

    // If it's already revoked but hasn't expired yet (within the 30s grace period),
    // we allow the refresh to proceed to prevent race conditions with multiple tabs.
    // However, if the user was explicitly logged out or token family revoked, 
    // we could add additional checks here.
    if (tokenDoc.isRevoked && tokenDoc.expiresAt < new Date()) {
        throw new ApiError(401, 'Refresh token has already been used/revoked');
    }

    const user = await User.findById(tokenDoc.userId);
    if (!user) throw new ApiError(401, 'User no longer exists');

    // Instead of deleting the old refresh token immediately (which causes race conditions
    // with multiple tabs), we mark it as revoked and give it a short 30-second grace period 
    // by updating expiresAt. MongoDB's TTL index will clean it up automatically.
    tokenDoc.isRevoked = true;
    tokenDoc.expiresAt = new Date(Date.now() + 30 * 1000); // 30 seconds
    await tokenDoc.save();

    const { accessToken, refreshToken: newRefreshToken } = await generateAuthTokens(user);
    setRefreshTokenCookie(res, newRefreshToken);
    setAccessTokenCookie(res, accessToken);

    res.status(200).json({
        success: true,
        message: 'Session refreshed successfully'
    });
});

const cliLogin = asyncHandler(async (req, res) => {
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    const pat = (req.body.pat || req.body.token)?.trim();

    if (!email || !pat) {
        throw new ApiError(400, 'Email and Personal Access Token (PAT) are required');
    }

    const user = await User.findOne({ email });
    if (!user) throw new ApiError(401, 'Invalid credentials');

    // Verify PAT
    const tokenHash = crypto.createHash('sha256').update(pat).digest('hex');
    const patDoc = await Token.findOne({
        tokenHash,
        userId: user._id,
        type: 'PERSONAL_ACCESS_TOKEN',
        isRevoked: false
    });

    if (!patDoc) throw new ApiError(401, 'Invalid PAT or credentials');

    if (patDoc.expiresAt && patDoc.expiresAt < new Date()) {
        throw new ApiError(401, 'Personal Access Token has expired');
    }

    // Fire-and-forget lastUsedAt update
    patDoc.constructor.updateOne({ _id: patDoc._id }, { $set: { lastUsedAt: new Date() } }).exec().catch(() => {});

    // Return success to the CLI app, confirming the PAT is valid
    res.status(200).json({
        success: true,
        message: 'CLI Login verified successfully',
        data: { user: { id: user._id, email: user.email, username: user.username } }
    });
});

const logout = asyncHandler(async (req, res) => {
    const { refreshToken: existingToken, accessToken } = req.cookies;
    if (existingToken) {
        const tokenHash = crypto.createHash('sha256').update(existingToken).digest('hex');
        await Token.deleteOne({ tokenHash, type: 'REFRESH_TOKEN' });
    }



    res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict'
    });
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict'
    });

    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
});

module.exports = {
    register,
    login,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    googleCallback,
    refresh,
    cliLogin,
    logout
};
