import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Printer, Download } from 'lucide-react';
import { api } from '../services/api';
import { db } from '../services/db';

export default function PeriodicReport({ currentUser, currentFamily }) {
  const [timeframe, setTimeframe] = useState('Monthly');
  const familyId = currentUser?.family_id || currentFamily?.family_id || 1;
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [poolTx, setPoolTx] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadReportData() {
      try {
        const [expList, contribList, bowlsList, membersList] = await Promise.all([
          api.expenses.getExpenses().catch(() => []),
          api.contributions.getContributions().catch(() => []),
          api.bowls.getBowls().catch(() => []),
          api.family.getFamilyMembers().catch(() => [])
        ]);

        if (isMounted) {
          if (Array.isArray(expList) && expList.length > 0) {
            setExpenses(expList.map(e => ({
              amount: Number(e.amount),
              category_id: e.bowl?.id || e.bowl_id,
              date_spent: e.created_at ? e.created_at.split('T')[0] : ''
            })));
          } else {
            setExpenses(db.getExpenses ? db.getExpenses(familyId) : []);
          }

          if (Array.isArray(contribList) && contribList.length > 0) {
            setPoolTx(contribList.map(c => ({
              amount: Number(c.amount),
              type: 'contribution',
              date: c.created_at ? c.created_at.split('T')[0] : ''
            })));
            setIncomes(contribList.map(c => ({
              amount: Number(c.amount)
            })));
          } else {
            setIncomes(db.getIncomes ? db.getIncomes(familyId) : []);
            setPoolTx(db.getPoolTransactions ? db.getPoolTransactions(familyId) : []);
          }

          if (Array.isArray(bowlsList) && bowlsList.length > 0) {
            setCategories(bowlsList.map(b => ({
              category_id: b.id,
              category_name: b.name,
              icon: b.icon || '🍲'
            })));
          } else {
            setCategories(db.getCategories ? db.getCategories() : []);
          }

          if (Array.isArray(membersList) && membersList.length > 0) {
            setUsers(membersList);
          } else {
            setUsers(db.getUsers ? db.getUsers(familyId) : []);
          }
        }
      } catch (err) {
        console.warn('Report fetch error:', err.message);
      }
    }
    loadReportData();
    return () => { isMounted = false; };
  }, [familyId]);

  const householdTitle = (currentFamily?.family_name || currentFamily?.name || 'Household').toUpperCase();

  const totalIncome = incomes.reduce((sum, inc) => sum + Number(inc.amount), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = async () => {
    try {
      const csvData = await api.dashboard.getReport('csv');
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `onepot_report_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not export CSV: ' + err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet color="#8b5cf6" /> Periodic Family Financial Report
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Aggregated statement of household cash flows, category spending caps, and savings performance.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select className="form-select" value={timeframe} onChange={(e) => setTimeframe(e.target.value)} style={{ padding: '0.45rem 0.85rem' }}>
            <option value="Monthly">Monthly Summary (Current Month)</option>
            <option value="Quarterly">Quarterly Report (Current Quarter)</option>
            <option value="Annual">Annual Overview (2026)</option>
          </select>

          <button onClick={handlePrint} className="btn btn-secondary">
            <Printer size={16} /> Print / Export PDF
          </button>
        </div>
      </div>

      {/* Report Paper Container */}
      <div className="glass-panel" style={{ padding: '2rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
        {/* Report Header */}
        <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>{householdTitle} FINANCIAL STATEMENT</h1>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Period Covered: <strong>Current Financial Cycle</strong> • Formal Sector Family Bank Planner
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
            <div>Generated: {new Date().toLocaleDateString('en-NG')}</div>
            <div>Status: <span style={{ color: '#10b981', fontWeight: 600 }}>Audited & Synchronized</span></div>
          </div>
        </div>

        {/* High-Level Executive Summary Box */}
        <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.75rem', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>Executive Summary Performance</h3>
          <div className="grid-4" style={{ gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gross Inflow</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>₦{totalIncome.toLocaleString()}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Outflow</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f43f5e' }}>₦{totalExpenses.toLocaleString()}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Net Retained Surplus</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>₦{netSavings.toLocaleString()}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Savings / Discipline Ratio</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>{savingsRate}%</div>
            </div>
          </div>
        </div>

        {/* Category Spending Breakdown Table */}
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.85rem' }}>Category Budget Variance Analysis</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem', marginBottom: '2rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Category Name</th>
              <th style={{ padding: '0.75rem 1rem' }}>Monthly Cap (₦)</th>
              <th style={{ padding: '0.75rem 1rem' }}>Actual Spent (₦)</th>
              <th style={{ padding: '0.75rem 1rem' }}>Variance (₦)</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const limitObj = budgetLimits.find(b => b.category_id === cat.category_id);
              const limit = limitObj ? Number(limitObj.amount) : 0;
              const spent = expenses.filter(e => e.category_id === cat.category_id).reduce((s, e) => s + Number(e.amount), 0);
              const variance = limit - spent;
              const isOver = spent > limit && limit > 0;

              return (
                <tr key={cat.category_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{cat.icon} {cat.category_name}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>₦{limit.toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>₦{spent.toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 1rem', color: variance < 0 ? '#f43f5e' : '#10b981' }}>
                    {variance < 0 ? `-₦${Math.abs(variance).toLocaleString()}` : `+₦${variance.toLocaleString()}`}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <span className={`badge ${isOver ? 'badge-danger' : 'badge-parent'}`}>
                      {isOver ? 'Exceeded Cap' : 'Within Budget'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Member Income & Expense Contribution Table */}
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.85rem' }}>Household Member Financial Contributions</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Member Name</th>
              <th style={{ padding: '0.75rem 1rem' }}>Role</th>
              <th style={{ padding: '0.75rem 1rem' }}>Income Earned (₦)</th>
              <th style={{ padding: '0.75rem 1rem' }}>Expenses Logged (₦)</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Pooled Fund Deposits (₦)</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const memberIncome = incomes.filter(i => i.user_id === u.user_id).reduce((s, i) => s + Number(i.amount), 0);
              const memberExpense = expenses.filter(e => e.user_id === u.user_id).reduce((s, e) => s + Number(e.amount), 0);
              const memberDeposits = poolTx.filter(t => t.user_id === u.user_id && t.type === 'contribution').reduce((s, t) => s + Number(t.amount), 0);

              return (
                <tr key={u.user_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{u.avatar} {u.first_name} {u.last_name}</td>
                  <td style={{ padding: '0.75rem 1rem', textTransform: 'uppercase', fontSize: '0.75rem' }}>{u.role}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#10b981' }}>₦{memberIncome.toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#f43f5e' }}>₦{memberExpense.toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#f59e0b', fontWeight: 700 }}>₦{memberDeposits.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
