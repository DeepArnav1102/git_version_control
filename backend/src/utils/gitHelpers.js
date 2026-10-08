const GitObject = require('../models/GitObject.model');

const diff = require('diff');

function generateUnifiedDiff(oldStr, newStr) {
    if (oldStr.length > 200000 || newStr.length > 200000) {
        return { diffText: 'File is too large to display diffs.', additions: 0, deletions: 0 };
    }
    
    // We just want additions and deletions count easily, so we can still use diffLines for stats
    const changes = diff.diffLines(oldStr, newStr);
    let additions = 0;
    let deletions = 0;
    changes.forEach(change => {
        const linesCount = change.value.replace(/\n$/, '').split('\n').length;
        if (change.added) additions += linesCount;
        if (change.removed) deletions += linesCount;
    });

    // Generate context-aware patch
    const patch = diff.createPatch('file', oldStr, newStr, '', '', { context: 3 });
    const patchLines = patch.split('\n');
    
    // Strip the headers from createPatch output (first 4 lines usually)
    // Format:
    // Index: file
    // ===================================================================
    // --- file
    // +++ file
    // @@ -l,c +l,c @@
    let startIndex = 0;
    for (let i = 0; i < patchLines.length; i++) {
        if (patchLines[i].startsWith('@@ ')) {
            startIndex = i;
            break;
        }
    }
    
    const diffText = patchLines.slice(startIndex).join('\n');

    return { diffText, additions, deletions };
}

// Batched Traversal to find the true LCA and all commits in between
async function getCommitGraph(repoId, headHash, baseHash) {
    if (headHash === baseHash) {
        return { lcaHash: headHash, commits: [], commitMap: new Map() };
    }

    const commitMap = new Map();
    const headAncestors = new Set();
    const baseAncestors = new Set();
    
    let headQueue = [headHash];
    let baseQueue = [baseHash];
    let commonAncestors = [];
    
    let extraDepth = 0;
    let foundIntersection = false;

    while ((headQueue.length > 0 || baseQueue.length > 0) && extraDepth < 10) {
        if (foundIntersection) extraDepth++;

        const hashesToFetch = [...new Set([...headQueue, ...baseQueue])].filter(h => !commitMap.has(h));
        
        if (hashesToFetch.length > 0) {
            const repoIds = Array.isArray(repoId) ? repoId : [repoId];
            const objs = await GitObject.find({ repositoryId: { $in: repoIds }, hash: { $in: hashesToFetch }, type: 'commit' });
            for (const obj of objs) {
                try {
                    commitMap.set(obj.hash, { parsed: typeof obj.data === 'string' ? JSON.parse(obj.data) : obj.data, createdAt: obj.createdAt });
                } catch {}
            }
        }

        const nextHeadQueue = [];
        for (const h of headQueue) {
            if (!headAncestors.has(h)) {
                headAncestors.add(h);
                if (baseAncestors.has(h)) {
                    foundIntersection = true;
                    commonAncestors.push(h);
                }
                const entry = commitMap.get(h);
                if (entry) {
                    const data = entry.parsed;
                    if (data.parent) nextHeadQueue.push(data.parent);
                    if (data.parents) nextHeadQueue.push(...data.parents);
                }
            }
        }
        headQueue = [...new Set(nextHeadQueue)];

        const nextBaseQueue = [];
        for (const h of baseQueue) {
            if (!baseAncestors.has(h)) {
                baseAncestors.add(h);
                if (headAncestors.has(h)) {
                    foundIntersection = true;
                    commonAncestors.push(h);
                }
                const entry = commitMap.get(h);
                if (entry) {
                    const data = entry.parsed;
                    if (data.parent) nextBaseQueue.push(data.parent);
                    if (data.parents) nextBaseQueue.push(...data.parents);
                }
            }
        }
        baseQueue = [...new Set(nextBaseQueue)];
    }

    const uniqueCommon = [...new Set(commonAncestors)];
    uniqueCommon.sort((a, b) => {
        const dateA = new Date(commitMap.get(a)?.parsed?.date || commitMap.get(a)?.createdAt || 0);
        const dateB = new Date(commitMap.get(b)?.parsed?.date || commitMap.get(b)?.createdAt || 0);
        return dateB - dateA;
    });

    const lcaHash = uniqueCommon.length > 0 ? uniqueCommon[0] : null;

    const commits = [];
    for (const h of headAncestors) {
        if (!baseAncestors.has(h)) {
            const entry = commitMap.get(h);
            if (entry) {
                commits.push({
                    hash: h,
                    message: entry.parsed.message,
                    author: entry.parsed.author || 'Contributor',
                    date: entry.parsed.date || entry.createdAt,
                    authorProfilePicture: null
                });
            }
        }
    }
    commits.sort((a, b) => new Date(b.date) - new Date(a.date));

    return { lcaHash, commits, commitMap };
}

