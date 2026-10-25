import React from 'react';
import { History, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { db } from '../services/db';

export default function PoolTransactionsLog({ transactions }) {
  const users = db.getUsers();

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History color="#3b82f6" /> Pooled Bank Transparency Audit Ledger
        </h2>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
          Permanent, multi-user logged record of all incoming member pool contributions and parent-authorized allocations.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem 1rem' }}>TX ID</th>
                <th style={{ padding: '0.75rem 1rem' }}>Date & Time</th>
                <th style={{ padding: '0.75rem 1rem' }}>Member User</th>
                <th style={{ padding: '0.75rem 1rem' }}>Transaction Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Purpose / Note</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount (₦)</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                const member = users.find(u => u.user_id === tx.user_id);
                const isContribution = tx.type === 'contribution';

                return (
                  <tr key={tx.transaction_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: 'var(--text-subtle)' }}>
                      #TX-00{tx.transaction_id}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                      {new Date(tx.created_at || tx.date).toLocaleString('en-NG')}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                        <span>{member?.avatar || '👤'}</span> {member?.first_name} {member?.last_name}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className={`badge ${isContribution ? 'badge-parent' : 'badge-warning'}`}>
                        {isContribution ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                        {isContribution ? 'Member Deposit' : 'Parent Allocation'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-main)' }}>
                      {tx.purpose}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: isContribution ? '#10b981' : '#f59e0b' }}>
                      {isContribution ? '+' : '-'}₦{Number(tx.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
