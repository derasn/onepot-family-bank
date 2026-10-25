const { query } = require('../config/db');

/**
 * Get comprehensive family dashboard summary
 */
async function getDashboardSummary(req, res, next) {
  try {
    const familyId = req.user.family_id;

    // 1. Fetch Family wallet & emergency balances
    const families = await query(
      `SELECT name, currency, pot_balance, emergency_balance, auto_save_rate
       FROM families WHERE id = ?`,
      [familyId]
    );

    if (families.length === 0) {
      return res.status(404).json({ success: false, message: 'Family not found.' });
    }

    const family = families[0];
    const potBalance = Number(family.pot_balance);
    const emergencyBalance = Number(family.emergency_balance);

    // 2. Total Spent This Month
    const spentMonthRows = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total_spent_month
       FROM expenses
       WHERE family_id = ? AND status = 'approved'
         AND MONTH(created_at) = MONTH(CURRENT_DATE())
         AND YEAR(created_at) = YEAR(CURRENT_DATE())`,
      [familyId]
    );
    const totalSpentThisMonth = Number(spentMonthRows[0].total_spent_month);

    // 3. Goals Savings
    const goalsRows = await query(
      `SELECT COALESCE(SUM(current_amount), 0) AS total_goals_saved
       FROM goals
       WHERE family_id = ? AND status IN ('in_progress', 'achieved')`,
      [familyId]
    );
    const totalGoalsSaved = Number(goalsRows[0].total_goals_saved);
    const totalSaved = emergencyBalance + totalGoalsSaved;

    // 4. Bowls Progress (middle-left)
    const bowls = await query(
      `SELECT id, name, category, target_budget, allocated_amount, spent_amount, color, icon, priority
       FROM bowls
       WHERE family_id = ?
       ORDER BY priority ASC, id ASC`,
      [familyId]
    );

    const formattedBowls = bowls.map((b) => {
      const target = Number(b.target_budget);
      const allocated = Number(b.allocated_amount);
      const spent = Number(b.spent_amount);
      const remaining = Math.max(0, allocated - spent);
      const percentSpent = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;

      return {
        id: b.id,
        name: b.name,
        category: b.category,
        target_budget: target,
        allocated_amount: allocated,
        spent_amount: spent,
        remaining_amount: remaining,
        percent_spent: percentSpent,
        is_near_limit: percentSpent >= 80,
        color: b.color,
        icon: b.icon
      };
    });

    // 5. Recent Transactions Table (middle-right: recent 10 transactions)
    const recentExpenses = await query(
      `SELECT 
        e.id, 'expense' AS type, e.title, e.amount, e.status, e.created_at,
        u.name AS user_name, u.avatar_url, b.name AS category_name, b.color AS category_color
       FROM expenses e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN bowls b ON b.id = e.bowl_id
       WHERE e.family_id = ?
       ORDER BY e.created_at DESC
       LIMIT 10`,
      [familyId]
    );

    // 6. Pie Chart Data: "Where did our money go?" (Spend by bowl category)
    const categorySpend = await query(
      `SELECT 
        COALESCE(b.name, 'Other') AS label,
        COALESCE(b.color, '#64748B') AS color,
        SUM(e.amount) AS value
       FROM expenses e
       LEFT JOIN bowls b ON b.id = e.bowl_id
       WHERE e.family_id = ? AND e.status = 'approved'
       GROUP BY b.id, b.name, b.color
       HAVING value > 0
       ORDER BY value DESC`,
      [familyId]
    );

    // 7. Bar Chart Data: "Budget vs. Actual Spend"
    const budgetVsActual = bowls.map((b) => ({
      bowl: b.name,
      budget: Number(b.target_budget),
      allocated: Number(b.allocated_amount),
      spent: Number(b.spent_amount),
      remaining: Math.max(0, Number(b.allocated_amount) - Number(b.spent_amount))
    }));

    // 8. Pending Approvals Count (for Parents / Admins)
    const pendingRequests = await query(
      `SELECT COUNT(*) AS pending_count
       FROM expenses
       WHERE family_id = ? AND status = 'pending'`,
      [familyId]
    );

    return res.json({
      success: true,
      family_name: family.name,
      currency: family.currency,
      cards: {
        pot_balance: potBalance,
        total_spent_this_month: totalSpentThisMonth,
        total_saved: totalSaved,
        emergency_balance: emergencyBalance,
        goals_saved: totalGoalsSaved,
        pending_requests_count: Number(pendingRequests[0].pending_count)
      },
      bowls: formattedBowls,
      recent_transactions: recentExpenses.map((tx) => ({
        id: tx.id,
        type: tx.type,
        title: tx.title,
        amount: Number(tx.amount),
        status: tx.status,
        user_name: tx.user_name,
        avatar_url: tx.avatar_url,
        category: tx.category_name,
        color: tx.category_color,
        created_at: tx.created_at
      })),
      charts: {
        pie_where_money_went: categorySpend.map((c) => ({
          label: c.label,
          value: Number(c.value),
          color: c.color
        })),
        bar_budget_vs_actual: budgetVsActual
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generate a downloadable periodic financial report
 */
async function getPeriodicReport(req, res, next) {
  try {
    const familyId = req.user.family_id;
    const { format = 'json' } = req.query;

    const family = (await query('SELECT name, currency, pot_balance, emergency_balance FROM families WHERE id = ?', [familyId]))[0];

    const monthlyExpenses = await query(
      `SELECT 
        DATE_FORMAT(e.created_at, '%Y-%m') AS period,
        b.name AS bowl_name,
        SUM(e.amount) AS total_amount,
        COUNT(e.id) AS transaction_count
       FROM expenses e
       LEFT JOIN bowls b ON b.id = e.bowl_id
       WHERE e.family_id = ? AND e.status = 'approved'
       GROUP BY period, bowl_name
       ORDER BY period DESC, total_amount DESC`,
      [familyId]
    );

    const monthlyContributions = await query(
      `SELECT 
        DATE_FORMAT(c.created_at, '%Y-%m') AS period,
        u.name AS member_name,
        SUM(c.amount) AS total_contributed,
        SUM(c.auto_save_amount) AS total_auto_saved
       FROM contributions c
       JOIN users u ON u.id = c.user_id
       WHERE c.family_id = ? AND c.status = 'success'
       GROUP BY period, member_name
       ORDER BY period DESC, total_contributed DESC`,
      [familyId]
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="onepot_family_report_${Date.now()}.csv"`);

      let csv = `OnePot Family Report - ${family.name}\n`;
      csv += `Currency: ${family.currency}\n\n`;
      csv += `Monthly Expenses Breakdown\n`;
      csv += `Period,Bowl,Total Spent,Count\n`;
      for (const row of monthlyExpenses) {
        csv += `${row.period},"${row.bowl_name || 'General'}",${row.total_amount},${row.transaction_count}\n`;
      }
      csv += `\nMonthly Contributions\n`;
      csv += `Period,Member,Total Contributed,Auto-Saved to Emergency\n`;
      for (const row of monthlyContributions) {
        csv += `${row.period},"${row.member_name}",${row.total_contributed},${row.total_auto_saved}\n`;
      }

      return res.send(csv);
    }

    return res.json({
      success: true,
      family_name: family.name,
      currency: family.currency,
      generated_at: new Date(),
      expenses_breakdown: monthlyExpenses,
      contributions_breakdown: monthlyContributions
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboardSummary,
  getPeriodicReport
};

