const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

// Rate limiter specifically for the check-username endpoint
const checkUsernameLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 20, // Limit each IP to 20 requests per `window`
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next) => {
        next(new ApiError(429, 'Too many username checks from this IP, please try again after a minute.'));
    }
});

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute window
    max: 3, // Limit each IP/User to 3 requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Tie limit to authenticated user ID if available, otherwise fallback to IP
        return req.user ? req.user._id.toString() : (req.headers['x-forwarded-for'] || req.socket.remoteAddress);
    },
    handler: (req, res, next) => {
        next(new ApiError(429, 'Too many security codes requested. Please try again after 15 minutes.'));
    }
});

// Rate limiter for the global search endpoint — prevents DB hammering on every keystroke
const searchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,             // 30 searches per minute per IP is plenty for a human
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
        next(new ApiError(429, 'Too many search requests. Please slow down.'));
    }
});

module.exports = {
    checkUsernameLimiter,
    otpLimiter,
    searchLimiter
};
