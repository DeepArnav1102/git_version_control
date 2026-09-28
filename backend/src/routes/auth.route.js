const express = require('express');
const validate = require('../middlewares/validate.middleware');
const { 
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
} = require('../controllers/auth.controller');
const { 
    registerSchema, 
    loginSchema, 
    cliLoginSchema,
    verifyOtpSchema,
    forgotPasswordSchema,
    resetPasswordSchema
} = require('../validations/auth.validation');
const { otpLimiter } = require('../middlewares/rateLimit.middleware');
const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

// Strict limiter: 10 attempts per 15 minutes per IP — for login, register, refresh
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
        next(new ApiError(429, 'Too many attempts from this IP. Please try again in 15 minutes.'));
    }
});

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created, OTP sent
 */
router.post('/register', authLimiter, validate(registerSchema), register);

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Verify email with OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 */
router.post('/verify-email', validate(verifyOtpSchema), verifyEmail);

/**
 * @swagger
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: Resend verification OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP resent
 */
router.post('/resend-verification', otpLimiter, validate(forgotPasswordSchema), resendVerification);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/login', authLimiter, validate(loginSchema), login);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent
 */
router.post('/forgot-password', otpLimiter, validate(forgotPasswordSchema), forgotPassword);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password using OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

/**
 * @swagger
 * /api/v1/auth/google/callback:
 *   post:
 *     summary: Google OAuth 2.0 callback
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *               redirectUri:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully logged in via Google
 */
router.post('/google/callback', googleCallback);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh Access Token
 *     tags: [Auth]
 *     description: Requires a valid HttpOnly secure cookie containing the refreshToken
 *     responses:
 *       200:
 *         description: Returns a new accessToken
 */
router.post('/refresh', refresh);

/**
 * @swagger
 * /api/v1/auth/cli/login:
 *   post:
 *     summary: Login via CLI using a PAT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               pat:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully logged in, returns tokens
 */
router.post('/cli/login', validate(cliLoginSchema), cliLogin);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Successfully logged out
 */
router.post('/logout', logout);

module.exports = router;
