const mongoose = require('mongoose');

const pullRequestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    state: { type: String, enum: ['open', 'merged', 'closed'], default: 'open' },
    
    // For handling forks vs same-repo PRs
    sourceRepo: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true },
    sourceBranch: { type: String, required: true },
    
    targetRepo: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true },
    targetBranch: { type: String, required: true },
    
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mergeCommitHash: { type: String }, // Set when merged
    
    // Extended features
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    labels: [{ 
        name: { type: String, required: true },
        color: { type: String, default: '#e5e7eb' } 
    }],
    milestone: { type: String, default: null },
    project: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('PullRequest', pullRequestSchema);
