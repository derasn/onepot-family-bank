const { query, pool } = require('../config/db');
const { notifyFamily } = require('../services/notificationService');
const { formatNaira } = require('../utils/helpers');

/**
 * Get all family goals
 */
async function getGoals(req, res, next) {
  try {
    const familyId = req.user.family_id;

    const goals = await query(
      `SELECT g.*, u.name AS creator_name, u.avatar_url AS creator_avatar
       FROM goals g
       JOIN users u ON u.id = g.created_by
       WHERE g.family_id = ?
       ORDER BY g.created_at DESC`,
      [familyId]
    );

    const formatted = goals.map((g) => {
      const target = Number(g.target_amount);
      const current = Number(g.current_amount);
      const progressPercent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
      const isCompleted = current >= target;

      return {
        id: g.id,
        title: g.title,
        description: g.description,
        target_amount: target,
        current_amount: current,
        remaining_amount: Math.max(0, target - current),
        progress_percentage: progressPercent,
        is_completed: isCompleted,
        deadline: g.deadline,
        image_url: g.image_url,
        status: g.status,
        is_locked: Boolean(g.is_locked),
        creator: {
          id: g.created_by,
          name: g.creator_name,
          avatar_url: g.creator_avatar
        },
        created_at: g.created_at
      };
    });

    return res.json({
      success: true,
      goals: formatted
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new Goal
 */
async function createGoal(req, res, next) {
  try {
    const familyId = req.user.family_id;
    const userId = req.user.id;
    const { title, description, target_amount, deadline, image_url } = req.body;

    const target = Number(target_amount);
    if (!title || !target || target <= 0) {
      return res.status(400).json({ success: false, message: 'Goal title and target amount (> 0) are required.' });
    }

    const defaultImage = image_url || 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=600&q=80';

    const result = await query(
      `INSERT INTO goals (family_id, created_by, title, description, target_amount, current_amount, deadline, image_url, status, is_locked)
       VALUES (?, ?, ?, ?, ?, 0.00, ?, ?, 'in_progress', 1)`,
      [familyId, userId, title.trim(), description || null, target, deadline || null, defaultImage]
    );

    await notifyFamily(familyId, {
      type: 'goal_milestone',
      title: '🎯 New Family Goal Created',
      message: `${req.user.name} created a new family goal: "${title.trim()}" (Target: ${formatNaira(target)}). Let's save together!`
    });

    return res.status(201).json({
      success: true,
      message: 'Family goal created successfully.',
      goalId: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Top up / Allocate funds to a Goal from Family Pot
 */
async function contributeToGoal(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const familyId = req.user.family_id;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid top-up amount is required.' });
    }

    await connection.beginTransaction();

    // Check pot balance
    const [famRows] = await connection.execute('SELECT pot_balance FROM families WHERE id = ? FOR UPDATE', [familyId]);
    const potBalance = Number(famRows[0].pot_balance);

    if (numAmount > potBalance) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient family pot balance (${formatNaira(potBalance)}). Add funds to the pot first.`
      });
    }

    // Check goal
    const [goalRows] = await connection.execute('SELECT * FROM goals WHERE id = ? AND family_id = ? FOR UPDATE', [id, familyId]);
    if (goalRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Goal not found.' });
    }

    const goal = goalRows[0];
    const newCurrent = Number(goal.current_amount) + numAmount;
    const isCompleted = newCurrent >= Number(goal.target_amount);

    // Deduct from pot
    await connection.execute('UPDATE families SET pot_balance = pot_balance - ? WHERE id = ?', [numAmount, familyId]);

    // Update goal
    await connection.execute(
      `UPDATE goals 
       SET current_amount = ?,
           status = CASE WHEN ? >= target_amount THEN 'achieved' ELSE status END
       WHERE id = ?`,
      [newCurrent, newCurrent, id]
    );

    await connection.commit();

    let milestoneMsg = `${req.user.name} added ${formatNaira(numAmount)} towards goal "${goal.title}". (${formatNaira(newCurrent)} of ${formatNaira(goal.target_amount)})`;
    if (isCompleted) {
      milestoneMsg += ` 🎉 Hooray! Your "${goal.title}" target money is complete!`;
    }

    await notifyFamily(familyId, {
      type: 'goal_milestone',
      title: isCompleted ? '🎉 Goal Achieved!' : 'Goal Funded',
      message: milestoneMsg
    });

    return res.json({
      success: true,
      message: `Successfully contributed ${formatNaira(numAmount)} to "${goal.title}".`,
      current_amount: newCurrent,
      is_completed: isCompleted
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/**
 * Unlock a Goal for disbursement (Admin only)
 */
async function unlockGoal(req, res, next) {
  try {
    const { id } = req.params;
    const familyId = req.user.family_id;
    const adminId = req.user.id;

    const goals = await query('SELECT * FROM goals WHERE id = ? AND family_id = ?', [id, familyId]);
    if (goals.length === 0) {
      return res.status(404).json({ success: false, message: 'Goal not found.' });
    }

    const goal = goals[0];

    // Check admin dual-unlock
    if (!goal.unlocked_by_admin1) {
      await query('UPDATE goals SET unlocked_by_admin1 = ?, is_locked = 0 WHERE id = ?', [adminId, id]);
    } else if (goal.unlocked_by_admin1 !== adminId) {
      await query('UPDATE goals SET unlocked_by_admin2 = ?, is_locked = 0, status = "disbursed" WHERE id = ?', [adminId, id]);
    }

    await notifyFamily(familyId, {
      type: 'goal_milestone',
      title: '🔓 Goal Funds Unlocked',
      message: `Goal "${goal.title}" has been authorized for disbursement by family administration.`
    });

    return res.json({
      success: true,
      message: `Goal "${goal.title}" unlocked successfully.`
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getGoals,
  createGoal,
  contributeToGoal,
  unlockGoal
};

