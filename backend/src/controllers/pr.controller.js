const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository.model');
const PullRequest = require('../models/PullRequest.model');
const GitObject = require('../models/GitObject.model');
const { resolveRepo } = require('../utils/repoHelpers');
const { findCommonAncestor, flattenTree, buildAndSaveTree } = require('../utils/gitHelpers');
const crypto = require('crypto');

const createPullRequest = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const { title, description, sourceOwner, sourceRepo, sourceBranch, targetBranch } = req.body;

    if (!title || !sourceOwner || !sourceRepo || !sourceBranch || !targetBranch) {
        throw new ApiError(400, 'Missing required fields');
    }

    if (title.length > 255) {
        throw new ApiError(400, 'Title is too long');
    }
    if (description && description.length > 10000) {
        throw new ApiError(400, 'Description is too long');
    }

    const targetRepoDoc = await resolveRepo(owner, repo, req.user);
    if (!targetRepoDoc) throw new ApiError(404, 'Target repository not found');

    const sourceRepoDoc = await resolveRepo(sourceOwner, sourceRepo, req.user);
    if (!sourceRepoDoc) throw new ApiError(404, 'Source repository not found');

    const pr = await PullRequest.create({
        title,
        description,
        sourceRepo: sourceRepoDoc._id,
        sourceBranch,
        targetRepo: targetRepoDoc._id,
        targetBranch,
        author: req.user._id
    });

    res.status(201).json({ success: true, pr });
});

const listPullRequests = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const { state } = req.query; // 'open', 'closed', 'merged'

    const targetRepoDoc = await resolveRepo(owner, repo, req.user);
    if (!targetRepoDoc) throw new ApiError(404, 'Repository not found');

    const query = { targetRepo: targetRepoDoc._id };
    if (state) query.state = state;

    const prs = await PullRequest.find(query)
        .populate('author', 'username avatarUrl')
        .populate('sourceRepo', 'name owner')
        .populate('targetRepo', 'name owner');
        
    res.status(200).json({ success: true, prs });
});

const getPullRequest = asyncHandler(async (req, res) => {
    const { owner, repo, id } = req.params;
    const pr = await PullRequest.findById(id)
        .populate('author', 'username avatarUrl')
        .populate('sourceRepo', 'name owner')
        .populate('targetRepo', 'name owner');

    if (!pr) throw new ApiError(404, 'Pull Request not found');
    res.status(200).json({ success: true, pr });
});

const getPullRequestCommits = asyncHandler(async (req, res) => {
    const { owner, repo, id } = req.params;
    // Logic for traversing GitObject to find commits unique to PR will go here.
    // For now, return a placeholder.
    res.status(501).json({ success: false, message: 'Not implemented' });
});

const updatePullRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { state } = req.body;

    if (!['open', 'closed'].includes(state)) {
        throw new ApiError(400, 'Invalid state');
    }

    const pr = await PullRequest.findById(id).populate('targetRepo');
    if (!pr) throw new ApiError(404, 'Pull Request not found');

    const isAuthor = pr.author.toString() === req.user._id.toString();
    const isTargetOwner = pr.targetRepo.owner.toString() === req.user._id.toString();

    if (!isAuthor && !isTargetOwner) {
        throw new ApiError(403, 'Not authorized to update this pull request');
    }

    pr.state = state;
    await pr.save();

    res.status(200).json({ success: true, pr });
});

const mergePullRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const pr = await PullRequest.findById(id).populate('targetRepo').populate('sourceRepo');
    if (!pr) throw new ApiError(404, 'Pull Request not found');

    const isTargetOwner = pr.targetRepo.owner.toString() === req.user._id.toString();
    if (!isTargetOwner) {
        throw new ApiError(403, 'Only repository owner can merge pull requests');
    }
    
    if (pr.state !== 'open') {
        throw new ApiError(400, 'Pull Request is not open');
    }
    // 1. Fetch commits
    const targetBranchDoc = pr.targetRepo.branches.find(b => b.name === pr.targetBranch);
    const sourceBranchDoc = pr.sourceRepo.branches.find(b => b.name === pr.sourceBranch);
    if (!targetBranchDoc || !sourceBranchDoc) throw new ApiError(400, 'Branches not found');

    const targetHash = targetBranchDoc.commitHash;
    const sourceHash = sourceBranchDoc.commitHash;

    if (targetHash === sourceHash) {
        throw new ApiError(400, 'Already up to date');
    }

    const baseHash = await findCommonAncestor(pr.targetRepo._id, targetHash, sourceHash);
    if (!baseHash) throw new ApiError(400, 'Unrelated histories, cannot merge');

    const [baseCommit, oursCommit, theirsCommit] = await Promise.all([
        GitObject.findOne({ repositoryId: pr.targetRepo._id, hash: baseHash, type: 'commit' }),
        GitObject.findOne({ repositoryId: pr.targetRepo._id, hash: targetHash, type: 'commit' }),
        GitObject.findOne({ repositoryId: pr.sourceRepo._id, hash: sourceHash, type: 'commit' })
    ]);

    const baseTreeHash = JSON.parse(baseCommit.data).tree;
    const oursTreeHash = JSON.parse(oursCommit.data).tree;
    const theirsTreeHash = JSON.parse(theirsCommit.data).tree;

    const [baseTree, oursTree, theirsTree] = await Promise.all([
        flattenTree(pr.targetRepo._id, baseTreeHash),
        flattenTree(pr.targetRepo._id, oursTreeHash),
        flattenTree(pr.sourceRepo._id, theirsTreeHash)
    ]);

    // 2. Load N-API module
    let nativeMerge;
    try {
        nativeMerge = require('../../native-merge.node');
    } catch (err) {
        console.error('Failed to load native-merge module:', err);
        throw new ApiError(500, 'Native merge module not available');
    }

    // 3. Perform native merge ASYNCHRONOUSLY (Non-blocking)
    const result = await nativeMerge.performMergeAsync({
        baseTree: JSON.stringify(baseTree),
        oursTree: JSON.stringify(oursTree),
        theirsTree: JSON.stringify(theirsTree)
    });

    if (!result.success) {
        throw new ApiError(409, 'Merge conflicts detected', result.conflictFiles);
    }

    // 4. Build and save new tree
    const mergedFlatTree = JSON.parse(result.mergedTree);
    const newRootTreeHash = await buildAndSaveTree(pr.targetRepo._id, mergedFlatTree, req.user._id);

    // 5. Create Merge Commit
    const commitMessage = `Merge pull request #${pr._id.toString().slice(-4)} from ${pr.sourceBranch}`;
    const commitData = {
        tree: newRootTreeHash,
        message: commitMessage,
        parents: [targetHash, sourceHash],
        author: req.user.username || req.user.email,
        date: new Date().toISOString()
    };
    
    const commitDataStr = JSON.stringify(commitData);
    const newCommitHash = crypto.createHash('sha256').update(commitDataStr).digest('hex');

    await GitObject.updateOne(
        { repositoryId: pr.targetRepo._id, hash: newCommitHash },
        { $set: { repositoryId: pr.targetRepo._id, hash: newCommitHash, type: 'commit', data: commitDataStr, pushedBy: req.user._id } },
        { upsert: true }
    );

    // 6. Update Target Branch
    const branchIndex = pr.targetRepo.branches.findIndex(b => b.name === pr.targetBranch);
    pr.targetRepo.branches[branchIndex].commitHash = newCommitHash;
    pr.targetRepo.branches[branchIndex].updatedAt = new Date();
    
    pr.targetRepo.latestCommit = {
        hash: newCommitHash,
        message: commitMessage,
        tree: newRootTreeHash,
        parent: targetHash,
        author: req.user.username || req.user.email,
        date: new Date()
    };
    await pr.targetRepo.save();

    // 7. Close PR
    pr.state = 'merged';
    await pr.save();
    
    res.status(200).json({ 
        success: true, 
        message: 'Pull request successfully merged',
        data: { commitHash: newCommitHash }
    });
});

module.exports = {
    createPullRequest,
    listPullRequests,
    getPullRequest,
    getPullRequestCommits,
    updatePullRequest,
    mergePullRequest
};
