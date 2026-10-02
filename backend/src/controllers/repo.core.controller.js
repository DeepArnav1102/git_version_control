const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository.model');
const GitObject = require('../models/GitObject.model');
const User = require('../models/User.model');
const Notification = require('../models/Notification.model');
const mongoose = require('mongoose');
const { generateAndSendOtp, verifyOtp } = require('../services/otp.service');
const { resolveUser, resolveRepo } = require('../utils/repoHelpers');
const checkRepoAvailability = asyncHandler(async (req, res) => {
    const { name } = req.query;
    if (!name || typeof name !== 'string') {
        throw new ApiError(400, 'Repository name is required');
    }

    const cleanName = name.replace(/\.git$/, '').toLowerCase().trim();
    if (!/^[a-zA-Z0-9_\-.]+$/.test(cleanName)) {
        return res.status(200).json({ success: true, available: false, message: 'Invalid characters' });
    }

    const existing = await Repository.findOne({ owner: req.user._id, name: cleanName });
    if (existing) {
        return res.status(200).json({ success: true, available: false });
    }

    res.status(200).json({ success: true, available: true });
});

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
    const { name, description, isPrivate, defaultBranch, topics, features } = req.body;

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
    
    if (topics !== undefined && Array.isArray(topics)) {
        repoDoc.topics = topics;
    }

    if (features !== undefined && typeof features === 'object') {
        repoDoc.features = {
            hasIssues: features.hasIssues !== undefined ? features.hasIssues : repoDoc.features?.hasIssues,
            hasPullRequests: features.hasPullRequests !== undefined ? features.hasPullRequests : repoDoc.features?.hasPullRequests,
            hasWiki: features.hasWiki !== undefined ? features.hasWiki : repoDoc.features?.hasWiki
        };
    }
    
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
    await repoDoc.populate({
        path: 'parentRepo',
        populate: {
            path: 'owner',
            select: 'username'
        }
    });
    await repoDoc.populate('collaborators.user', 'username email name profilePicture');
    await repoDoc.populate('pendingInvites.user', 'username email name profilePicture');

    let responseData = repoDoc.toObject();

    if (repoDoc.isFork && repoDoc.parentRepo) {
        let ahead = 0;
        let behind = 0;
        const parentRepoId = repoDoc.parentRepo._id || repoDoc.parentRepo;
        const parentRepo = await Repository.findById(parentRepoId);
        
        if (parentRepo) {
            const forkBranch = repoDoc.branches.find(b => b.name === repoDoc.defaultBranch);
            const parentBranch = parentRepo.branches.find(b => b.name === parentRepo.defaultBranch);
            
            let forkHash = forkBranch ? forkBranch.commitHash : null;
            let parentHash = parentBranch ? parentBranch.commitHash : null;
            
            if (forkHash && parentHash) {
                const allCommitObjs = await GitObject.find({ 
                    $or: [{ repositoryId: repoDoc._id }, { repositoryId: parentRepo._id }],
                    type: 'commit' 
                });
                const commitMap = new Map();
                for (const obj of allCommitObjs) {
                    try {
                        const parsed = typeof obj.data === 'string' ? JSON.parse(obj.data) : obj.data;
                        commitMap.set(obj.hash, parsed);
                    } catch {}
                }

                const parentAncestors = new Set();
                let currP = parentHash;
                while (currP) {
                    parentAncestors.add(currP);
                    const c = commitMap.get(currP);
                    currP = c ? (c.parent || (c.parents && c.parents.length > 0 ? c.parents[0] : null)) : null;
                }

                let currF = forkHash;
                let commonAncestor = null;
                while (currF) {
                    if (parentAncestors.has(currF)) {
                        commonAncestor = currF;
                        break;
                    }
                    ahead++;
                    const c = commitMap.get(currF);
                    currF = c ? (c.parent || (c.parents && c.parents.length > 0 ? c.parents[0] : null)) : null;
                }

                currP = parentHash;
                while (currP && currP !== commonAncestor) {
                    behind++;
                    const c = commitMap.get(currP);
                    currP = c ? (c.parent || (c.parents && c.parents.length > 0 ? c.parents[0] : null)) : null;
                }
            }
        }
        responseData.ahead = ahead;
        responseData.behind = behind;
    }

    res.status(200).json({
        success: true,
        data: responseData,
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

    // Recursive function to get all fork IDs
    const getAllForkIds = async (repoId) => {
        const forks = await Repository.find({ parentRepo: repoId }, '_id');
        let allIds = [];
        for (const fork of forks) {
            allIds.push(fork._id);
            const childIds = await getAllForkIds(fork._id);
            allIds = allIds.concat(childIds);
        }
        return allIds;
    };

    const forkIds = await getAllForkIds(repoDoc._id);
    const allRepoIdsToDelete = [repoDoc._id, ...forkIds];

    // Delete all GitObjects associated with this repository and its forks
    await GitObject.deleteMany({ repositoryId: { $in: allRepoIdsToDelete } });
    
    // Delete the repository documents
    await Repository.deleteMany({ _id: { $in: allRepoIdsToDelete } });

    res.status(200).json({
        success: true,
        message: 'Repository and its forks deleted successfully'
    });
});

