const mongoose = require('mongoose');
const User = require('../models/User.model');
const Repository = require('../models/Repository.model');
const GitObject = require('../models/GitObject.model');

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
    const repo = await Repository.findOne({ owner: ownerId, name: normalizedRepoName });
    if (!repo) return null;

    // Enforce privacy: private repos are only accessible to owner and approved collaborators
    if (repo.isPrivate) {
        const userIdStr = currentUser?._id ? currentUser._id.toString() : null;
        if (!userIdStr) return null;
        const isOwner = repo.owner.toString() === userIdStr;
        const isCollaborator = Array.isArray(repo.collaborators) && repo.collaborators.some(c => {
            const cId = c.user?._id ? c.user._id.toString() : c.user?.toString();
            return cId === userIdStr;
        });
        if (!isOwner && !isCollaborator) return null;
    }

    return repo;
};

// Helper to parse GitObject data (handles JSON, string, and base64-encoded JSON)
const parseGitObjectData = (obj) => {
    if (!obj || obj.data === undefined || obj.data === null) return null;
    let raw = obj.data;
    if (typeof raw !== 'string') return raw;

    // Check if encoded as base64
    if (obj.encoding === 'base64') {
        try {
            raw = Buffer.from(raw, 'base64').toString('utf8');
        } catch {}
    }

    try {
        return JSON.parse(raw);
    } catch {
        // Fallback: if not explicitly marked base64, attempt base64 decode if it looks like base64
        try {
            const decoded = Buffer.from(raw, 'base64').toString('utf8');
            return JSON.parse(decoded);
        } catch {
            return raw;
        }
    }
};

// Helper: recursively build full directory tree hierarchy for navigation tree
const buildRecursiveTree = async (treeHash, repositoryId, currentSubPath = '') => {
    const obj = await GitObject.findOne({
        repositoryId,
        hash: treeHash,
        type: 'tree',
    });
    if (!obj) return [];
    let parsed;
    try {
        parsed = parseGitObjectData(obj);
    } catch {
        return [];
    }
    const rawEntries = parsed.entries || [];
    const result = [];
    for (const entry of rawEntries) {
        const entryPath = currentSubPath ? `${currentSubPath}/${entry.name}` : entry.name;
        if (entry.object_type === 'tree') {
            const children = await buildRecursiveTree(entry.object_hash, repositoryId, entryPath);
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

/**
 * Atomically updates a branch's commitHash and updatedAt, creating the branch if it doesn't exist,
 * and updates latestCommit. Prevents race conditions during concurrent pushes/merges.
 */
const updateBranchCommit = async (repoId, branchName, commitHash, latestCommitData = null) => {
    const now = new Date();
    const setFields = {
        'branches.$.commitHash': commitHash,
        'branches.$.updatedAt': now,
    };
    if (latestCommitData) {
        setFields.latestCommit = latestCommitData;
    }

    // Try updating existing branch
    let updatedRepo = await Repository.findOneAndUpdate(
        { _id: repoId, 'branches.name': branchName },
        { $set: setFields },
        { returnDocument: 'after' }
    );

    // If branch didn't exist in array, push it atomically
    if (!updatedRepo) {
        const updateDoc = {
            $push: {
                branches: {
                    name: branchName,
                    commitHash,
                    updatedAt: now,
                }
            }
        };
        if (latestCommitData) {
            updateDoc.$set = { latestCommit: latestCommitData };
        }
        updatedRepo = await Repository.findByIdAndUpdate(
            repoId,
            updateDoc,
            { returnDocument: 'after' }
        );
    }

    if (updatedRepo && !updatedRepo.defaultBranch) {
        updatedRepo = await Repository.findByIdAndUpdate(
            repoId,
            { $set: { defaultBranch: branchName } },
            { returnDocument: 'after' }
        );
    }

    return updatedRepo;
};

module.exports = {
    resolveUser,
    resolveRepo,
    buildRecursiveTree,
    updateBranchCommit,
    parseGitObjectData,
};

