const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository.model');
const GitObject = require('../models/GitObject.model');
const User = require('../models/User.model');
const mongoose = require('mongoose');
const { generateAndSendOtp, verifyOtp } = require('../services/otp.service');

// Helper to resolve user from owner param (username, email, or ObjectId)
const resolveUser = async (ownerParam) => {
    if (!ownerParam) return null;
    if (mongoose.Types.ObjectId.isValid(ownerParam)) {
        const u = await User.findById(ownerParam);
        if (u) return u;
    }
    const escapedParam = ownerParam.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return await User.findOne({
        $or: [
            { username: ownerParam.toLowerCase() },
            { email: ownerParam.toLowerCase() },
            { email: { $regex: new RegExp(`^${escapedParam}@`, 'i') } }
        ]
    });
};

// Helper to resolve repository from ownerParam and repoName
const resolveRepo = async (ownerParam, repoName, currentUser = null) => {
    let ownerId;
    if (ownerParam) {
        const user = await resolveUser(ownerParam);
        if (user) ownerId = user._id;
    }
    if (!ownerId && currentUser) {
        ownerId = currentUser._id;
    }
    if (!ownerId) return null;

    const normalizedRepoName = repoName.replace(/\.git$/, '').toLowerCase().trim();
    return await Repository.findOne({ owner: ownerId, name: normalizedRepoName });
};

// ─── Create Repository ────────────────────────────────────────────────
const createRepo = asyncHandler(async (req, res) => {
    const { name, description = '', isPrivate = false } = req.body;

    if (!name || typeof name !== 'string') {
        throw new ApiError(400, 'Repository name is required');
    }

    const cleanName = name.replace(/\.git$/, '').toLowerCase().trim();
    if (!/^[a-zA-Z0-9_\-.]+$/.test(cleanName)) {
        throw new ApiError(400, 'Repository name can only contain letters, numbers, hyphens, and underscores');
    }

    const existing = await Repository.findOne({ owner: req.user._id, name: cleanName });
    if (existing) {
        throw new ApiError(400, `Repository '${cleanName}' already exists for this account`);
    }

    const repo = await Repository.create({
        name: cleanName,
        owner: req.user._id,
        description,
        isPrivate: Boolean(isPrivate),
        defaultBranch: 'main',
        branches: [],
    });

    res.status(201).json({
        success: true,
        message: 'Repository created successfully',
        data: repo,
    });
});

// ─── Update Repository ────────────────────────────────────────────────
const updateRepo = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const { name, description, isPrivate, defaultBranch } = req.body;

    const repoDoc = await resolveRepo(owner, repo, req.user);
    if (!repoDoc) throw new ApiError(404, 'Repository not found');

    if (repoDoc.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'You do not have permission to edit this repository');
    }

    if (name) {
        const cleanName = name.replace(/\.git$/, '').toLowerCase().trim();
        if (!/^[a-zA-Z0-9_\-.]+$/.test(cleanName)) {
            throw new ApiError(400, 'Repository name can only contain letters, numbers, hyphens, and underscores');
        }
        if (cleanName !== repoDoc.name) {
            const existing = await Repository.findOne({ owner: req.user._id, name: cleanName });
            if (existing) {
                throw new ApiError(400, `Repository '${cleanName}' already exists`);
            }
            repoDoc.name = cleanName;
        }
    }

    if (description !== undefined) repoDoc.description = description;
    if (isPrivate !== undefined) repoDoc.isPrivate = Boolean(isPrivate);
    
    if (defaultBranch) {
        const branchExists = repoDoc.branches.some(b => b.name === defaultBranch);
        if (!branchExists && repoDoc.branches.length > 0) {
            throw new ApiError(400, `Branch '${defaultBranch}' does not exist`);
        }
        repoDoc.defaultBranch = defaultBranch;
    }

    await repoDoc.save();

    res.status(200).json({
        success: true,
        message: 'Repository updated successfully',
        data: repoDoc,
    });
});

// ─── List Repositories for Authenticated User ─────────────────────────
const getUserRepos = asyncHandler(async (req, res) => {
    // Include repos owned by user OR where user has pushed objects/commits
    const pushedRepoIds = await GitObject.distinct('repositoryId', { pushedBy: req.user._id });
    const repos = await Repository.find({
        $or: [
            { owner: req.user._id },
            { _id: { $in: pushedRepoIds } }
        ]
    })
        .populate('owner', 'username email name profilePicture')
        .sort({ updatedAt: -1 });

    res.status(200).json({
        success: true,
        data: repos,
    });
});

