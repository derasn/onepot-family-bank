const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { maskAccountNumber } = require('../utils/helpers');

const JWT_SECRET = process.env.JWT_SECRET || 'onepot_family_bank_super_secret_jwt_key_2026_xyz';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Register a new user
 */
async function register(req, res, next) {
  try {
    const { name, email, password, phone, role = 'member' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email is already taken
    const existing = await query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = role === 'admin' ? 'admin' : 'member';
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name.trim())}`;

    const result = await query(
      `INSERT INTO users (name, email, password_hash, phone, role, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), normalizedEmail, passwordHash, phone || null, userRole, avatarUrl]
    );

    const userId = result.insertId;
    const token = jwt.sign({ userId, email: normalizedEmail, role: userRole }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: {
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        phone: phone || null,
        role: userRole,
        avatar_url: avatarUrl,
        family: null
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Log in an existing user
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = await query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Retrieve active family membership if any
    const memberships = await query(
      `SELECT fm.family_id, fm.role AS family_role, fm.relationship, fm.bank_name, fm.account_number_masked,
              f.name AS family_name, f.currency, f.pot_balance, f.emergency_balance, f.invite_code
       FROM family_members fm
       JOIN families f ON f.id = fm.family_id
       WHERE fm.user_id = ?
       LIMIT 1`,
      [user.id]
    );

    let family = null;
    if (memberships.length > 0) {
      const m = memberships[0];
      family = {
        id: m.family_id,
        name: m.family_name,
        role: m.family_role,
        relationship: m.relationship,
        currency: m.currency,
        pot_balance: Number(m.pot_balance),
        emergency_balance: Number(m.emergency_balance),
        invite_code: m.invite_code,
        bank_name: m.bank_name,
        account_number_masked: m.account_number_masked
      };
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        familyId: family?.id || null,
        familyRole: family?.role || null
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar_url: user.avatar_url,
        family
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current authenticated user profile
 */
async function getMe(req, res) {
  return res.json({
    success: true,
    user: req.user
  });
}

/**
 * Update user profile
 */
async function updateProfile(req, res, next) {
  try {
    const { name, phone, avatar_url, bank_name, account_number } = req.body;
    const userId = req.user.id;

    if (name) {
      await query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), userId]);
    }
    if (phone !== undefined) {
      await query('UPDATE users SET phone = ? WHERE id = ?', [phone, userId]);
    }
    if (avatar_url) {
      await query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatar_url, userId]);
    }

    // If updating family bank information (masked for privacy)
    if (req.user.family_id && (bank_name || account_number)) {
      const masked = account_number ? maskAccountNumber(account_number) : undefined;
      let updateSql = 'UPDATE family_members SET ';
      const updates = [];
      const params = [];

      if (bank_name) {
        updates.push('bank_name = ?');
        params.push(bank_name);
      }
      if (masked) {
        updates.push('account_number_masked = ?');
        params.push(masked);
      }
      if (updates.length > 0) {
        updateSql += updates.join(', ') + ' WHERE family_id = ? AND user_id = ?';
        params.push(req.user.family_id, userId);
        await query(updateSql, params);
      }
    }

    const updatedUsers = await query('SELECT id, name, email, phone, role, avatar_url FROM users WHERE id = ?', [userId]);

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: updatedUsers[0]
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change password
 */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.'
      });
    }

    const users = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const isValid = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    return res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword
};

