const { query, pool } = require('../config/db');
const { generateInviteCode, maskAccountNumber } = require('../utils/helpers');
const { DEFAULT_BOWLS } = require('../config/dbInit');
const { notifyAdmins, createNotification } = require('../services/notificationService');

/**
 * Create a new Family Pot
 */
async function createFamily(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const { name, currency = 'NGN', auto_save_rate = 0.05, relationship = 'Parent' } = req.body;
    const userId = req.user.id;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Family pot name is required.' });
    }

    // Check if user already belongs to a family
    const existing = await query('SELECT family_id FROM family_members WHERE user_id = ?', [userId]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already belong to a family pot. You can only belong to one active family at a time.'
      });
    }

    await connection.beginTransaction();

    const inviteCode = generateInviteCode(name);

    // 1. Insert Family
    const [familyResult] = await connection.execute(
      `INSERT INTO families (name, invite_code, currency, pot_balance, emergency_balance, auto_save_rate, created_by)
       VALUES (?, ?, ?, 0.00, 0.00, ?, ?)`,
      [name.trim(), inviteCode, currency, auto_save_rate, userId]
    );

    const familyId = familyResult.insertId;

    // 2. Add creator as Admin
    await connection.execute(
      `INSERT INTO family_members (family_id, user_id, role, relationship)
       VALUES (?, ?, 'admin', ?)`,
      [familyId, userId, relationship]
    );

    // 3. Seed default bowls for this new family
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

    // 4. Update user's global role to admin
    await connection.execute('UPDATE users SET role = "admin" WHERE id = ?', [userId]);

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Family pot created successfully!',
      family: {
        id: familyId,
        name: name.trim(),
        invite_code: inviteCode,
        currency,
        pot_balance: 0.00,
        emergency_balance: 0.00,
        auto_save_rate,
        role: 'admin'
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/**
 * Join an existing family via invite code
 */
async function joinFamily(req, res, next) {
  try {
    const { invite_code, relationship = 'Child', role = 'member', bank_name, account_number } = req.body;
    const userId = req.user.id;

    if (!invite_code) {
      return res.status(400).json({ success: false, message: 'Invite code is required.' });
    }

    // Check if user is already in a family
    const existing = await query('SELECT family_id FROM family_members WHERE user_id = ?', [userId]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already belong to a family pot. Leave your current family first to join another.'
      });
    }

    // Find family by invite code
    const families = await query('SELECT * FROM families WHERE invite_code = ?', [invite_code.trim().toUpperCase()]);
    if (families.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid invite code. Family not found.' });
    }

    const family = families[0];
    const memberRole = role === 'admin' ? 'admin' : 'member';
    const maskedAcc = account_number ? maskAccountNumber(account_number) : null;

    await query(
      `INSERT INTO family_members (family_id, user_id, role, relationship, bank_name, account_number_masked)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [family.id, userId, memberRole, relationship, bank_name || null, maskedAcc]
    );

    // Notify Admins
    await notifyAdmins(family.id, {
      type: 'system',
      title: 'New Family Member Joined',
      message: `${req.user.name} (${relationship}) has joined the ${family.name} as a ${memberRole}.`,
      excludeUserId: userId
    });

    return res.json({
      success: true,
      message: `Successfully joined ${family.name}!`,
      family: {
        id: family.id,
        name: family.name,
        role: memberRole,
        currency: family.currency,
        pot_balance: Number(family.pot_balance),
        emergency_balance: Number(family.emergency_balance)
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get details of the active family
 */
async function getFamilyDetails(req, res, next) {
  try {
    const familyId = req.user.family_id;
    const families = await query(
      `SELECT f.*, u.name AS creator_name 
       FROM families f
       JOIN users u ON u.id = f.created_by
       WHERE f.id = ?`,
      [familyId]
    );

    if (families.length === 0) {
      return res.status(404).json({ success: false, message: 'Family pot not found.' });
    }

    const family = families[0];

    // Compute monthly spent
    const spentResults = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total_spent_month
       FROM expenses
       WHERE family_id = ? AND status = 'approved'
         AND MONTH(created_at) = MONTH(CURRENT_DATE())
         AND YEAR(created_at) = YEAR(CURRENT_DATE())`,
      [familyId]
    );

    // Compute total goals savings
    const goalResults = await query(
      `SELECT COALESCE(SUM(current_amount), 0) AS total_goals_saved
       FROM goals
       WHERE family_id = ? AND status IN ('in_progress', 'achieved')`,
      [familyId]
    );

    const totalSpentMonth = Number(spentResults[0].total_spent_month);
    const totalGoalsSaved = Number(goalResults[0].total_goals_saved);
    const totalSaved = Number(family.emergency_balance) + totalGoalsSaved;

    return res.json({
      success: true,
      family: {
        id: family.id,
        name: family.name,
        invite_code: family.invite_code,
        currency: family.currency,
        pot_balance: Number(family.pot_balance),
        emergency_balance: Number(family.emergency_balance),
        total_spent_this_month: totalSpentMonth,
        total_saved: totalSaved,
        auto_save_rate: Number(family.auto_save_rate),
        created_at: family.created_at,
        created_by: family.creator_name,
        user_role: req.user.family_role
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List family members with contributions, spent amounts, and roles
 */
async function getFamilyMembers(req, res, next) {
  try {
    const familyId = req.user.family_id;

    const members = await query(
      `SELECT 
        fm.id AS membership_id,
        fm.role,
        fm.relationship,
        fm.bank_name,
        fm.account_number_masked,
        fm.joined_at,
        u.id AS user_id,
        u.name,
        u.email,
        u.phone,
        u.avatar_url,
        COALESCE((SELECT SUM(c.amount) FROM contributions c WHERE c.family_id = fm.family_id AND c.user_id = u.id AND c.status = 'success'), 0) AS total_contributed,
        COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.family_id = fm.family_id AND e.user_id = u.id AND e.status = 'approved'), 0) AS total_spent
       FROM family_members fm
       JOIN users u ON u.id = fm.user_id
       WHERE fm.family_id = ?
       ORDER BY fm.role ASC, fm.joined_at ASC`,
      [familyId]
    );

    return res.json({
      success: true,
      members: members.map((m) => ({
        id: m.membership_id,
        user_id: m.user_id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        avatar_url: m.avatar_url,
        role: m.role,
        relationship: m.relationship,
        bank_name: m.bank_name,
        account_number_masked: m.account_number_masked,
        total_contributed: Number(m.total_contributed),
        total_spent: Number(m.total_spent),
        joined_at: m.joined_at
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a member's role or details (Admin only)
 */
async function updateMemberRole(req, res, next) {
  try {
    const { memberId } = req.params;
    const { role, relationship } = req.body;
    const familyId = req.user.family_id;

    if (!role && !relationship) {
      return res.status(400).json({ success: false, message: 'Role or relationship update required.' });
    }

    const updates = [];
    const params = [];
    if (role) {
      if (!['admin', 'member'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role. Must be admin or member.' });
      }
      updates.push('role = ?');
      params.push(role);
    }
    if (relationship) {
      updates.push('relationship = ?');
      params.push(relationship);
    }

    params.push(memberId, familyId);
    await query(`UPDATE family_members SET ${updates.join(', ')} WHERE id = ? AND family_id = ?`, params);

    return res.json({
      success: true,
      message: 'Member updated successfully.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Remove a member from the family (Admin only)
 */
async function removeMember(req, res, next) {
  try {
    const { memberId } = req.params;
    const familyId = req.user.family_id;

    // Check member
    const members = await query('SELECT user_id, role FROM family_members WHERE id = ? AND family_id = ?', [memberId, familyId]);
    if (members.length === 0) {
      return res.status(404).json({ success: false, message: 'Family member not found.' });
    }

    if (members[0].user_id === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot remove yourself from the family pot.' });
    }

    await query('DELETE FROM family_members WHERE id = ? AND family_id = ?', [memberId, familyId]);

    return res.json({
      success: true,
      message: 'Family member removed successfully.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Regenerate family invite code (Admin only)
 */
async function regenerateInviteCode(req, res, next) {
  try {
    const familyId = req.user.family_id;
    const families = await query('SELECT name FROM families WHERE id = ?', [familyId]);
    const newCode = generateInviteCode(families[0].name);

    await query('UPDATE families SET invite_code = ? WHERE id = ?', [newCode, familyId]);

    return res.json({
      success: true,
      message: 'Invite code regenerated successfully.',
      invite_code: newCode
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update family settings (Admin only)
 */
async function updateFamilySettings(req, res, next) {
  try {
    const familyId = req.user.family_id;
    const { name, auto_save_rate } = req.body;

    const updates = [];
    const params = [];
    if (name) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (auto_save_rate !== undefined) {
      const rate = Number(auto_save_rate);
      if (isNaN(rate) || rate < 0 || rate > 0.5) {
        return res.status(400).json({ success: false, message: 'Auto-save rate must be between 0 and 0.50 (50%).' });
      }
      updates.push('auto_save_rate = ?');
      params.push(rate);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid settings provided.' });
    }

    params.push(familyId);
    await query(`UPDATE families SET ${updates.join(', ')} WHERE id = ?`, params);

    return res.json({
      success: true,
      message: 'Family settings updated successfully.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all available families for signup / dropdown selectors
 */
async function getAllFamilies(req, res, next) {
  try {
    const families = await query(
      `SELECT id, id AS family_id, name, name AS family_name, invite_code, currency, pot_balance, emergency_balance, created_at 
       FROM families ORDER BY id ASC`
    );
    return res.json({
      success: true,
      families,
      data: families
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createFamily,
  joinFamily,
  getFamilyDetails,
  getFamilyMembers,
  updateMemberRole,
  removeMember,
  regenerateInviteCode,
  updateFamilySettings,
  getAllFamilies
};

