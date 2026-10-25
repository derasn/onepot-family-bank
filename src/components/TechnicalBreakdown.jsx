import React, { useState } from 'react';
import { 
  Palette, 
  Code2, 
  Database, 
  Tag, 
  Copy, 
  Check, 
  Layers, 
  Search,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

export default function TechnicalBreakdown() {
  const [copiedKey, setCopiedKey] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Color Tokens
  const colorTokens = [
    { name: '--bg-primary', hex: '#0f172a', desc: 'Main dark page background canvas (Slate 900)', file: 'src/index.css', line: 5, category: 'theme' },
    { name: '--bg-secondary', hex: '#1e293b', desc: 'Header, modals, cards, and panel surface (Slate 800)', file: 'src/index.css', line: 6, category: 'theme' },
    { name: '--bg-card', hex: 'rgba(30, 41, 59, 0.75)', desc: 'Glassmorphic card backdrop with blur filter', file: 'src/index.css', line: 7, category: 'theme' },
    { name: '--border-color', hex: 'rgba(255, 255, 255, 0.08)', desc: 'Card dividers and subtle borders', file: 'src/index.css', line: 9, category: 'theme' },
    { name: '--primary', hex: '#10b981', desc: 'Nigerian Emerald Green (Primary Action & Branding)', file: 'src/index.css', line: 13, category: 'brand' },
    { name: '--primary-hover', hex: '#059669', desc: 'Hover state for primary emerald buttons', file: 'src/index.css', line: 14, category: 'brand' },
    { name: '--primary-light', hex: 'rgba(16, 185, 129, 0.15)', desc: 'Soft emerald background for badges & alert chips', file: 'src/index.css', line: 15, category: 'brand' },
    { name: '--accent-gold', hex: '#f59e0b', desc: 'Amber/Gold for Shared Pooled Bank (Ajo Fund)', file: 'src/index.css', line: 18, category: 'brand' },
    { name: '--accent-gold-light', hex: 'rgba(245, 158, 11, 0.15)', desc: 'Soft gold badge and chip background', file: 'src/index.css', line: 19, category: 'brand' },
    { name: '--accent-blue', hex: '#3b82f6', desc: 'Royal blue for contributor role and member flow stats', file: 'src/index.css', line: 20, category: 'brand' },
    { name: '--accent-purple', hex: '#8b5cf6', desc: 'Purple for Financial Reports & Statements', file: 'src/index.css', line: 21, category: 'brand' },
    { name: '--accent-rose', hex: '#f43f5e', desc: 'Rose red for expenses, over-budget warnings & alerts', file: 'src/index.css', line: 22, category: 'brand' },
    { name: '--accent-rose-light', hex: 'rgba(244, 63, 94, 0.15)', desc: 'Soft red badge and warning pill background', file: 'src/index.css', line: 23, category: 'brand' },
    { name: '--text-main', hex: '#f8fafc', desc: 'High-contrast text for body and display headers', file: 'src/index.css', line: 26, category: 'typography' },
    { name: '--text-muted', hex: '#94a3b8', desc: 'Medium-contrast text for sublabels & placeholders', file: 'src/index.css', line: 27, category: 'typography' },
    { name: '--text-subtle', hex: '#64748b', desc: 'Subdued metadata, timestamps, and footer text', file: 'src/index.css', line: 28, category: 'typography' },
  ];

  // Key Names and Brand Elements
  const keyNames = [
    { element: 'HTML Tab Title', value: 'family-pooled-bank', file: 'index.html', line: 7, desc: 'Displayed in browser tab bar and bookmarks' },
    { element: 'Main Header Title', value: 'NaijaFamily Pooled Bank', file: 'src/components/Header.jsx', line: '42-44', desc: 'Primary application title in executive header' },
    { element: 'Household Fallback Name', value: 'The Okafor Household', file: 'src/components/Header.jsx', line: 30, desc: 'Default family title if no registered name exists' },
    { element: 'Household Tagline', value: '{familyName} • Pooled Family Account', file: 'src/components/Header.jsx', line: 46, desc: 'Header breadcrumb with dynamic family name' },
    { element: 'Currency Identifier', value: '🇳🇬 NGN (₦)', file: 'src/components/Header.jsx', line: 55, desc: 'Nigerian Naira currency flag and symbol badge' },
    { element: 'Auth Modal App Header', value: 'NaijaFamily Pooled Bank', file: 'src/components/AuthModal.jsx', line: '187-192', desc: 'Welcome title on login and registration screens' },
    { element: 'Auth Modal Subtitle', value: 'Household Financial Planning & Collective Ajo Vaults', file: 'src/components/AuthModal.jsx', line: 191, desc: 'Mission tagline under auth modal logo' },
    { element: 'Shared Vault Display Name', value: 'Shared Family Pooled Bank Balance (Ajo Fund)', file: 'src/components/PooledFundCard.jsx', line: 118, desc: 'Central banner heading on Ajo pooled fund card' },
    { element: 'Footer Copyright & Brand', value: 'NaijaFamily Pooled Bank & Family Financial Planner', file: 'src/App.jsx', line: 130, desc: 'Persistent footer notice with Nigerian household context' },
    { element: 'Footer Architecture Stack', value: 'Built with React, Node.js REST Architecture, Chart.js & Nodemailer', file: 'src/App.jsx', line: 133, desc: 'System stack credits in main footer' },
    { element: 'Seed Family Name', value: 'Demo Family', file: 'src/services/db.js', line: 13, desc: 'Initial database seed family profile' },
    { element: 'Seed Parent Profile', value: 'Demo Parent (Role: parent, 👑)', file: 'src/services/db.js', line: '21-27', desc: 'Admin account with full pool allocation rights' },
    { element: 'Seed Child Profile', value: 'Demo Child (Role: child, 🧑‍🎓)', file: 'src/services/db.js', line: '32-38', desc: 'Restricted member with deposit & viewing rights' },
    { element: 'Package System Name', value: 'family-pooled-bank', file: 'package.json', line: 2, desc: 'Node package identifier in package.json' },
  ];

  // Component & Dynamic Status Colors
  const statusColors = [
    { name: 'Button Primary Gradient', code: 'linear-gradient(135deg, #10b981, #059669)', file: 'src/index.css', line: 164, sample: 'button-primary' },
    { name: 'Button Accent (Ajo) Gradient', code: 'linear-gradient(135deg, #f59e0b, #d97706)', file: 'src/index.css', line: 186, sample: 'button-accent' },
    { name: 'Button Danger / Warning', code: 'rgba(244, 63, 94, 0.15) / #f87171', file: 'src/index.css', line: '197-199', sample: 'button-danger' },
    { name: 'Parent Role Badge', code: 'bg: rgba(16, 185, 129, 0.18), text: #10b981', file: 'src/index.css', line: '122-126', sample: 'badge-parent' },
    { name: 'Child Role Badge', code: 'bg: rgba(59, 130, 246, 0.18), text: #60a5fa', file: 'src/index.css', line: '128-132', sample: 'badge-child' },
    { name: 'Budget Cap Safe (<80%)', code: '#10b981 (Emerald Green)', file: 'src/components/BudgetManager.jsx', line: '118, 134', sample: 'status-safe' },
    { name: 'Budget Cap Warning (80%-99%)', code: '#f59e0b (Amber Gold)', file: 'src/components/BudgetManager.jsx', line: '118, 134', sample: 'status-warning' },
    { name: 'Budget Cap Exceeded (≥100%)', code: '#f43f5e (Rose Red Alert)', file: 'src/components/BudgetManager.jsx', line: '118, 134', sample: 'status-danger' },
    { name: 'Chart.js Incomes Bar', code: 'rgba(16, 185, 129, 0.85)', file: 'src/components/Dashboard.jsx', line: 101, sample: 'chart-income' },
    { name: 'Chart.js Expenses Bar', code: 'rgba(244, 63, 94, 0.85)', file: 'src/components/Dashboard.jsx', line: 107, sample: 'chart-expense' },
  ];

  // Chart.js 8 Category Palette
  const chartPalette = [
    { hex: '#10b981', label: 'Food & Provisions' },
    { hex: '#f59e0b', label: 'School Fees & Books' },
    { hex: '#3b82f6', label: 'House Rent & Maint.' },
    { hex: '#8b5cf6', label: 'Generator & PHCN' },
    { hex: '#f43f5e', label: 'Healthcare & Emergencies' },
    { hex: '#06b6d4', label: 'Transport & Car Fuel' },
    { hex: '#ec4899', label: 'Extended Family ("Black Tax")' },
    { hex: '#6366f1', label: 'Savings & Investments' },
  ];

  // Database Tables
  const dbTables = [
    { table: 'family_table', line: 11, desc: 'Stores family units (family_id, family_name, created_at)' },
    { table: 'user_table', line: 18, desc: 'Stores family members & roles (parent vs child RBAC)' },
    { table: 'category_table', line: 30, desc: 'Household expense categories with emoji icon glyphs' },
    { table: 'income_table', line: 38, desc: 'Incomes logged per member with amounts and sources' },
    { table: 'expense_table', line: 50, desc: 'Expenses tagged to category, user, and payment method' },
    { table: 'budgetlimit_table', line: 65, desc: 'Category budget caps for automated SMTP alert threshold checks' },
    { table: 'notification_table', line: 76, desc: 'SMTP email notifications and audit alert logs' },
    { table: 'pooledfund_table', line: 88, desc: 'Central Ajo vault balance per household' },
    { table: 'pooltransactions_table', line: 97, desc: 'Audit ledger of pool contributions and parent allocations' },
    { table: 'deposit_account_table', line: 111, desc: 'Linked commercial Nigerian bank accounts for direct pool deposits' },
  ];

  // Filtered lists
  const filteredColors = colorTokens.filter(c => 
    (filterCategory === 'all' || filterCategory === 'colors') &&
    (c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     c.hex.toLowerCase().includes(searchQuery.toLowerCase()) ||
     c.desc.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredNames = keyNames.filter(n =>
    (filterCategory === 'all' || filterCategory === 'names') &&
    (n.element.toLowerCase().includes(searchQuery.toLowerCase()) ||
     n.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
     n.file.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '0.45rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Code2 size={20} color="#ffffff" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
              Technical Breakdown, Branding & Code Map
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Comprehensive technical directory mapping names, colors, UI tokens, and database schemas directly to their source lines of code.
          </p>
        </div>

        {/* Global Summary Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-parent" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
            <Sparkles size={14} /> Full-Stack Architecture Verified
          </span>
        </div>
      </div>

      {/* Interactive Controls & Filter Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text"
            className="form-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search color hex, variable, name, file, or line number..."
            style={{ paddingLeft: '2.4rem', fontSize: '0.85rem' }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Elements', icon: Layers },
            { id: 'names', label: 'Key Names & Titles', icon: Tag },
            { id: 'colors', label: 'Color Tokens', icon: Palette },
            { id: 'status', label: 'Status & Badges', icon: ShieldCheck },
            { id: 'db', label: 'Database Schema', icon: Database },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = filterCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterCategory(tab.id)}
                className="btn btn-secondary"
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  background: isActive ? 'var(--primary)' : 'var(--bg-primary)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  borderColor: isActive ? 'var(--primary)' : 'var(--border-color)',
                  fontWeight: isActive ? 700 : 500
                }}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: KEY NAMES & BRANDING IDENTIFIERS */}
      {(filterCategory === 'all' || filterCategory === 'names') && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tag size={18} color="#10b981" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Application & Entity Names Breakdown</h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
              {filteredNames.length} items cataloged
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>UI Element</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Rendered String / Display Name</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Source File</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Line(s)</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Copy</th>
                </tr>
              </thead>
              <tbody>
                {filteredNames.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)' }}>
                    <td style={{ padding: '0.75rem 0.85rem', fontWeight: 600 }}>{item.element}</td>
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <span style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#10b981', fontFamily: 'monospace', fontWeight: 600 }}>
                        {item.value}
                      </span>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {item.desc}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {item.file}
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Line {item.line}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleCopy(item.value, `name-${idx}`)}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        title="Copy value"
                      >
                        {copiedKey === `name-${idx}` ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2: COLOR PALETTE & CSS TOKENS */}
      {(filterCategory === 'all' || filterCategory === 'colors') && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Palette size={18} color="#f59e0b" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Color Tokens & CSS Variables</h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
              Defined in <code>src/index.css</code> (Lines 3–41)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {filteredColors.map((color, idx) => (
              <div 
                key={idx}
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                {/* Visual Swatch */}
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  background: color.hex,
                  border: '2px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)',
                  flexShrink: 0
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>
                      {color.name}
                    </span>
                    <button
                      onClick={() => handleCopy(color.hex, `color-${idx}`)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                      title="Copy hex code"
                    >
                      {copiedKey === `color-${idx}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#10b981', fontFamily: 'monospace', margin: '0.15rem 0' }}>
                    {color.hex}
                  </div>

                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    {color.desc}
                  </div>

                  <div style={{ marginTop: '0.35rem' }}>
                    <span style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-subtle)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.675rem' }}>
                      {color.file}: Line {color.line}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: COMPONENT STYLING & STATUS VISUALS */}
      {(filterCategory === 'all' || filterCategory === 'status') && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="#3b82f6" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Interactive Badges, Buttons & Chart.js Palette</h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
              Live CSS Renderings
            </span>
          </div>

          <div className="grid-2">
            {/* Live Badges and Buttons */}
            <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-muted)' }}>
                Role Badges & Interactive Buttons
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '1rem' }}>
                <span className="badge badge-parent">Parent (Line 123)</span>
                <span className="badge badge-child">Child (Line 129)</span>
                <span className="badge badge-warning">Alert (Line 135)</span>
                <span className="badge badge-danger">Danger (Line 141)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                <button className="btn btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
                  .btn-primary (Line 164)
                </button>
                <button className="btn btn-accent" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
                  .btn-accent (Line 186)
                </button>
                <button className="btn btn-danger" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
                  .btn-danger (Line 197)
                </button>
              </div>
            </div>

            {/* Dynamic Budget Alert Engine Color Thresholds */}
            <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-muted)' }}>
                Budget Spending Cap Logic (BudgetManager.jsx: Line 134)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span>Safe Spending (&lt;80%):</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>#10b981 (Emerald Green)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span>Warning Threshold (80% - 99%):</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>#f59e0b (Amber Gold)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span>Exceeded Cap (≥100%):</span>
                  <span style={{ color: '#f43f5e', fontWeight: 700 }}>#f43f5e (Rose Alert Red)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart.js 8 Palette Swatches */}
          <div style={{ marginTop: '1.25rem', background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-muted)' }}>
                Chart.js 8-Color Expense Category Palette (Dashboard.jsx: Lines 63–66)
              </h4>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-subtle)' }}>8 Harmonious Categories</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.75rem' }}>
              {chartPalette.map((item, idx) => (
                <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '100%', height: '18px', background: item.hex, borderRadius: '4px', marginBottom: '0.4rem' }} />
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: item.hex, fontFamily: 'monospace' }}>{item.hex}</div>
                  <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Component Status & Dynamic Color Reference Table */}
          <div style={{ marginTop: '1.25rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Component / State</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Color Token / Formula</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Source File</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Line(s)</th>
                </tr>
              </thead>
              <tbody>
                {statusColors.map((st, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>{st.name}</td>
                    <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'monospace', color: '#10b981' }}>{st.code}</td>
                    <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{st.file}</td>
                    <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                      <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Line {st.line}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 4: DATABASE & BACKEND SCHEMA DIRECTORY */}
      {(filterCategory === 'all' || filterCategory === 'db') && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} color="#8b5cf6" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Database Tables & Schema Mappings</h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
              Source: <code>backend/schema.sql</code> (Tables 3.1–3.10)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {dbTables.map((t, idx) => (
              <div 
                key={idx}
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                    {t.table}
                  </span>
                  <span style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                    Line {t.line}
                  </span>
                </div>
                <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
