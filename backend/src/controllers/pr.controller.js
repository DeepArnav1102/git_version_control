const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository.model');
const PullRequest = require('../models/PullRequest.model');
const PRComment = require('../models/PRComment.model');
const GitObject = require('../models/GitObject.model');
const User = require('../models/User.model');
const { resolveRepo } = require('../utils/repoHelpers');
const { getCommitGraph, flattenTree, buildAndSaveTree } = require('../utils/gitHelpers');
const crypto = require('crypto');

const createPullRequest = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const { title, description, sourceOwner, sourceRepo, sourceBranch, targetBranch, assignees, reviewers, labels, milestone, project } = req.body;

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

    const prData = {
        title,
        description,
        sourceRepo: sourceRepoDoc._id,
        sourceBranch,
        targetRepo: targetRepoDoc._id,
        targetBranch,
        author: req.user._id
    };

    if (assignees) prData.assignees = assignees;
    if (reviewers) prData.reviewers = reviewers;
    if (labels) {
        if (!Array.isArray(labels)) {
            throw new ApiError(400, 'Labels must be an array');
        }
        prData.labels = labels.filter(l => 
            l && typeof l.name === 'string' && l.name.length > 0 && l.name.length <= 50 &&
            (!l.color || /^#[0-9A-Fa-f]{3,6}$/i.test(l.color))
        );
    }
    if (milestone) prData.milestone = milestone;
    if (project) prData.project = project;

    const pr = await PullRequest.create(prData);

    res.status(201).json({ success: true, pr });
});

const listPullRequests = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const { state, author, assignee, reviewer, involves, sort } = req.query; // Extended query params
    
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 30;
    const skip = (page - 1) * limit;

    const targetRepoDoc = await Repository.findOne({ 
        owner: (await User.findOne({ username: owner }))._id, 
        name: repo 
    }).populate('owner', 'username profilePicture')
      .populate('collaborators.user', 'username profilePicture');
    
    if (!targetRepoDoc) throw new ApiError(404, 'Repository not found');

    const query = { 
        $or: [
            { targetRepo: targetRepoDoc._id },
            { sourceRepo: targetRepoDoc._id }
        ]
    };
    if (state) query.state = state;

    const resolveUser = async (val) => {
        if (!val) return null;
        if (val.match(/^[0-9a-fA-F]{24}$/)) return val;
        const u = await User.findOne({ username: val });
        return u ? u._id : '000000000000000000000000'; // Return a dummy ID if not found so query returns empty
    };

    if (author) query.author = await resolveUser(author);
    if (assignee) query.assignees = await resolveUser(assignee);
    if (reviewer) query.reviewers = await resolveUser(reviewer);
    if (involves) {
        const invId = await resolveUser(involves);
        query.$or = [
            { author: invId },
            { assignees: invId },
            { reviewers: invId }
        ];
    }
    if (req.query.label) query['labels.name'] = req.query.label;
    if (req.query.milestone) query.milestone = req.query.milestone;
    if (req.query.project) query.project = req.query.project;
    
    let sortQuery = { createdAt: -1 };
    if (sort === 'oldest') sortQuery = { createdAt: 1 };
    else if (sort === 'recently_updated') sortQuery = { updatedAt: -1 };

    const totalPrs = await PullRequest.countDocuments(query);
    const totalPages = Math.ceil(totalPrs / limit) || 1;

    const prs = await PullRequest.find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .populate('author', 'username profilePicture')
        .populate('assignees', 'username profilePicture')
        .populate('reviewers', 'username profilePicture')
        .populate({ path: 'sourceRepo', select: 'name owner', populate: { path: 'owner', select: 'username' } })
        .populate({ path: 'targetRepo', select: 'name owner', populate: { path: 'owner', select: 'username' } });
        
    const labelsAggregation = await PullRequest.aggregate([
        { $match: { $or: [{ targetRepo: targetRepoDoc._id }, { sourceRepo: targetRepoDoc._id }] } },
        { $unwind: "$labels" },
        {
            $group: {
                _id: "$labels.name",
                color: { $first: "$labels.color" },
                description: { $first: "$labels.description" }
            }
        },
        { $project: { name: "$_id", color: 1, description: 1, _id: 0 } }
    ]);
    
    const uniqueLabelsMap = new Map([
        ['bug', { name: 'bug', color: '#d73a4a', description: "Something isn't working" }],
        ['documentation', { name: 'documentation', color: '#0075ca', description: "Improvements or additions to documentation" }],
        ['duplicate', { name: 'duplicate', color: '#cfd3d7', description: "This issue or pull request already exists" }],
        ['enhancement', { name: 'enhancement', color: '#a2eeef', description: "New feature or request" }],
        ['good first issue', { name: 'good first issue', color: '#7057ff', description: "Good for newcomers" }],
        ['help wanted', { name: 'help wanted', color: '#008672', description: "Extra attention is needed" }],
        ['invalid', { name: 'invalid', color: '#e4e669', description: "This doesn't seem right" }],
        ['question', { name: 'question', color: '#d876e3', description: "Further information is requested" }],
        ['wontfix', { name: 'wontfix', color: '#ffffff', description: "This will not be worked on" }]
    ]);
    
    labelsAggregation.forEach(l => {
        if (l.name && !uniqueLabelsMap.has(l.name)) {
            uniqueLabelsMap.set(l.name, l);
        }
    });
    
    const possibleAssigneesAndAuthors = [targetRepoDoc.owner, ...targetRepoDoc.collaborators.map(c => c.user)];
    // deduplicate users just in case
    const uniqueUsersMap = new Map();
    possibleAssigneesAndAuthors.filter(Boolean).forEach(u => uniqueUsersMap.set(u._id.toString(), u));

    res.status(200).json({ 
        success: true, 
        prs,
        metadata: {
            users: Array.from(uniqueUsersMap.values()),
            labels: Array.from(uniqueLabelsMap.values()),
            page,
            totalPages,
            totalPrs
        }
    });
});