// ─── List Repositories for Specific User / Public ─────────────────────
const getReposByUsername = asyncHandler(async (req, res) => {
    const { username } = req.params;
    const user = await resolveUser(username);
    if (!user) throw new ApiError(404, 'User not found');

    const filter = { owner: user._id };
    if (!req.user || req.user._id.toString() !== user._id.toString()) {
        filter.isPrivate = false;
    }

    const repos = await Repository.find(filter)
        .populate('owner', 'username email name profilePicture')
        .sort({ updatedAt: -1 });

    res.status(200).json({
        success: true,
        data: repos,
    });
});

// ─── Get Single Repository Details ────────────────────────────────────
const getRepoDetails = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const repoDoc = await resolveRepo(owner, repo, req.user);
    if (!repoDoc) throw new ApiError(404, 'Repository not found');

    if (repoDoc.isPrivate && (!req.user || repoDoc.owner.toString() !== req.user._id.toString())) {
        throw new ApiError(403, 'Access denied to private repository');
    }

    await repoDoc.populate('owner', 'username email name profilePicture');

    res.status(200).json({
        success: true,
        data: repoDoc,
    });
});

// ─── Get File Tree at Path ────────────────────────────────────────────
const getRepoTree = asyncHandler(async (req, res) => {
    const { owner, repo, ref = 'main' } = req.params;
    const { path = '', recursive } = req.query;

    const repoDoc = await resolveRepo(owner, repo, req.user);
    if (!repoDoc) throw new ApiError(404, 'Repository not found');

    // 1. Resolve commit hash from branch or direct commit hash
    let commitHash = null;
    const branch = repoDoc.branches.find((b) => b.name === ref);
    if (branch) {
        commitHash = branch.commitHash;
    } else {
        const commitObj = await GitObject.findOne({
            repositoryId: repoDoc._id,
            hash: ref,
            type: 'commit',
        });
        if (commitObj) commitHash = ref;
    }

    if (!commitHash) {
        return res.status(200).json({
            success: true,
            data: {
                isEmpty: true,
                entries: [],
                tree: [],
                branches: repoDoc.branches.map((b) => b.name),
                defaultBranch: repoDoc.defaultBranch,
            },
        });
    }

    // 2. Load root commit
    let commitObj = await GitObject.findOne({
        repositoryId: repoDoc._id,
        hash: commitHash,
        type: 'commit',
    });
    if (!commitObj) {
        commitObj = await GitObject.findOne({
            hash: commitHash,
            type: 'commit',
        });
    }
    if (!commitObj) throw new ApiError(404, 'Commit not found');

    let commitData;
    try {
        commitData = typeof commitObj.data === 'string' ? JSON.parse(commitObj.data) : commitObj.data;
    } catch {
        throw new ApiError(500, 'Invalid commit format');
    }

    if (commitData && commitData.author) {
        const authorUser = await User.findOne({ username: commitData.author.toLowerCase() }).select('profilePicture');
        if (authorUser && authorUser.profilePicture) {
            commitData.authorProfilePicture = authorUser.profilePicture;
        }
    }

    // 3. Load root tree
    let currentTreeHash = commitData.tree;
    let currentTreeObj = await GitObject.findOne({
        repositoryId: repoDoc._id,
        hash: currentTreeHash,
        type: 'tree',
    });
    if (!currentTreeObj) {
        currentTreeObj = await GitObject.findOne({
            hash: currentTreeHash,
            type: 'tree',
        });
    }
    if (!currentTreeObj) throw new ApiError(404, 'Root tree not found');

    let rootTreeData = typeof currentTreeObj.data === 'string' ? JSON.parse(currentTreeObj.data) : currentTreeObj.data;
    let treeData = rootTreeData;

    // Helper: recursively build full directory tree hierarchy for navigation tree
    const buildRecursiveTree = async (treeHash, currentSubPath = '') => {
        let obj = await GitObject.findOne({
            repositoryId: repoDoc._id,
            hash: treeHash,
            type: 'tree',
        });
        if (!obj) {
            obj = await GitObject.findOne({
                hash: treeHash,
                type: 'tree',
            });
        }
        if (!obj) return [];
        let parsed;
        try {
            parsed = typeof obj.data === 'string' ? JSON.parse(obj.data) : obj.data;
        } catch {
            return [];
        }
        const rawEntries = parsed.entries || [];
        const result = [];
        for (const entry of rawEntries) {
            const entryPath = currentSubPath ? `${currentSubPath}/${entry.name}` : entry.name;
            if (entry.object_type === 'tree') {
                const children = await buildRecursiveTree(entry.object_hash, entryPath);
                result.push({
                    name: entry.name,
                    path: entryPath,
                    object_hash: entry.object_hash,
                    object_type: 'tree',
                    children,
                });
            } else {
                result.push({
                    name: entry.name,
                    path: entryPath,
                    object_hash: entry.object_hash,
                    object_type: 'blob',
                });
            }
        }
        return result.sort((a, b) => {
            if (a.object_type === b.object_type) return a.name.localeCompare(b.name);
            return a.object_type === 'tree' ? -1 : 1;
        });
    };

    // 4. Traverse if path is specified
    const cleanPath = path.trim().replace(/^\/+|\/+$/g, '');
    if (cleanPath) {
        const segments = cleanPath.split('/').filter(Boolean);
        for (const segment of segments) {
            const match = treeData.entries.find(
                (e) => e.name === segment && e.object_type === 'tree'
            );
            if (!match) {
                throw new ApiError(404, `Directory '${segment}' not found in path '${cleanPath}'`);
            }
            currentTreeObj = await GitObject.findOne({
                repositoryId: repoDoc._id,
                hash: match.object_hash,
                type: 'tree',
            });
            if (!currentTreeObj) {
                currentTreeObj = await GitObject.findOne({
                    hash: match.object_hash,
                    type: 'tree',
                });
            }
            if (!currentTreeObj) throw new ApiError(404, `Tree object not found for ${segment}`);
            treeData = typeof currentTreeObj.data === 'string' ? JSON.parse(currentTreeObj.data) : currentTreeObj.data;
        }
    }

    // Sort entries: directories first, then files
    const entries = [...(treeData.entries || [])].sort((a, b) => {
        if (a.object_type === b.object_type) return a.name.localeCompare(b.name);
        return a.object_type === 'tree' ? -1 : 1;
    });

    let fullTree = null;
    if (recursive === 'true' || recursive === '1' || recursive === true) {
        fullTree = await buildRecursiveTree(commitData.tree, '');
    }

    res.status(200).json({
        success: true,
        data: {
            isEmpty: false,
            currentPath: cleanPath,
            entries,
            tree: fullTree,
            commit: {
                hash: commitHash,
                message: commitData.message,
                author: repoDoc.latestCommit?.author || 'Contributor',
                date: repoDoc.latestCommit?.date || repoDoc.updatedAt,
            },
            branches: repoDoc.branches.map((b) => b.name),
            defaultBranch: repoDoc.defaultBranch,
        },
    });
});

