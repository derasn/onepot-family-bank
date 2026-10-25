const { query } = require('../config/db');
const { exchangeAuthCode, getAccountDetails } = require('../services/monoService');
const { maskAccountNumber } = require('../utils/helpers');

/**
 * Link an open banking account via Mono Sandbox
 */
async function linkAccount(req, res, next) {
  try {
    const familyId = req.user.family_id;
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Mono authorization code is required.' });
    }

    const authResult = await exchangeAuthCode(code);
    const accountDetails = await getAccountDetails(authResult.accountId);

    const maskedAcc = maskAccountNumber(accountDetails.accountNumber);

    // Save or update linked mono account
    await query(
      `INSERT INTO mono_accounts (family_id, user_id, mono_account_id, institution_name, account_name, account_number_masked, account_type, balance, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         balance = VALUES(balance),
         account_name = VALUES(account_name),
         institution_name = VALUES(institution_name)`,
      [
        familyId,
        userId,
        accountDetails.id,
        accountDetails.institution.name,
        accountDetails.name,
        maskedAcc,
        accountDetails.type,
        accountDetails.balance,
        accountDetails.currency
      ]
    );

    // Update family member profile with bank info
    await query(
      `UPDATE family_members
       SET bank_name = ?, account_number_masked = ?, mono_account_id = ?
       WHERE family_id = ? AND user_id = ?`,
      [accountDetails.institution.name, maskedAcc, accountDetails.id, familyId, userId]
    );

    return res.json({
      success: true,
      message: 'Bank account securely linked and verified via Mono Sandbox.',
      account: {
        id: accountDetails.id,
        institution: accountDetails.institution.name,
        account_name: accountDetails.name,
        account_number_masked: maskedAcc,
        type: accountDetails.type,
        balance: accountDetails.balance,
        currency: accountDetails.currency
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List linked bank accounts for the family
 */
async function getLinkedAccounts(req, res, next) {
  try {
    const familyId = req.user.family_id;

    const accounts = await query(
      `SELECT ma.*, u.name AS member_name, fm.relationship
       FROM mono_accounts ma
       JOIN users u ON u.id = ma.user_id
       LEFT JOIN family_members fm ON fm.family_id = ma.family_id AND fm.user_id = u.id
       WHERE ma.family_id = ?`,
      [familyId]
    );

    return res.json({
      success: true,
      accounts: accounts.map((a) => ({
        id: a.id,
        mono_account_id: a.mono_account_id,
        institution_name: a.institution_name,
        account_name: a.account_name,
        account_number_masked: a.account_number_masked,
        account_type: a.account_type,
        balance: Number(a.balance),
        currency: a.currency,
        member_name: a.member_name,
        relationship: a.relationship,
        created_at: a.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  linkAccount,
  getLinkedAccounts
};

