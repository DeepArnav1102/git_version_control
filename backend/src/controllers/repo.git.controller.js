const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository.model');
const GitObject = require('../models/GitObject.model');
const User = require('../models/User.model');
const mongoose = require('mongoose');
const { resolveUser, resolveRepo } = require('../utils/repoHelpers');
const { getCommitGraph, generateUnifiedDiff, flattenTree } = require('../utils/gitHelpers');

async function getLastCommitsForEntries(repoId, startCommitHash, pathSegments, entries) {
    const unresolved = new Set(entries.map(e => e.name));
    const result = {};
    let currentHash = startCommitHash;
    let limit = 50; // Max commits to traverse to prevent hanging

    while (unresolved.size > 0 && currentHash && limit > 0) {
        limit--;
        let commitObj = await GitObject.findOne({ repositoryId: repoId, hash: currentHash, type: 'commit' });
        if (!commitObj) commitObj = await GitObject.findOne({ hash: currentHash, type: 'commit' });
        if (!commitObj) break;

        const currData = typeof commitObj.data === 'string' ? JSON.parse(commitObj.data) : commitObj.data;
        const parentHash = currData.parent || (currData.parents && currData.parents.length > 0 ? currData.parents[0] : null);

        if (!parentHash) {
            // First commit ever, everything left was created here
            for (const name of unresolved) {
                result[name] = { hash: currentHash, message: currData.message, date: currData.date || commitObj.createdAt, author: currData.author };
            }
            break;
        }

        async function getTreeHashForPath(rootTreeHash, segments) {
            if (!segments || segments.length === 0) return rootTreeHash;
            let currentTree = rootTreeHash;
            for (const seg of segments) {
                if (!currentTree) return null;
                let tObj = await GitObject.findOne({ repositoryId: repoId, hash: currentTree, type: 'tree' });
                if (!tObj) tObj = await GitObject.findOne({ hash: currentTree, type: 'tree' });
                if (!tObj) return null;
                const tData = typeof tObj.data === 'string' ? JSON.parse(tObj.data) : tObj.data;
                const match = tData.entries?.find(e => e.name === seg && e.object_type === 'tree');
                currentTree = match ? match.object_hash : null;
            }
            return currentTree;
        }

        const currDirHash = await getTreeHashForPath(currData.tree, pathSegments);
        
        let parentCommitObj = await GitObject.findOne({ repositoryId: repoId, hash: parentHash, type: 'commit' });
        if (!parentCommitObj) parentCommitObj = await GitObject.findOne({ hash: parentHash, type: 'commit' });
        if (!parentCommitObj) {
            for (const name of unresolved) {
                result[name] = { hash: currentHash, message: currData.message, date: currData.date || commitObj.createdAt, author: currData.author };
            }
            break;
        }
        
        const parentData = typeof parentCommitObj.data === 'string' ? JSON.parse(parentCommitObj.data) : parentCommitObj.data;
        const parentDirHash = await getTreeHashForPath(parentData.tree, pathSegments);

        if (currDirHash !== parentDirHash) {
            if (!parentDirHash) {
                for (const name of unresolved) {
                    result[name] = { hash: currentHash, message: currData.message, date: currData.date || commitObj.createdAt, author: currData.author };
                }
                break;
            }

            let currTreeObj = await GitObject.findOne({ repositoryId: repoId, hash: currDirHash, type: 'tree' });
            if (!currTreeObj) currTreeObj = await GitObject.findOne({ hash: currDirHash, type: 'tree' });
            
            let parentTreeObj = await GitObject.findOne({ repositoryId: repoId, hash: parentDirHash, type: 'tree' });
            if (!parentTreeObj) parentTreeObj = await GitObject.findOne({ hash: parentDirHash, type: 'tree' });

            const currTreeData = currTreeObj ? (typeof currTreeObj.data === 'string' ? JSON.parse(currTreeObj.data) : currTreeObj.data) : { entries: [] };
            const parentTreeData = parentTreeObj ? (typeof parentTreeObj.data === 'string' ? JSON.parse(parentTreeObj.data) : parentTreeObj.data) : { entries: [] };

            const getEntryHash = (treeData, name) => treeData.entries?.find(e => e.name === name)?.object_hash;

            for (const name of Array.from(unresolved)) {
                if (getEntryHash(currTreeData, name) !== getEntryHash(parentTreeData, name)) {
                    result[name] = { hash: currentHash, message: currData.message, date: currData.date || commitObj.createdAt, author: currData.author };
                    unresolved.delete(name);
                }
            }
        }

        currentHash = parentHash;
    }
    
    return result;
}

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
    let entries = [...(treeData.entries || [])].sort((a, b) => {
        if (a.object_type === b.object_type) return a.name.localeCompare(b.name);
        return a.object_type === 'tree' ? -1 : 1;
    });

    const pathSegments = cleanPath ? cleanPath.split('/').filter(Boolean) : [];
    const entryCommits = await getLastCommitsForEntries(repoDoc._id, commitHash, pathSegments, entries);
    entries = entries.map(e => ({
        ...e,
        commit: entryCommits[e.name] || null
    }));

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
        
        const parentHash = commitData.parent || (commitData.parents && commitData.parents.length > 0 ? commitData.parents[0] : null);
        
        commits.push({
            hash: currentHash,
            message: commitData.message,
            tree: commitData.tree,
            parent: parentHash,
            author: commitData.author || repoDoc.latestCommit?.author || 'Contributor',
            date: commitData.date || repoDoc.latestCommit?.date || entry.createdAt,
        });
        currentHash = parentHash;
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

