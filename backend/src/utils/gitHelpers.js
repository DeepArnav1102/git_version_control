const GitObject = require('../models/GitObject.model');

// Find Lowest Common Ancestor (LCA)
async function findCommonAncestor(repoId, commitHash1, commitHash2) {
    if (commitHash1 === commitHash2) return commitHash1;

    const visited1 = new Set();
    const visited2 = new Set();
    const queue1 = [commitHash1];
    const queue2 = [commitHash2];

    while (queue1.length > 0 || queue2.length > 0) {
        if (queue1.length > 0) {
            const curr1 = queue1.shift();
            if (visited2.has(curr1)) return curr1;
            visited1.add(curr1);
            
            const commit1 = await GitObject.findOne({ repositoryId: repoId, hash: curr1, type: 'commit' });
            if (commit1) {
                const data = JSON.parse(commit1.data);
                if (data.parent) queue1.push(data.parent);
                if (data.parents) queue1.push(...data.parents);
            }
        }

        if (queue2.length > 0) {
            const curr2 = queue2.shift();
            if (visited1.has(curr2)) return curr2;
            visited2.add(curr2);
            
            const commit2 = await GitObject.findOne({ repositoryId: repoId, hash: curr2, type: 'commit' });
            if (commit2) {
                const data = JSON.parse(commit2.data);
                if (data.parent) queue2.push(data.parent);
                if (data.parents) queue2.push(...data.parents);
            }
        }
    }
    return null;
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
        
        // 2. Fetch them all in a single batch query!
        const treeObjects = await GitObject.find({ 
            repositoryId: repoId, 
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
    findCommonAncestor,
    flattenTree,
    buildAndSaveTree
};
