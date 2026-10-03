const express = require('express');
const { protect } = require('../middlewares/auth.middleware');
const {
    createPullRequest,
    listPullRequests,
    getPullRequest,
    getPullRequestCommits,
    updatePullRequest,
    mergePullRequest
} = require('../controllers/pr.controller');

// Important: mergeParams: true allows access to :owner and :repo from the parent router
const router = express.Router({ mergeParams: true });

router.use(protect);

// Routes for /api/v1/repos/:owner/:repo/pulls
router.post('/', createPullRequest);
router.get('/', listPullRequests);
router.get('/:id', getPullRequest);
router.get('/:id/commits', getPullRequestCommits);
router.patch('/:id', updatePullRequest);
router.post('/:id/merge', mergePullRequest);

module.exports = router;
