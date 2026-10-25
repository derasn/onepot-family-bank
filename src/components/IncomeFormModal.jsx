import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { api } from '../services/api';
import { db } from '../services/db';

export default function IncomeFormModal({ currentUser, isOpen, onClose, onIncomeAdded }) {
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!amount || Number(amount) <= 0) {
      setErrorMsg('Please enter a valid income amount in Naira (₦).');
      return;
    }

    if (!source) {
      setErrorMsg('Please specify the income source (e.g., Monthly Salary, Side Hustle).');
      return;
    }

    try {
      // Record contribution into family pot via API
      await api.contributions.contribute({
        amount: parseFloat(amount),
        note: `Income: ${source}`
      }).catch(() => null);

      if (db.addIncome) {
        db.addIncome({
          user_id: currentUser.user_id,
          family_id: currentUser.family_id || 1,
          source: source,
          amount: parseFloat(amount),
          date_received: dateReceived
        });
      }

      onIncomeAdded();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Error recording income');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp color="#10b981" /> Record Income Entry
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && (
              <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f87171', padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.8rem', color: '#10b981' }}>
              Earner: <strong>{currentUser.first_name} {currentUser.last_name}</strong> ({currentUser.role.toUpperCase()})
            </div>

            <div className="form-group">
              <label className="form-label">Income Source / Title</label>
              <input 
                type="text" 
                placeholder="e.g. Civil Service Monthly Salary / Freelance / Business Sales" 
                className="form-input"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Amount Received (₦)</label>
              <input 
                type="number" 
                step="500" 
                placeholder="e.g. 150000" 
                className="form-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Date Received</label>
              <input 
                type="date" 
                className="form-input"
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Income Record</button>
          </div>
        </form>
      </div>
    </div>
  );
}
