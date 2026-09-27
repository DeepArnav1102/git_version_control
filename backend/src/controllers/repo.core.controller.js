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

    res.status(200).json({
        success: true,
        data: repoDoc,
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

module.exports = { createRepo, updateRepo, getUserRepos, getReposByUsername, getRepoDetails, requestDeleteOtp, deleteRepo };