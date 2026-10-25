import React, { useState } from 'react';
import { 
  Building2, 
  Bell, 
  ChevronDown, 
  LayoutDashboard, 
  Landmark, 
  PieChart, 
  FileSpreadsheet, 
  Mail, 
  History,
  RotateCcw,
  LogOut
} from 'lucide-react';

export default function Header({ 
  currentUser, 
  currentFamily,
  users, 
  onSwitchUser, 
  onLogout,
  activeTab, 
  setActiveTab, 
  notifications, 
  onToggleNotifications,
  onResetData
}) {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const familyName = currentFamily?.family_name || 'The Okafor Household';

  return (
    <header className="header-wrapper" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
      {/* Top Banner & User Role Switcher */}
      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Brand & Household Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
            <Landmark size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: '800', lineHeight: 1.1, background: 'linear-gradient(135deg, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              OnePot Family Bank
            </h1>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Building2 size={12} color="#10b981" /> {currentFamily?.family_name || currentFamily?.name || 'Adeleke Family Pot'} • One family, one pot = No stories
            </span>
          </div>
        </div>

        {/* Currency & Active User / Role Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {/* Nigerian Naira Badge */}
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>🇳🇬</span> NGN (₦)
          </div>

          {/* Notification Bell */}
          <button 
            onClick={onToggleNotifications}
            className="btn btn-secondary"
            style={{ position: 'relative', padding: '0.5rem 0.75rem' }}
            title="View SMTP Email Alerts & Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#f43f5e', color: '#fff', fontSize: '0.7rem', fontWeight: 700, width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Reset Demo Data Button */}
          <button 
            onClick={onResetData}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
            title="Reset Demo Data to Initial State"
          >
            <RotateCcw size={15} /> Reset
          </button>

          {/* Role Switcher & Logout Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.85rem' }}
            >
              <span style={{ fontSize: '1.2rem' }}>{currentUser.avatar}</span>
              <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{currentUser.first_name} {currentUser.last_name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {currentUser.role === 'parent' ? '🛡️ Parent Manager' : '🧑‍🎓 Child Contributor'}
                </div>
              </div>
              <ChevronDown size={16} />
            </button>

            {showRoleMenu && (
              <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.5rem', width: '250px', zIndex: 50, boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
                  Family Members
                </div>
                {users.filter(u => u.family_id === currentUser.family_id).map(u => (
                  <button
                    key={u.user_id}
                    onClick={() => {
                      onSwitchUser(u);
                      setShowRoleMenu(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      background: u.user_id === currentUser.user_id ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      margin: '0.15rem 0'
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{u.avatar}</span>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{u.first_name} {u.last_name}</div>
                      <div style={{ fontSize: '0.725rem', color: u.role === 'parent' ? '#10b981' : '#60a5fa' }}>
                        {u.role === 'parent' ? 'Parent (Full Rights)' : 'Child (Restricted)'}
                      </div>
                    </div>
                  </button>
                ))}

                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                  <button
                    onClick={() => {
                      setShowRoleMenu(false);
                      onLogout();
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      background: 'rgba(244, 63, 94, 0.12)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: '#f43f5e',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <LogOut size={16} /> Sign Out / Switch Family
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '0 1.25rem' }}>
        <div className="tab-navigation" style={{ marginBottom: 0 }}>
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} /> Executive Dashboard
          </button>
          <button 
            className={`tab-btn ${activeTab === 'pool' ? 'active' : ''}`}
            onClick={() => setActiveTab('pool')}
          >
            <Landmark size={18} /> Pooled Bank Fund (Ajo)
          </button>
          <button 
            className={`tab-btn ${activeTab === 'budgets' ? 'active' : ''}`}
            onClick={() => setActiveTab('budgets')}
          >
            <PieChart size={18} /> Budget & Category Caps
          </button>
          <button 
            className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <History size={18} /> Pool Audit Ledger
          </button>
          <button 
            className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <FileSpreadsheet size={18} /> Periodic Reports
          </button>
          <button 
            className={`tab-btn ${activeTab === 'smtp' ? 'active' : ''}`}
            onClick={() => setActiveTab('smtp')}
          >
            <Mail size={18} /> SMTP Email Logs
            {unreadCount > 0 && <span className="badge badge-danger" style={{ padding: '0.1rem 0.4rem' }}>{unreadCount}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}