const toggleStarRepo = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const repoDoc = await resolveRepo(owner, repo, req.user);
    
    if (!repoDoc) throw new ApiError(404, 'Repository not found');

    const currentUser = await User.findById(req.user._id);
    const isStarred = currentUser.starredRepos.includes(repoDoc._id);

    if (isStarred) {
        currentUser.starredRepos.pull(repoDoc._id);
        repoDoc.starsCount = Math.max(0, (repoDoc.starsCount || 0) - 1);
        await Notification.findOneAndDelete({
            recipient: repoDoc.owner,
            actor: req.user._id,
            type: 'STAR',
            repo: repoDoc._id,
        }).catch(err => console.error("Notification delete error:", err));
    } else {
        currentUser.starredRepos.push(repoDoc._id);
        repoDoc.starsCount = (repoDoc.starsCount || 0) + 1;
        if (repoDoc.owner.toString() !== req.user._id.toString()) {
            await Notification.create({
                recipient: repoDoc.owner,
                actor: req.user._id,
                type: 'STAR',
                repo: repoDoc._id,
            }).catch(err => console.error("Notification create error:", err));
        }
    }

    await currentUser.save();
    await repoDoc.save();

    res.status(200).json({
        success: true,
        message: isStarred ? 'Repository unstarred' : 'Repository starred',
        data: { isStarred: !isStarred, starsCount: repoDoc.starsCount }
    });
});

const forkRepo = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const sourceRepo = await resolveRepo(owner, repo, req.user);
    
    if (!sourceRepo) {
        throw new ApiError(404, 'Source repository not found');
    }

    if (sourceRepo.owner.toString() === req.user._id.toString()) {
        throw new ApiError(400, 'You cannot fork your own repository');
    }

    const existingFork = await Repository.findOne({
        owner: req.user._id,
        name: sourceRepo.name
    });

    if (existingFork) {
        throw new ApiError(400, `You already have a repository named '${sourceRepo.name}'`);
    }

    const forkedRepo = await Repository.create({
        name: sourceRepo.name,
        owner: req.user._id,
        description: sourceRepo.description,
        isPrivate: sourceRepo.isPrivate,
        defaultBranch: sourceRepo.defaultBranch,
        branches: sourceRepo.branches.map(b => ({
            name: b.name,
            commitHash: b.commitHash,
            updatedAt: Date.now()
        })),
        latestCommit: sourceRepo.latestCommit,
        isFork: true,
        parentRepo: sourceRepo._id,
        rootRepo: sourceRepo.rootRepo || sourceRepo._id
    });
    
    // update source repo forks count
    sourceRepo.forksCount = (sourceRepo.forksCount || 0) + 1;
    await sourceRepo.save();

    // Copy all GitObjects from source to the new fork
    const sourceObjects = await GitObject.find({ repositoryId: sourceRepo._id }).lean();
    if (sourceObjects.length > 0) {
        const newObjects = sourceObjects.map(obj => ({
            repositoryId: forkedRepo._id,
            hash: obj.hash,
            type: obj.type,
            data: obj.data,
            pushedBy: req.user._id
        }));
        await GitObject.insertMany(newObjects);
    }

    res.status(201).json({
        success: true,
        message: 'Repository forked successfully',
        data: forkedRepo
    });
});

const syncRepo = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const forkedRepo = await resolveRepo(owner, repo, req.user);
    
    if (!forkedRepo) throw new ApiError(404, 'Repository not found');
    if (!forkedRepo.isFork || !forkedRepo.parentRepo) {
        throw new ApiError(400, 'This repository is not a fork');
    }
    
    if (forkedRepo.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'You do not have permission to sync this repository');
    }

    const parentRepo = await Repository.findById(forkedRepo.parentRepo);
    if (!parentRepo) {
        throw new ApiError(404, 'Parent repository no longer exists');
    }

    // Fast-forward sync: copy missing objects from parent to fork
    // Fetch only the hashes to save memory
    const parentHashesDocs = await GitObject.find({ repositoryId: parentRepo._id }, { hash: 1 }).lean();
    const forkHashesDocs = await GitObject.find({ repositoryId: forkedRepo._id }, { hash: 1 }).lean();
    
    const forkHashes = new Set(forkHashesDocs.map(o => o.hash));
    const missingHashes = parentHashesDocs.map(o => o.hash).filter(hash => !forkHashes.has(hash));

    if (missingHashes.length > 0) {
        // Fetch only the full objects we actually need to copy
        const missingObjects = await GitObject.find({ 
            repositoryId: parentRepo._id, 
            hash: { $in: missingHashes } 
        }).lean();

        const objectsToCopy = missingObjects.map(o => ({
            repositoryId: forkedRepo._id,
            hash: o.hash,
            type: o.type,
            data: o.data,
            pushedBy: req.user._id
        }));

        await GitObject.insertMany(objectsToCopy);
    }

    // Update branches
    const parentDefaultBranch = parentRepo.branches.find(b => b.name === parentRepo.defaultBranch);
    if (parentDefaultBranch) {
        const forkBranchIndex = forkedRepo.branches.findIndex(b => b.name === forkedRepo.defaultBranch);
        if (forkBranchIndex !== -1) {
            forkedRepo.branches[forkBranchIndex].commitHash = parentDefaultBranch.commitHash;
            forkedRepo.branches[forkBranchIndex].updatedAt = Date.now();
        } else {
            forkedRepo.branches.push({
                name: parentRepo.defaultBranch,
                commitHash: parentDefaultBranch.commitHash,
                updatedAt: Date.now()
            });
            forkedRepo.defaultBranch = parentRepo.defaultBranch;
        }
        forkedRepo.latestCommit = parentRepo.latestCommit;
        await forkedRepo.save();
    }

    res.status(200).json({
        success: true,
        message: 'Repository synced successfully',
        data: forkedRepo
    });
});