// ─── Get File Content (Blob) ──────────────────────────────────────────
const getRepoBlob = asyncHandler(async (req, res) => {
    const { owner, repo, hash } = req.params;

    const repoDoc = await resolveRepo(owner, repo, req.user);
    if (!repoDoc) throw new ApiError(404, 'Repository not found');

    let blobObj = await GitObject.findOne({
        repositoryId: repoDoc._id,
        hash,
        type: 'blob',
    });
    if (!blobObj) {
        blobObj = await GitObject.findOne({
            hash,
            type: 'blob',
        });
    }
    if (!blobObj) throw new ApiError(404, 'File content not found');

    res.status(200).json({
        success: true,
        data: {
            hash: blobObj.hash,
            content: blobObj.data,
            size: Buffer.byteLength(blobObj.data || '', 'utf8'),
        },
    });
});

// ─── Get Commits History ──────────────────────────────────────────────
const getRepoCommits = asyncHandler(async (req, res) => {
    const { owner, repo, ref = 'main' } = req.params;

    const repoDoc = await resolveRepo(owner, repo, req.user);
    if (!repoDoc) throw new ApiError(404, 'Repository not found');

    let currentHash = null;
    const branch = repoDoc.branches.find((b) => b.name === ref);
    if (branch) currentHash = branch.commitHash;
    else currentHash = ref;

    const commits = [];
    const visited = new Set();

    while (currentHash && !visited.has(currentHash) && commits.length < 50) {
        visited.add(currentHash);
        const obj = await GitObject.findOne({
            repositoryId: repoDoc._id,
            hash: currentHash,
            type: 'commit',
        });
        if (!obj) break;

        try {
            const commitData = JSON.parse(obj.data);
            commits.push({
                hash: currentHash,
                message: commitData.message,
                tree: commitData.tree,
                parent: commitData.parent,
                author: commitData.author || repoDoc.latestCommit?.author || 'Contributor',
                date: commitData.date || repoDoc.latestCommit?.date || obj.createdAt,
            });
            currentHash = commitData.parent || null;
        } catch {
            break;
        }
    }

    // Resolve profile pictures for unique authors
    const uniqueAuthors = [...new Set(commits.map(c => c.author.toLowerCase()))];
    const authorUsers = await User.find({ username: { $in: uniqueAuthors } }).select('username profilePicture');
    const authorPfpMap = {};
    authorUsers.forEach(u => {
        authorPfpMap[u.username.toLowerCase()] = u.profilePicture;
    });

    commits.forEach(c => {
        if (authorPfpMap[c.author.toLowerCase()]) {
            c.authorProfilePicture = authorPfpMap[c.author.toLowerCase()];
        }
    });

    res.status(200).json({
        success: true,
        data: commits,
    });
});

