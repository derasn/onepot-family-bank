const crypto = require('crypto');

/**
 * Mask account number for financial privacy (e.g. 0123456789 -> ****6789)
 */
function maskAccountNumber(accountNumber) {
  if (!accountNumber) return null;
  const cleaned = String(accountNumber).trim();
  if (cleaned.startsWith('****')) return cleaned;
  if (cleaned.length <= 4) return '****' + cleaned;
  return '****' + cleaned.slice(-4);
}

/**
 * Generate unique uppercase family invite code
 */
function generateInviteCode(familyPrefix = 'POT') {
  const cleanPrefix = familyPrefix
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'ONEPOT';
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${cleanPrefix}-${randomSuffix}`;
}

/**
 * Generate unique transaction reference
 */
function generateReference(prefix = 'TX') {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Format currency in Nigerian Naira (NGN)
 */
function formatNaira(amount) {
  const num = Number(amount) || 0;
  return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Calculate Zero-Based Budgeting allocation check
 * Total Pot Balance - Total Allocated = 0
 */
function validateZeroBasedAllocation(totalPot, allocations) {
  const totalAllocated = allocations.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const remaining = Number(totalPot) - totalAllocated;
  return {
    isValid: Math.abs(remaining) < 0.01,
    totalPot: Number(totalPot),
    totalAllocated,
    remaining: Math.round(remaining * 100) / 100
  };
}

module.exports = {
  maskAccountNumber,
  generateInviteCode,
  generateReference,
  formatNaira,
  validateZeroBasedAllocation
};