const inviteCollaborator = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;
    const { username, role = 'read' } = req.body;

    const repoDoc = await resolveRepo(owner, repo, req.user);
    if (!repoDoc) throw new ApiError(404, 'Repository not found');

    if (repoDoc.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, 'Only the repository owner can invite collaborators');
    }

    const invitee = await User.findOne({ username });
    if (!invitee) throw new ApiError(404, 'User not found');

    if (invitee._id.toString() === req.user._id.toString()) {
        throw new ApiError(400, 'You cannot invite yourself');
    }

    const isAlreadyCollaborator = repoDoc.collaborators.some(c => c.user.toString() === invitee._id.toString());
    if (isAlreadyCollaborator) {
        throw new ApiError(400, 'User is already a collaborator');
    }

    const hasPendingInvite = repoDoc.pendingInvites?.some(i => i.user.toString() === invitee._id.toString());
    if (hasPendingInvite) {
        throw new ApiError(400, 'User already has a pending invite');
    }

    if (!repoDoc.pendingInvites) repoDoc.pendingInvites = [];
    repoDoc.pendingInvites.push({ user: invitee._id, role });
    await repoDoc.save();

    await Notification.create({
        recipient: invitee._id,
        actor: req.user._id,
        type: 'REPO_INVITE',
        repo: repoDoc._id,
    });

    res.status(200).json({ success: true, message: 'Invitation sent successfully' });
});

const acceptInvite = asyncHandler(async (req, res) => {
    const { owner, repo } = req.params;

    const repoDoc = await resolveRepo(owner, repo, req.user);
    if (!repoDoc) throw new ApiError(404, 'Repository not found');

    const inviteIndex = (repoDoc.pendingInvites || []).findIndex(i => i.user.toString() === req.user._id.toString());
    
    if (inviteIndex === -1) {
        throw new ApiError(400, 'No pending invite found for this repository');
    }

    const invite = repoDoc.pendingInvites[inviteIndex];

    repoDoc.pendingInvites.splice(inviteIndex, 1);
    
    if (!repoDoc.collaborators) repoDoc.collaborators = [];
    repoDoc.collaborators.push({ user: req.user._id, role: invite.role });
    
    await repoDoc.save();

    // Try to mark notification as read
    await Notification.updateMany(
        { recipient: req.user._id, type: 'REPO_INVITE', repo: repoDoc._id },
        { $set: { isRead: true } }
    );

    res.status(200).json({ success: true, message: 'Invitation accepted successfully' });
});

const removeCollaborator = asyncHandler(async (req, res) => {
    const { owner, repo, userId } = req.params;

    const repoDoc = await resolveRepo(owner, repo, req.user);
    if (!repoDoc) throw new ApiError(404, 'Repository not found');

    if (repoDoc.owner.toString() !== req.user._id.toString() && req.user._id.toString() !== userId) {
        throw new ApiError(403, 'You do not have permission to remove collaborators');
    }

    let removed = false;

    if (repoDoc.collaborators) {
        const initLen = repoDoc.collaborators.length;
        repoDoc.collaborators = repoDoc.collaborators.filter(c => c.user.toString() !== userId);
        if (repoDoc.collaborators.length < initLen) removed = true;
    }

    if (repoDoc.pendingInvites) {
        const initLen = repoDoc.pendingInvites.length;
        repoDoc.pendingInvites = repoDoc.pendingInvites.filter(i => i.user.toString() !== userId);
        if (repoDoc.pendingInvites.length < initLen) removed = true;
    }

    if (!removed) {
        throw new ApiError(404, 'User is not a collaborator or invitee');
    }

    await repoDoc.save();

    // Remove any pending invite notifications for this user
    await Notification.deleteMany({
        recipient: userId,
        repo: repoDoc._id,
        type: 'REPO_INVITE'
    });

    res.status(200).json({ success: true, message: 'Collaborator removed successfully' });
});

module.exports = { 
    checkRepoAvailability,
    createRepo, 
    updateRepo, 
    getUserRepos, 
    getReposByUsername, 
    getRepoDetails, 
    requestDeleteOtp, 
    deleteRepo, 
    toggleStarRepo, 
    forkRepo, 
    syncRepo,
    inviteCollaborator,
    acceptInvite,
    removeCollaborator
};