const deleteRepoFile = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const filePathParam = req.params.filePath; // array in Express 5 wildcard
    const pathSegments = Array.isArray(filePathParam) ? filePathParam.filter(Boolean) : filePathParam.split('/').filter(Boolean);
    const filePath = pathSegments.join('/');
    const branchName = req.query.branch || 'main';

    if (!filePath) throw new ApiError(400, 'File path is required');

    const repoDoc = await resolveRepo(owner, repo, req.user);
    if (!repoDoc) throw new ApiError(404, 'Repository not found');

    if (repoDoc.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'You do not have permission to modify this repository');
    }

    const branch = repoDoc.branches.find(b => b.name === branchName);
    if (!branch) throw new ApiError(404, 'Branch not found');

    const commitObj = await GitObject.findOne({ repositoryId: repoDoc._id, hash: branch.commitHash, type: 'commit' });
    if (!commitObj) throw new ApiError(404, 'Commit not found');

    const commitData = typeof commitObj.data === 'string' ? JSON.parse(commitObj.data) : commitObj.data;
    const rootTreeHash = commitData.tree;

    // pathSegments already extracted above
    
    async function deleteFileFromTree(repositoryId, treeHash, segments, userId) {
        const treeObj = await GitObject.findOne({ repositoryId, hash: treeHash, type: 'tree' });
        if (!treeObj) throw new ApiError(404, 'Tree object not found');
        
        let parsed = typeof treeObj.data === 'string' ? JSON.parse(treeObj.data) : treeObj.data;
        let entries = parsed.entries || [];
        
        const segment = segments[0];
        const isTarget = segments.length === 1;
        
        let modified = false;
        let newEntries = [];
        let fileFound = false;
        
        for (const entry of entries) {
            if (entry.name === segment) {
                if (isTarget) {
                    modified = true;
                    fileFound = true;
                    continue; // Skip it
                } else if (entry.object_type === 'tree') {
                    const newChildHash = await deleteFileFromTree(repositoryId, entry.object_hash, segments.slice(1), userId);
                    if (newChildHash !== entry.object_hash) {
                        entry.object_hash = newChildHash;
                        modified = true;
                        fileFound = true;
                    }
                }
            }
            newEntries.push(entry);
        }
        
        if (isTarget && !fileFound) throw new ApiError(404, 'File not found in repository');
        if (!modified) return treeHash;
        
        const newData = JSON.stringify({ entries: newEntries });
        const newHash = crypto.createHash('sha1').update('tree ' + newData + Date.now().toString()).digest('hex');
        
        await GitObject.create({
            repositoryId,
            hash: newHash,
            type: 'tree',
            data: newData,
            pushedBy: userId
        });
        
        return newHash;
    }

    const newRootTreeHash = await deleteFileFromTree(repoDoc._id, rootTreeHash, pathSegments, req.user._id);

    if (newRootTreeHash === rootTreeHash) {
        throw new ApiError(400, 'File could not be deleted (no changes made)');
    }

    const newCommitData = {
        tree: newRootTreeHash,
        parent: branch.commitHash,
        author: req.user.username,
        message: `Delete ${filePath}`,
        date: new Date().toISOString()
    };
    
    const newCommitDataStr = JSON.stringify(newCommitData);
    const newCommitHash = crypto.createHash('sha1').update('commit ' + newCommitDataStr + Date.now().toString()).digest('hex');

    await GitObject.create({
        repositoryId: repoDoc._id,
        hash: newCommitHash,
        type: 'commit',
        data: newCommitDataStr,
        pushedBy: req.user._id
    });

    branch.commitHash = newCommitHash;
    branch.updatedAt = new Date();
    repoDoc.latestCommit = {
        hash: newCommitHash,
        message: newCommitData.message,
        author: newCommitData.author,
        date: newCommitData.date
    };
    await repoDoc.save();

    res.status(200).json({ success: true, message: 'File deleted successfully', newCommitHash });
});

