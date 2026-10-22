const express = require('express');
const { protect } = require('../middlewares/auth.middleware');
const {
    createPullRequest,
    listPullRequests,
    getPullRequest,
    getPullRequestCommits,
    updatePullRequest,
    mergePullRequest,
    getPullRequestComments,
    createPullRequestComment
} = require('../controllers/pr.controller');

const { resolveRepo } = require('../utils/repoHelpers');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Important: mergeParams: true allows access to :owner and :repo from the parent router
const router = express.Router({ mergeParams: true });

router.use(protect);

// Enforce that the repository exists and user is authorized to access it
router.use(asyncHandler(async (req, res, next) => {
    const { owner, repo } = req.params;
    const repoDoc = await resolveRepo(owner, repo, req.user);
    if (!repoDoc) throw new ApiError(404, 'Repository not found');
    req.repoDoc = repoDoc;
    next();
}));

// Routes for /api/v1/repos/:owner/:repo/pulls
router.post('/', createPullRequest);
router.get('/', listPullRequests);
router.get('/:id', getPullRequest);
router.get('/:id/commits', getPullRequestCommits);
router.patch('/:id', updatePullRequest);
router.post('/:id/merge', mergePullRequest);
router.get('/:id/comments', getPullRequestComments);
router.post('/:id/comments', createPullRequestComment);

module.exports = router;
