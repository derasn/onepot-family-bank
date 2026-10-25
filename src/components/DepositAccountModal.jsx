import React, { useState } from 'react';
import { CreditCard, Landmark, X, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { db } from '../services/db';

export default function DepositAccountModal({ currentUser, isOpen, onClose, onAccountAdded }) {
  const [bankName, setBankName] = useState('Zenith Bank');
  const [customBank, setCustomBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('savings');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const nigerianBanks = [
    'Zenith Bank',
    'Guaranty Trust Bank (GTBank)',
    'Access Bank',
    'First Bank of Nigeria',
    'United Bank for Africa (UBA)',
    'Kuda Microfinance Bank',
    'OPay Digital Bank',
    'Moniepoint Microfinance Bank',
    'Fidelity Bank',
    'Stanbic IBTC Bank',
    'Sterling Bank',
    'Other Bank...'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalBank = bankName === 'Other Bank...' ? customBank : bankName;

    if (!finalBank || !accountNumber || !accountName) {
      setError('Bank Name, Account Number, and Account Name are required.');
      return;
    }

    if (accountNumber.length < 10) {
      setError('Please enter a valid 10-digit NUBAN Account Number.');
      return;
    }

    try {
      setError('');
      // Save via API (masks account number for financial privacy)
      await api.auth.updateProfile({
        bank_name: finalBank,
        account_number: accountNumber
      }).catch(() => null);

      if (db.addDepositAccount) {
        db.addDepositAccount({
          familyId: currentUser?.family_id || 1,
          userId: currentUser?.user_id || 1,
          bankName: finalBank,
          accountNumber,
          accountName,
          accountType
        });
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setAccountNumber('');
        setAccountName('');
        onAccountAdded();
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'Failed to save bank account.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Landmark size={20} color="#10b981" /> Link Deposit Bank Account
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', padding: '0.75rem', borderRadius: '8px', fontSize: '0.825rem', marginBottom: '1rem' }}>
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', padding: '0.75rem', borderRadius: '8px', fontSize: '0.825rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} /> Deposit Bank Account linked successfully!
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Select Bank Name</label>
            <select 
              value={bankName} 
              onChange={(e) => setBankName(e.target.value)}
              className="form-select"
            >
              {nigerianBanks.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {bankName === 'Other Bank...' && (
            <div className="form-group">
              <label className="form-label">Specify Bank Name</label>
              <input 
                type="text"
                placeholder="e.g. Wema Bank / Alat"
                value={customBank}
                onChange={(e) => setCustomBank(e.target.value)}
                className="form-input"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">NUBAN Account Number (10 Digits)</label>
            <input 
              type="text"
              placeholder="e.g. 0123456789"
              maxLength={10}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Account Name (Account Holder)</label>
            <input 
              type="text"
              placeholder="e.g. Babatunde Adeleke"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Account Type</label>
            <select 
              value={accountType} 
              onChange={(e) => setAccountType(e.target.value)}
              className="form-select"
            >
              <option value="savings">Savings Account</option>
              <option value="current">Current Account</option>
              <option value="domiciliary">Domiciliary Foreign Account</option>
            </select>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.75rem', color: '#34d399', marginBottom: '1.25rem' }}>
            ℹ️ This deposit account will be linked to your family's pooled vault for funding contributions.
          </div>

          <div className="modal-footer" style={{ padding: 0, background: 'transparent', borderTop: 'none' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <CreditCard size={16} /> Link Deposit Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
