import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Lock, ShieldCheck, CheckCircle, AlertTriangle, Layers, Zap } from 'lucide-react';
import { api } from '../services/api';
import { db } from '../services/db';

export default function BudgetManager({ currentUser, onDataChange }) {
  const [bowls, setBowls] = useState([]);
  const [unallocated, setUnallocated] = useState(null);
  const [editingBowlId, setEditingBowlId] = useState(null);
  const [newLimitAmount, setNewLimitAmount] = useState('');
  const [allocatingMode, setAllocatingMode] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const isParent = currentUser?.role === 'parent' || currentUser?.role === 'admin';

  const loadBowlsData = useCallback(async () => {
    try {
      setLoading(true);
      const [bowlsData, unallocData] = await Promise.all([
        api.bowls.getBowls().catch(() => []),
        api.bowls.getUnallocatedPot().catch(() => null)
      ]);

      if (Array.isArray(bowlsData) && bowlsData.length > 0) {
        setBowls(bowlsData);
      } else {
        // Fallback to local categories
        const localCats = db.getCategories ? db.getCategories() : [];
        setBowls(localCats.map(c => ({
          id: c.category_id,
          name: c.category_name,
          icon: c.icon,
          category: 'general',
          target_budget: 50000,
          allocated_amount: 50000,
          spent_amount: 15000,
          remaining_amount: 35000,
          percent_spent: 30,
          is_near_limit: false
        })));
      }

      if (unallocData) {
        setUnallocated(unallocData);
      }
    } catch (err) {
      console.warn('Failed to load bowls from API:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBowlsData();
  }, [loadBowlsData]);

  const handleSaveLimit = async (bowlId) => {
    if (!isParent) {
      alert('🔒 Access Restricted: Only Parent Managers can edit spending caps.');
      return;
    }

    if (!newLimitAmount || Number(newLimitAmount) < 0) {
      return;
    }

    try {
      setErrorMsg('');
      await api.bowls.updateBudgetLimit(bowlId, newLimitAmount);
      setEditingBowlId(null);
      setSuccessMsg('Bowl budget cap updated successfully!');
      await loadBowlsData();
      if (onDataChange) onDataChange();
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update spending cap.');
    }
  };

  const handleQuickAllocation = async (mode) => {
    if (!isParent) return;
    try {
      setAllocatingMode(mode);
      setErrorMsg('');
      const res = await api.bowls.allocateFunds({ mode, allocations: [] });
      setSuccessMsg(res.message || `Successfully allocated funds via ${mode} mode.`);
      await loadBowlsData();
      if (onDataChange) onDataChange();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || `Failed to run ${mode} allocation.`);
    } finally {
      setAllocatingMode(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart color="#10b981" /> Bowls Envelope Budgeting & Spending Caps
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            All family expenses must come from an approved bowl. In-app alerts trigger at 80% consumption.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isParent ? (
            <span className="badge badge-parent"><ShieldCheck size={14} /> Parent Admin Mode</span>
          ) : (
            <span className="badge badge-child"><Lock size={14} /> Child Read-Only Mode</span>
          )}
        </div>
      </div>

      {/* Zero-Based Pot Allocation Bar for Parents */}
      {isParent && unallocated && (
        <div className="glass-panel" style={{ padding: '1.15rem 1.35rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unallocated Family Pot</span>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>
                ₦{Number(unallocated.pot_balance || 0).toLocaleString()}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.2rem 0 0' }}>
                {unallocated.is_zero_based_balanced ? '✅ Zero-Based Balanced: Every naira in the pot has a designated job!' : 'Allocate remaining pot funds into bowls.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button 
                onClick={() => handleQuickAllocation('50-30-20')} 
                disabled={allocatingMode !== null}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
              >
                <Layers size={14} /> 50-30-20 Mode
              </button>
              <button 
                onClick={() => handleQuickAllocation('priority')} 
                disabled={allocatingMode !== null}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
              >
                <Zap size={14} /> Priority Fill
              </button>
            </div>
          </div>
        </div>
      )}

      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' }}>
          <CheckCircle size={20} /> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' }}>
          <AlertTriangle size={20} /> {errorMsg}
        </div>
      )}

      <div className="grid-2">
        {bowls.map(bowl => {
          const limitAmount = Number(bowl.target_budget || 0);
          const totalSpent = Number(bowl.spent_amount || 0);
          const allocated = Number(bowl.allocated_amount || 0);
          const percent = limitAmount > 0 ? Math.round((totalSpent / limitAmount) * 100) : (allocated > 0 ? Math.round((totalSpent / allocated) * 100) : 0);
          const isNearLimit = bowl.is_near_limit || percent >= 80;
          const isEditing = editingBowlId === bowl.id;

          return (
            <div key={bowl.id} className="glass-panel" style={{ padding: '1.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontSize: '1.6rem' }}>{bowl.icon || '🍲'}</span>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{bowl.name}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Allocated: ₦{allocated.toLocaleString()} • Remaining: ₦{Math.max(0, allocated - totalSpent).toLocaleString()}
                    </span>
                  </div>
                </div>

                {isParent && !isEditing && (
                  <button 
                    onClick={() => {
                      setEditingBowlId(bowl.id);
                      setNewLimitAmount(limitAmount);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                  >
                    Edit Cap
                  </button>
                )}
              </div>

              {isEditing ? (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <input 
                    type="number"
                    step="1000"
                    className="form-input"
                    value={newLimitAmount}
                    onChange={(e) => setNewLimitAmount(e.target.value)}
                    placeholder="Enter limit in ₦"
                    style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}
                  />
                  <button onClick={() => handleSaveLimit(bowl.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>Save</button>
                  <button onClick={() => setEditingBowlId(null)} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>Cancel</button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Spent to Date: </span>
                      <strong style={{ fontSize: '1rem', color: percent >= 100 ? '#f43f5e' : isNearLimit ? '#f59e0b' : '#10b981' }}>
                        ₦{totalSpent.toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target Cap: </span>
                      <strong style={{ fontSize: '1rem', color: '#ffffff' }}>
                        ₦{limitAmount.toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(percent, 100)}%`,
                      height: '100%',
                      background: percent >= 100 ? '#f43f5e' : isNearLimit ? '#f59e0b' : '#10b981',
                      borderRadius: '4px'
                    }} />
                  </div>

                  {isNearLimit && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <AlertTriangle size={13} /> Near 80% spending limit threshold.
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
