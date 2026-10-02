const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    markAsArchived,
    archiveMultiple,
    toggleSave
} = require('../controllers/notification.controller');

// All notification routes require authentication
router.use(protect);

router.get('/unread-count', getUnreadCount);
router.get('/', getNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/archive', archiveMultiple); // For bulk action
router.patch('/:id/read', markAsRead);
router.patch('/:id/archive', markAsArchived);
router.patch('/:id/save', toggleSave);

module.exports = router;
