const asyncHandler = require('../utils/asyncHandler');
const { generatePersonalAccessToken } = require('../services/token.service');
const { generateAndSendOtp, verifyOtp } = require('../services/otp.service');
const Token = require('../models/Token.model');
const ApiError = require('../utils/ApiError');

const requestOtp = asyncHandler(async (req, res) => {
    // req.user is set by the protect middleware
    await generateAndSendOtp(req.user, 'PAT_ACTION');
    
    res.status(200).json({
        success: true,
        message: 'Security code sent to your email.'
    });
});

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const checkTokenName = asyncHandler(async (req, res) => {
    const { name } = req.query;
    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(200).json({ success: true, data: { available: true } });
    }

    const trimmedName = name.trim();
    const safeName = escapeRegex(trimmedName);

    const existingToken = await Token.findOne({
        userId: req.user._id,
        type: 'PERSONAL_ACCESS_TOKEN',
        name: { $regex: new RegExp(`^${safeName}$`, 'i') },
        isRevoked: false
    });

    if (!existingToken) {
        return res.status(200).json({
            success: true,
            data: { available: true }
        });
    }

    // Generate suggestions
    const baseName = trimmedName;
    const safeBaseName = escapeRegex(baseName);
    // Find tokens like "Name 1", "Name 2"
    const similarTokens = await Token.find({
        userId: req.user._id,
        type: 'PERSONAL_ACCESS_TOKEN',
        name: { $regex: new RegExp(`^${safeBaseName} \\d+$`, 'i') },
        isRevoked: false
    });

    const existingSuffixes = similarTokens.map(t => {
        const match = t.name.match(/\d+$/);
        return match ? parseInt(match[0], 10) : 0;
    });

    let nextSuffix = 1;
    const suggestions = [];
    while (suggestions.length < 3) {
        if (!existingSuffixes.includes(nextSuffix)) {
            suggestions.push(`${baseName} ${nextSuffix}`);
        }
        nextSuffix++;
    }

    res.status(200).json({
        success: true,
        data: {
            available: false,
            suggestions
        }
    });
});

const generatePAT = asyncHandler(async (req, res) => {
    const { name, otp } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
        throw new ApiError(400, 'Token name is required');
    }

    const trimmedName = name.trim();
    const safeName = escapeRegex(trimmedName);
    
    // Check for duplicate name
    const existing = await Token.findOne({
        userId: req.user._id,
        type: 'PERSONAL_ACCESS_TOKEN',
        name: { $regex: new RegExp(`^${safeName}$`, 'i') },
        isRevoked: false
    });
    if (existing) {
        throw new ApiError(400, 'A token with this name already exists');
    }

    // Step-Up Authentication Challenge
    if (!otp) throw new ApiError(400, 'Security code (OTP) is required to generate a PAT');
    await verifyOtp(req.user._id, otp, 'PAT_ACTION');

    const rawToken = await generatePersonalAccessToken(req.user._id, name);
    
    res.status(201).json({
        success: true,
        message: 'Personal Access Token generated successfully',
        data: {
            token: rawToken,
            warning: 'Copy this token now. You will not be able to see it again!'
        }
    });
});

const listPATs = asyncHandler(async (req, res) => {
    const tokens = await Token.find({ 
        userId: req.user._id, 
        type: 'PERSONAL_ACCESS_TOKEN',
        isRevoked: false
    }).select('-tokenHash'); // Do not send hashes to frontend

    res.status(200).json({
        success: true,
        data: tokens
    });
});

const revokePAT = asyncHandler(async (req, res) => {
    const { tokenId } = req.params;
    const { otp } = req.body;

    // Step-Up Authentication Challenge
    if (!otp) throw new ApiError(400, 'Security code (OTP) is required to revoke a PAT');
    await verifyOtp(req.user._id, otp, 'PAT_ACTION');

    const tokenDoc = await Token.findOne({ _id: tokenId, userId: req.user._id, type: 'PERSONAL_ACCESS_TOKEN' });
    
    if (!tokenDoc) {
        throw new ApiError(404, 'Token not found');
    }

    tokenDoc.isRevoked = true;
    await tokenDoc.save();

    res.status(200).json({
        success: true,
        message: 'Personal Access Token revoked successfully'
    });
});

module.exports = {
    requestOtp,
    checkTokenName,
    generatePAT,
    listPATs,
    revokePAT
};
