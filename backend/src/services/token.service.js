const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Token = require('../models/Token.model');
const ApiError = require('../utils/ApiError');

/**
 * Creates the unique signing key for a user (Salt + Pepper).
 * This key is used to sign and verify JWT Access Tokens.
 * 
 * @param {string} userSalt - The unique 16-byte hex salt from the User document.
 * @returns {string} The sha256 hash of the system pepper and user salt.
 * @throws {Error} If the JWT_PEPPER_SECRET environment variable is missing.
 */
const getJwtSecret = (userSalt) => {
    const pepper = process.env.JWT_PEPPER_SECRET || 'rusty_jwt_pepper_secret_fallback_key';
    return crypto.createHash('sha256').update(pepper + userSalt).digest('hex');
};

/**
 * Generates a signed Access Token (JWT) and an opaque Refresh Token.
 * The Refresh Token is hashed and stored in the database.
 * 
 * @async
 * @param {Object} user - The Mongoose User document.
 * @returns {Promise<{accessToken: string, refreshToken: string}>} The generated tokens.
 */
const generateAuthTokens = async (user) => {
    const secret = getJwtSecret(user.securitySalt);
    const accessToken = jwt.sign(
        { userId: user._id, email: user.email },
        secret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 6); // 6 months

    await Token.create({
        userId: user._id,
        type: 'REFRESH_TOKEN',
        tokenHash: refreshTokenHash,
        expiresAt,
    });

    return { accessToken, refreshToken };
};

/**
 * Generates a Personal Access Token (PAT) for CLI usage.
 * The raw token is returned exactly once, while only the sha256 hash is stored in the DB.
 * 
 * @async
 * @param {mongoose.Types.ObjectId} userId - The ID of the user creating the PAT.
 * @param {string} name - A descriptive name for the PAT (e.g., "MacBook CLI").
 * @returns {Promise<string>} The raw PAT string prefixed with "git_pat_".
 */
const generatePersonalAccessToken = async (userId, name) => {
    const rawToken = 'git_pat_' + crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 100); // 100 years (effectively never expires unless revoked)

    await Token.create({
        userId,
        type: 'PERSONAL_ACCESS_TOKEN',
        tokenHash,
        name,
        expiresAt,
        lastUsedAt: new Date(),
    });

    return rawToken;
};

/**
 * Verifies a JWT Access Token securely using the dynamic Salt + Pepper key.
 * 
 * @param {string} token - The raw JWT string from the Bearer header.
 * @param {string} userSalt - The user's specific security salt.
 * @returns {Object} The decoded JWT payload.
 * @throws {ApiError} (401) If the token is forged, expired, or invalid.
 */
const verifyAccessToken = (token, userSalt) => {
    try {
        const secret = getJwtSecret(userSalt);
        return jwt.verify(token, secret);
    } catch (error) {
        throw new ApiError(401, 'Invalid or expired access token');
    }
};

module.exports = {
    generateAuthTokens,
    generatePersonalAccessToken,
    verifyAccessToken,
    getJwtSecret,
};