const getPullRequest = asyncHandler(async (req, res) => {
    const { owner, repo, id } = req.params;
    const pr = await PullRequest.findById(id)
        .populate('author', 'username profilePicture')
        .populate('assignees', 'username profilePicture')
        .populate('reviewers', 'username profilePicture')
        .populate({ path: 'sourceRepo', select: 'name owner', populate: { path: 'owner', select: 'username' } })
        .populate({ path: 'targetRepo', select: 'name owner', populate: { path: 'owner', select: 'username' } });

    if (!pr) throw new ApiError(404, 'Pull Request not found');
    res.status(200).json({ success: true, pr });
});

const getPullRequestCommits = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const pr = await PullRequest.findById(id).populate('targetRepo').populate('sourceRepo');
    if (!pr) throw new ApiError(404, 'Pull Request not found');

    if (!pr.targetRepo || !pr.sourceRepo) {
        return res.status(200).json({ success: true, commits: [] });
    }

    const targetBranchDoc = pr.targetRepo.branches.find(b => b.name === pr.targetBranch);
    const sourceBranchDoc = pr.sourceRepo.branches.find(b => b.name === pr.sourceBranch);
    
    if (!targetBranchDoc || !sourceBranchDoc) {
        return res.status(200).json({ success: true, commits: [] });
    }

    const { commits } = await getCommitGraph(
        [pr.targetRepo._id, pr.sourceRepo._id],
        sourceBranchDoc.commitHash,
        targetBranchDoc.commitHash
    );

    res.status(200).json({ success: true, commits });
});

const updatePullRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { state, assignees, reviewers, labels, milestone, project } = req.body;

    const pr = await PullRequest.findById(id).populate('targetRepo');
    if (!pr) throw new ApiError(404, 'Pull Request not found');

    const isAuthor = pr.author.toString() === req.user._id.toString();
    const isTargetOwner = pr.targetRepo.owner.toString() === req.user._id.toString();

    if (!isAuthor && !isTargetOwner) {
        throw new ApiError(403, 'Not authorized to update this pull request');
    }

    if (state !== undefined) {
        if (!['open', 'closed'].includes(state)) {
            throw new ApiError(400, 'Invalid state');
        }
        pr.state = state;
    }
    
    if (assignees !== undefined) pr.assignees = assignees;
    if (reviewers !== undefined) pr.reviewers = reviewers;
    if (labels !== undefined) {
        if (!Array.isArray(labels)) {
            throw new ApiError(400, 'Labels must be an array');
        }
        pr.labels = labels.filter(l => 
            l && typeof l.name === 'string' && l.name.length > 0 && l.name.length <= 50 &&
            (!l.color || /^#[0-9A-Fa-f]{3,6}$/i.test(l.color))
        );
    }
    if (milestone !== undefined) pr.milestone = milestone;
    if (project !== undefined) pr.project = project;

    await pr.save();
    
    await pr.populate([
        { path: 'author', select: 'username profilePicture' },
        { path: 'assignees', select: 'username profilePicture' },
        { path: 'reviewers', select: 'username profilePicture' }
    ]);

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

    const { lcaHash: baseHash } = await getCommitGraph([pr.targetRepo._id, pr.sourceRepo._id], sourceHash, targetHash);
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

const getPullRequestComments = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const comments = await PRComment.find({ pullRequest: id })
        .populate('author', 'username name email profilePicture avatar_url')
        .sort({ createdAt: 1 });
    
    res.status(200).json({ success: true, comments });
});

const createPullRequestComment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content) {
        throw new ApiError(400, 'Comment content is required');
    }
    
    const pr = await PullRequest.findById(id);
    if (!pr) throw new ApiError(404, 'Pull request not found');

    const comment = await PRComment.create({
        content,
        author: req.user._id,
        pullRequest: pr._id
    });
    
    await comment.populate('author', 'username name email profilePicture avatar_url');
    
    res.status(201).json({ success: true, comment });
});

module.exports = {
    createPullRequest,
    listPullRequests,
    getPullRequest,
    getPullRequestCommits,
    updatePullRequest,
    mergePullRequest,
    getPullRequestComments,
    createPullRequestComment
};

