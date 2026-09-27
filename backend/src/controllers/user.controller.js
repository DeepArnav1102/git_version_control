const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User.model');
const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository.model');
const GitObject = require('../models/GitObject.model');

const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
        .populate({
            path: 'pinnedRepos',
            select: 'name description language isPrivate _id owner defaultBranch starsCount forksCount',
            populate: { path: 'owner', select: 'username' }
        })
        .populate({
            path: 'starredRepos',
            select: 'name description language isPrivate _id owner defaultBranch starsCount forksCount',
            populate: { path: 'owner', select: 'username' }
        })
        .select('-passwordHash -securitySalt');
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    res.status(200).json({
        success: true,
        data: { user }
    });
});

const checkUsername = asyncHandler(async (req, res) => {
    const { q } = req.query;

    // Quick index lookup
    const user = await User.findOne({ username: q.toLowerCase() }).select('_id');

    let suggestions = [];
    if (user) {
        const base = q.toLowerCase();
        suggestions = [
            `${base}${Math.floor(1000 + Math.random() * 9000)}`,
            `${base}${Math.floor(1000 + Math.random() * 9000)}`,
            `${base}${Math.floor(1000 + Math.random() * 9000)}`
        ];
    }

    res.status(200).json({
        success: true,
        data: {
            available: !user,
            requestedUsername: q,
            suggestions
        }
    });
});

const updateOnboarding = asyncHandler(async (req, res, next) => {
    const { name, username, bio } = req.body;

    // req.user should be populated by the protect middleware
    const userId = req.user._id;

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    name,
                    username: username.toLowerCase(),
                    bio
                }
            },
            { returnDocument: 'after', runValidators: true }
        ).select('-passwordHash -securitySalt');

        if (!updatedUser) {
            throw new ApiError(404, 'User not found');
        }

        res.status(200).json({
            success: true,
            message: 'Onboarding completed successfully',
            data: { user: updatedUser }
        });
    } catch (error) {
        // Handle MongoDB duplicate key error for username
        if (error.code === 11000 && error.keyPattern && error.keyPattern.username) {
            // Generate 3 suggestions using the requested username + a random 4 digit number
            const base = username.toLowerCase();
            const suggestions = [
                `${base}${Math.floor(1000 + Math.random() * 9000)}`,
                `${base}${Math.floor(1000 + Math.random() * 9000)}`,
                `${base}${Math.floor(1000 + Math.random() * 9000)}`
            ];

            return next(new ApiError(409, 'Username is already taken', [], { suggestions }));
        }

        next(error);
    }
});

const updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Explicitly destructure allowed fields to prevent overwriting protected fields like _id, email, password
    const {
        name,
        username,
        bio,
        gender,
        profilePicture,
        organization,
        location,
        localTime,
        socialLinks
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (username !== undefined) updateData.username = username.toLowerCase();
    if (bio !== undefined) updateData.bio = bio;
    if (gender !== undefined) updateData.gender = gender;
    if (profilePicture !== undefined) {
        if (profilePicture && !profilePicture.startsWith('https://')) {
            throw new ApiError(400, 'profilePicture must be a valid HTTPS URL');
        }
        updateData.profilePicture = profilePicture;
    }
    if (organization !== undefined) updateData.organization = organization;
    if (location !== undefined) updateData.location = location;
    if (localTime !== undefined) updateData.localTime = localTime;
    if (socialLinks !== undefined) updateData.socialLinks = socialLinks;

    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { returnDocument: 'after', runValidators: true }
        ).select('-passwordHash -securitySalt');

        if (!updatedUser) {
            throw new ApiError(404, 'User not found');
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: { user: updatedUser }
        });
    } catch (error) {
        if (error.code === 11000 && error.keyPattern && error.keyPattern.username) {
            throw new ApiError(409, 'Username is already taken');
        }
        throw error;
    }
});

const uploadProfilePhoto = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, 'No file provided');
    }

    const userId = req.user._id;
    const profilePictureUrl = req.file.path; // Multer-storage-cloudinary places the URL in req.file.path

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { profilePicture: profilePictureUrl } },
        { returnDocument: 'after', runValidators: true }
    ).select('-passwordHash -securitySalt');

    if (!updatedUser) {
        throw new ApiError(404, 'User not found');
    }

    res.status(200).json({
        success: true,
        message: 'Profile picture updated successfully',
        data: { user: updatedUser }
    });
});

