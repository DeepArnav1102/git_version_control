const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository.model');
const GitObject = require('../models/GitObject.model');
const User = require('../models/User.model');
const mongoose = require('mongoose');
const { generateAndSendOtp, verifyOtp } = require('../services/otp.service');
const { resolveUser, resolveRepo } = require('../utils/repoHelpers');


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

    // Auto-create repository if pushing to a new repo — default to private for safety
    if (!repoDoc) {
        repoDoc = await Repository.create({
            owner: req.user._id,
            name: repoName,
            defaultBranch: 'main',
            branches: [],
            isPrivate: true,
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
            isPrivate: true,
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

module.exports = { checkObjectExists, storeObject, updateRef };