// ─── Download Repo as ZIP ──────────────────────────────────────────────
const downloadRepoZip = asyncHandler(async (req, res) => {
    const { owner, repo, ref = 'main' } = req.params;

    const repoDoc = await resolveRepo(owner, repo, req.user);
    if (!repoDoc) throw new ApiError(404, 'Repository not found');

    if (repoDoc.isPrivate && (!req.user || repoDoc.owner.toString() !== req.user._id.toString())) {
        throw new ApiError(403, 'Access denied to private repository');
    }

    let commitHash = null;
    const branch = repoDoc.branches.find((b) => b.name === ref);
    if (branch) {
        commitHash = branch.commitHash;
    } else {
        commitHash = ref;
    }

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

    const { buildRecursiveTree } = require('../utils/repoHelpers');
    const treeMap = await buildRecursiveTree(commitData.tree, repoDoc._id);

    const AdmZip = require('adm-zip');
    const zip = new AdmZip();

    const appendToArchive = async (nodes) => {
        for (const node of nodes) {
            if (node.object_type === 'blob') {
                let blobObj = await GitObject.findOne({
                    repositoryId: repoDoc._id,
                    hash: node.object_hash,
                    type: 'blob',
                });
                if (!blobObj) {
                    blobObj = await GitObject.findOne({
                        hash: node.object_hash,
                        type: 'blob',
                    });
                }
                if (blobObj && blobObj.data) {
                    zip.addFile(node.path, Buffer.from(blobObj.data));
                }
            } else if (node.object_type === 'tree' && node.children) {
                await appendToArchive(node.children);
            }
        }
    };

    await appendToArchive(treeMap);

    const zipBuffer = zip.toBuffer();
    res.attachment(`${repoDoc.name}-${ref}.zip`);
    res.status(200).send(zipBuffer);
});

