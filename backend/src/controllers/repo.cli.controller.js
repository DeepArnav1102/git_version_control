const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository.model');
const GitObject = require('../models/GitObject.model');
const { resolveRepo, updateBranchCommit, parseGitObjectData } = require('../utils/repoHelpers');
const { canUserPushToRepo } = require('../utils/permissionHelpers');


// ============================================================
// CHECK OBJECT EXISTS
// ============================================================

const checkObjectExists = asyncHandler(async (req, res) => {
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
        return res.status(200).json({
            exists: false,
        });
    }

    const exists = await GitObject.exists({
        repositoryId: repoDoc._id,
        hash,
    });

    return res.status(200).json({
        exists: !!exists,
    });
});


// ============================================================
// STORE GIT OBJECT
// ============================================================

const storeObject = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;

    const repoName = (repo || owner)
        .replace(/\.git$/, '')
        .toLowerCase()
        .trim();

    const {
        type: objectType,
        hash,
        data,
        encoding,
    } = req.body;

    if (!objectType || !hash || data === undefined) {
        throw new ApiError(
            400,
            'type, hash, and data are required'
        );
    }

    if (typeof hash !== 'string' || !/^[a-f0-9]{40,64}$/.test(hash)) {
        throw new ApiError(400, 'Invalid hash format');
    }

    if (typeof objectType !== 'string' || !['commit', 'tree', 'blob'].includes(objectType)) {
        throw new ApiError(400, 'Invalid object type');
    }

    const repoDoc = await resolveRepo(
        owner && repo ? owner : null,
        repoName,
        req.user
    );

    if (!repoDoc) {
        throw new ApiError(
            404,
            'Repository not found. Please create it first.'
        );
    }

    if (!canUserPushToRepo(repoDoc, req.user)) {
        throw new ApiError(
            403,
            'You do not have permission to push to this repository. You must be the owner or an approved contributor.'
        );
    }

    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    if (dataString.length > 50 * 1024 * 1024) { // 50MB limit
        throw new ApiError(400, 'Data payload exceeds 50MB limit');
    }

    const updateFields = {
        repositoryId: repoDoc._id,
        hash,
        type: objectType,
        data: dataString,
        pushedBy: req.user._id,
    };
    if (encoding === 'base64' || encoding === 'utf8') {
        updateFields.encoding = encoding;
    }

    await GitObject.updateOne(
        {
            repositoryId: repoDoc._id,
            hash,
        },
        {
            $set: updateFields,
        },
        {
            upsert: true,
        }
    );

    return res.status(200).json({
        success: true,
        message: 'Object stored successfully',
        hash,
    });
});


// ============================================================
// BATCH CHECK OBJECTS EXISTENCE (N+1 Elimination)
// ============================================================

const checkObjectsBatch = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const { hashes } = req.body;

    if (!Array.isArray(hashes)) {
        throw new ApiError(400, 'hashes must be an array of SHA-256 strings');
    }

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
        return res.status(200).json({
            existing: [],
            missing: hashes,
        });
    }

    const foundObjects = await GitObject.find({
        repositoryId: repoDoc._id,
        hash: { $in: hashes },
    }).select('hash -_id').lean();

    const existingSet = new Set(foundObjects.map((o) => o.hash));
    const existing = [];
    const missing = [];

    for (const h of hashes) {
        if (existingSet.has(h)) {
            existing.push(h);
        } else {
            missing.push(h);
        }
    }

    return res.status(200).json({
        success: true,
        existing,
        missing,
    });
});


// ============================================================
// BATCH STORE GIT OBJECTS (N+1 Elimination)
// ============================================================

const storeObjectsBatch = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const { objects } = req.body;

    if (!Array.isArray(objects)) {
        throw new ApiError(400, 'objects must be an array');
    }

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
        throw new ApiError(404, 'Repository not found');
    }

    if (!canUserPushToRepo(repoDoc, req.user)) {
        throw new ApiError(
            403,
            'You do not have permission to push to this repository.'
        );
    }

    if (objects.length === 0) {
        return res.status(200).json({
            success: true,
            storedCount: 0,
            stored: [],
        });
    }

    const bulkOps = [];
    const storedHashes = [];

    for (const obj of objects) {
        const { type: objectType, hash, data, encoding } = obj;

        if (!objectType || !hash || data === undefined) {
            continue;
        }

        if (typeof hash !== 'string' || !/^[a-f0-9]{40,64}$/.test(hash)) {
            continue;
        }

        if (!['commit', 'tree', 'blob'].includes(objectType)) {
            continue;
        }

        const dataString = typeof data === 'string' ? data : JSON.stringify(data);

        const setDoc = {
            repositoryId: repoDoc._id,
            hash,
            type: objectType,
            data: dataString,
            pushedBy: req.user._id,
        };
        if (encoding === 'base64' || encoding === 'utf8') {
            setDoc.encoding = encoding;
        }

        bulkOps.push({
            updateOne: {
                filter: {
                    repositoryId: repoDoc._id,
                    hash,
                },
                update: {
                    $set: setDoc,
                },
                upsert: true,
            },
        });

        storedHashes.push(hash);
    }

    if (bulkOps.length > 0) {
        await GitObject.bulkWrite(bulkOps, { ordered: false });
    }

    return res.status(200).json({
        success: true,
        storedCount: bulkOps.length,
        stored: storedHashes,
    });
});


// ============================================================
// BATCH GET GIT OBJECTS (N+1 Elimination)
// ============================================================

