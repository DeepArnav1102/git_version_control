const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            enum: ['FOLLOW', 'STAR', 'FORK', 'MENTION', 'ASSIGNED', 'PARTICIPATING', 'REPO_INVITE'],
            required: true,
        },
        repo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Repository',
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        isSaved: {
            type: Boolean,
            default: false,
        },
        isArchived: {
            type: Boolean,
            default: false,
        },
        // To prevent database bloat, automatically delete notifications after 30 days
        createdAt: {
            type: Date,
            default: Date.now,
            expires: 60 * 60 * 24 * 30, // 30 days
        },
    },
    { timestamps: true }
);

// Compound index to quickly fetch unread notifications for a specific user
notificationSchema.index({ recipient: 1, isRead: 1, isArchived: 1, isSaved: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
