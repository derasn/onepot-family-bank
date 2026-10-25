const { query, pool } = require('../config/db');
const { notifyAdmins } = require('../services/notificationService');

/**
 * Get all bowls for the current family
 */
async function getBowls(req, res, next) {
  try {
    const familyId = req.user.family_id;

    const bowls = await query(
      `SELECT * FROM bowls WHERE family_id = ? ORDER BY priority ASC, id ASC`,
      [familyId]
    );

    const formatted = bowls.map((b) => {
      const target = Number(b.target_budget);
      const allocated = Number(b.allocated_amount);
      const spent = Number(b.spent_amount);
      const remaining = Math.max(0, allocated - spent);
      const percentSpent = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;
      const isNearLimit = percentSpent >= 80;

      return {
        id: b.id,
        name: b.name,
        description: b.description,
        category: b.category,
        target_budget: target,
        allocated_amount: allocated,
        spent_amount: spent,
        remaining_amount: remaining,
        percent_spent: percentSpent,
        is_near_limit: isNearLimit,
        is_locked: Boolean(b.is_locked),
        is_system_default: Boolean(b.is_system_default),
        icon: b.icon,
        color: b.color,
        priority: b.priority,
        created_at: b.created_at
      };
    });

    return res.json({
      success: true,
      bowls: formatted
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new custom bowl (Admin only)
 */
async function createBowl(req, res, next) {
  try {
    const familyId = req.user.family_id;
    const { name, description, category = 'general', target_budget = 0, icon = 'folder', color = '#3B82F6', priority = 10 } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Bowl name is required.' });
    }

    const result = await query(
      `INSERT INTO bowls (family_id, name, description, category, target_budget, allocated_amount, spent_amount, is_locked, is_system_default, icon, color, priority)
       VALUES (?, ?, ?, ?, ?, 0.00, 0.00, 0, 0, ?, ?, ?)`,
      [familyId, name.trim(), description || null, category, Number(target_budget) || 0, icon, color, Number(priority) || 10]
    );

    return res.status(201).json({
      success: true,
      message: `Bowl "${name}" created successfully.`,
      bowlId: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing bowl (Admin only)
 */
async function updateBowl(req, res, next) {
  try {
    const { id } = req.params;
    const familyId = req.user.family_id;
    const { name, description, category, target_budget, icon, color, priority, is_locked } = req.body;

    const bowls = await query('SELECT * FROM bowls WHERE id = ? AND family_id = ?', [id, familyId]);
    if (bowls.length === 0) {
      return res.status(404).json({ success: false, message: 'Bowl not found.' });
    }

    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name.trim()); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (category) { updates.push('category = ?'); params.push(category); }
    if (target_budget !== undefined) { updates.push('target_budget = ?'); params.push(Number(target_budget)); }
    if (icon) { updates.push('icon = ?'); params.push(icon); }
    if (color) { updates.push('color = ?'); params.push(color); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(Number(priority)); }
    if (is_locked !== undefined) { updates.push('is_locked = ?'); params.push(is_locked ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(id, familyId);
    await query(`UPDATE bowls SET ${updates.join(', ')} WHERE id = ? AND family_id = ?`, params);

    return res.json({
      success: true,
      message: 'Bowl updated successfully.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a bowl (Admin only)
 */
async function deleteBowl(req, res, next) {
  try {
    const { id } = req.params;
    const familyId = req.user.family_id;

    const bowls = await query('SELECT * FROM bowls WHERE id = ? AND family_id = ?', [id, familyId]);
    if (bowls.length === 0) {
      return res.status(404).json({ success: false, message: 'Bowl not found.' });
    }

    const bowl = bowls[0];
    if (bowl.is_locked) {
      return res.status(400).json({ success: false, message: 'Cannot delete a locked bowl.' });
    }

    // Check if bowl has unspent allocation
    if (Number(bowl.allocated_amount) > Number(bowl.spent_amount)) {
      const remaining = Number(bowl.allocated_amount) - Number(bowl.spent_amount);
      // Return remaining back to family pot before deletion
      await query('UPDATE families SET pot_balance = pot_balance + ? WHERE id = ?', [remaining, familyId]);
    }

    await query('DELETE FROM bowls WHERE id = ? AND family_id = ?', [id, familyId]);

    return res.json({
      success: true,
      message: 'Bowl deleted successfully and any remaining balance refunded to the family pot.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Allocate pot funds into bowls (Admin only)
 * Supported Modes:
 * 1. 'manual': Specific amounts explicitly allocated by admin
 * 2. 'zero-based': Every available naira must be allocated (sum == potBalance)
 * 3. '50-30-20': 50% Needs, 30% Wants, 20% Savings
 * 4. 'priority': Sequential allocation from highest priority bowl
 */
async function allocateFunds(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const familyId = req.user.family_id;
    const { mode = 'manual', allocations = [] } = req.body;

    await connection.beginTransaction();

    // Get current family pot balance
    const [familyRows] = await connection.execute('SELECT pot_balance FROM families WHERE id = ? FOR UPDATE', [familyId]);
    if (familyRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Family not found.' });
    }

    const currentPot = Number(familyRows[0].pot_balance);
    if (currentPot <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Family pot balance is empty (₦0.00). Please add contributions to the pot before allocating.'
      });
    }

    // Fetch existing bowls
    const [allBowls] = await connection.execute('SELECT * FROM bowls WHERE family_id = ? ORDER BY priority ASC, id ASC', [familyId]);
    if (allBowls.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'No bowls found to allocate into.' });
    }

    let resolvedAllocations = []; // [{ bowlId, amount }]

    if (mode === 'manual') {
      const totalRequested = allocations.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      if (totalRequested <= 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Allocation amount must be greater than zero.' });
      }
      if (totalRequested > currentPot) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient pot balance. Requested ₦${totalRequested.toLocaleString()} but pot only has ₦${currentPot.toLocaleString()}.`
        });
      }
      resolvedAllocations = allocations.map((a) => ({ bowlId: a.bowlId, amount: Number(a.amount) }));

    } else if (mode === 'zero-based') {
      // In zero-based budgeting, sum of allocations must equal current available pot
      const totalAllocated = allocations.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const diff = Math.abs(currentPot - totalAllocated);

      if (diff > 0.05) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Zero-Based Rule Violation: Every naira in the pot must be assigned a job! Pot balance is ₦${currentPot.toLocaleString()}, but total allocated is ₦${totalAllocated.toLocaleString()} (Difference: ₦${(currentPot - totalAllocated).toLocaleString()}).`
        });
      }
      resolvedAllocations = allocations.map((a) => ({ bowlId: a.bowlId, amount: Number(a.amount) }));

    } else if (mode === '50-30-20') {
      // 50% Needs, 30% Wants, 20% Savings
      const needsShare = currentPot * 0.50;
      const wantsShare = currentPot * 0.30;
      const savingsShare = currentPot * 0.20;

      const needsBowls = allBowls.filter((b) => ['housing', 'food', 'utilities', 'education', 'health'].includes(b.category));
      const wantsBowls = allBowls.filter((b) => ['transport', 'general', 'entertainment'].includes(b.category));
      const savingsBowls = allBowls.filter((b) => ['emergency', 'savings'].includes(b.category));

      const distributeEvenly = (bowls, total) => {
        if (bowls.length === 0) return [];
        const perBowl = total / bowls.length;
        return bowls.map((b) => ({ bowlId: b.id, amount: Math.round(perBowl * 100) / 100 }));
      };

      resolvedAllocations = [
        ...distributeEvenly(needsBowls.length > 0 ? needsBowls : allBowls, needsShare),
        ...distributeEvenly(wantsBowls.length > 0 ? wantsBowls : allBowls, wantsShare),
        ...distributeEvenly(savingsBowls.length > 0 ? savingsBowls : allBowls, savingsShare)
      ];

    } else if (mode === 'priority') {
      // Allocate from priority 1 onwards until pot is drained
      let remainingPot = currentPot;
      for (const b of allBowls) {
        if (remainingPot <= 0) break;
        const needed = Math.max(0, Number(b.target_budget) - Number(b.allocated_amount));
        const assign = Math.min(remainingPot, needed > 0 ? needed : remainingPot);
        if (assign > 0) {
          resolvedAllocations.push({ bowlId: b.id, amount: assign });
          remainingPot -= assign;
        }
      }
    } else {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Unknown allocation mode: ${mode}` });
    }

    // Apply allocations
    let totalDeducted = 0;
    for (const alloc of resolvedAllocations) {
      if (alloc.amount > 0) {
        await connection.execute(
          'UPDATE bowls SET allocated_amount = allocated_amount + ? WHERE id = ? AND family_id = ?',
          [alloc.amount, alloc.bowlId, familyId]
        );
        totalDeducted += alloc.amount;
      }
    }

    // Deduct from family pot balance
    await connection.execute(
      'UPDATE families SET pot_balance = GREATEST(0, pot_balance - ?) WHERE id = ?',
      [totalDeducted, familyId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: `Successfully allocated ₦${totalDeducted.toLocaleString()} across bowls using "${mode}" strategy.`,
      mode,
      allocatedTotal: totalDeducted,
      remainingPot: Math.max(0, currentPot - totalDeducted),
      allocations: resolvedAllocations
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/**
 * Get unallocated pot balance and summary for Zero-Based Budgeting
 */
async function getUnallocatedPot(req, res, next) {
  try {
    const familyId = req.user.family_id;

    const families = await query('SELECT pot_balance, currency FROM families WHERE id = ?', [familyId]);
    const bowls = await query('SELECT SUM(allocated_amount) as total_allocated, SUM(spent_amount) as total_spent, SUM(target_budget) as total_target FROM bowls WHERE family_id = ?', [familyId]);

    const potBalance = Number(families[0].pot_balance);
    const totalAllocated = Number(bowls[0].total_allocated || 0);
    const totalSpent = Number(bowls[0].total_spent || 0);
    const totalTarget = Number(bowls[0].total_target || 0);

    return res.json({
      success: true,
      pot_balance: potBalance,
      total_allocated: totalAllocated,
      total_spent: totalSpent,
      total_target: totalTarget,
      is_zero_based_balanced: potBalance === 0,
      currency: families[0].currency
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getBowls,
  createBowl,
  updateBowl,
  deleteBowl,
  allocateFunds,
  getUnallocatedPot
};