const getObjectsBatch = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const { hashes } = req.body;

    if (!Array.isArray(hashes)) {
        throw new ApiError(400, 'hashes must be an array of strings');
    }

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
        throw new ApiError(404, 'Repository not found');
    }

    if (hashes.length === 0) {
        return res.status(200).json({
            success: true,
            objects: [],
        });
    }

    const objects = await GitObject.find({
        repositoryId: repoDoc._id,
        hash: { $in: hashes },
    }).select('hash type data encoding -_id').lean();

    return res.status(200).json({
        success: true,
        count: objects.length,
        objects,
    });
});


// ============================================================
// UPDATE REMOTE BRANCH REF
// ============================================================

const updateRef = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;

    const repoName = (repo || owner)
        .replace(/\.git$/, '')
        .toLowerCase()
        .trim();

    const {
        branch,
        commitHash,
    } = req.body;

    if (!branch || !commitHash) {
        throw new ApiError(
            400,
            'branch and commitHash are required'
        );
    }

    if (typeof commitHash !== 'string' || !/^[a-f0-9]{40,64}$/.test(commitHash)) {
        throw new ApiError(400, 'Invalid commit hash format');
    }

    if (typeof branch !== 'string' || branch.length > 255 || !/^[a-zA-Z0-9_\-\.\/]+$/.test(branch)) {
        throw new ApiError(400, 'Invalid branch name');
    }

    const cleanBranch = branch
        .replace(/^refs\/heads\//, '')
        .trim();

    const repoDoc = await resolveRepo(
        owner && repo ? owner : null,
        repoName,
        req.user
    );

    if (!repoDoc) {
        throw new ApiError(
            404,
            'Repository not found. Please create it first.'
        );
    }

    if (!canUserPushToRepo(repoDoc, req.user)) {
        throw new ApiError(
            403,
            'You do not have permission to push to this repository. You must be the owner or an approved contributor.'
        );
    }

    const commitObj = await GitObject.findOne({
        repositoryId: repoDoc._id,
        hash: commitHash,
        type: 'commit',
    });

    let commitData = {};

    if (commitObj) {
        try {
            commitData = parseGitObjectData(commitObj) || {};
        } catch (error) {
            commitData = {};
        }
    }

    let safeMessage = commitData.message || `Update ${cleanBranch}`;
    if (typeof safeMessage !== 'string') safeMessage = String(safeMessage);
    if (safeMessage.length > 5000) safeMessage = safeMessage.substring(0, 5000) + '...';

    const latestCommitData = {
        hash: commitHash,
        message: safeMessage,
        tree: commitData.tree,
        parent:
            commitData.parent ||
            (
                commitData.parents &&
                commitData.parents.length > 0
                    ? commitData.parents[0]
                    : null
            ),
        author:
            req.user.username ||
            req.user.email,
        date: new Date(),
    };

    await updateBranchCommit(repoDoc._id, cleanBranch, commitHash, latestCommitData);

    return res.status(200).json({
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


// ============================================================
// GET ONE REMOTE BRANCH REF
// ============================================================

const getRemoteRef = asyncHandler(async (req, res) => {
    const {
        owner,
        repo,
        branch,
    } = req.params;

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
        (item) => item.name === branch
    );

    if (!branchDoc || !branchDoc.commitHash) {
        throw new ApiError(
            404,
            `Branch '${branch}' not found`
        );
    }

    return res.status(200).json({
        success: true,
        branch: branchDoc.name,
        commitHash: branchDoc.commitHash,
    });
});


// ============================================================
// GET ALL REMOTE BRANCH REFS
// ============================================================

const getRemoteRefs = asyncHandler(async (req, res) => {
    const {
        owner,
        repo,
    } = req.params;

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

    const branches = repoDoc.branches
        .filter(
            (branch) => branch.commitHash
        )
        .map((branch) => ({
            branch: branch.name,
            commitHash: branch.commitHash,
        }));

    return res.status(200).json({
        success: true,
        branches,
    });
});


// ============================================================
// DELETE REMOTE BRANCH
// ============================================================

const deleteRemoteRef = asyncHandler(async (req, res) => {
    const {
        owner,
        repo,
        branch,
    } = req.params;

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

    if (!canUserPushToRepo(repoDoc, req.user)) {
        throw new ApiError(
            403,
            'You do not have permission to delete branches in this repository'
        );
    }

    const cleanBranch = branch
        .replace(/^refs\/heads\//, '')
        .trim();

    if (
        cleanBranch === repoDoc.defaultBranch
    ) {
        throw new ApiError(
            400,
            `Cannot delete the default branch '${cleanBranch}'`
        );
    }

    const branchExists = repoDoc.branches.some(
        (item) => item.name === cleanBranch
    );

    if (!branchExists) {
        throw new ApiError(
            404,
            `Branch '${cleanBranch}' not found`
        );
    }

    await Repository.findByIdAndUpdate(repoDoc._id, {
        $pull: { branches: { name: cleanBranch } }
    });

    return res.status(200).json({
        success: true,
        message:
            `Branch '${cleanBranch}' deleted`,
        branch: cleanBranch,
    });
});


// ============================================================
// GET GIT OBJECT
// ============================================================

const getObject = asyncHandler(async (req, res) => {
    const {
        owner,
        repo,
        hash,
    } = req.params;

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

    return res.status(200).json({
        success: true,
        hash: object.hash,
        type: object.type,
        data: object.data,
        encoding: object.encoding || undefined,
    });
});


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    checkObjectExists,
    checkObjectsBatch,
    storeObject,
    storeObjectsBatch,
    getObjectsBatch,
    updateRef,
    getRemoteRef,
    getRemoteRefs,
    deleteRemoteRef,
    getObject,
};
