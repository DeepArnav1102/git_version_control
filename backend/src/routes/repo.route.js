const express = require('express');
const { protect } = require('../middlewares/auth.middleware');
const {
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
    requestDeleteOtp,
    deleteRepo,
    toggleStarRepo,
} = require('../controllers/repo.controller');
const { otpLimiter } = require('../middlewares/rateLimit.middleware');

const router = express.Router();

// ─── Web API ──────────────────────────────────────────────────────────
router.post('/', protect, createRepo);
router.get('/', protect, getUserRepos);
router.get('/user/:username', getReposByUsername);

// ─── Single Repo Routes ───────────────────────────────────────────────
router.get('/:owner/:repo', getRepoDetails);
router.patch('/:owner/:repo', protect, updateRepo);
router.post('/:owner/:repo/star', protect, toggleStarRepo);
router.post('/:owner/:repo/request-delete-otp', otpLimiter, protect, requestDeleteOtp);
router.delete('/:owner/:repo', protect, deleteRepo);
router.get('/:owner/:repo/tree', getRepoTree);
router.get('/:owner/:repo/tree/:ref', getRepoTree);
router.get('/:owner/:repo/blob/:hash', getRepoBlob);
router.get('/:owner/:repo/commits', getRepoCommits);
router.get('/:owner/:repo/commits/:ref', getRepoCommits);

// ─── CLI Push Endpoints (Full path: :owner/:repo) ──────────────────────
router.get('/:owner/:repo/objects/:hash/exists', protect, checkObjectExists);
router.post('/:owner/:repo/objects', protect, storeObject);
router.post('/:owner/:repo/refs', protect, updateRef);

// ─── CLI Push Endpoints (Short path: :repo) ───────────────────────────
router.get('/:repo/objects/:hash/exists', protect, checkObjectExists);
router.post('/:repo/objects', protect, storeObject);
router.post('/:repo/refs', protect, updateRef);

module.exports = router;
