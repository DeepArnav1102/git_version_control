const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../services/token.service');

const protect = asyncHandler(async (req, res, next) => {
    let token;
    
    // 1. Extract token from HttpOnly cookie (Web Flow)
    if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
    }
    // 2. Fallback to Bearer header or X-Rusty-Token (CLI Flow & PATs)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    else if (req.headers['x-rusty-token']) {
        token = req.headers['x-rusty-token'];
    }
    
    if (!token) {
        throw new ApiError(401, 'Not authorized, no token provided');
    }

    try {
        // 3. Handle Personal Access Token (PAT) Flow
        if (token.startsWith('git_pat_')) {
            const crypto = require('crypto');
            const Token = require('../models/Token.model');
            
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const patDoc = await Token.findOne({ 
                tokenHash, 
                type: 'PERSONAL_ACCESS_TOKEN', 
                isRevoked: false 
            });

            if (!patDoc) {
                throw new ApiError(401, 'Invalid or revoked Personal Access Token');
            }

            // Fire-and-forget lastUsedAt update — avoids blocking the request on a DB write
            patDoc.constructor.updateOne({ _id: patDoc._id }, { $set: { lastUsedAt: new Date() } }).exec().catch(() => {});

            const user = await User.findById(patDoc.userId).select('-passwordHash -securitySalt');
            if (!user) throw new ApiError(401, 'User belonging to this token no longer exists');

            req.user = user;
            return next();
        }

        // 4. Handle standard JWT Flow (Web Sessions)
        // Decode the token without verifying signature first to extract the userId
        const decoded = jwt.decode(token);
        
        if (!decoded || !decoded.userId) {
            throw new ApiError(401, 'Invalid token payload');
        }

        // Fetch the user from the database to get their unique securitySalt
        const user = await User.findById(decoded.userId);
        if (!user) {
            throw new ApiError(401, 'User belonging to this token no longer exists');
        }

        // Verify the token securely using the system pepper + user's specific salt
        // This will throw if the token is forged, expired, or if the user's salt changed
        verifyAccessToken(token, user.securitySalt);

        // Attach user to request for downstream handlers
        req.user = user;
        next();
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(401, 'Not authorized, token validation failed');
    }
});
const protectOptional = asyncHandler(async (req, res, next) => {
    let token;
    
    if (req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
    }
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    else if (req.headers['x-rusty-token']) {
        token = req.headers['x-rusty-token'];
    }
    
    if (!token) {
        return next();
    }

    try {
        if (token.startsWith('git_pat_')) {
            const crypto = require('crypto');
            const Token = require('../models/Token.model');
            
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const patDoc = await Token.findOne({ 
                tokenHash, 
                type: 'PERSONAL_ACCESS_TOKEN', 
                isRevoked: false 
            });

            if (patDoc) {
                const user = await User.findById(patDoc.userId).select('-passwordHash -securitySalt');
                if (user) req.user = user;
            }
            return next();
        }

        const decoded = jwt.decode(token);
        if (decoded && decoded.userId) {
            const user = await User.findById(decoded.userId);
            if (user) {
                try {
                    verifyAccessToken(token, user.securitySalt);
                    req.user = user;
                } catch (err) {
                    // Ignore token validation failure in optional auth
                }
            }
        }
        next();
    } catch (error) {
        next(); // Ignore errors in optional auth
    }
});

module.exports = { protect, protectOptional };
