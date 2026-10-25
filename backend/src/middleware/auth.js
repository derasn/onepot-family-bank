const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'onepot_family_bank_super_secret_jwt_key_2026_xyz';

/**
 * Middleware: Verify JWT and attach user and family info to request
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Missing Bearer token.'
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token.'
      });
    }

    // Fetch user details
    const users = await query(
      'SELECT id, name, email, phone, role, avatar_url FROM users WHERE id = ?',
      [decoded.userId || decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User account no longer exists.'
      });
    }

    const user = users[0];

    // Fetch user's active family membership
    const memberships = await query(
      `SELECT fm.family_id, fm.role AS family_role, fm.relationship, fm.bank_name, fm.account_number_masked,
              f.name AS family_name, f.currency, f.pot_balance, f.emergency_balance, f.invite_code
       FROM family_members fm
       JOIN families f ON f.id = fm.family_id
       WHERE fm.user_id = ?
       LIMIT 1`,
      [user.id]
    );

    if (memberships.length > 0) {
      const m = memberships[0];
      user.family_id = m.family_id;
      user.family_role = m.family_role;
      user.family = {
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
    } else {
      user.family_id = null;
      user.family_role = null;
      user.family = null;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication internal server error'
    });
  }
}

/**
 * Middleware: Requires the user to belong to a family pot
 */
function requireFamily(req, res, next) {
  if (!req.user || !req.user.family_id) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You must create or join a family pot first.'
    });
  }
  next();
}

/**
 * Middleware: Requires the user to have 'admin' (Parent/Custodian) role in the family
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const isAdmin = req.user.family_role === 'admin' || req.user.role === 'admin';
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Permission denied: This action requires Admin (Parent) privileges.'
    });
  }
  next();
}

module.exports = {
  authenticate,
  requireFamily,
  requireAdmin
};

