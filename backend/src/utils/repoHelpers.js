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
    return await Repository.findOne({ owner: ownerId, name: normalizedRepoName });
};

// Helper: recursively build full directory tree hierarchy for navigation tree
const buildRecursiveTree = async (treeHash, repositoryId, currentSubPath = '') => {
    let obj = await GitObject.findOne({
        repositoryId,
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

module.exports = {
    resolveUser,
    resolveRepo,
    buildRecursiveTree
};
