const express = require('express');
const { protect, protectOptional } = require('../middlewares/auth.middleware');
const { checkUsernameLimiter } = require('../middlewares/rateLimit.middleware');
const validate = require('../middlewares/validate.middleware');
const {
    getMe,
    checkUsername,
    updateOnboarding,
    updateProfile,
    updateDashboardCard,
    searchUsers,
    getPublicProfile,
    updatePinnedRepos,
    getUserContributions,
    toggleFollowUser,
} = require('../controllers/user.controller');

const {
    checkUsernameSchema,
    onboardingSchema,
    updateProfileSchema,
    updateDashboardCardSchema,
} = require('../validations/user.validation');

const router = express.Router();

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile returned
 *       401:
 *         description: Not authorized
 */
router.get('/me', protect, getMe);

/**
 * @swagger
 * /api/v1/users/check-username:
 *   get:
 *     summary: Check if a username is available
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Username to check
 *     responses:
 *       200:
 *         description: Availability status returned
 *       429:
 *         description: Too many requests
 */
router.get('/check-username', checkUsernameLimiter, validate(checkUsernameSchema), checkUsername);

/**
 * @swagger
 * /api/v1/users/search:
 *   get:
 *     summary: Search users using Atlas Search (Lucene)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Search term (name, username)
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', protectOptional, searchUsers);

/**
 * @swagger
 * /api/v1/users/onboarding:
 *   patch:
 *     summary: Submit initial onboarding profile data
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - username
 *             properties:
 *               name:
 *                 type: string
 *               username:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
 *       409:
 *         description: Username already taken (returns suggestions)
 */
router.patch('/onboarding', protect, validate(onboardingSchema), updateOnboarding);

/**
 * @swagger
 * /api/v1/users/profile:
 *   patch:
 *     summary: Dynamically update user profile fields
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               username:
 *                 type: string
 *               bio:
 *                 type: string
 *               gender:
 *                 type: string
 *               profilePicture:
 *                 type: string
 *               organization:
 *                 type: string
 *               location:
 *                 type: object
 *                 properties:
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   country:
 *                     type: string
 *               localTime:
 *                 type: string
 *               socialLinks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     platform:
 *                       type: string
 *                     url:
 *                       type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.patch('/profile', protect, validate(updateProfileSchema), updateProfile);

const { uploadProfilePicture } = require('../config/cloudinary.config');
const { uploadProfilePhoto } = require('../controllers/user.controller');

/**
 * @swagger
 * /api/v1/users/profile-picture:
 *   put:
 *     summary: Upload and update user profile picture
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture updated successfully
 */
router.put('/profile-picture', protect, uploadProfilePicture.single('profilePicture'), uploadProfilePhoto);

/**
 * @swagger
 * /api/v1/users/dashboard-card:
 *   patch:
 *     summary: Update dashboard card avatar and color preferences
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               avatarKey:
 *                 type: string
 *                 enum: [boyAvatar1, boyAvatar2, boyAvatar3, girlAvatar1, girlAvatar2, girlAvatar3]
 *               cardColor:
 *                 type: string
 *                 example: '#6d28d9'
 *     responses:
 *       200:
 *         description: Dashboard card updated successfully
 */
router.patch('/dashboard-card', protect, validate(updateDashboardCardSchema), updateDashboardCard);

/**
 * @swagger
 * /api/v1/users/u/{username}:
 *   get:
 *     summary: Get public profile of a user by username
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: User profile returned
 *       404:
 *         description: User not found
 */
router.get('/u/:username', protectOptional, getPublicProfile);

/**
 * @swagger
 * /api/v1/users/pinned:
 *   put:
 *     summary: Update pinned repositories for current user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pinnedRepos
 *             properties:
 *               pinnedRepos:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Pinned repositories updated
 */
router.put('/pinned', protect, updatePinnedRepos);

/**
 * @swagger
 * /api/v1/users/u/{username}/contributions:
 *   get:
 *     summary: Get contribution heatmap data for a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Heatmap data
 */
router.get('/u/:username/contributions', getUserContributions);

/**
 * @swagger
 * /api/v1/users/u/{username}/follow:
 *   post:
 *     summary: Toggle follow/unfollow a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully toggled follow
 */
router.post('/u/:username/follow', protect, toggleFollowUser);

module.exports = router;
