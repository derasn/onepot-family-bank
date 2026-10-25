const { query, pool } = require('../config/db');
const { notifyAdmins, createNotification } = require('../services/notificationService');
const { formatNaira } = require('../utils/helpers');

/**
 * List all expenses / transactions for active family
 */
async function getExpenses(req, res, next) {
  try {
    const familyId = req.user.family_id;
    const { status, bowl_id, user_id, start_date, end_date } = req.query;

    let sql = `
      SELECT 
        e.*,
        b.name AS bowl_name,
        b.category AS bowl_category,
        b.color AS bowl_color,
        b.icon AS bowl_icon,
        u.name AS requester_name,
        u.avatar_url AS requester_avatar,
        fm.relationship AS requester_relationship,
        fm.role AS requester_role,
        appr.name AS approver_name
      FROM expenses e
      LEFT JOIN bowls b ON b.id = e.bowl_id
      JOIN users u ON u.id = e.user_id
      LEFT JOIN family_members fm ON fm.family_id = e.family_id AND fm.user_id = u.id
      LEFT JOIN users appr ON appr.id = e.approved_by
      WHERE e.family_id = ?
    `;
    const params = [familyId];

    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }
    if (bowl_id) {
      sql += ' AND e.bowl_id = ?';
      params.push(bowl_id);
    }
    if (user_id) {
      sql += ' AND e.user_id = ?';
      params.push(user_id);
    }
    if (start_date) {
      sql += ' AND e.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND e.created_at <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY e.created_at DESC';

    const expenses = await query(sql, params);

    return res.json({
      success: true,
      expenses: expenses.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        amount: Number(e.amount),
        status: e.status,
        is_emergency_borrow: Boolean(e.is_emergency_borrow),
        bowl: e.bowl_id
          ? {
              id: e.bowl_id,
              name: e.bowl_name,
              category: e.bowl_category,
              color: e.bowl_color,
              icon: e.bowl_icon
            }
          : null,
        requester: {
          id: e.user_id,
          name: e.requester_name,
          avatar_url: e.requester_avatar,
          relationship: e.requester_relationship,
          role: e.requester_role
        },
        approver: e.approved_by
          ? {
              id: e.approved_by,
              name: e.approver_name,
              approved_at: e.approved_at
            }
          : null,
        rejection_reason: e.rejection_reason,
        receipt_url: e.receipt_url,
        created_at: e.created_at,
        updated_at: e.updated_at
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new expense or spending request
 * - Admin: auto-approved and debited immediately
 * - Member: saved as 'pending' for parent/admin approval
 */
async function createExpense(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const familyId = req.user.family_id;
    const userId = req.user.id;
    const isAdmin = req.user.family_role === 'admin' || req.user.role === 'admin';
    const { bowl_id, amount, title, description, receipt_url } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid expense amount is required.' });
    }
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Expense title / purpose is required.' });
    }
    if (!bowl_id) {
      return res.status(400).json({ success: false, message: 'Expense must be linked to a budget bowl.' });
    }

    await connection.beginTransaction();

    // Check bowl balance
    const [bowlRows] = await connection.execute('SELECT * FROM bowls WHERE id = ? AND family_id = ? FOR UPDATE', [bowl_id, familyId]);
    if (bowlRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Specified bowl not found.' });
    }

    const bowl = bowlRows[0];
    const allocated = Number(bowl.allocated_amount);
    const spent = Number(bowl.spent_amount);
    const available = allocated - spent;

    if (numAmount > available) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance in "${bowl.name}" bowl! Available: ${formatNaira(available)}, Requested: ${formatNaira(numAmount)}. If urgent, request an Emergency Fund borrow instead.`
      });
    }

    if (isAdmin) {
      // 1. Direct Debit for Admin
      const newSpent = spent + numAmount;
      await connection.execute('UPDATE bowls SET spent_amount = ? WHERE id = ?', [newSpent, bowl_id]);

      const [expenseResult] = await connection.execute(
        `INSERT INTO expenses (family_id, bowl_id, user_id, amount, title, description, receipt_url, status, approved_by, approved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, NOW())`,
        [familyId, bowl_id, userId, numAmount, title.trim(), description || null, receipt_url || null, userId]
      );

      await connection.commit();

      // Check if bowl reached 80% spending limit
      if (allocated > 0 && (newSpent / allocated) >= 0.80) {
        const pct = Math.round((newSpent / allocated) * 100);
        await notifyAdmins(familyId, {
          type: 'threshold_alert',
          title: `⚠️ Spending Alert: ${bowl.name}`,
          message: `Bowl "${bowl.name}" has reached ${pct}% of its allocated budget (${formatNaira(newSpent)} spent of ${formatNaira(allocated)}).`
        });
      }

      return res.status(201).json({
        success: true,
        message: `Expense of ${formatNaira(numAmount)} logged and debited from "${bowl.name}".`,
        expenseId: expenseResult.insertId,
        status: 'approved'
      });
    } else {
      // 2. Member Request (Pending Approval)
      const [expenseResult] = await connection.execute(
        `INSERT INTO expenses (family_id, bowl_id, user_id, amount, title, description, receipt_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [familyId, bowl_id, userId, numAmount, title.trim(), description || null, receipt_url || null]
      );

      const expenseId = expenseResult.insertId;

      // Add to approvals table
      await connection.execute(
        `INSERT INTO approvals (family_id, entity_type, entity_id, requested_by, status)
         VALUES (?, 'expense', ?, ?, 'pending')`,
        [familyId, expenseId, userId]
      );

      await connection.commit();

      // Notify Parents / Admins of pending spending request
      await notifyAdmins(familyId, {
        type: 'expense_request',
        title: `Spending Request: ${title.trim()}`,
        message: `${req.user.name} requested ${formatNaira(numAmount)} from "${bowl.name}" for "${title.trim()}". Needs parental approval.`,
        metadata: { expenseId, amount: numAmount, bowlName: bowl.name }
      });

      return res.status(201).json({
        success: true,
        message: `Spending request for ${formatNaira(numAmount)} submitted for parent approval.`,
        expenseId,
        status: 'pending'
      });
    }
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/**
 * Request to borrow from emergency fund when bowl is empty
 */
async function requestEmergencyBorrow(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const familyId = req.user.family_id;
    const userId = req.user.id;
    const { amount, title, description } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid emergency borrow amount is required.' });
    }
    if (!title) {
      return res.status(400).json({ success: false, message: 'Reason for emergency borrowing is required.' });
    }

    await connection.beginTransaction();

    const [familyRows] = await connection.execute('SELECT emergency_balance FROM families WHERE id = ? FOR UPDATE', [familyId]);
    const emergencyBalance = Number(familyRows[0].emergency_balance);

    if (numAmount > emergencyBalance) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Requested emergency amount (${formatNaira(numAmount)}) exceeds available Emergency Funds (${formatNaira(emergencyBalance)}).`
      });
    }

    const [expenseResult] = await connection.execute(
      `INSERT INTO expenses (family_id, bowl_id, user_id, amount, title, description, status, is_emergency_borrow)
       VALUES (?, NULL, ?, ?, ?, ?, 'pending', 1)`,
      [familyId, userId, numAmount, `[EMERGENCY] ${title.trim()}`, description || null]
    );

    const expenseId = expenseResult.insertId;

    await connection.execute(
      `INSERT INTO approvals (family_id, entity_type, entity_id, requested_by, status)
       VALUES (?, 'emergency_borrow', ?, ?, 'pending')`,
      [familyId, expenseId, userId]
    );

    await connection.commit();

    await notifyAdmins(familyId, {
      type: 'emergency_alert',
      title: '🚨 Emergency Fund Borrow Request',
      message: `${req.user.name} requested an emergency fund withdrawal of ${formatNaira(numAmount)} for "${title.trim()}". Requires parental authorization.`
    });

    return res.status(201).json({
      success: true,
      message: `Emergency fund withdrawal request of ${formatNaira(numAmount)} submitted. Awaiting admin approval.`,
      expenseId,
      status: 'pending'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/**
 * Approve or Reject a pending expense request (Admin only)
 */
async function decideExpense(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { decision, rejection_reason, comments } = req.body;
    const familyId = req.user.family_id;
    const adminId = req.user.id;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be either "approved" or "rejected".' });
    }

    await connection.beginTransaction();

    const [expenseRows] = await connection.execute('SELECT * FROM expenses WHERE id = ? AND family_id = ? FOR UPDATE', [id, familyId]);
    if (expenseRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Expense request not found.' });
    }

    const expense = expenseRows[0];
    if (expense.status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `This expense request is already ${expense.status}.`
      });
    }

    const amount = Number(expense.amount);

    if (decision === 'approved') {
      if (expense.is_emergency_borrow) {
        // Deduct from emergency funds
        const [famRows] = await connection.execute('SELECT emergency_balance FROM families WHERE id = ? FOR UPDATE', [familyId]);
        if (Number(famRows[0].emergency_balance) < amount) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Insufficient emergency funds available to approve this request.'
          });
        }
        await connection.execute('UPDATE families SET emergency_balance = emergency_balance - ? WHERE id = ?', [amount, familyId]);
      } else {
        // Deduct from bowl spent_amount
        const [bowlRows] = await connection.execute('SELECT * FROM bowls WHERE id = ? AND family_id = ? FOR UPDATE', [expense.bowl_id, familyId]);
        if (bowlRows.length === 0) {
          await connection.rollback();
          return res.status(404).json({ success: false, message: 'Assigned bowl not found.' });
        }
        const bowl = bowlRows[0];
        const allocated = Number(bowl.allocated_amount);
        const spent = Number(bowl.spent_amount);

        if (amount > (allocated - spent)) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Bowl "${bowl.name}" no longer has enough balance to approve this expense (${formatNaira(allocated - spent)} remaining).`
          });
        }

        const newSpent = spent + amount;
        await connection.execute('UPDATE bowls SET spent_amount = ? WHERE id = ?', [newSpent, expense.bowl_id]);

        // Threshold check
        if (allocated > 0 && (newSpent / allocated) >= 0.80) {
          const pct = Math.round((newSpent / allocated) * 100);
          await notifyAdmins(familyId, {
            type: 'threshold_alert',
            title: `⚠️ Spending Alert: ${bowl.name}`,
            message: `Bowl "${bowl.name}" has reached ${pct}% limit (${formatNaira(newSpent)} spent of ${formatNaira(allocated)}).`
          });
        }
      }

      // Mark approved
      await connection.execute(
        'UPDATE expenses SET status = "approved", approved_by = ?, approved_at = NOW() WHERE id = ?',
        [adminId, id]
      );

      // Update approval audit
      await connection.execute(
        'UPDATE approvals SET status = "approved", approver_id = ?, comments = ? WHERE entity_type IN ("expense", "emergency_borrow") AND entity_id = ?',
        [adminId, comments || null, id]
      );

      await connection.commit();

      // Notify requester
      await createNotification({
        familyId,
        userId: expense.user_id,
        type: 'expense_decision',
        title: 'Expense Request Approved ✅',
        message: `Your request for ${formatNaira(amount)} ("${expense.title}") was approved by ${req.user.name}.`
      });

      return res.json({
        success: true,
        message: `Expense request approved and ${formatNaira(amount)} debited.`,
        status: 'approved'
      });
    } else {
      // Rejected
      await connection.execute(
        'UPDATE expenses SET status = "rejected", rejection_reason = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
        [rejection_reason || 'Rejected by parent', adminId, id]
      );

      await connection.execute(
        'UPDATE approvals SET status = "rejected", approver_id = ?, comments = ? WHERE entity_type IN ("expense", "emergency_borrow") AND entity_id = ?',
        [adminId, comments || rejection_reason || null, id]
      );

      await connection.commit();

      // Notify requester
      await createNotification({
        familyId,
        userId: expense.user_id,
        type: 'expense_decision',
        title: 'Expense Request Rejected ❌',
        message: `Your request for ${formatNaira(amount)} ("${expense.title}") was rejected. Reason: ${rejection_reason || 'No reason provided.'}`
      });

      return res.json({
        success: true,
        message: 'Expense request rejected. Balances remained intact.',
        status: 'rejected'
      });
    }
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/**
 * Get single expense details with audit history
 */
async function getExpenseById(req, res, next) {
  try {
    const { id } = req.params;
    const familyId = req.user.family_id;

    const expenses = await query(
      `SELECT e.*, b.name AS bowl_name, u.name AS requester_name, appr.name AS approver_name
       FROM expenses e
       LEFT JOIN bowls b ON b.id = e.bowl_id
       JOIN users u ON u.id = e.user_id
       LEFT JOIN users appr ON appr.id = e.approved_by
       WHERE e.id = ? AND e.family_id = ?`,
      [id, familyId]
    );

    if (expenses.length === 0) {
      return res.status(404).json({ success: false, message: 'Expense not found.' });
    }

    const approvals = await query(
      `SELECT a.*, u.name AS approver_name
       FROM approvals a
       LEFT JOIN users u ON u.id = a.approver_id
       WHERE a.entity_id = ? AND a.family_id = ?`,
      [id, familyId]
    );

    return res.json({
      success: true,
      expense: expenses[0],
      approvals
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getExpenses,
  createExpense,
  requestEmergencyBorrow,
  decideExpense,
  getExpenseById
};

