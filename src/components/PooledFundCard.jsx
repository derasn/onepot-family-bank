import React, { useState } from 'react';
import { Landmark, ArrowUpRight, ArrowDownLeft, Shield, Lock, CheckCircle, CreditCard } from 'lucide-react';
import { api } from '../services/api';
import { db } from '../services/db';
import { SMTPNotificationService } from '../services/smtpService';
import DepositAccountModal from './DepositAccountModal';

export default function PooledFundCard({ currentUser, poolData, transactions, onDataChange }) {
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);

  // Form states
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributePurpose, setContributePurpose] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  
  const [allocateAmount, setAllocateAmount] = useState('');
  const [allocatePurpose, setAllocatePurpose] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const depositAccounts = db.getDepositAccounts(currentUser?.family_id);

  // Compute total contributions and allocations
  const totalContributed = transactions
    .filter(t => t.type === 'contribution')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalAllocated = transactions
    .filter(t => t.type === 'allocation')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const handleContributeSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!contributeAmount || Number(contributeAmount) <= 0) {
      setErrorMsg('Please enter a valid contribution amount in Naira (₦).');
      return;
    }

    try {
      const numAmount = Number(contributeAmount);
      const res = await api.contributions.contribute({
        amount: numAmount,
        note: contributePurpose || 'Monthly Pooled Contribution',
        payment_method: 'manual'
      });

      setSuccessMsg(res.message || `Successfully contributed ₦${numAmount.toLocaleString()} to the OnePot Family Bank!`);
      setContributeAmount('');
      setContributePurpose('');
      setShowContributeModal(false);
      if (onDataChange) onDataChange();

      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to process contribution');
    }
  };

  const handleAllocateSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Check RBAC permission (Parents only)
    if (currentUser.role !== 'parent' && currentUser.role !== 'admin') {
      setErrorMsg('Access Denied: Only Parent Managers (Father/Mother) are authorized to allocate pooled funds.');
      return;
    }

    if (!allocateAmount || Number(allocateAmount) <= 0) {
      setErrorMsg('Please enter a valid allocation amount in Naira (₦).');
      return;
    }

    try {
      const numAmount = Number(allocateAmount);
      // Run priority fill or allocation
      const res = await api.bowls.allocateFunds({
        mode: 'priority',
        allocations: []
      });

      setSuccessMsg(res.message || `Successfully allocated ₦${numAmount.toLocaleString()} from the Pooled Bank!`);
      setAllocateAmount('');
      setAllocatePurpose('');
      setShowAllocateModal(false);
      if (onDataChange) onDataChange();

      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to process allocation');
    }
  };

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      {/* Success Notification Alert Banner */}
      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', animation: 'fadeIn 0.2s' }}>
          <CheckCircle size={20} /> {successMsg}
        </div>
      )}

      {/* Primary Glassmorphism Pooled Bank Banner */}
      <div className="glass-panel" style={{ padding: '1.75rem', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative background glow */}
        <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '220px', height: '220px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          {/* Shared Balance Display */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.35rem' }}>
              <Landmark size={18} color="#10b981" /> Shared Family Pooled Bank Balance (Ajo Fund)
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span style={{ color: '#10b981', fontSize: '2rem' }}>₦</span>
              {poolData.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: '0.25rem' }}>
              Last activity recorded: {new Date(poolData.last_updated).toLocaleString('en-NG')}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            {/* Link Deposit Bank Account Button */}
            <button
              onClick={() => setShowBankModal(true)}
              className="btn btn-secondary"
              style={{ padding: '0.75rem 1.2rem', fontSize: '0.9rem' }}
            >
              <CreditCard size={18} color="#10b981" /> + Link Deposit Bank
            </button>

            {/* Contribute Button - Open to All Roles */}
            <button 
              onClick={() => { setErrorMsg(''); setShowContributeModal(true); }} 
              className="btn btn-primary"
              style={{ padding: '0.75rem 1.4rem', fontSize: '0.95rem' }}
            >
              <ArrowUpRight size={20} /> Contribute to Pool
            </button>

            {/* Allocate Button - Parent Permission Only */}
            <button 
              onClick={() => {
                setErrorMsg('');
                if (currentUser.role !== 'parent') {
                  alert('🔒 Restricted Action: Only Parent Managers (Father & Mother) can allocate money from the shared pooled bank fund.');
                  return;
                }
                setShowAllocateModal(true);
              }} 
              className="btn btn-accent"
              style={{ padding: '0.75rem 1.4rem', fontSize: '0.95rem', opacity: currentUser.role !== 'parent' ? 0.7 : 1 }}
              title={currentUser.role !== 'parent' ? 'Parent Authorization Required' : 'Allocate Pooled Funds'}
            >
              {currentUser.role !== 'parent' ? <Lock size={18} /> : <ArrowDownLeft size={20} />} 
              Allocate Pooled Funds {currentUser.role !== 'parent' && '(Parents Only)'}
            </button>
          </div>
        </div>

        {/* Breakdown Stats Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Pooled Deposits</span>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#10b981' }}>
              ₦{totalContributed.toLocaleString()}
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Parent Allocations</span>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f59e0b' }}>
              ₦{totalAllocated.toLocaleString()}
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Linked Deposit Accounts</span>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>
              {depositAccounts.length} Linked Banks
            </div>
          </div>
        </div>
      </div>

      {/* CONTRIBUTE MODAL */}
      {showContributeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowUpRight color="#10b981" /> Contribute to Shared Pooled Bank
              </h3>
              <button onClick={() => setShowContributeModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <form onSubmit={handleContributeSubmit}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f87171', padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                    ⚠️ {errorMsg}
                  </div>
                )}
                
                <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.825rem', color: '#10b981' }}>
                  Contributing User: <strong>{currentUser.first_name} {currentUser.last_name} ({currentUser.role.toUpperCase()})</strong>
                </div>

                {/* Funding Deposit Bank Account Selector */}
                <div className="form-group">
                  <label className="form-label">Funding Deposit Account</label>
                  {depositAccounts.length > 0 ? (
                    <select
                      className="form-select"
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                    >
                      {depositAccounts.map(a => (
                        <option key={a.account_id} value={a.account_id}>
                          🏦 {a.bank_name} - {a.account_number} ({a.account_name})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.65rem', borderRadius: '8px', fontSize: '0.78rem', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>No deposit bank linked yet.</span>
                      <button type="button" onClick={() => { setShowContributeModal(false); setShowBankModal(true); }} style={{ background: '#f59e0b', color: '#0f172a', border: 'none', padding: '0.25rem 0.65rem', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}>
                        + Link Bank Now
                      </button>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Contribution Amount in Naira (₦)</label>
                  <input 
                    type="number" 
                    step="500"
                    placeholder="e.g. 50000"
                    className="form-input" 
                    value={contributeAmount}
                    onChange={(e) => setContributeAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Source / Note Purpose</label>
                  <input 
                    type="text" 
                    placeholder="e.g. September Salary Allocation / Business Income Share"
                    className="form-input" 
                    value={contributePurpose}
                    onChange={(e) => setContributePurpose(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowContributeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm & Deposit ₦</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALLOCATE MODAL (PARENTS ONLY) */}
      {showAllocateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowDownLeft color="#f59e0b" /> Allocate Pooled Funds (Parent Manager)
              </h3>
              <button onClick={() => setShowAllocateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <form onSubmit={handleAllocateSubmit}>
              <div className="modal-body">
                {errorMsg && (
                  <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f87171', padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.12)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.825rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={16} /> Approving Parent: <strong>{currentUser.first_name} {currentUser.last_name}</strong>
                </div>

                <div className="form-group">
                  <label className="form-label">Available Shared Pool Balance</label>
                  <input type="text" className="form-input" value={`₦${poolData.balance.toLocaleString()}`} disabled style={{ opacity: 0.7 }} />
                </div>

                <div className="form-group">
                  <label className="form-label">Allocation Amount (₦)</label>
                  <input 
                    type="number" 
                    step="500"
                    placeholder="e.g. 80000"
                    className="form-input" 
                    value={allocateAmount}
                    onChange={(e) => setAllocateAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Household Purpose / Destination Expense</label>
                  <input 
                    type="text" 
                    placeholder="e.g. House Rent Advance / Children School Fees / PHCN Power"
                    className="form-input" 
                    value={allocatePurpose}
                    onChange={(e) => setAllocatePurpose(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAllocateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-accent">Approve Allocation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LINK DEPOSIT BANK ACCOUNT MODAL */}
      <DepositAccountModal 
        currentUser={currentUser}
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        onAccountAdded={onDataChange}
      />
    </div>
  );
}
