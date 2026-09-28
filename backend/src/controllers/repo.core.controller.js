const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository.model');
const GitObject = require('../models/GitObject.model');
const User = require('../models/User.model');
const mongoose = require('mongoose');
const { generateAndSendOtp, verifyOtp } = require('../services/otp.service');
const { resolveUser, resolveRepo } = require('../utils/repoHelpers');


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
    await repoDoc.populate({
        path: 'parentRepo',
        populate: {
            path: 'owner',
            select: 'username'
        }
    });

    let responseData = repoDoc.toObject();

    if (repoDoc.isFork && repoDoc.parentRepo) {
        let ahead = 0;
        let behind = 0;
        const parentRepoId = repoDoc.parentRepo._id || repoDoc.parentRepo;
        const parentRepo = await Repository.findById(parentRepoId);
        
        if (parentRepo) {
            const forkBranch = repoDoc.branches.find(b => b.name === repoDoc.defaultBranch);
            const parentBranch = parentRepo.branches.find(b => b.name === parentRepo.defaultBranch);
            
            let forkHash = forkBranch ? forkBranch.commitHash : null;
            let parentHash = parentBranch ? parentBranch.commitHash : null;
            
            if (forkHash && parentHash) {
                const allCommitObjs = await GitObject.find({ 
                    $or: [{ repositoryId: repoDoc._id }, { repositoryId: parentRepo._id }],
                    type: 'commit' 
                });
                const commitMap = new Map();
                for (const obj of allCommitObjs) {
                    try {
                        const parsed = typeof obj.data === 'string' ? JSON.parse(obj.data) : obj.data;
                        commitMap.set(obj.hash, parsed);
                    } catch {}
                }

                const parentAncestors = new Set();
                let currP = parentHash;
                while (currP) {
                    parentAncestors.add(currP);
                    const c = commitMap.get(currP);
                    currP = c && c.parent ? c.parent : null;
                }

                let currF = forkHash;
                let commonAncestor = null;
                while (currF) {
                    if (parentAncestors.has(currF)) {
                        commonAncestor = currF;
                        break;
                    }
                    ahead++;
                    const c = commitMap.get(currF);
                    currF = c && c.parent ? c.parent : null;
                }

                currP = parentHash;
                while (currP && currP !== commonAncestor) {
                    behind++;
                    const c = commitMap.get(currP);
                    currP = c && c.parent ? c.parent : null;
                }
            }
        }
        responseData.ahead = ahead;
        responseData.behind = behind;
    }

    res.status(200).json({
        success: true,
        data: responseData,
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

    // Recursive function to get all fork IDs
    const getAllForkIds = async (repoId) => {
        const forks = await Repository.find({ parentRepo: repoId }, '_id');
        let allIds = [];
        for (const fork of forks) {
            allIds.push(fork._id);
            const childIds = await getAllForkIds(fork._id);
            allIds = allIds.concat(childIds);
        }
        return allIds;
    };

    const forkIds = await getAllForkIds(repoDoc._id);
    const allRepoIdsToDelete = [repoDoc._id, ...forkIds];

    // Delete all GitObjects associated with this repository and its forks
    await GitObject.deleteMany({ repositoryId: { $in: allRepoIdsToDelete } });
    
    // Delete the repository documents
    await Repository.deleteMany({ _id: { $in: allRepoIdsToDelete } });

    res.status(200).json({
        success: true,
        message: 'Repository and its forks deleted successfully'
    });
});

const toggleStarRepo = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const repoDoc = await resolveRepo(owner, repo, req.user);
    
    if (!repoDoc) throw new ApiError(404, 'Repository not found');

    const currentUser = await User.findById(req.user._id);
    const isStarred = currentUser.starredRepos.includes(repoDoc._id);

    if (isStarred) {
        currentUser.starredRepos.pull(repoDoc._id);
        repoDoc.starsCount = Math.max(0, (repoDoc.starsCount || 0) - 1);
    } else {
        currentUser.starredRepos.push(repoDoc._id);
        repoDoc.starsCount = (repoDoc.starsCount || 0) + 1;
    }

    await currentUser.save();
    await repoDoc.save();

    res.status(200).json({
        success: true,
        message: isStarred ? 'Repository unstarred' : 'Repository starred',
        data: { isStarred: !isStarred, starsCount: repoDoc.starsCount }
    });
});

