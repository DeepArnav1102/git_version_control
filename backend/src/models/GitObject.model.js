const mongoose = require('mongoose');

const gitObjectSchema = new mongoose.Schema(
    {
        repositoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Repository',
            required: true,
            index: true,
        },
        hash: {
            type: String,
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['blob', 'tree', 'commit'],
            required: true,
        },
        data: {
            type: String,
            default: '',
        },
        encoding: {
            type: String,
            enum: ['base64', 'utf8', null],
            default: null,
        },
        pushedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

// Compound unique index so duplicate objects within the same repository aren't duplicated
gitObjectSchema.index({ repositoryId: 1, hash: 1 }, { unique: true });

// Index for fetching objects by type within a repository (e.g., all commits or all trees)
gitObjectSchema.index({ repositoryId: 1, type: 1 });

// Index to quickly find which repositories a user has contributed to
gitObjectSchema.index({ pushedBy: 1 });

const GitObject = mongoose.model('GitObject', gitObjectSchema);
module.exports = GitObject;
