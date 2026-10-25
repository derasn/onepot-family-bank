const { query } = require('../config/db');

/**
 * Get all notifications for current user
 */
async function getNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const { unread_only } = req.query;

    let sql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (unread_only === 'true') {
      sql += ' AND is_read = 0';
    }

    sql += ' ORDER BY created_at DESC LIMIT 50';

    const notifications = await query(sql, params);

    return res.json({
      success: true,
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        is_read: Boolean(n.is_read),
        metadata: n.metadata ? (typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata) : null,
        created_at: n.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark a single notification as read
 */
async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);

    return res.json({
      success: true,
      message: 'Notification marked as read.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark all notifications as read for current user
 */
async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user.id;

    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);

    return res.json({
      success: true,
      message: 'All notifications marked as read.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get unread notification count
 */
async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user.id;
    const result = await query('SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);

    return res.json({
      success: true,
      unread_count: Number(result[0].unread_count)
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount
};

