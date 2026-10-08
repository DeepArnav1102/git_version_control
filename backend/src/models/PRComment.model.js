const mongoose = require('mongoose');

const prCommentSchema = new mongoose.Schema({
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pullRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'PullRequest', required: true },
}, { timestamps: true });

module.exports = mongoose.model('PRComment', prCommentSchema);
