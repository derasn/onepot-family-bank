import React, { useState, useEffect } from 'react';
import { 
  Landmark, 
  Users, 
  LogIn, 
  Key, 
  Mail, 
  Building, 
  CheckCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';
import { db } from '../services/db';
import { SMTPNotificationService } from '../services/smtpService';

export default function AuthModal({ onLoginSuccess }) {
  const [existingFamilies, setExistingFamilies] = useState([]);
  const [activeTab, setActiveTab] = useState('login'); // 'register-family' | 'login' | 'join-family'
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register Family State
  const [regFamilyName, setRegFamilyName] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regRole, setRegRole] = useState('parent');

  // Join Family State
  const [joinFamilyId, setJoinFamilyId] = useState('1');
  const [joinFirstName, setJoinFirstName] = useState('');
  const [joinLastName, setJoinLastName] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinConfirmPassword, setJoinConfirmPassword] = useState('');
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [showJoinConfirmPassword, setShowJoinConfirmPassword] = useState(false);
  const [joinRole, setJoinRole] = useState('child');

  // Load existing families from API
  useEffect(() => {
    let isMounted = true;
    async function loadFamilies() {
      try {
        const families = await api.family.getFamilies();
        if (isMounted && Array.isArray(families)) {
          setExistingFamilies(families);
          if (families.length === 0) {
            setActiveTab('register-family');
          } else if (families[0]?.family_id || families[0]?.id) {
            setJoinFamilyId(String(families[0].family_id || families[0].id));
          }
        }
      } catch (err) {
        console.warn('Fallback loading families:', err.message);
        if (isMounted) {
          const local = db.getFamilies ? db.getFamilies() : [];
          setExistingFamilies(local);
        }
      }
    }
    loadFamilies();
    return () => { isMounted = false; };
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.login({ email: loginEmail, password: loginPassword });
      const user = res.user;
      const family = res.family;
      setSuccessMsg(`Welcome back, ${user.first_name || user.name}!`);
      setTimeout(() => onLoginSuccess(user, family), 600);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterFamilySubmit = async (e) => {
    e.preventDefault();
    if (!regFamilyName || !regFirstName || !regEmail) {
      setError('Family Name, Admin First Name, and Email are required.');
      return;
    }
    if (!regPassword) {
      setError('Please create a password for your new family account.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match! Please check and confirm your password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.registerFamily({
        family_name: regFamilyName,
        first_name: regFirstName,
        last_name: regLastName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        avatar: regRole === 'parent' ? '👑' : '🧑‍🎓'
      });

      const user = res.user;
      const family = res.family;

      try {
        SMTPNotificationService.sendWelcomeEmail(user, family);
      } catch {
        // Non-blocking
      }

      setSuccessMsg(`Family Account "${family.family_name || family.name}" created! Welcome email dispatched.`);
      setTimeout(() => onLoginSuccess(user, family), 900);
    } catch (err) {
      setError(err.message || 'Failed to create family account.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinFamilySubmit = async (e) => {
    e.preventDefault();
    if (!joinFirstName || !joinEmail) {
      setError('First name and Email are required to join a family.');
      return;
    }
    if (!joinPassword) {
      setError('Please create a password for your account.');
      return;
    }
    if (joinPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (joinPassword !== joinConfirmPassword) {
      setError('Passwords do not match! Please check and confirm your password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.joinFamily({
        family_id: joinFamilyId,
        first_name: joinFirstName,
        last_name: joinLastName,
        email: joinEmail,
        password: joinPassword,
        role: joinRole,
        avatar: joinRole === 'parent' ? '👩‍💼' : '🧑‍🎓'
      });

      const user = res.user;
      const family = res.family;

      try {
        SMTPNotificationService.sendWelcomeEmail(user, family);
      } catch {
        // Non-blocking
      }

      setSuccessMsg(`Successfully joined ${family.family_name || family.name}! Welcome email dispatched.`);
      setTimeout(() => onLoginSuccess(user, family), 900);
    } catch (err) {
      setError(err.message || 'Failed to join family account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0f172a 70%, #020617 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      overflowY: 'auto'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '540px',
        background: 'rgba(30, 41, 59, 0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '24px',
        padding: '2.25rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
      }}>
        {/* App Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '60px',
            height: '60px',
            margin: '0 auto 1rem auto',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 20px rgba(16, 185, 129, 0.3)'
          }}>
            <Landmark size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.35rem 0', fontFamily: 'Outfit, sans-serif' }}>
            NaijaFamily Pooled Bank
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
            Household Financial Planning & Collective Ajo Vaults
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '0.35rem',
          background: 'rgba(15, 23, 42, 0.6)',
          padding: '0.35rem',
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          marginBottom: '1.5rem'
        }}>
          <button
            onClick={() => { setActiveTab('login'); setError(''); setSuccessMsg(''); }}
            style={{
              padding: '0.65rem 0.5rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'login' ? '#10b981' : 'transparent',
              color: activeTab === 'login' ? '#ffffff' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s ease'
            }}
          >
            <LogIn size={15} /> Login
          </button>
          <button
            onClick={() => { setActiveTab('register-family'); setError(''); setSuccessMsg(''); }}
            style={{
              padding: '0.65rem 0.5rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'register-family' ? '#10b981' : 'transparent',
              color: activeTab === 'register-family' ? '#ffffff' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Building size={15} /> New Family
          </button>
          <button
            onClick={() => { setActiveTab('join-family'); setError(''); setSuccessMsg(''); }}
            style={{
              padding: '0.65rem 0.5rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'join-family' ? '#10b981' : 'transparent',
              color: activeTab === 'join-family' ? '#ffffff' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s ease'
            }}
          >
            <Users size={15} /> Join Pool
          </button>
        </div>

        {/* Error or Success Alert */}
        {error && (
          <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.825rem', marginBottom: '1.25rem' }}>
            ⚠️ {error}
          </div>
        )}
        {successMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.825rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}

        {/* TAB 1: LOGIN FORM */}
        {activeTab === 'login' && (
          <div>
            <form onSubmit={handleLoginSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Account Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    placeholder="emeka.okafor@gov.ng"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem 0.75rem 2.6rem',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <Key size={16} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 2.5rem 0.75rem 2.6rem',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.8rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 8px 16px rgba(16, 185, 129, 0.25)',
                  marginBottom: '1.5rem'
                }}
              >
                Log In to Household Account <ArrowRight size={16} />
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: REGISTER NEW FAMILY ACCOUNT */}
        {activeTab === 'register-family' && (
          <form onSubmit={handleRegisterFamilySubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Family / Household Name
              </label>
              <input
                type="text"
                placeholder="e.g. The Adeleke Household"
                value={regFamilyName}
                onChange={(e) => setRegFamilyName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Admin First Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Babatunde"
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Last Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Adeleke"
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Admin Email Address
              </label>
              <input
                type="email"
                placeholder="babatunde@adeleke.org.ng"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* PASSWORD & CONFIRM PASSWORD FIELDS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Create Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="Min 6 chars"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 2.2rem 0.75rem 0.85rem',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.6rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 2.2rem 0.75rem 0.85rem',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: regConfirmPassword && regPassword !== regConfirmPassword ? '1px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.6rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    {showRegConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Live Password Match Indicator */}
            {regConfirmPassword && (
              <div style={{
                fontSize: '0.75rem',
                marginBottom: '1rem',
                color: regPassword === regConfirmPassword ? '#34d399' : '#fb7185',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                {regPassword === regConfirmPassword ? (
                  <>✓ Passwords match</>
                ) : (
                  <>✕ Passwords do not match</>
                )}
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Family Role
              </label>
              <select
                value={regRole}
                onChange={(e) => setRegRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              >
                <option value="parent">Parent / Head of Household (Admin Manager)</option>
                <option value="child">Child / Dependent (Contributor)</option>
              </select>
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '0.85rem',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 8px 16px rgba(16, 185, 129, 0.25)'
              }}
            >
              Create Family & Start Pooled Vault <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* TAB 3: JOIN EXISTING FAMILY ACCOUNT */}
        {activeTab === 'join-family' && (
          <form onSubmit={handleJoinFamilySubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Select Family Account to Join
              </label>
              <select
                value={joinFamilyId}
                onChange={(e) => setJoinFamilyId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              >
                {existingFamilies.map(f => {
                  const fid = f.family_id || f.id;
                  const fname = f.family_name || f.name;
                  return (
                    <option key={fid} value={fid}>
                      {fname} (ID #{fid})
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  First Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chidimma"
                  value={joinFirstName}
                  onChange={(e) => setJoinFirstName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Last Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Okafor"
                  value={joinLastName}
                  onChange={(e) => setJoinLastName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="chidimma.okafor@gmail.com"
                value={joinEmail}
                onChange={(e) => setJoinEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* JOIN FAMILY PASSWORD & CONFIRM PASSWORD */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Create Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showJoinPassword ? 'text' : 'password'}
                    placeholder="Min 6 chars"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 2.2rem 0.75rem 0.85rem',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowJoinPassword(!showJoinPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.6rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    {showJoinPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showJoinConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={joinConfirmPassword}
                    onChange={(e) => setJoinConfirmPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 2.2rem 0.75rem 0.85rem',
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: joinConfirmPassword && joinPassword !== joinConfirmPassword ? '1px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowJoinConfirmPassword(!showJoinConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.6rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    {showJoinConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Live Password Match Indicator for Join Family */}
            {joinConfirmPassword && (
              <div style={{
                fontSize: '0.75rem',
                marginBottom: '1rem',
                color: joinPassword === joinConfirmPassword ? '#34d399' : '#fb7185',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                {joinPassword === joinConfirmPassword ? (
                  <>✓ Passwords match</>
                ) : (
                  <>✕ Passwords do not match</>
                )}
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Member Role
              </label>
              <select
                value={joinRole}
                onChange={(e) => setJoinRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              >
                <option value="child">Child / Dependent (Student / Contributor)</option>
                <option value="parent">Parent / Co-Manager</option>
              </select>
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '0.85rem',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 8px 16px rgba(16, 185, 129, 0.25)'
              }}
            >
              Join Family Account <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
