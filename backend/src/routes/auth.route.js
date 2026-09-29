const express = require('express');
const validate = require('../middlewares/validate.middleware');
const {
    registerSchema,
    loginSchema,
    cliLoginSchema,
    verifyOtpSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
} = require('../validations/auth.validation');
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
    logout,
} = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const { otpLimiter } = require('../middlewares/rateLimit.middleware');

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user with email and password
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
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully, verification email sent
 *       409:
 *         description: User already exists
 */
router.post('/register', validate(registerSchema), register);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Log in with email and password
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
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, tokens set in cookies
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified
 */
router.post('/login', validate(loginSchema), login);

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Verify email address with OTP
 *     tags: [Auth]
 */
router.post('/verify-email', validate(verifyOtpSchema), verifyEmail);

/**
 * @swagger
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: Resend email verification OTP
 *     tags: [Auth]
 */
router.post('/resend-verification', otpLimiter, resendVerification);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request a password reset OTP
 *     tags: [Auth]
 */
router.post('/forgot-password', otpLimiter, validate(forgotPasswordSchema), forgotPassword);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password using OTP
 *     tags: [Auth]
 */
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

/**
 * @swagger
 * /api/v1/auth/google/callback:
 *   post:
 *     summary: Exchange Google OAuth code for tokens
 *     tags: [Auth]
 */
router.post('/google/callback', googleCallback);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh the access token using the refresh token cookie
 *     tags: [Auth]
 */
router.post('/refresh', refresh);

/**
 * @swagger
 * /api/v1/auth/cli/login:
 *   post:
 *     summary: Verify CLI login using email and PAT
 *     tags: [Auth]
 */
router.post('/cli/login', validate(cliLoginSchema), cliLogin);

/**
 * @swagger
 * /api/v1/auth/cli-login:
 *   post:
 *     summary: Verify CLI login using email and PAT
 *     tags: [Auth]
 */
router.post('/cli-login', validate(cliLoginSchema), cliLogin);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Log out the current user
 *     tags: [Auth]
 */
router.post('/logout', protect, logout);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current authenticated user info
 *     tags: [Auth]
 */
router.get('/me', protect, (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            user: {
                id: req.user._id,
                email: req.user.email,
                username: req.user.username,
                isEmailVerified: req.user.isEmailVerified,
            },
        },
    });
});

module.exports = router;
