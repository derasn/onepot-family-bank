const { query } = require('../config/db');
const { sendEmail } = require('./emailService');

/**
 * Create an in-app notification and optionally send an email
 */
async function createNotification({ familyId, userId, type, title, message, metadata = null }) {
  try {
    const metaJson = metadata ? JSON.stringify(metadata) : null;
    await query(
      `INSERT INTO notifications (family_id, user_id, type, title, message, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [familyId, userId, type, title, message, metaJson]
    );

    // Fetch user email to dispatch email notification
    const users = await query('SELECT email, name FROM users WHERE id = ?', [userId]);
    if (users.length > 0) {
      const u = users[0];
      await sendEmail({
        to: u.email,
        subject: `[OnePot Notification] ${title}`,
        text: `Hello ${u.name},\n\n${message}\n\nCheck your OnePot Family dashboard for details.\nOnePot Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #2563eb;">OnePot Family Bank</h2>
            <h3 style="color: #1e293b;">${title}</h3>
            <p style="color: #475569; font-size: 15px; line-height: 1.5;">${message}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8;">This is an automated notification from your OnePot family pooled account.</p>
          </div>
        `
      });
    }
  } catch (error) {
    console.error('Failed to create notification:', error.message);
  }
}

/**
 * Notify all admins (parents) in a family
 */
async function notifyAdmins(familyId, { type, title, message, metadata = null, excludeUserId = null }) {
  try {
    let sql = `
      SELECT fm.user_id 
      FROM family_members fm 
      WHERE fm.family_id = ? AND fm.role = 'admin'
    `;
    const params = [familyId];

    if (excludeUserId) {
      sql += ' AND fm.user_id != ?';
      params.push(excludeUserId);
    }

    const admins = await query(sql, params);
    for (const admin of admins) {
      await createNotification({
        familyId,
        userId: admin.user_id,
        type,
        title,
        message,
        metadata
      });
    }
  } catch (error) {
    console.error('Failed to notify admins:', error.message);
  }
}

/**
 * Notify all members of a family
 */
async function notifyFamily(familyId, { type, title, message, metadata = null, excludeUserId = null }) {
  try {
    let sql = 'SELECT fm.user_id FROM family_members fm WHERE fm.family_id = ?';
    const params = [familyId];

    if (excludeUserId) {
      sql += ' AND fm.user_id != ?';
      params.push(excludeUserId);
    }

    const members = await query(sql, params);
    for (const member of members) {
      await createNotification({
        familyId,
        userId: member.user_id,
        type,
        title,
        message,
        metadata
      });
    }
  } catch (error) {
    console.error('Failed to notify family:', error.message);
  }
}

module.exports = {
  createNotification,
  notifyAdmins,
  notifyFamily
};

