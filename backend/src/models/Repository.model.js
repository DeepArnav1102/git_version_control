const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        description: {
            type: String,
            default: '',
            trim: true,
        },
        isPrivate: {
            type: Boolean,
            default: false,
        },
        starsCount: {
            type: Number,
            default: 0,
        },
        forksCount: {
            type: Number,
            default: 0,
        },
        watchersCount: {
            type: Number,
            default: 0,
        },
        defaultBranch: {
            type: String,
            default: 'main',
        },
        branches: [
            {
                name: {
                    type: String,
                    required: true,
                },
                commitHash: {
                    type: String,
                    required: true,
                },
                updatedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        latestCommit: {
            hash: String,
            message: String,
            tree: String,
            parent: String,
            author: String,
            date: {
                type: Date,
                default: Date.now,
            },
        },
        isFork: {
            type: Boolean,
            default: false
        },
        parentRepo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Repository',
            default: null
        },
        rootRepo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Repository',
            default: null
        },
        collaborators: [{
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            role: { type: String, enum: ['read', 'write', 'admin'], default: 'read' }
        }],
        pendingInvites: [{
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            role: { type: String, enum: ['read', 'write', 'admin'], default: 'read' },
            createdAt: { type: Date, default: Date.now }
        }],
        topics: [{
            type: String,
            trim: true,
            lowercase: true
        }],
        features: {
            hasIssues: { type: Boolean, default: true },
            hasPullRequests: { type: Boolean, default: true },
            hasWiki: { type: Boolean, default: false }
        },
        branchProtection: [{
            branchName: { type: String, required: true },
            requireReviews: { type: Boolean, default: false },
            preventDirectPushes: { type: Boolean, default: false }
        }],
        webhooks: [{
            url: { type: String, required: true },
            secret: { type: String },
            events: [{ type: String }],
            isActive: { type: Boolean, default: true }
        }],
        isArchived: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

// Compound unique index so each user cannot have two repositories with the same name
repositorySchema.index({ owner: 1, name: 1 }, { unique: true });

// Index for efficiently sorting a user's repositories by recent updates
repositorySchema.index({ owner: 1, updatedAt: -1 });

// Index for filtering a user's repositories by privacy (e.g., getting public repos)
repositorySchema.index({ owner: 1, isPrivate: 1 });

const Repository = mongoose.model('Repository', repositorySchema);
module.exports = Repository;