const forkRepo = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const sourceRepo = await resolveRepo(owner, repo, req.user);
    
    if (!sourceRepo) {
        throw new ApiError(404, 'Source repository not found');
    }

    if (sourceRepo.owner.toString() === req.user._id.toString()) {
        throw new ApiError(400, 'You cannot fork your own repository');
    }

    const existingFork = await Repository.findOne({
        owner: req.user._id,
        name: sourceRepo.name
    });

    if (existingFork) {
        throw new ApiError(400, `You already have a repository named '${sourceRepo.name}'`);
    }

    const forkedRepo = await Repository.create({
        name: sourceRepo.name,
        owner: req.user._id,
        description: sourceRepo.description,
        isPrivate: sourceRepo.isPrivate,
        defaultBranch: sourceRepo.defaultBranch,
        branches: sourceRepo.branches.map(b => ({
            name: b.name,
            commitHash: b.commitHash,
            updatedAt: Date.now()
        })),
        latestCommit: sourceRepo.latestCommit,
        isFork: true,
        parentRepo: sourceRepo._id,
        rootRepo: sourceRepo.rootRepo || sourceRepo._id
    });
    
    // update source repo forks count
    sourceRepo.forksCount = (sourceRepo.forksCount || 0) + 1;
    await sourceRepo.save();

    // Copy all GitObjects from source to the new fork
    const sourceObjects = await GitObject.find({ repositoryId: sourceRepo._id });
    if (sourceObjects.length > 0) {
        const newObjects = sourceObjects.map(obj => ({
            repositoryId: forkedRepo._id,
            hash: obj.hash,
            type: obj.type,
            data: obj.data,
            pushedBy: req.user._id
        }));
        await GitObject.insertMany(newObjects);
    }

    res.status(201).json({
        success: true,
        message: 'Repository forked successfully',
        data: forkedRepo
    });
});

const syncRepo = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const forkedRepo = await resolveRepo(owner, repo, req.user);
    
    if (!forkedRepo) throw new ApiError(404, 'Repository not found');
    if (!forkedRepo.isFork || !forkedRepo.parentRepo) {
        throw new ApiError(400, 'This repository is not a fork');
    }
    
    if (forkedRepo.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'You do not have permission to sync this repository');
    }

    const parentRepo = await Repository.findById(forkedRepo.parentRepo);
    if (!parentRepo) {
        throw new ApiError(404, 'Parent repository no longer exists');
    }

    // Fast-forward sync: copy missing objects from parent to fork
    const parentObjects = await GitObject.find({ repositoryId: parentRepo._id });
    const forkObjects = await GitObject.find({ repositoryId: forkedRepo._id }, { hash: 1 });
    const forkHashes = new Set(forkObjects.map(o => o.hash));
    
    const objectsToCopy = parentObjects.filter(o => !forkHashes.has(o.hash)).map(o => ({
        repositoryId: forkedRepo._id,
        hash: o.hash,
        type: o.type,
        data: o.data,
        pushedBy: req.user._id
    }));

    if (objectsToCopy.length > 0) {
        await GitObject.insertMany(objectsToCopy);
    }

    // Update branches
    const parentDefaultBranch = parentRepo.branches.find(b => b.name === parentRepo.defaultBranch);
    if (parentDefaultBranch) {
        const forkBranchIndex = forkedRepo.branches.findIndex(b => b.name === forkedRepo.defaultBranch);
        if (forkBranchIndex !== -1) {
            forkedRepo.branches[forkBranchIndex].commitHash = parentDefaultBranch.commitHash;
            forkedRepo.branches[forkBranchIndex].updatedAt = Date.now();
        } else {
            forkedRepo.branches.push({
                name: parentRepo.defaultBranch,
                commitHash: parentDefaultBranch.commitHash,
                updatedAt: Date.now()
            });
            forkedRepo.defaultBranch = parentRepo.defaultBranch;
        }
        forkedRepo.latestCommit = parentRepo.latestCommit;
        await forkedRepo.save();
    }

    res.status(200).json({
        success: true,
        message: 'Repository synced successfully',
        data: forkedRepo
    });
});

module.exports = { 
    createRepo, 
    updateRepo, 
    getUserRepos, 
    getReposByUsername, 
    getRepoDetails, 
    requestDeleteOtp, 
    deleteRepo, 
    toggleStarRepo, 
    forkRepo, 
    syncRepo 
};