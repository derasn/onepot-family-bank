import React, { useState, useEffect } from 'react';
import { CreditCard, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
import { api } from '../services/api';
import { db } from '../services/db';
import { SMTPNotificationService } from '../services/smtpService';

export default function ExpenseFormModal({ currentUser, isOpen, onClose, onExpenseAdded }) {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('1');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [dateSpent, setDateSpent] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [budgetAlert, setBudgetAlert] = useState(null);
  const [pendingNotice, setPendingNotice] = useState(null);

  const isParent = currentUser?.role === 'parent' || currentUser?.role === 'admin';

  useEffect(() => {
    let isMounted = true;
    async function loadBowls() {
      try {
        const bowls = await api.bowls.getBowls();
        if (isMounted && Array.isArray(bowls) && bowls.length > 0) {
          const mapped = bowls.map(b => ({
            category_id: b.id,
            category_name: b.name,
            icon: b.icon || '🍲',
            remaining: b.remaining_amount
          }));
          setCategories(mapped);
          setCategoryId(String(mapped[0].category_id));
        }
      } catch {
        const local = db.getCategories ? db.getCategories() : [];
        if (isMounted) {
          setCategories(local);
          if (local.length > 0) setCategoryId(String(local[0].category_id));
        }
      }
    }
    if (isOpen) {
      loadBowls();
    }
    return () => { isMounted = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setBudgetAlert(null);
    setPendingNotice(null);

    const numAmount = parseFloat(amount);
    if (!amount || numAmount <= 0) {
      setErrorMsg('Please enter a valid expense amount in Naira (₦).');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create expense via API
      const result = await api.expenses.createExpense({
        bowl_id: Number(categoryId),
        amount: numAmount,
        title: description || 'General Household Expense',
        description: `${description || 'Expense'} (via ${paymentMethod})`
      });

      if (onExpenseAdded) onExpenseAdded();

      if (result.status === 'pending') {
        // Member request
        setPendingNotice(result.message || 'Spending request submitted for parental approval.');
      } else {
        // Admin auto-approved
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error recording expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard color="#f43f5e" /> {isParent ? 'Log Household Expense (Direct Debit)' : 'Request Spending from Bowl'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        {pendingNotice ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '1.5rem' }}>
            <Clock size={48} color="#f59e0b" style={{ margin: '0 auto 0.75rem auto' }} />
            <h4 style={{ color: '#fbbf24', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Request Submitted for Approval</h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              {pendingNotice}
            </p>
            <button onClick={() => { setPendingNotice(null); onClose(); }} className="btn btn-primary" style={{ width: '100%' }}>
              Acknowledge & Done
            </button>
          </div>
        ) : budgetAlert ? (
          <div className="modal-body">
            <div style={{
              background: budgetAlert.severity === 'critical' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              border: `1px solid ${budgetAlert.severity === 'critical' ? '#f43f5e' : '#f59e0b'}`,
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              textAlign: 'center'
            }}>
              <AlertTriangle size={48} color={budgetAlert.severity === 'critical' ? '#f43f5e' : '#f59e0b'} style={{ margin: '0 auto 0.75rem auto' }} />
              <h4 style={{ color: budgetAlert.severity === 'critical' ? '#f87171' : '#fbbf24', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                {budgetAlert.severity === 'critical' ? 'BUDGET LIMIT EXCEEDED!' : 'BUDGET LIMIT WARNING (80%+)'}
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: '1rem', lineHeight: 1.5 }}>
                {budgetAlert.subject}
              </p>
              <button 
                onClick={() => { setBudgetAlert(null); onClose(); }} 
                className="btn btn-primary" 
                style={{ width: '100%' }}
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {errorMsg && (
                <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f87171', padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <div style={{ padding: '0.65rem 0.85rem', background: isParent ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.8rem', color: isParent ? '#60a5fa' : '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isParent ? <ShieldCheck size={16} /> : <Clock size={16} />}
                <span>
                  {isParent 
                    ? `Admin Mode: Instant debit from bowl & pot balance.`
                    : `Child Contributor: Requests are submitted as pending for parent approval.`}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Select Budget Bowl</label>
                <select 
                  className="form-select" 
                  value={categoryId} 
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.icon} {cat.category_name} {cat.remaining !== undefined ? `(₦${cat.remaining.toLocaleString()} left)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount (₦)</label>
                <input 
                  type="number" 
                  step="100" 
                  placeholder="e.g. 25000" 
                  className="form-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="grid-2" style={{ gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select 
                    className="form-select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Bank Transfer">Bank Transfer (NIP/App)</option>
                    <option value="POS">POS Terminal</option>
                    <option value="Cash">Cash (Wallet/ATM)</option>
                    <option value="Card">Debit Card</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Date Spent</label>
                  <input 
                    type="date" 
                    className="form-input"
                    value={dateSpent}
                    onChange={(e) => setDateSpent(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Description / Purpose</label>
                <input 
                  type="text" 
                  placeholder="e.g. NNPC Fuel / Market Groceries / School Books" 
                  className="form-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : (isParent ? 'Log & Debit Expense' : 'Submit Spending Request')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
