import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import PooledFundCard from './components/PooledFundCard';
import BudgetManager from './components/BudgetManager';
import PoolTransactionsLog from './components/PoolTransactionsLog';
import PeriodicReport from './components/PeriodicReport';
import NotificationDrawer from './components/NotificationDrawer';
import AuthModal from './components/AuthModal';
import { api } from './services/api';
import { db } from './services/db';

export default function App() {
  const initialSession = api.session.getCurrent() || (db.getCurrentSession ? db.getCurrentSession() : null);
  
  // App state
  const [currentUser, setCurrentUser] = useState(initialSession?.user || null);
  const [currentFamily, setCurrentFamily] = useState(initialSession?.family || null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [pooledFund, setPooledFund] = useState({ balance: 0, emergency_balance: 0 });
  const [poolTransactions, setPoolTransactions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Asynchronously fetch family data from Express REST API
  const refreshData = useCallback(async () => {
    if (!currentUser) return;
    try {
      // 1. Fetch family details (pot balance & emergency)
      const famDetails = await api.family.getFamilyDetails().catch(() => null);
      if (famDetails) {
        setPooledFund({
          pool_id: famDetails.id || famDetails.family_id || 1,
          family_id: famDetails.id || famDetails.family_id || 1,
          balance: Number(famDetails.pot_balance) || 0,
          emergency_balance: Number(famDetails.emergency_balance) || 0,
          total_saved: Number(famDetails.total_saved) || 0,
          currency: famDetails.currency || 'NGN',
          last_updated: new Date().toISOString()
        });
        setCurrentFamily(famDetails);
      }

      // 2. Fetch family members
      const members = await api.family.getFamilyMembers().catch(() => []);
      if (Array.isArray(members) && members.length > 0) {
        const mappedUsers = members.map(m => {
          const parts = (m.name || '').split(' ');
          return {
            user_id: m.user_id || m.id,
            id: m.user_id || m.id,
            family_id: currentUser.family_id,
            first_name: parts[0] || 'User',
            last_name: parts.slice(1).join(' ') || '',
            name: m.name,
            email: m.email,
            role: (m.role === 'admin' || m.role === 'parent') ? 'parent' : 'child',
            avatar: m.avatar_url || (m.role === 'admin' ? '👑' : '🧑‍🎓'),
            title: (m.role === 'admin' || m.role === 'parent') ? 'Parent (Family Admin)' : 'Child (Contributor)'
          };
        });
        setUsers(mappedUsers);
      }

      // 3. Fetch pool transactions / contributions
      const txs = await api.contributions.getContributions().catch(() => []);
      if (Array.isArray(txs)) {
        const mappedTxs = txs.map(c => ({
          transaction_id: c.id,
          id: c.id,
          family_id: currentUser.family_id,
          user_id: c.user_id,
          type: 'contribution',
          amount: Number(c.amount),
          pot_amount: Number(c.pot_amount),
          auto_save_amount: Number(c.auto_save_amount),
          purpose: c.note || 'Family pot contribution',
          date: c.created_at ? c.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          created_at: c.created_at
        }));
        setPoolTransactions(mappedTxs);
      }

      // 4. Fetch notifications
      const notifs = await api.notifications.getNotifications().catch(() => []);
      if (Array.isArray(notifs)) {
        setNotifications(notifs.map(n => ({
          notification_id: n.id,
          id: n.id,
          message: n.message || n.title,
          title: n.title,
          type: n.type || 'info',
          sent_at: n.created_at,
          read: Boolean(n.is_read)
        })));
      }
    } catch (err) {
      console.warn('Error refreshing family state from API:', err.message);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      refreshData();
    }
  }, [currentUser, refreshData]);

  const handleDataChange = () => {
    refreshData();
  };

  const handleLoginSuccess = (user, family) => {
    setCurrentUser(user);
    setCurrentFamily(family);
    api.session.setCurrent(user, family);
  };

  const handleLogout = () => {
    api.auth.logout();
    if (db.clearSession) db.clearSession();
    setCurrentUser(null);
    setCurrentFamily(null);
    setUsers([]);
    setPoolTransactions([]);
    setNotifications([]);
  };

  const handleResetData = () => {
    if (window.confirm('Wipe local session data and sign out?')) {
      handleLogout();
    }
  };

  // Authentication Guard Screen
  if (!currentUser) {
    return <AuthModal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Header with Navigation & Role Switcher */}
      <Header 
        currentUser={currentUser}
        currentFamily={currentFamily}
        users={users}
        onSwitchUser={(user) => {
          setCurrentUser(user);
          api.session.setCurrent(user, currentFamily);
        }}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        notifications={notifications}
        onToggleNotifications={() => setActiveTab('smtp')}
        onResetData={handleResetData}
      />

      {/* Main View Container */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard 
            currentUser={currentUser}
            currentFamily={currentFamily}
            onDataChange={handleDataChange}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'pool' && (
          <div>
            <PooledFundCard 
              currentUser={currentUser}
              poolData={pooledFund}
              transactions={poolTransactions}
              onDataChange={handleDataChange}
            />
            <PoolTransactionsLog transactions={poolTransactions} />
          </div>
        )}

        {activeTab === 'budgets' && (
          <BudgetManager 
            currentUser={currentUser}
            onDataChange={handleDataChange}
          />
        )}

        {activeTab === 'logs' && (
          <PoolTransactionsLog transactions={poolTransactions} />
        )}

        {activeTab === 'reports' && (
          <PeriodicReport 
            currentUser={currentUser}
            currentFamily={currentFamily}
          />
        )}

        {activeTab === 'smtp' && (
          <NotificationDrawer 
            notifications={notifications}
            onDataChange={handleDataChange}
          />
        )}
      </main>

      {/* App Footer */}
      <footer style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', padding: '1.25rem 0', marginTop: 'auto', textAlign: 'center', fontSize: '0.825rem', color: 'var(--text-subtle)' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '0 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            © 2026 <strong>OnePot Family Bank & Envelope Budgeting</strong> • One family, one pot = No stories
          </div>
          <div>
            Built with React, Express REST API, MySQL Database, Paystack Test Mode & Nodemailer
          </div>
        </div>
      </footer>
    </div>
  );
}
