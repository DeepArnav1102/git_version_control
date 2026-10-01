const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository.model');
const GitObject = require('../models/GitObject.model');
const { resolveRepo } = require('../utils/repoHelpers');


// ─── Push / Object Storage Endpoints ─────────────────────────────────

// Check whether an object already exists on the remote
const checkObjectExists = asyncHandler(async (req, res) => {
    const { owner, repo, hash } = req.params;
    const repoName = repo || owner;

    const repoDoc = await resolveRepo(
        owner && repo ? owner : null,
        repoName,
        req.user
    );

    if (!repoDoc) {
        return res.status(200).json({ exists: false });
    }

    const exists = await GitObject.exists({
        repositoryId: repoDoc._id,
        hash
    });

    res.status(200).json({
        exists: !!exists
    });
});


// Store a Git object pushed by Rusty
const storeObject = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;

    const repoName = (repo || owner)
        .replace(/\.git$/, '')
        .toLowerCase()
        .trim();

    const {
        type: objectType,
        hash,
        data
    } = req.body;

    if (!objectType || !hash || data === undefined) {
        throw new ApiError(
            400,
            'type, hash, and data are required'
        );
    }

    let repoDoc = await resolveRepo(
        owner && repo ? owner : null,
        repoName,
        req.user
    );

    if (!repoDoc) {
        throw new ApiError(404, 'Repository not found. Please create it first.');
    }

    if (repoDoc.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'You do not have permission to push to this repository');
    }

    await GitObject.updateOne(
        {
            repositoryId: repoDoc._id,
            hash
        },
        {
            $set: {
                repositoryId: repoDoc._id,
                hash,
                type: objectType,
                data:
                    typeof data === 'string'
                        ? data
                        : JSON.stringify(data),
                pushedBy: req.user._id,
            },
        },
        {
            upsert: true
        }
    );

    res.status(200).json({
        success: true,
        message: 'Object stored successfully',
        hash,
    });
});


// Update remote branch reference
const updateRef = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;

    const repoName = (repo || owner)
        .replace(/\.git$/, '')
        .toLowerCase()
        .trim();

    const {
        branch,
        commitHash
    } = req.body;

    if (!branch || !commitHash) {
        throw new ApiError(
            400,
            'branch and commitHash are required'
        );
    }

    const cleanBranch = branch
        .replace(/^refs\/heads\//, '')
        .trim();

    let repoDoc = await resolveRepo(
        owner && repo ? owner : null,
        repoName,
        req.user
    );

    if (!repoDoc) {
        throw new ApiError(404, 'Repository not found. Please create it first.');
    }

    if (repoDoc.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'You do not have permission to push to this repository');
    }

    // Inspect commit to extract metadata
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

    // Update existing branch or create it
    const branchIndex = repoDoc.branches.findIndex(
        (b) => b.name === cleanBranch
    );

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
        message:
            commitData.message ||
            `Update ${cleanBranch}`,
        tree: commitData.tree,
        parent: commitData.parent,
        author:
            req.user.username ||
            req.user.email,
        date: new Date(),
    };

    await repoDoc.save();

    res.status(200).json({
        success: true,
        message:
            `Successfully pushed to branch '${cleanBranch}'`,
        data: {
            branch: cleanBranch,
            commitHash,
            repo: repoDoc.name,
        },
    });
});


// ─── Fetch: Get Remote Branch Reference ──────────────────────────────

const getRemoteRef = asyncHandler(async (req, res) => {
    const { owner, repo, branch } = req.params;

    const repoName = (repo || owner)
        .replace(/\.git$/, '')
        .toLowerCase()
        .trim();

    const repoDoc = await resolveRepo(
        owner && repo ? owner : null,
        repoName,
        req.user
    );

    if (!repoDoc) {
        throw new ApiError(
            404,
            'Repository not found'
        );
    }

    const branchDoc = repoDoc.branches.find(
        (b) => b.name === branch
    );

    if (!branchDoc || !branchDoc.commitHash) {
        throw new ApiError(
            404,
            `Branch '${branch}' not found`
        );
    }

    res.status(200).json({
        success: true,
        branch: branchDoc.name,
        commitHash: branchDoc.commitHash,
    });
});


// ─── Fetch: Download Git Object ──────────────────────────────────────

const getObject = asyncHandler(async (req, res) => {
    const { owner, repo, hash } = req.params;

    const repoName = (repo || owner)
        .replace(/\.git$/, '')
        .toLowerCase()
        .trim();

    const repoDoc = await resolveRepo(
        owner && repo ? owner : null,
        repoName,
        req.user
    );

    if (!repoDoc) {
        throw new ApiError(
            404,
            'Repository not found'
        );
    }

    const object = await GitObject.findOne({
        repositoryId: repoDoc._id,
        hash,
    });

    if (!object) {
        throw new ApiError(
            404,
            'Git object not found'
        );
    }

    res.status(200).json({
        success: true,
        hash: object.hash,
        type: object.type,
        data: object.data,
    });
});


module.exports = {
    checkObjectExists,
    storeObject,
    updateRef,
    getRemoteRef,
    getObject,
};
