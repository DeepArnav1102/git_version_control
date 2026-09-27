const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository.model');
const GitObject = require('../models/GitObject.model');
const User = require('../models/User.model');
const mongoose = require('mongoose');
const { generateAndSendOtp, verifyOtp } = require('../services/otp.service');
const { resolveUser, resolveRepo } = require('../utils/repoHelpers');


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
        // Bulk-fetch ALL tree objects for this repo in one query, then walk in-memory (avoids N+1)
        const allTreeObjs = await GitObject.find({ repositoryId: repoDoc._id, type: 'tree' });
        const treeMap = new Map();
        for (const t of allTreeObjs) {
            try {
                treeMap.set(t.hash, typeof t.data === 'string' ? JSON.parse(t.data) : t.data);
            } catch { /* skip malformed */ }
        }

        const buildTree = (treeHash, currentSubPath = '') => {
            const parsed = treeMap.get(treeHash);
            if (!parsed) return [];
            const rawEntries = parsed.entries || [];
            const result = [];
            for (const entry of rawEntries) {
                const entryPath = currentSubPath ? `${currentSubPath}/${entry.name}` : entry.name;
                if (entry.object_type === 'tree') {
                    const children = buildTree(entry.object_hash, entryPath);
                    result.push({ name: entry.name, path: entryPath, object_hash: entry.object_hash, object_type: 'tree', children });
                } else {
                    result.push({ name: entry.name, path: entryPath, object_hash: entry.object_hash, object_type: 'blob' });
                }
            }
            return result.sort((a, b) => {
                if (a.object_type === b.object_type) return a.name.localeCompare(b.name);
                return a.object_type === 'tree' ? -1 : 1;
            });
        };

        fullTree = buildTree(commitData.tree, '');
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
                author: commitData.author || repoDoc.latestCommit?.author || 'Contributor',
                date: commitData.date || repoDoc.latestCommit?.date || repoDoc.updatedAt,
                authorProfilePicture: commitData.authorProfilePicture || null,
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

    // Security: deny access to blobs in private repos for non-owners
    if (repoDoc.isPrivate && (!req.user || repoDoc.owner.toString() !== req.user._id.toString())) {
        throw new ApiError(403, 'Access denied to private repository');
    }

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

    // Bulk-fetch ALL commit objects for this repo in one query — avoids N+1
    const allCommitObjs = await GitObject.find({ repositoryId: repoDoc._id, type: 'commit' });
    const commitMap = new Map();
    for (const obj of allCommitObjs) {
        try {
            const parsed = typeof obj.data === 'string' ? JSON.parse(obj.data) : obj.data;
            commitMap.set(obj.hash, { parsed, createdAt: obj.createdAt });
        } catch { /* skip malformed objects */ }
    }

    // Walk parent chain in-memory — same ordering and 50-commit cap as before
    const commits = [];
    const visited = new Set();

    while (currentHash && !visited.has(currentHash) && commits.length < 50) {
        visited.add(currentHash);
        const entry = commitMap.get(currentHash);
        if (!entry) break;

        const commitData = entry.parsed;
        commits.push({
            hash: currentHash,
            message: commitData.message,
            tree: commitData.tree,
            parent: commitData.parent,
            author: commitData.author || repoDoc.latestCommit?.author || 'Contributor',
            date: commitData.date || repoDoc.latestCommit?.date || entry.createdAt,
        });
        currentHash = commitData.parent || null;
    }

    // Resolve profile pictures for unique authors — single batch query
    const uniqueAuthors = [...new Set(commits.map(c => c.author.toLowerCase()))];
    const authorUsers = await User.find({ username: { $in: uniqueAuthors } }).select('username profilePicture');
    const authorPfpMap = {};
    authorUsers.forEach(u => {
        authorPfpMap[u.username.toLowerCase()] = u.profilePicture || null;
    });

    commits.forEach(c => {
        c.authorProfilePicture = authorPfpMap[c.author.toLowerCase()] || null;
    });

    res.status(200).json({
        success: true,
        data: commits,
    });
});

module.exports = { getRepoTree, getRepoBlob, getRepoCommits };