// ─── Push / Object Storage Endpoints (Used by CLI `rusty push`) ────────
const checkObjectExists = asyncHandler(async (req, res) => {
    const { owner, repo, hash } = req.params;
    const repoName = repo || owner;

    const repoDoc = await resolveRepo(owner && repo ? owner : null, repoName, req.user);
    if (!repoDoc) {
        return res.status(200).json({ exists: false });
    }

    const exists = await GitObject.exists({ repositoryId: repoDoc._id, hash });
    res.status(200).json({ exists: !!exists });
});

const storeObject = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const repoName = (repo || owner).replace(/\.git$/, '').toLowerCase().trim();
    const { type: objectType, hash, data } = req.body;

    if (!objectType || !hash || data === undefined) {
        throw new ApiError(400, 'type, hash, and data are required');
    }

    let repoDoc = await resolveRepo(owner && repo ? owner : null, repoName, req.user);

    // Auto-create repository if pushing to a new repo
    if (!repoDoc) {
        repoDoc = await Repository.create({
            owner: req.user._id,
            name: repoName,
            defaultBranch: 'main',
            branches: [],
            isPrivate: false,
        });
    }

    await GitObject.updateOne(
        { repositoryId: repoDoc._id, hash },
        {
            $set: {
                repositoryId: repoDoc._id,
                hash,
                type: objectType,
                data: typeof data === 'string' ? data : JSON.stringify(data),
                pushedBy: req.user._id,
            },
        },
        { upsert: true }
    );

    res.status(200).json({
        success: true,
        message: 'Object stored successfully',
        hash,
    });
});

const updateRef = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const repoName = (repo || owner).replace(/\.git$/, '').toLowerCase().trim();
    const { branch, commitHash } = req.body;

    if (!branch || !commitHash) {
        throw new ApiError(400, 'branch and commitHash are required');
    }

    const cleanBranch = branch.replace(/^refs\/heads\//, '').trim();

    let repoDoc = await resolveRepo(owner && repo ? owner : null, repoName, req.user);
    if (!repoDoc) {
        repoDoc = await Repository.create({
            owner: req.user._id,
            name: repoName,
            defaultBranch: cleanBranch || 'main',
            branches: [],
            isPrivate: false,
        });
    }

    // Inspect the commit to extract message and tree
    const commitObj = await GitObject.findOne({
        repositoryId: repoDoc._id,
        hash: commitHash,
        type: 'commit',
    });

    let commitData = {};
    if (commitObj) {
        try {
            commitData = JSON.parse(commitObj.data);
        } catch {}
    }

    // Update or insert branch
    const branchIndex = repoDoc.branches.findIndex((b) => b.name === cleanBranch);
    if (branchIndex >= 0) {
        repoDoc.branches[branchIndex].commitHash = commitHash;
        repoDoc.branches[branchIndex].updatedAt = new Date();
    } else {
        repoDoc.branches.push({
            name: cleanBranch,
            commitHash,
            updatedAt: new Date(),
        });
    }

    if (!repoDoc.defaultBranch) {
        repoDoc.defaultBranch = cleanBranch;
    }

    repoDoc.latestCommit = {
        hash: commitHash,
        message: commitData.message || `Update ${cleanBranch}`,
        tree: commitData.tree,
        parent: commitData.parent,
        author: req.user.username || req.user.email,
        date: new Date(),
    };

    await repoDoc.save();

    res.status(200).json({
        success: true,
        message: `Successfully pushed to branch '${cleanBranch}'`,
        data: {
            branch: cleanBranch,
            commitHash,
            repo: repoDoc.name,
        },
    });
});

const requestDeleteOtp = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const repoDoc = await resolveRepo(owner, repo, req.user);
    
    if (!repoDoc) {
        throw new ApiError(404, 'Repository not found');
    }
    if (repoDoc.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'You do not have permission to delete this repository');
    }

    await generateAndSendOtp(req.user, 'REPO_DELETE');

    res.status(200).json({
        success: true,
        message: 'OTP sent to your registered email for repository deletion'
    });
});

// ─── Delete Repository ────────────────────────────────────────────────
const deleteRepo = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const { otp } = req.body;
    
    if (!otp) {
        throw new ApiError(400, 'OTP is required to delete repository');
    }

    const repoDoc = await resolveRepo(owner, repo, req.user);
    
    if (!repoDoc) {
        throw new ApiError(404, 'Repository not found');
    }

    if (repoDoc.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'You do not have permission to delete this repository');
    }

    await verifyOtp(req.user._id, otp, 'REPO_DELETE');

    // Delete all GitObjects associated with this repository
    await GitObject.deleteMany({ repositoryId: repoDoc._id });
    
    // Delete the repository document itself
    await Repository.findByIdAndDelete(repoDoc._id);

    res.status(200).json({
        success: true,
        message: 'Repository deleted successfully'
    });
});

module.exports = {
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
};
