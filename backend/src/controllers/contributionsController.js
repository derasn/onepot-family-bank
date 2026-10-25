const { query, pool } = require('../config/db');
const { initializeTransaction, verifyTransaction } = require('../services/paystackService');
const { notifyFamily } = require('../services/notificationService');
const { generateReference, formatNaira } = require('../utils/helpers');

/**
 * Initialize a contribution via Paystack (Simulated / Test Mode)
 */
async function initializeContribution(req, res, next) {
  try {
    const familyId = req.user.family_id;
    const userId = req.user.id;
    const { amount, note } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid contribution amount is required.' });
    }

    const paystackResult = await initializeTransaction({
      email: req.user.email,
      amount: numAmount,
      familyId,
      userId,
      metadata: { note }
    });

    // Record pending paystack transaction
    await query(
      `INSERT INTO paystack_transactions (family_id, user_id, reference, amount, currency, type, status, channel)
       VALUES (?, ?, ?, ?, 'NGN', 'contribution', 'pending', 'card')`,
      [familyId, userId, paystackResult.reference, numAmount]
    );

    return res.json({
      success: true,
      message: 'Contribution transaction initialized.',
      data: paystackResult
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify a Paystack contribution transaction and credit family pot & emergency fund
 */
async function verifyContribution(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const familyId = req.user.family_id;
    const userId = req.user.id;
    const { reference, amount: fallbackAmount, note } = req.body;

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Transaction reference is required.' });
    }

    // Check if already processed
    const existing = await query('SELECT * FROM contributions WHERE reference = ? AND status = "success"', [reference]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This contribution reference has already been verified and credited.'
      });
    }

    // Verify with Paystack (or mock simulation)
    const verification = await verifyTransaction(reference);
    if (verification.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Transaction verification was not successful.'
      });
    }

    const contributionAmount = verification.amount || Number(fallbackAmount) || 10000;

    await connection.beginTransaction();

    // Get family auto-save rate
    const [familyRows] = await connection.execute('SELECT auto_save_rate, name FROM families WHERE id = ? FOR UPDATE', [familyId]);
    const autoSaveRate = Number(familyRows[0].auto_save_rate || 0.05);

    // Calculate auto savings (e.g. 5% into emergency fund, 95% into active pot)
    const autoSaveAmount = Math.round(contributionAmount * autoSaveRate * 100) / 100;
    const potAmount = Math.round((contributionAmount - autoSaveAmount) * 100) / 100;

    // 1. Credit family pot and emergency balance
    await connection.execute(
      `UPDATE families
       SET pot_balance = pot_balance + ?,
           emergency_balance = emergency_balance + ?
       WHERE id = ?`,
      [potAmount, autoSaveAmount, familyId]
    );

    // 2. Record contribution
    await connection.execute(
      `INSERT INTO contributions (family_id, user_id, amount, pot_amount, auto_save_amount, payment_method, reference, status, note)
       VALUES (?, ?, ?, ?, ?, 'paystack', ?, 'success', ?)
       ON DUPLICATE KEY UPDATE status = 'success', amount = VALUES(amount), pot_amount = VALUES(pot_amount), auto_save_amount = VALUES(auto_save_amount)`,
      [familyId, userId, contributionAmount, potAmount, autoSaveAmount, reference, note || 'Paystack contribution']
    );

    // 3. Update Paystack transaction record
    await connection.execute(
      `UPDATE paystack_transactions
       SET status = 'success', paid_at = NOW(), gateway_response = ?
       WHERE reference = ?`,
      [verification.gateway_response || 'Successful', reference]
    );

    await connection.commit();

    // 4. Notify all family members of the new pooled funds
    await notifyFamily(familyId, {
      type: 'contribution',
      title: 'New Family Pot Contribution',
      message: `${req.user.name} contributed ${formatNaira(contributionAmount)} to the pot. ${formatNaira(potAmount)} added to wallet, ${formatNaira(autoSaveAmount)} auto-saved into Emergency Fund!`,
      metadata: { contributionAmount, potAmount, autoSaveAmount, reference }
    });

    return res.json({
      success: true,
      message: `Successfully contributed ${formatNaira(contributionAmount)} to the family pot!`,
      contribution: {
        amount: contributionAmount,
        pot_amount: potAmount,
        auto_save_amount: autoSaveAmount,
        reference
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
 * Record a direct / manual contribution (Simulated closed-loop ledger)
 */
async function manualContribution(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const familyId = req.user.family_id;
    const userId = req.user.id;
    const { amount, note, payment_method = 'manual' } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid contribution amount is required.' });
    }

    const reference = generateReference('CONTRIB');

    await connection.beginTransaction();

    const [familyRows] = await connection.execute('SELECT auto_save_rate FROM families WHERE id = ? FOR UPDATE', [familyId]);
    const autoSaveRate = Number(familyRows[0].auto_save_rate || 0.05);

    const autoSaveAmount = Math.round(numAmount * autoSaveRate * 100) / 100;
    const potAmount = Math.round((numAmount - autoSaveAmount) * 100) / 100;

    // Credit pot and emergency balance
    await connection.execute(
      `UPDATE families
       SET pot_balance = pot_balance + ?,
           emergency_balance = emergency_balance + ?
       WHERE id = ?`,
      [potAmount, autoSaveAmount, familyId]
    );

    // Record contribution
    await connection.execute(
      `INSERT INTO contributions (family_id, user_id, amount, pot_amount, auto_save_amount, payment_method, reference, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'success', ?)`,
      [familyId, userId, numAmount, potAmount, autoSaveAmount, payment_method, reference, note || 'Direct family contribution']
    );

    await connection.commit();

    await notifyFamily(familyId, {
      type: 'contribution',
      title: 'New Contribution Logged',
      message: `${req.user.name} added ${formatNaira(numAmount)} to the family pot.`,
      metadata: { amount: numAmount, reference }
    });

    return res.status(201).json({
      success: true,
      message: `Successfully added ${formatNaira(numAmount)} to the family pot!`,
      contribution: {
        amount: numAmount,
        pot_amount: potAmount,
        auto_save_amount: autoSaveAmount,
        reference
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
 * Get contribution history for the active family
 */
async function getContributions(req, res, next) {
  try {
    const familyId = req.user.family_id;
    const { user_id, start_date, end_date } = req.query;

    let sql = `
      SELECT c.*, u.name AS user_name, u.avatar_url, fm.relationship, fm.role AS family_role
      FROM contributions c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN family_members fm ON fm.family_id = c.family_id AND fm.user_id = u.id
      WHERE c.family_id = ?
    `;
    const params = [familyId];

    if (user_id) {
      sql += ' AND c.user_id = ?';
      params.push(user_id);
    }
    if (start_date) {
      sql += ' AND c.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND c.created_at <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY c.created_at DESC';

    const contributions = await query(sql, params);

    return res.json({
      success: true,
      contributions: contributions.map((c) => ({
        id: c.id,
        user_id: c.user_id,
        user_name: c.user_name,
        relationship: c.relationship,
        family_role: c.family_role,
        avatar_url: c.avatar_url,
        amount: Number(c.amount),
        pot_amount: Number(c.pot_amount),
        auto_save_amount: Number(c.auto_save_amount),
        payment_method: c.payment_method,
        reference: c.reference,
        status: c.status,
        note: c.note,
        created_at: c.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get pooling breakdown statistics ("Dad 200k, Mum 100k, Tobi 20k...")
 */
async function getContributionStats(req, res, next) {
  try {
    const familyId = req.user.family_id;

    const stats = await query(
      `SELECT 
        u.id AS user_id,
        u.name,
        fm.relationship,
        fm.role,
        COALESCE(SUM(c.amount), 0) AS total_contributed,
        COUNT(c.id) AS contribution_count
       FROM family_members fm
       JOIN users u ON u.id = fm.user_id
       LEFT JOIN contributions c ON c.family_id = fm.family_id AND c.user_id = u.id AND c.status = 'success'
       WHERE fm.family_id = ?
       GROUP BY u.id, u.name, fm.relationship, fm.role
       ORDER BY total_contributed DESC`,
      [familyId]
    );

    const totalFamilyContributions = stats.reduce((sum, s) => sum + Number(s.total_contributed), 0);

    const membersWithPercentage = stats.map((s) => {
      const amount = Number(s.total_contributed);
      const percentage = totalFamilyContributions > 0 ? Math.round((amount / totalFamilyContributions) * 100) : 0;
      return {
        user_id: s.user_id,
        name: s.name,
        relationship: s.relationship,
        role: s.role,
        total_contributed: amount,
        contribution_count: Number(s.contribution_count),
        percentage
      };
    });

    return res.json({
      success: true,
      total_family_contributions: totalFamilyContributions,
      breakdown: membersWithPercentage
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  initializeContribution,
  verifyContribution,
  manualContribution,
  getContributions,
  getContributionStats
};