// Fetch and flatten a tree from MongoDB iteratively using batch fetches (Resolves N+1 query problem)
async function flattenTree(repoId, rootTreeHash) {
    const flatTree = {};
    if (!rootTreeHash) return flatTree;

    // Queue format: { hash, prefix }
    let queue = [{ hash: rootTreeHash, prefix: '' }];

    while (queue.length > 0) {
        // 1. Gather all unique tree hashes for this depth level
        const hashesToFetch = [...new Set(queue.map(q => q.hash))];
        
        const repoQuery = Array.isArray(repoId) ? { $in: repoId } : repoId;
        // 2. Fetch them all in a single batch query!
        const treeObjects = await GitObject.find({ 
            repositoryId: repoQuery, 
            hash: { $in: hashesToFetch }, 
            type: 'tree' 
        });

        // 3. Create a lookup map for instant access
        const treeMap = {};
        for (const obj of treeObjects) {
            treeMap[obj.hash] = obj.data;
        }

        const nextQueue = [];

        // 4. Process the current queue and queue up the next level of trees
        for (const { hash, prefix } of queue) {
            const dataStr = treeMap[hash];
            if (!dataStr) continue;

            let entries = [];
            try {
                const parsed = JSON.parse(dataStr);
                entries = Array.isArray(parsed) ? parsed : (parsed.entries || []);
            } catch (e) {
                entries = [];
            }

            for (const entry of entries) {
                const name = entry.name;
                const type = entry.type || entry.object_type;
                const entryHash = entry.hash || entry.object_hash;
                
                const fullPath = prefix ? `${prefix}/${name}` : name;
                
                if (type === 'blob') {
                    flatTree[fullPath] = entryHash;
                } else if (type === 'tree') {
                    nextQueue.push({ hash: entryHash, prefix: fullPath });
                }
            }
        }

        // Move to the next depth level
        queue = nextQueue;
    }
    
    return flatTree;
}

const crypto = require('crypto');

// Rebuilds nested tree objects from a flat map and saves them to MongoDB
// Returns the hash of the root tree
async function buildAndSaveTree(repoId, flatTree, userId) {
    const root = {};
    for (const [fullPath, hash] of Object.entries(flatTree)) {
        const parts = fullPath.split('/');
        let current = root;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = hash; // Blob hash
    }

    async function processNode(node) {
        const entries = [];
        for (const [name, content] of Object.entries(node)) {
            if (typeof content === 'string') {
                entries.push({ mode: '100644', name, object_hash: content, object_type: 'blob' });
            } else {
                const subTreeHash = await processNode(content);
                entries.push({ mode: '040000', name, object_hash: subTreeHash, object_type: 'tree' });
            }
        }
        
        const treeObj = { entries };
        const dataStr = JSON.stringify(treeObj);
        const hash = crypto.createHash('sha256').update(dataStr).digest('hex');
        
        await GitObject.updateOne(
            { repositoryId: repoId, hash },
            { $set: { repositoryId: repoId, hash, type: 'tree', data: dataStr, pushedBy: userId } },
            { upsert: true }
        );
        return hash;
    }

    return await processNode(root);
}

module.exports = {
    getCommitGraph,
    generateUnifiedDiff,
    flattenTree,
    buildAndSaveTree
};
