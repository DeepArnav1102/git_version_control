const mongoose = require('mongoose');

const verificationCodeSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        email: {
            type: String,
            required: true,
        },
        codeHash: {
            type: String,
            required: true,
        },
        purpose: {
            type: String,
            enum: ['REGISTRATION_VERIFY', 'PASSWORD_RESET', 'PAT_ACTION', 'REPO_DELETE'],
            required: true,
        },
        attempts: {
            type: Number,
            default: 0,
        },
        maxAttempts: {
            type: Number,
            default: 3,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        isUsed: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// TTL index to automatically purge documents when they expire
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);
module.exports = VerificationCode;
