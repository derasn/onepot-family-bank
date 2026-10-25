import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Landmark, 
  CreditCard,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  RotateCcw
} from 'lucide-react';
import { api } from '../services/api';
import { db } from '../services/db';
import PooledFundCard from './PooledFundCard';
import ExpenseFormModal from './ExpenseFormModal';
import IncomeFormModal from './IncomeFormModal';

export default function Dashboard({ currentUser, currentFamily, onDataChange }) {
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);

  // Filter & Search states for the comprehensive Household Transaction History
  const [activeTypeFilter, setActiveTypeFilter] = useState('all'); // 'all' | 'expense' | 'income' | 'pool'
  const [searchQuery, setSearchQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const familyId = currentUser?.family_id || currentFamily?.family_id || 1;
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pooledFund, setPooledFund] = useState({ balance: 0, emergency_balance: 0 });
  const [poolTransactions, setPoolTransactions] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const loadDashboardData = useCallback(async () => {
    try {
      const [expList, contribList, bowlsList, membersList, famDetails] = await Promise.all([
        api.expenses.getExpenses().catch(() => []),
        api.contributions.getContributions().catch(() => []),
        api.bowls.getBowls().catch(() => []),
        api.family.getFamilyMembers().catch(() => []),
        api.family.getFamilyDetails().catch(() => null)
      ]);

      if (Array.isArray(expList) && expList.length > 0) {
        setExpenses(expList.map(e => ({
          expense_id: e.id,
          id: e.id,
          amount: Number(e.amount),
          title: e.title,
          description: e.description,
          category_id: e.bowl?.id || e.bowl_id,
          user_id: e.requester?.id || e.user_id,
          date_spent: e.created_at ? e.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          status: e.status,
          payment_method: e.is_emergency_borrow ? 'Emergency Fund' : (e.bowl?.name || 'Bowl Allocation')
        })));
      } else {
        const local = db.getExpenses ? db.getExpenses(familyId) : [];
        setExpenses(local);
      }

      if (Array.isArray(contribList) && contribList.length > 0) {
        setPoolTransactions(contribList.map(c => ({
          transaction_id: c.id,
          id: c.id,
          user_id: c.user_id,
          type: 'contribution',
          amount: Number(c.amount),
          purpose: c.note || 'Family pot contribution',
          date: c.created_at ? c.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
        })));
      } else {
        const local = db.getPoolTransactions ? db.getPoolTransactions(familyId) : [];
        setPoolTransactions(local);
      }

      if (Array.isArray(bowlsList) && bowlsList.length > 0) {
        setCategories(bowlsList.map(b => ({
          category_id: b.id,
          id: b.id,
          category_name: b.name,
          name: b.name,
          icon: b.icon || '🍲',
          target: Number(b.target_budget),
          allocated: Number(b.allocated_amount),
          spent: Number(b.spent_amount)
        })));
      } else {
        const local = db.getCategories ? db.getCategories() : [];
        setCategories(local);
      }

      if (Array.isArray(membersList) && membersList.length > 0) {
        setUsers(membersList.map(m => ({
          user_id: m.user_id || m.id,
          id: m.user_id || m.id,
          name: m.name,
          first_name: (m.name || '').split(' ')[0],
          last_name: (m.name || '').split(' ').slice(1).join(' '),
          role: (m.role === 'admin' || m.role === 'parent') ? 'parent' : 'child',
          avatar: m.avatar_url || (m.role === 'admin' ? '👑' : '🧑‍🎓')
        })));
      } else {
        const local = db.getUsers ? db.getUsers(familyId) : [];
        setUsers(local);
      }

      if (famDetails) {
        setPooledFund({
          pool_id: famDetails.id || 1,
          balance: Number(famDetails.pot_balance) || 0,
          emergency_balance: Number(famDetails.emergency_balance) || 0,
          total_saved: Number(famDetails.total_saved) || 0,
          last_updated: new Date().toISOString()
        });
      } else {
        const local = db.getPooledFund ? db.getPooledFund(familyId) : { balance: 0 };
        setPooledFund(local);
      }
    } catch (err) {
      console.warn('Dashboard fetch fallback:', err.message);
    }
  }, [familyId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleLocalDataChange = () => {
    loadDashboardData();
    if (onDataChange) onDataChange();
  };

  // Financial calculations
  const totalIncome = incomes.reduce((sum, inc) => sum + Number(inc.amount), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const netSurplus = totalIncome - totalExpenses;

  // Build Unified Household Transaction History
  const allHouseholdTransactions = [
    ...expenses.map(e => ({
      id: `exp-${e.expense_id}`,
      rawId: e.expense_id,
      type: 'expense',
      title: e.description || e.title || 'General Household Expense',
      amount: Number(e.amount),
      date: e.date_spent,
      user_id: e.user_id,
      category_id: e.category_id,
      payment_method: e.payment_method || 'Bank Transfer',
      notes: e.notes || ''
    })),
    ...incomes.map(i => ({
      id: `inc-${i.income_id}`,
      rawId: i.income_id,
      type: 'income',
      title: i.title || i.source || 'Earned Income',
      amount: Number(i.amount),
      date: i.date_received,
      user_id: i.user_id,
      category_id: null,
      payment_method: i.source || 'Direct Bank Deposit',
      notes: i.notes || ''
    })),
    ...poolTransactions.map(p => ({
      id: `pool-${p.transaction_id}`,
      rawId: p.transaction_id,
      type: p.type === 'contribution' ? 'pool_deposit' : 'pool_allocation',
      title: p.purpose || (p.type === 'contribution' ? 'Ajo Pool Contribution' : 'Ajo Pool Allocation'),
      amount: Number(p.amount),
      date: p.date || p.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      user_id: p.user_id,
      category_id: null,
      payment_method: 'Shared Pooled Vault (Ajo)',
      notes: p.purpose || ''
    }))
  ];

  // Filtered & Sorted Transactions
  const filteredTransactions = allHouseholdTransactions
    .filter(tx => {
      // Type filter
      if (activeTypeFilter === 'expense' && tx.type !== 'expense') return false;
      if (activeTypeFilter === 'income' && tx.type !== 'income') return false;
      if (activeTypeFilter === 'pool' && tx.type !== 'pool_deposit' && tx.type !== 'pool_allocation') return false;

      // Member filter
      if (memberFilter !== 'all' && tx.user_id !== Number(memberFilter)) return false;

      // Category filter (only applicable to expenses)
      if (categoryFilter !== 'all') {
        if (tx.type !== 'expense' || tx.category_id !== Number(categoryFilter)) return false;
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const member = users.find(u => u.user_id === tx.user_id);
        const memberName = `${member?.first_name || ''} ${member?.last_name || ''}`.toLowerCase();
        const category = categories.find(c => c.category_id === tx.category_id);
        const categoryName = category?.category_name.toLowerCase() || '';

        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchNotes = (tx.notes || '').toLowerCase().includes(q);
        const matchMethod = (tx.payment_method || '').toLowerCase().includes(q);

        if (!matchTitle && !matchNotes && !matchMethod && !memberName.includes(q) && !categoryName.includes(q)) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'oldest') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'highest') return b.amount - a.amount;
      if (sortBy === 'lowest') return a.amount - b.amount;
      return 0;
    });

  // Aggregated totals for the filtered results
  const filteredExpenseTotal = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const filteredIncomeTotal = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

  const resetFilters = () => {
    setActiveTypeFilter('all');
    setSearchQuery('');
    setMemberFilter('all');
    setCategoryFilter('all');
    setSortBy('newest');
  };

  const hasActiveFilters = activeTypeFilter !== 'all' || searchQuery !== '' || memberFilter !== 'all' || categoryFilter !== 'all' || sortBy !== 'newest';

  return (
    <div>
      {/* Central Pooled Fund Component */}
      <PooledFundCard 
        currentUser={currentUser}
        poolData={pooledFund}
        transactions={poolTransactions}
        onDataChange={handleLocalDataChange}
      />

      {/* Quick Actions & High-level Financial Widgets */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Household Cashflow Overview</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setShowIncomeModal(true)} 
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            <TrendingUp size={16} color="#10b981" /> + Log Income
          </button>
          <button 
            onClick={() => setShowExpenseModal(true)} 
            className="btn btn-primary"
            style={{ fontSize: '0.85rem' }}
          >
            <CreditCard size={16} /> + Log Expense
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid-4" style={{ marginBottom: '1.75rem' }}>
        {/* Total Income Card */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            <span>TOTAL FAMILY INCOME</span>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '0.35rem', borderRadius: '8px' }}>
              <TrendingUp size={18} color="#10b981" />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
            ₦{totalIncome.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Across all {users.length} household earner{users.length === 1 ? '' : 's'}</span>
        </div>

        {/* Total Expenses Card */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            <span>TOTAL FAMILY EXPENSES</span>
            <div style={{ background: 'rgba(244, 63, 94, 0.15)', padding: '0.35rem', borderRadius: '8px' }}>
              <TrendingDown size={18} color="#f43f5e" />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
            ₦{totalExpenses.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{expenses.length} transaction{expenses.length === 1 ? '' : 's'} recorded</span>
        </div>

        {/* Net Surplus / Deficit */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            <span>NET HOUSEHOLD SURPLUS</span>
            <div style={{ background: netSurplus >= 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(244, 63, 94, 0.15)', padding: '0.35rem', borderRadius: '8px' }}>
              <Wallet size={18} color={netSurplus >= 0 ? '#3b82f6' : '#f43f5e'} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: netSurplus >= 0 ? '#38bdf8' : '#f87171' }}>
            ₦{netSurplus.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Income minus Expenses</span>
        </div>

        {/* Pooled Bank Fund */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            <span>SHARED POOLED BANK</span>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '0.35rem', borderRadius: '8px' }}>
              <Landmark size={18} color="#f59e0b" />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#f59e0b' }}>
            ₦{pooledFund.balance.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>100% transparent Ajo account</span>
        </div>
      </div>

      {/* COMPREHENSIVE HOUSEHOLD TRANSACTION HISTORY (Takes over the remaining executive dashboard) */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        {/* Section Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '0.5rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Receipt size={22} color="#10b981" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Household Transaction History & Ledger</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                  Unified, multi-user audit log of all expenditures, earned revenues, and shared pooled fund allocations.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Transaction Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button 
              onClick={() => setShowIncomeModal(true)} 
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
            >
              <TrendingUp size={14} color="#10b981" /> + Income
            </button>
            <button 
              onClick={() => setShowExpenseModal(true)} 
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
            >
              <CreditCard size={14} /> + Expense
            </button>
          </div>
        </div>

        {/* Metric Bar for Active Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: 'var(--bg-primary)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
          <div>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Transactions Shown
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
              {filteredTransactions.length} of {allHouseholdTransactions.length}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Filtered Outflows
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f43f5e' }}>
              -₦{filteredExpenseTotal.toLocaleString()}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Filtered Inflows
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
              +₦{filteredIncomeTotal.toLocaleString()}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Net Period Flow
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (filteredIncomeTotal - filteredExpenseTotal) >= 0 ? '#38bdf8' : '#f87171' }}>
              ₦{(filteredIncomeTotal - filteredExpenseTotal).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
          {/* Top Row: Type Pills & Search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            {/* Type Selector Pills */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `All Activities (${allHouseholdTransactions.length})` },
                { id: 'expense', label: `Expenses (${expenses.length})` },
                { id: 'income', label: `Incomes (${incomes.length})` },
                { id: 'pool', label: `Ajo Pooled Vault (${poolTransactions.length})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTypeFilter(tab.id)}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.8rem',
                    background: activeTypeFilter === tab.id ? 'var(--primary)' : 'var(--bg-primary)',
                    color: activeTypeFilter === tab.id ? '#ffffff' : 'var(--text-muted)',
                    borderColor: activeTypeFilter === tab.id ? 'var(--primary)' : 'var(--border-color)',
                    fontWeight: activeTypeFilter === tab.id ? 700 : 500
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Keyword Search Input */}
            <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 240px' }}>
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text"
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transactions, notes, members, categories..."
                style={{ paddingLeft: '2.4rem', fontSize: '0.825rem' }}
              />
            </div>
          </div>

          {/* Bottom Row: Dropdown Filters & Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Member Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Member:</span>
              <select
                className="form-select"
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', width: 'auto' }}
              >
                <option value="all">All Family Members</option>
                {users.map(u => (
                  <option key={u.user_id} value={u.user_id}>{u.avatar} {u.first_name} {u.last_name}</option>
                ))}
              </select>
            </div>

            {/* Category Dropdown (Expenses) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Category:</span>
              <select
                className="form-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', width: 'auto' }}
              >
                <option value="all">All Categories</option>
                {categories.map(c => (
                  <option key={c.category_id} value={c.category_id}>{c.icon} {c.category_name}</option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sort:</span>
              <select
                className="form-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', width: 'auto' }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest">Highest Amount</option>
                <option value="lowest">Lowest Amount</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}
              >
                <RotateCcw size={13} /> Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Transaction Details</th>
                <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                <th style={{ padding: '0.75rem 1rem' }}>Member User</th>
                <th style={{ padding: '0.75rem 1rem' }}>Method / Channel</th>
                <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount (₦)</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map(tx => {
                  const member = users.find(u => u.user_id === tx.user_id);
                  const category = categories.find(c => c.category_id === tx.category_id);

                  const isExpense = tx.type === 'expense';
                  const isIncome = tx.type === 'income';
                  const isPoolDeposit = tx.type === 'pool_deposit';
                  const isPoolAlloc = tx.type === 'pool_allocation';

                  return (
                    <tr 
                      key={tx.id} 
                      style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* Description & Category */}
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '1.4rem' }}>
                            {category?.icon || (isIncome ? '💰' : '🏦')}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                              {tx.title}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {category?.category_name || (isIncome ? 'Earned Revenue' : 'Shared Pooled Bank')}
                              {tx.notes && ` • "${tx.notes}"`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {tx.date}
                      </td>

                      {/* Logged By */}
                      <td style={{ padding: '0.9rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.1rem' }}>{member?.avatar || '👤'}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                              {member?.first_name} {member?.last_name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: member?.role === 'parent' ? '#10b981' : '#60a5fa' }}>
                              {member?.role === 'parent' ? 'Parent' : 'Child'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Payment Method / Channel */}
                      <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {tx.payment_method}
                      </td>

                      {/* Transaction Type Badge */}
                      <td style={{ padding: '0.9rem 1rem', whiteSpace: 'nowrap' }}>
                        {isExpense && (
                          <span className="badge badge-danger">
                            <TrendingDown size={12} /> Expense
                          </span>
                        )}
                        {isIncome && (
                          <span className="badge badge-parent">
                            <TrendingUp size={12} /> Inflow
                          </span>
                        )}
                        {isPoolDeposit && (
                          <span className="badge badge-warning">
                            <ArrowUpRight size={12} /> Pool Deposit
                          </span>
                        )}
                        {isPoolAlloc && (
                          <span className="badge badge-warning">
                            <ArrowDownLeft size={12} /> Pool Allocation
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td style={{ 
                        padding: '0.9rem 1rem', 
                        textAlign: 'right', 
                        fontWeight: 700, 
                        fontSize: '0.95rem',
                        color: isExpense ? '#f43f5e' : isIncome ? '#10b981' : '#f59e0b',
                        whiteSpace: 'nowrap'
                      }}>
                        {isExpense && `-₦${tx.amount.toLocaleString()}`}
                        {isIncome && `+₦${tx.amount.toLocaleString()}`}
                        {isPoolDeposit && `+₦${tx.amount.toLocaleString()}`}
                        {isPoolAlloc && `-₦${tx.amount.toLocaleString()}`}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <Filter size={32} color="var(--text-subtle)" />
                      <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>No transactions match your filter criteria</div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', margin: 0 }}>
                        Try clearing search terms or resetting filters to view all household financial records.
                      </p>
                      <button onClick={resetFilters} className="btn btn-secondary" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                        Reset Filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Modal */}
      <ExpenseFormModal 
        currentUser={currentUser}
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onExpenseAdded={handleLocalDataChange}
      />

      {/* Income Modal */}
      <IncomeFormModal 
        currentUser={currentUser}
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
        onIncomeAdded={handleLocalDataChange}
      />
    </div>
  );
}
