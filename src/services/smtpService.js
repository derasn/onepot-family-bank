/**
 * Nodemailer / SMTP Email Dispatcher Service
 * Implements automated email alert functionality specified in Section 3.4 & Figure 3.4
 */

import { db } from './db.js';

export class SMTPNotificationService {
  /**
   * Evaluates category budget limits after an expense is logged
   * Sends automated email via SMTP log & in-app push notification if threshold exceeded.
   */
  static evaluateBudgetAlerts(expense, category, categoryExpensesTotal, currentFamily) {
    const limits = db.getBudgetLimits(expense.family_id || currentFamily?.family_id);
    const limitObj = limits.find(b => b.category_id === category.category_id);

    if (!limitObj || limitObj.amount <= 0) return null;

    const limitAmount = limitObj.amount;
    const currentPercent = (categoryExpensesTotal / limitAmount) * 100;
    const householdName = currentFamily?.family_name || db.getFamilyById(expense.family_id)?.family_name || 'Household';

    let alertType = null;
    let severity = 'normal';
    let subject = '';
    let body = '';

    if (currentPercent >= 100) {
      alertType = 'BUDGET_EXCEEDED';
      severity = 'critical';
      subject = `🚨 URGENT: Budget Limit Exceeded for ${category.category_name}`;
      body = `Dear ${householdName},\n\nAn expense of ₦${expense.amount.toLocaleString()} logged on ${expense.date_spent} has EXCEEDED your set monthly limit for "${category.category_name}".\n\n- Monthly Budget Cap: ₦${limitAmount.toLocaleString()}\n- Current Spent Total: ₦${categoryExpensesTotal.toLocaleString()} (${Math.round(currentPercent)}% of budget)\n- Logged By: User #${expense.user_id}\n\nPlease review your family dashboard to reallocate pooled funds or adjust spending.`;
    } else if (currentPercent >= 80) {
      alertType = 'BUDGET_WARNING';
      severity = 'warning';
      subject = `⚠️ WARNING: ${category.category_name} Budget at ${Math.round(currentPercent)}%`;
      body = `Dear ${householdName},\n\nYour spending in "${category.category_name}" has reached ${Math.round(currentPercent)}% of the allocated monthly limit.\n\n- Monthly Budget Cap: ₦${limitAmount.toLocaleString()}\n- Total Spent to Date: ₦${categoryExpensesTotal.toLocaleString()}\n- Remaining Limit: ₦${(limitAmount - categoryExpensesTotal).toLocaleString()}\n\nConsider exercising caution on further expenditures in this category.`;
    }

    if (alertType) {
      const familyUsers = db.getUsers(expense.family_id || currentFamily?.family_id);
      // 1. Add to Database Notification table (Table 3.7)
      const notifRecord = db.addNotification({
        family_id: expense.family_id || currentFamily?.family_id || 1,
        type: alertType,
        message: `${subject}: ${category.category_name} spent ₦${categoryExpensesTotal.toLocaleString()} / ₦${limitAmount.toLocaleString()} (${Math.round(currentPercent)}%)`,
        emailSubject: subject,
        emailBody: body,
        smtpServer: 'smtp.gmail.com:587 (TLS Authenticated)',
        recipients: familyUsers.map(u => u.email).join(', ')
      });

      return {
        alertType,
        severity,
        subject,
        body,
        notifRecord,
        currentPercent: Math.round(currentPercent)
      };
    }

    return null;
  }

  /**
   * Dispatch automated email on Pooled Fund Contribution
   */
  static notifyPoolContribution(user, amount, purpose, newBalance, family) {
    const householdName = family?.family_name || db.getFamilyById(user.family_id)?.family_name || 'Family';
    const subject = `💳 Pooled Fund Contribution: ₦${amount.toLocaleString()} received from ${user.first_name}`;
    const body = `Hello ${householdName},\n\n${user.first_name} ${user.last_name || ''} has just contributed ₦${amount.toLocaleString()} to the family pooled account.\n\nPurpose / Note: "${purpose}"\nUpdated Shared Pool Balance: ₦${newBalance.toLocaleString()}\n\nThank you for promoting collective family financial security!`;
    const familyUsers = db.getUsers(user.family_id);

    return db.addNotification({
      family_id: user.family_id || 1,
      user_id: user.user_id,
      type: 'Pool Contribution',
      message: `${user.first_name} contributed ₦${amount.toLocaleString()} to Shared Pool. Balance: ₦${newBalance.toLocaleString()}`,
      emailSubject: subject,
      emailBody: body,
      smtpServer: 'smtp.gmail.com:587',
      recipients: familyUsers.map(u => u.email).join(', ')
    });
  }