const updateDashboardCard = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { avatarKey, cardColor } = req.body;

    const updateData = {};
    if (avatarKey !== undefined) updateData['dashboardCard.avatarKey'] = avatarKey;
    if (cardColor !== undefined) updateData['dashboardCard.cardColor'] = cardColor;

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { returnDocument: 'after' }
    ).select('-passwordHash -securitySalt');

    if (!updatedUser) {
        throw new ApiError(404, 'User not found');
    }

    res.status(200).json({
        success: true,
        message: 'Dashboard card updated successfully',
        data: { user: updatedUser },
    });
});

const searchUsers = asyncHandler(async (req, res) => {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
        return res.status(200).json({
            success: true,
            data: { users: [] }
        });
    }

    const users = await User.aggregate([
        {
            $search: {
                index: 'user_search_index',
                text: {
                    query: q,
                    path: ['name', 'username'],
                    fuzzy: {
                        maxEdits: 1,
                        prefixLength: 1
                    }
                }
            }
        },
        { $limit: 20 },
        {
            $project: {
                name: 1,
                username: 1,
                profilePicture: 1,
                bio: 1,
                _id: 1,
                score: { $meta: 'searchScore' }
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: { users }
    });
});

const getPublicProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;
    
    // Find user by username
    const user = await User.findOne({ username: username.toLowerCase() })
        .populate({
            path: 'pinnedRepos',
            select: 'name description language isPrivate _id owner defaultBranch starsCount forksCount',
            populate: { path: 'owner', select: 'username' }
        })
        .populate({
            path: 'starredRepos',
            select: 'name description language isPrivate _id owner defaultBranch starsCount forksCount',
            populate: { path: 'owner', select: 'username' }
        })
        .select('-passwordHash -securitySalt');
        
    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    res.status(200).json({
        success: true,
        data: { user }
    });
});

const updatePinnedRepos = asyncHandler(async (req, res) => {
    const { pinnedRepos } = req.body;
    
    if (!Array.isArray(pinnedRepos)) {
        throw new ApiError(400, 'pinnedRepos must be an array of repository IDs');
    }
    
    // Ensure the user owns these repos before pinning them
    const repos = await Repository.find({ _id: { $in: pinnedRepos }, owner: req.user._id });
    if (repos.length !== pinnedRepos.length) {
        throw new ApiError(400, 'One or more repositories are invalid or not owned by you');
    }
    
    const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { pinnedRepos } },
        { new: true }
    ).populate({
        path: 'pinnedRepos',
        select: 'name description language isPrivate _id owner',
        populate: { path: 'owner', select: 'username' }
    });
    
    res.status(200).json({
        success: true,
        message: 'Pinned repositories updated successfully',
        data: { pinnedRepos: user.pinnedRepos }
    });
});

const getUserContributions = asyncHandler(async (req, res) => {
    const { username } = req.params;
    
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) throw new ApiError(404, 'User not found');
    
    // Calculate date range for the last 365 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);
    
    // Count commits by this user pushed within the last year
    const commits = await GitObject.aggregate([
        {
            $match: {
                pushedBy: user._id,
                type: 'commit',
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);
    
    // Convert to dictionary: { 'YYYY-MM-DD': count }
    const heatmap = {};
    let totalContributions = 0;
    
    commits.forEach(c => {
        heatmap[c._id] = c.count;
        totalContributions += c.count;
    });
    
    res.status(200).json({
        success: true,
        data: {
            heatmap,
            totalContributions,
            startDate,
            endDate
        }
    });
});

const toggleFollowUser = asyncHandler(async (req, res) => {
    const { username } = req.params;
    const currentUser = await User.findById(req.user._id);
    const targetUser = await User.findOne({ username: username.toLowerCase() });

    if (!targetUser) throw new ApiError(404, 'User not found');
    if (currentUser._id.toString() === targetUser._id.toString()) {
        throw new ApiError(400, 'You cannot follow yourself');
    }

    const isFollowing = currentUser.following.includes(targetUser._id);

    if (isFollowing) {
        // Unfollow
        currentUser.following.pull(targetUser._id);
        targetUser.followers.pull(currentUser._id);
    } else {
        // Follow
        currentUser.following.push(targetUser._id);
        targetUser.followers.push(currentUser._id);
    }

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({
        success: true,
        message: isFollowing ? 'Unfollowed successfully' : 'Followed successfully',
        data: { isFollowing: !isFollowing }
    });
});

module.exports = {
    getMe,
    checkUsername,
    updateOnboarding,
    updateProfile,
    uploadProfilePhoto,
    updateDashboardCard,
    searchUsers,
    getPublicProfile,
    updatePinnedRepos,
    getUserContributions,
    toggleFollowUser,
};
