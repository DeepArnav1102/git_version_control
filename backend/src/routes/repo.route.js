const express = require('express');
const { protect, protectOptional } = require('../middlewares/auth.middleware');
const {
    checkRepoAvailability,
    createRepo,
    updateRepo,
    getUserRepos,
    getReposByUsername,
    getRepoDetails,
    getRepoTree,
    getRepoBlob,
    getRepoCommits,
    checkObjectExists,
    storeObject,
    updateRef,
    getRemoteRef,
    getRemoteRefs,
    deleteRemoteRef,
    getObject,
    requestDeleteOtp,
    deleteRepo,
    toggleStarRepo,
    forkRepo,
    syncRepo,
    deleteRepoFile,
    downloadRepoZip,
    inviteCollaborator,
    acceptInvite,
    removeCollaborator,
} = require('../controllers/repo.controller');
const { otpLimiter } = require('../middlewares/rateLimit.middleware');

const router = express.Router();

// ─── Web API ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/repos:
 *   post:
 *     summary: Create a new repository
 *     tags: [Repositories]
 */
router.get('/check-availability', protect, checkRepoAvailability);
router.post('/', protect, createRepo);

/**
 * @swagger
 * /api/v1/repos:
 *   get:
 *     summary: Get repositories for the authenticated user
 *     tags: [Repositories]
 */
router.get('/', protect, getUserRepos);

/**
 * @swagger
 * /api/v1/repos/user/{username}:
 *   get:
 *     summary: Get repositories for a specific user
 *     tags: [Repositories]
 */
router.get('/user/:username', protectOptional, getReposByUsername);

// ─── Single Repo Routes ───────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}:
 *   get:
 *     summary: Get repository details
 *     tags: [Repositories]
 */
router.get('/:owner/:repo', protectOptional, getRepoDetails);

router.post('/:owner/:repo/collaborators/invite', protect, inviteCollaborator);
router.post('/:owner/:repo/collaborators/accept', protect, acceptInvite);
router.delete('/:owner/:repo/collaborators/:userId', protect, removeCollaborator);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}:
 *   patch:
 *     summary: Update repository details
 *     tags: [Repositories]
 */
router.patch('/:owner/:repo', protect, updateRepo);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/star:
 *   post:
 *     summary: Toggle star on a repository
 *     tags: [Repositories]
 */
router.post('/:owner/:repo/star', protect, toggleStarRepo);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/request-delete-otp:
 *   post:
 *     summary: Request OTP to delete repository
 *     tags: [Repositories]
 */
router.post('/:owner/:repo/request-delete-otp', otpLimiter, protect, requestDeleteOtp);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}:
 *   delete:
 *     summary: Delete a repository
 *     tags: [Repositories]
 */
router.delete('/:owner/:repo', protect, deleteRepo);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/fork:
 *   post:
 *     summary: Fork a repository
 *     tags: [Repositories]
 */
router.post('/:owner/:repo/fork', protect, forkRepo);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/sync:
 *   post:
 *     summary: Sync a forked repository with its upstream
 *     tags: [Repositories]
 */
router.post('/:owner/:repo/sync', protect, syncRepo);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/tree:
 *   get:
 *     summary: Get the repository file tree for the default branch
 *     tags: [Repositories]
 */
router.get('/:owner/:repo/tree', protectOptional, getRepoTree);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/tree/{ref}:
 *   get:
 *     summary: Get the repository file tree for a specific reference
 *     tags: [Repositories]
 */
router.get('/:owner/:repo/tree/:ref', protectOptional, getRepoTree);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/zip/{ref}:
 *   get:
 *     summary: Download the repository as a zip file
 *     tags: [Repositories]
 */
router.get('/:owner/:repo/zip/:ref', protectOptional, downloadRepoZip);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/blob/{hash}:
 *   get:
 *     summary: Get a repository blob by hash
 *     tags: [Repositories]
 */
router.get('/:owner/:repo/blob/:hash', protectOptional, getRepoBlob);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/commits:
 *   get:
 *     summary: Get commits for the default branch
 *     tags: [Repositories]
 */
router.get('/:owner/:repo/commits', protectOptional, getRepoCommits);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/commits/{ref}:
 *   get:
 *     summary: Get commits for a specific reference
 *     tags: [Repositories]
 */
router.get('/:owner/:repo/commits/:ref', protectOptional, getRepoCommits);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/contents/*:
 *   delete:
 *     summary: Delete a file from the repository
 *     tags: [Repositories]
 */
router.delete('/:owner/:repo/contents/*filePath', protect, deleteRepoFile);

// ─── CLI Push Endpoints (Full path: :owner/:repo) ──────────────────────

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/objects/{hash}/exists:
 *   get:
 *     summary: Check if a git object exists (CLI)
 *     tags: [CLI]
 */
router.get('/:owner/:repo/objects/:hash/exists', protect, checkObjectExists);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/objects:
 *   post:
 *     summary: Store a git object (CLI)
 *     tags: [CLI]
 */
router.post('/:owner/:repo/objects', protect, storeObject);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/refs:
 *   post:
 *     summary: Update a git reference (CLI)
 *     tags: [CLI]
 */
router.post('/:owner/:repo/refs', protect, updateRef);

// ─── CLI Fetch Endpoints (Full path: :owner/:repo) ────────────────────
/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/refs:
 *   get:
 *     summary: Get all remote branch references (CLI fetch)
 *     tags: [CLI]
 */
router.get('/:owner/:repo/refs', protect, getRemoteRefs);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/refs/{branch}:
 *   delete:
 *     summary: Delete a remote branch reference (CLI)
 *     tags: [CLI]
 */
router.delete('/:owner/:repo/refs/:branch', protect, deleteRemoteRef);
/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/refs/{branch}:
 *   get:
 *     summary: Get a remote branch reference (CLI fetch)
 *     tags: [CLI]
 */
router.get('/:owner/:repo/refs/:branch', protect, getRemoteRef);

/**
 * @swagger
 * /api/v1/repos/{owner}/{repo}/objects/{hash}:
 *   get:
 *     summary: Download a git object (CLI fetch)
 *     tags: [CLI]
 */
router.get('/:owner/:repo/objects/:hash', protect, getObject);

// ─── CLI Push / Fetch Endpoints (Short path: :repo) ───────────────────

/**
 * @swagger
 * /api/v1/repos/{repo}/objects/{hash}/exists:
 *   get:
 *     summary: Check if a git object exists (CLI, Short path)
 *     tags: [CLI]
 */
router.get('/:repo/objects/:hash/exists', protect, checkObjectExists);

/**
 * @swagger
 * /api/v1/repos/{repo}/objects:
 *   post:
 *     summary: Store a git object (CLI, Short path)
 *     tags: [CLI]
 */
router.post('/:repo/objects', protect, storeObject);

/**
 * @swagger
 * /api/v1/repos/{repo}/refs:
 *   post:
 *     summary: Update a git reference (CLI, Short path)
 *     tags: [CLI]
 */
router.post('/:repo/refs', protect, updateRef);

/**
 * @swagger
 * /api/v1/repos/{repo}/refs/{branch}:
 *   get:
 *     summary: Get a remote branch reference (CLI fetch, Short path)
 *     tags: [CLI]
 */
router.get('/:repo/refs/:branch', protect, getRemoteRef);

/**
 * @swagger
 * /api/v1/repos/{repo}/objects/{hash}:
 *   get:
 *     summary: Download a git object (CLI fetch, Short path)
 *     tags: [CLI]
 */
router.get('/:repo/objects/:hash', protect, getObject);

module.exports = router;
