const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            index: true,
        },
        passwordHash: {
            type: String,
            // Nullable for users who sign up exclusively via Google Auth
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true, // Allows multiple null values for local auth users
            index: true,
        },
        securitySalt: {
            type: String,
            // Automatically generated for every new user
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        name: {
            type: String,
        },
        username: {
            type: String,
            unique: true,
            sparse: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        bio: {
            type: String,
            maxLength: 500,
        },
        gender: {
            type: String,
            enum: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
        },
        profilePicture: {
            type: String,
        },
        organization: {
            type: String,
        },
        location: {
            city: String,
            state: String,
            country: String,
        },
        localTime: {
            type: String,
        },
        socialLinks: [
            {
                platform: {
                    type: String,
                    enum: ['insta', 'youtube', 'linkedin'],
                },
                url: String,
            },
        ],

        dashboardCard: {
            avatarKey: {
                type: String,
                enum: ['boyAvatar1', 'boyAvatar2', 'boyAvatar3', 'girlAvatar1', 'girlAvatar2', 'girlAvatar3'],
                default: 'boyAvatar1',
            },
            cardColor: {
                type: String,
                default: '#6d28d9', // violet-700
            },
        },
        pinnedRepos: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Repository',
            }
        ],
        followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        starredRepos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Repository' }]
    },
    { timestamps: true }
);

// Pre-save hook to generate securitySalt and hash passwords
userSchema.pre('save', async function () {
    // Ensure every user has a security salt for JWT signing (Pepper + Salt)
    if (!this.securitySalt) {
        this.securitySalt = crypto.randomBytes(16).toString('hex');
    }

    // Only hash the password if it's new or has been modified
    if (!this.isModified('passwordHash') || !this.passwordHash) return;

    try {
        const salt = await bcrypt.genSalt(10);
        this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    } catch (error) {
        throw error;
    }
});

// Instance method to verify password
userSchema.methods.isPasswordCorrect = async function (password) {
    if (!this.passwordHash) return false; 
    return await bcrypt.compare(password, this.passwordHash);
};

// Instance method to instantly invalidate all active JWTs for the user
userSchema.methods.invalidateAllSessions = async function () {
    this.securitySalt = crypto.randomBytes(16).toString('hex');
    await this.save({ validateModifiedOnly: true });
    
    // We also must revoke all refresh tokens, otherwise they can just be used to get new access tokens!
    const Token = mongoose.model('Token');
    await Token.updateMany(
        { userId: this._id, type: 'REFRESH_TOKEN', isRevoked: false },
        { $set: { isRevoked: true, expiresAt: new Date() } }
    );
};

const User = mongoose.model('User', userSchema);
module.exports = User;