const compareBranches = asyncHandler(async (req, res) => {
    const { owner, repo, compareString } = req.params;
    
    // Security Validation: prevent regex/DOS payloads in compare string
    if (compareString.length > 512 || !/^[a-zA-Z0-9_\-\.\/:]+\.\.\.[a-zA-Z0-9_\-\.\/:]+$/.test(compareString)) {
        throw new ApiError(400, 'Invalid compare string format or length. Use base...head');
    }
    let baseRef, headRef;
    if (compareString.includes('...')) {
        [baseRef, headRef] = compareString.split('...');
    } else {
        throw new ApiError(400, 'Invalid compare string format or length. Use base...head');
    }

    let sourceOwner = owner;
    let sourceBranch = headRef;
    if (headRef.includes(':')) {
        [sourceOwner, sourceBranch] = headRef.split(':');
    }

    const repoDoc = await resolveRepo(owner, repo, req.user);
    if (!repoDoc) throw new ApiError(404, 'Base repository not found');

    let sourceRepoDoc = repoDoc;
    if (sourceOwner !== owner) {
        sourceRepoDoc = await resolveRepo(sourceOwner, repo, req.user);
        if (!sourceRepoDoc) throw new ApiError(404, 'Source repository not found');
    }

    const repoIds = [repoDoc._id];
    if (sourceOwner !== owner) repoIds.push(sourceRepoDoc._id);

    const resolveCommitHash = async (repoDocument, ref) => {
        const branch = repoDocument.branches.find(b => b.name === ref);
        if (branch) return branch.commitHash;
        const commitObj = await GitObject.findOne({ repositoryId: repoDocument._id, hash: ref, type: 'commit' });
        if (commitObj) return ref;
        return null;
    };

    const baseHash = await resolveCommitHash(repoDoc, baseRef);
    const headHash = await resolveCommitHash(sourceRepoDoc, sourceBranch);

    if (!baseHash || !headHash) {
        throw new ApiError(404, 'One or both branches/commits not found');
    }

    // Optimization: Traverse the graph efficiently in chunks without loading all commits
    const { lcaHash, commits, commitMap } = await getCommitGraph(repoIds, headHash, baseHash);

    if (lcaHash === headHash) {
        return res.status(200).json({ success: true, data: { upToDate: true } });
    }
    if (lcaHash === baseHash && commits.length === 0) {
        return res.status(200).json({ success: true, data: { identical: true } });
    }

    // Assign author profile pictures
    const uniqueAuthors = [...new Set(commits.map(c => c.author.toLowerCase()))];
    const authorUsers = await User.find({ username: { $in: uniqueAuthors } }).select('username profilePicture');
    const authorPfpMap = {};
    authorUsers.forEach(u => authorPfpMap[u.username.toLowerCase()] = u.profilePicture || null);
    commits.forEach(c => c.authorProfilePicture = authorPfpMap[c.author.toLowerCase()] || null);

    // Tree diffing
    const lcaCommit = commitMap.get(lcaHash);
    const headCommit = commitMap.get(headHash);
    
    const baseTreeHash = lcaCommit ? lcaCommit.parsed.tree : null;
    const headTreeHash = headCommit ? headCommit.parsed.tree : null;

    const baseTreeFlat = await flattenTree(repoIds, baseTreeHash);
    const headTreeFlat = await flattenTree(repoIds, headTreeHash);

    const allPaths = new Set([...Object.keys(baseTreeFlat), ...Object.keys(headTreeFlat)]);
    const changedFiles = [];
    
    const isBinaryExt = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        const binExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'pdf', 'zip', 'tar', 'gz', 'mp4', 'mp3', 'exe', 'node', 'dll', 'so', 'dylib', 'ttf', 'woff', 'woff2'];
        return binExts.includes(ext) || !filename.includes('.');
    };

    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const path of allPaths) {
        const bHash = baseTreeFlat[path];
        const hHash = headTreeFlat[path];

        if (bHash === hHash) continue; // No change

        let status = 'modified';
        if (!bHash) status = 'added';
        if (!hHash) status = 'deleted';

        let additions = 0;
        let deletions = 0;
        let diffText = '';
        const isBinary = isBinaryExt(path);

        if (!isBinary && status !== 'deleted') {
            const getBlob = async (h) => {
                if (!h) return '';
                const obj = await GitObject.findOne({ repositoryId: { $in: repoIds }, hash: h, type: 'blob' });
                return obj ? obj.data : '';
            };
            const oldStr = await getBlob(bHash);
            const newStr = await getBlob(hHash);
            
            const diffResult = generateUnifiedDiff(oldStr, newStr);
            diffText = diffResult.diffText;
            additions = diffResult.additions;
            deletions = diffResult.deletions;
        } else if (!isBinary && status === 'deleted') {
            const obj = await GitObject.findOne({ repositoryId: { $in: repoIds }, hash: bHash, type: 'blob' });
            const oldStr = obj ? obj.data : '';
            deletions = oldStr.split('\n').length;
        }

        totalAdditions += additions;
        totalDeletions += deletions;

        changedFiles.push({
            path,
            status,
            additions,
            deletions,
            isBinary,
            diffText: isBinary ? null : diffText
        });
    }

    // Mergeability check
    let mergeable = true;
    let conflictFiles = [];
    
    // nativeMerge expects baseTree (LCA), oursTree (base branch), theirsTree (head branch)
    const oursCommitHash = await resolveCommitHash(repoDoc, baseRef);
    const oursCommitEntry = commitMap.get(oursCommitHash);
    const oursTreeHash = oursCommitEntry ? oursCommitEntry.parsed.tree : null;
    const oursTreeFlat = await flattenTree(repoDoc._id, oursTreeHash);

    try {
        const nativeMerge = require('../../native-merge.node');
        const result = await nativeMerge.performMergeAsync({
            baseTree: JSON.stringify(baseTreeFlat),
            oursTree: JSON.stringify(oursTreeFlat),
            theirsTree: JSON.stringify(headTreeFlat)
        });
        if (!result.success) {
            mergeable = false;
            conflictFiles = result.conflictFiles || [];
        }
    } catch (e) {
        console.error('Merge check failed:', e);
        mergeable = false;
    }

    res.status(200).json({
        success: true,
        data: {
            upToDate: false,
            identical: false,
            mergeable,
            conflictFiles,
            commits,
            files: changedFiles,
            stats: {
                totalAdditions,
                totalDeletions,
                filesChanged: changedFiles.length,
                commitsCount: commits.length
            }
        }
    });
});

module.exports = { getRepoTree, getRepoBlob, getRepoCommits, deleteRepoFile, downloadRepoZip, compareBranches };