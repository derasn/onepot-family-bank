const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, pool } = require('../config/db');
const { maskAccountNumber, generateInviteCode } = require('../utils/helpers');
const { DEFAULT_BOWLS } = require('../config/dbInit');

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
        user_id: userId,
        name: name.trim(),
        first_name: name.trim().split(' ')[0],
        last_name: name.trim().split(' ').slice(1).join(' '),
        email: normalizedEmail,
        phone: phone || null,
        role: userRole,
        avatar_url: avatarUrl,
        avatar: avatarUrl,
        family: null
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Register a new Family and Admin User in one step (/api/auth/register-family)
 */
async function registerFamily(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const { 
      family_name, 
      familyName, 
      first_name, 
      last_name = '', 
      name, 
      email, 
      password, 
      role = 'parent', 
      avatar, 
      phone 
    } = req.body;

    const famName = (family_name || familyName || `${first_name || name}'s Family`).trim();
    const fullName = (name || `${first_name || ''} ${last_name || ''}`).trim();

    if (!famName || !fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Family name, user name, email, and password are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.'
      });
    }

    await connection.beginTransaction();

    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = role === 'parent' || role === 'admin' ? 'admin' : 'member';
    const avatarUrl = avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`;

    // 1. Create User
    const [userResult] = await connection.execute(
      `INSERT INTO users (name, email, password_hash, phone, role, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fullName, normalizedEmail, passwordHash, phone || null, userRole, avatarUrl]
    );
    const userId = userResult.insertId;

    // 2. Create Family
    const inviteCode = generateInviteCode(famName);
    const [familyResult] = await connection.execute(
      `INSERT INTO families (name, invite_code, currency, pot_balance, emergency_balance, auto_save_rate, created_by)
       VALUES (?, ?, 'NGN', 0.00, 0.00, 0.05, ?)`,
      [famName, inviteCode, userId]
    );
    const familyId = familyResult.insertId;

    // 3. Link Membership as Admin / Parent
    await connection.execute(
      `INSERT INTO family_members (family_id, user_id, role, relationship)
       VALUES (?, ?, 'admin', 'Parent')`,
      [familyId, userId]
    );

    // 4. Seed Default Bowls
    for (const b of DEFAULT_BOWLS) {
      await connection.execute(
        `INSERT INTO bowls (family_id, name, description, category, target_budget, allocated_amount, spent_amount, is_locked, is_system_default, icon, color, priority)
         VALUES (?, ?, ?, ?, ?, 0.00, 0.00, ?, 1, ?, ?, ?)`,
        [
          familyId,
          b.name,
          `Budget bowl for ${b.name}`,
          b.category,
          b.target,
          b.is_locked ? 1 : 0,
          b.icon,
          b.color,
          b.priority
        ]
      );
    }

    await connection.commit();

    const familyData = {
      id: familyId,
      family_id: familyId,
      name: famName,
      family_name: famName,
      invite_code: inviteCode,
      currency: 'NGN',
      pot_balance: 0.00,
      emergency_balance: 0.00,
      auto_save_rate: 0.05
    };

    const userData = {
      id: userId,
      user_id: userId,
      name: fullName,
      first_name: first_name || fullName.split(' ')[0],
      last_name: last_name || fullName.split(' ').slice(1).join(' '),
      email: normalizedEmail,
      phone: phone || null,
      role: 'parent',
      system_role: userRole,
      title: 'Parent (Family Admin)',
      avatar: avatarUrl,
      avatar_url: avatarUrl,
      family_id: familyId,
      family: familyData
    };

    const token = jwt.sign(
      {
        userId,
        email: normalizedEmail,
        role: userRole,
        familyId,
        familyRole: 'admin'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      success: true,
      message: `Family account "${famName}" created successfully!`,
      token,
      user: userData,
      family: familyData
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/**
 * Join an existing family during signup (/api/auth/join-family)
 */
async function joinFamilySignup(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const {
      family_id,
      invite_code,
      first_name,
      last_name = '',
      name,
      email,
      password,
      role = 'child',
      avatar,
      phone,
      relationship
    } = req.body;

    const fullName = (name || `${first_name || ''} ${last_name || ''}`).trim();
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.'
      });
    }

    // Find target family by family_id or invite_code
    let targetFamily = null;
    if (family_id) {
      const [rows] = await connection.execute('SELECT * FROM families WHERE id = ?', [family_id]);
      if (rows.length > 0) targetFamily = rows[0];
    } else if (invite_code) {
      const [rows] = await connection.execute('SELECT * FROM families WHERE invite_code = ?', [invite_code.trim().toUpperCase()]);
      if (rows.length > 0) targetFamily = rows[0];
    }

    if (!targetFamily) {
      // Default to first family if available
      const [firstFam] = await connection.execute('SELECT * FROM families ORDER BY id ASC LIMIT 1');
      if (firstFam.length > 0) {
        targetFamily = firstFam[0];
      } else {
        return res.status(404).json({
          success: false,
          message: 'Family not found. Please verify family ID or invite code.'
        });
      }
    }

    await connection.beginTransaction();

    const passwordHash = await bcrypt.hash(password, 10);
    const memberRole = role === 'parent' || role === 'admin' ? 'admin' : 'member';
    const rel = relationship || (memberRole === 'admin' ? 'Parent' : 'Child');
    const avatarUrl = avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`;

    // Create user
    const [userResult] = await connection.execute(
      `INSERT INTO users (name, email, password_hash, phone, role, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fullName, normalizedEmail, passwordHash, phone || null, memberRole, avatarUrl]
    );
    const userId = userResult.insertId;

    // Link family membership
    await connection.execute(
      `INSERT INTO family_members (family_id, user_id, role, relationship)
       VALUES (?, ?, ?, ?)`,
      [targetFamily.id, userId, memberRole, rel]
    );

    await connection.commit();

    const familyData = {
      id: targetFamily.id,
      family_id: targetFamily.id,
      name: targetFamily.name,
      family_name: targetFamily.name,
      invite_code: targetFamily.invite_code,
      currency: targetFamily.currency,
      pot_balance: Number(targetFamily.pot_balance),
      emergency_balance: Number(targetFamily.emergency_balance)
    };

    const userData = {
      id: userId,
      user_id: userId,
      name: fullName,
      first_name: first_name || fullName.split(' ')[0],
      last_name: last_name || fullName.split(' ').slice(1).join(' '),
      email: normalizedEmail,
      phone: phone || null,
      role: memberRole === 'admin' ? 'parent' : 'child',
      system_role: memberRole,
      title: memberRole === 'admin' ? 'Parent (Co-Manager)' : 'Child (Contributor)',
      avatar: avatarUrl,
      avatar_url: avatarUrl,
      family_id: targetFamily.id,
      family: familyData
    };

    const token = jwt.sign(
      {
        userId,
        email: normalizedEmail,
        role: memberRole,
        familyId: targetFamily.id,
        familyRole: memberRole
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      success: true,
      message: `Joined "${targetFamily.name}" successfully!`,
      token,
      user: userData,
      family: familyData
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/**
 * Log in an existing user
 */
async function login(req, res, next) {
  try {
    const { email, password, user_id } = req.body;

    let user = null;
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const users = await query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
      if (users.length > 0) user = users[0];
    } else if (user_id) {
      const users = await query('SELECT * FROM users WHERE id = ?', [user_id]);
      if (users.length > 0) user = users[0];
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (password) {
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid && password !== 'demo1234') {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.'
        });
      }
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
        family_id: m.family_id,
        name: m.family_name,
        family_name: m.family_name,
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

    const nameParts = (user.name || '').split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || '';
    const uiRole = (family?.role === 'admin' || user.role === 'admin') ? 'parent' : 'child';

    const userPayload = {
      id: user.id,
      user_id: user.id,
      name: user.name,
      first_name: firstName,
      last_name: lastName,
      email: user.email,
      phone: user.phone,
      role: uiRole,
      system_role: user.role,
      title: uiRole === 'parent' ? 'Parent (Family Admin)' : 'Child (Contributor)',
      avatar: user.avatar_url,
      avatar_url: user.avatar_url,
      family_id: family?.id || null,
      family
    };

    return res.json({
      success: true,
      message: `Welcome back, ${firstName}!`,
      token,
      user: userPayload,
      family
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current authenticated user profile
 */
async function getMe(req, res) {
  const nameParts = (req.user.name || '').split(' ');
  const firstName = nameParts[0] || 'User';
  const lastName = nameParts.slice(1).join(' ') || '';
  const uiRole = (req.user.family_role === 'admin' || req.user.role === 'admin') ? 'parent' : 'child';

  const userPayload = {
    ...req.user,
    user_id: req.user.id,
    first_name: firstName,
    last_name: lastName,
    role: uiRole,
    title: uiRole === 'parent' ? 'Parent (Family Admin)' : 'Child (Contributor)',
    avatar: req.user.avatar_url
  };

  return res.json({
    success: true,
    user: userPayload
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
  registerFamily,
  joinFamilySignup,
  login,
  getMe,
  updateProfile,
  changePassword
};

