const Notification = require('../models/Notification.model');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get notifications for the authenticated user
 * Supports ?filter=unread, ?filter=archived, ?filter=saved, ?filter=read, and ?type=...
 */
const getNotifications = asyncHandler(async (req, res) => {
    const { filter, type } = req.query;
    
    let query = { recipient: req.user._id };
    
    if (filter === 'unread') {
        query.isRead = false;
        query.isArchived = false;
    } else if (filter === 'read') {
        query.isRead = true;
        query.isArchived = false;
    } else if (filter === 'archived' || filter === 'done') {
        query.isArchived = true;
    } else if (filter === 'saved') {
        query.isSaved = true;
        query.isArchived = false;
    } else {
        // default 'inbox' view: not archived
        query.isArchived = false;
    }

    if (type && type !== 'all') {
        query.type = type.toUpperCase();
    }

    const notifications = await Notification.find(query)
        .populate('actor', 'name username profilePicture')
        .populate({
            path: 'repo',
            select: 'name isPrivate owner',
            populate: { path: 'owner', select: 'username' }
        })
        .sort({ createdAt: -1 })
        .limit(100);

    res.status(200).json({
        success: true,
        data: notifications
    });
});

/**
 * Mark a single notification as read
 */
const markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
        { _id: id, recipient: req.user._id },
        { isRead: true },
        { new: true }
    );

    if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, data: notification });
});

/**
 * Mark all notifications as read
 */
const markAllAsRead = asyncHandler(async (req, res) => {
    await Notification.updateMany(
        { recipient: req.user._id, isRead: false },
        { isRead: true }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
});

/**
 * Mark a single notification as archived (Done)
 */
const markAsArchived = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
        { _id: id, recipient: req.user._id },
        { isArchived: true, isRead: true }, // archiving implicitly marks as read
        { new: true }
    );

    if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, data: notification });
});

/**
 * Mark multiple notifications as archived (Done)
 */
const archiveMultiple = asyncHandler(async (req, res) => {
    const { ids } = req.body; // array of notification IDs
    
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: 'No notification IDs provided' });
    }

    await Notification.updateMany(
        { _id: { $in: ids }, recipient: req.user._id },
        { isArchived: true, isRead: true }
    );

    res.status(200).json({ success: true, message: 'Notifications archived' });
});

/**
 * Get count of unread notifications (Optimized for polling)
 */
const getUnreadCount = asyncHandler(async (req, res) => {
    const count = await Notification.countDocuments({
        recipient: req.user._id,
        isRead: false,
        isArchived: false
    });
    
    res.status(200).json({ success: true, data: { count } });
});

/**
 * Toggle saved/bookmarked status of a notification
 */
const toggleSave = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const notification = await Notification.findOne({ _id: id, recipient: req.user._id });
    if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    notification.isSaved = !notification.isSaved;
    await notification.save();

    res.status(200).json({
        success: true,
        data: notification,
        message: notification.isSaved ? 'Notification saved' : 'Notification removed from saved'
    });
});

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    markAsArchived,
    archiveMultiple,
    toggleSave
};