  /**
   * Dispatch automated email on Pooled Fund Allocation
   */
  static notifyPoolAllocation(parentUser, amount, purpose, newBalance, family) {
    const householdName = family?.family_name || db.getFamilyById(parentUser.family_id)?.family_name || 'Family';
    const subject = `🏦 Pooled Fund Allocation: ₦${amount.toLocaleString()} allocated by ${parentUser.first_name}`;
    const body = `Hello ${householdName},\n\nParent Manager ${parentUser.first_name} ${parentUser.last_name || ''} has approved and allocated ₦${amount.toLocaleString()} from the Pooled Fund.\n\nAllocation Purpose: "${purpose}"\nRemaining Shared Pool Balance: ₦${newBalance.toLocaleString()}\n\nThis transaction has been logged permanently in the family audit ledger.`;
    const familyUsers = db.getUsers(parentUser.family_id);

    return db.addNotification({
      family_id: parentUser.family_id || 1,
      user_id: parentUser.user_id,
      type: 'Pool Allocation',
      message: `${parentUser.first_name} allocated ₦${amount.toLocaleString()} for "${purpose}". Remaining Balance: ₦${newBalance.toLocaleString()}`,
      emailSubject: subject,
      emailBody: body,
      smtpServer: 'smtp.gmail.com:587',
      recipients: familyUsers.map(u => u.email).join(', ')
    });
  }

  /**
   * Dispatch automated welcome email when a new family account or member registers
   */
  static sendWelcomeEmail(user, family) {
    const subject = `🎉 Welcome to NaijaFamily Pooled Bank - ${family.family_name}!`;
    const body = `Dear ${user.first_name} ${user.last_name || ''},\n\n` +
      `Welcome to NaijaFamily Pooled Bank & Household Financial Planner!\n\n` +
      `NaijaFamily Pooled Bank officially recognizes your registered email address (${user.email}) for "${family.family_name}".\n\n` +
      `📋 Account Summary:\n` +
      `- Household Name: ${family.family_name} (ID #${family.family_id})\n` +
      `- Member Name: ${user.first_name} ${user.last_name || ''}\n` +
      `- Member Role: ${user.title || user.role}\n` +
      `- Registered Email: ${user.email}\n\n` +
      `🚀 What you can do with your Pooled Bank account:\n` +
      `1. Set and monitor monthly budget caps with automated email warning alerts.\n` +
      `2. Contribute and allocate funds in your family's Ajo / Esusu shared vault.\n` +
      `3. Track comprehensive financial reports and spending breakdown analytics.\n\n` +
      `Thank you for securing your household's financial future with us!\n\n` +
      `Warm regards,\n` +
      `NaijaFamily Pooled Bank Automated SMTP Engine`;

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 2rem; border-radius: 16px;">
        <div style="background-color: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #334155;">
          <h2 style="color: #10b981; margin-top: 0;">🎉 Welcome to NaijaFamily Pooled Bank!</h2>
          <p style="font-size: 1rem; color: #cbd5e1;">Dear <strong>${user.first_name} ${user.last_name || ''}</strong>,</p>
          <p style="color: #94a3b8; line-height: 1.6;">NaijaFamily Pooled Bank officially recognizes your registered email address (<strong>${user.email}</strong>) for <strong>"${family.family_name}"</strong>.</p>
          
          <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 1rem; margin: 1.5rem 0; border-radius: 6px;">
            <h4 style="margin: 0 0 0.5rem 0; color: #34d399;">📋 Registered Account Details</h4>
            <ul style="margin: 0; padding-left: 1.2rem; color: #cbd5e1;">
              <li><strong>Household Name:</strong> ${family.family_name} (ID #${family.family_id})</li>
              <li><strong>Member Name:</strong> ${user.first_name} ${user.last_name || ''}</li>
              <li><strong>Role:</strong> ${user.title || user.role}</li>
              <li><strong>Registered Email:</strong> ${user.email}</li>
            </ul>
          </div>

          <h4 style="color: #f8fafc; margin-bottom: 0.5rem;">🚀 What you can do next:</h4>
          <ol style="color: #94a3b8; line-height: 1.6; padding-left: 1.2rem;">
            <li>Set monthly spending caps per expense category.</li>
            <li>Contribute or request allocations from the shared Ajo / Esusu vault.</li>
            <li>Receive real-time automated SMTP alerts when budgets reach 80% or 100%.</li>
          </ol>

          <hr style="border: none; border-top: 1px solid #334155; margin: 2rem 0;" />
          <p style="font-size: 0.8rem; color: #64748b; margin: 0;">NaijaFamily Pooled Bank & Household Financial Planner • Automated System Dispatch</p>
        </div>
      </div>
    `;

    return db.addNotification({
      user_id: user.user_id,
      family_id: family.family_id,
      type: 'WELCOME_EMAIL',
      message: `Welcome email sent to ${user.email} for family "${family.family_name}"`,
      emailSubject: subject,
      emailBody: body,
      emailHtml: htmlBody,
      smtpServer: 'smtp.gmail.com:587 (TLS Authenticated)',
      recipients: user.email
    });
  }
}
