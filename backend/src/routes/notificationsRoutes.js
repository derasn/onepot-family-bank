const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, notificationsController.getNotifications);
router.get('/unread-count', authenticate, notificationsController.getUnreadCount);
router.put('/read-all', authenticate, notificationsController.markAllAsRead);
router.put('/:id/read', authenticate, notificationsController.markAsRead);

module.exports = router;

