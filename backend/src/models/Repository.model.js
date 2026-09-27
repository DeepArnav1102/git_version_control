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
    },
    { timestamps: true }
);

// Compound unique index so each user cannot have two repositories with the same name
repositorySchema.index({ owner: 1, name: 1 }, { unique: true });

const Repository = mongoose.model('Repository', repositorySchema);
module.exports = Repository;
