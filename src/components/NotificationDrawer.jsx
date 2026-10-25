import React, { useState } from 'react';
import { Mail, Bell, CheckCircle, Server, Send } from 'lucide-react';
import { api } from '../services/api';
import { db } from '../services/db';

export default function NotificationDrawer({ notifications, onDataChange }) {
  const [selectedNotif, setSelectedNotif] = useState(null);

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllAsRead();
    } catch {
      // Fallback
    }
    if (db.markAllNotificationsRead) db.markAllNotificationsRead();
    if (onDataChange) onDataChange();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail color="#f43f5e" /> SMTP Email Notification Log & Alerts
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Automated Nodemailer / SMTP server dispatch history for budget limits, pool contributions, and allocations.
          </p>
        </div>

        <button onClick={handleMarkAllRead} className="btn btn-secondary" style={{ fontSize: '0.825rem' }}>
          <CheckCircle size={16} /> Mark All Read
        </button>
      </div>

      <div className="grid-2">
        {/* Left Column: Notification Feed */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} color="#10b981" /> Automated System Trigger Feed
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
            {notifications.map(n => (
              <div 
                key={n.notification_id}
                onClick={() => setSelectedNotif(n)}
                style={{
                  padding: '1rem',
                  background: selectedNotif?.notification_id === n.notification_id ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-primary)',
                  border: `1px solid ${selectedNotif?.notification_id === n.notification_id ? '#10b981' : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span className={`badge ${n.type.includes('Budget') || n.type.includes('BUDGET') ? 'badge-danger' : 'badge-parent'}`}>
                    {n.type}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                    {new Date(n.sent_at).toLocaleTimeString('en-NG')}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: n.is_read ? 400 : 600, color: 'var(--text-main)', lineHeight: 1.4 }}>
                  {n.message}
                </div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Send size={12} /> Click to view raw SMTP Email Headers
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Simulated Nodemailer / SMTP Email Raw Viewer */}
        <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.95)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Server size={18} color="#38bdf8" /> SMTP Nodemailer Packet Inspector
          </h3>

          {selectedNotif ? (
            <div style={{ fontFamily: 'monospace', fontSize: '0.825rem', lineHeight: 1.6 }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                <div style={{ color: '#38bdf8' }}>STATUS: 250 2.0.0 OK (Message Accepted for Delivery)</div>
                <div style={{ color: 'var(--text-muted)' }}>SMTP SERVER: {selectedNotif.smtpServer || 'smtp.gmail.com:587 (TLS)'}</div>
                <div style={{ color: 'var(--text-muted)' }}>SENDER: noreply@naijafamilybank.org.ng</div>
                <div style={{ color: '#10b981' }}>TO: {selectedNotif.recipients || 'family-members@okafor.org.ng'}</div>
                <div style={{ color: '#f59e0b', fontWeight: 'bold', marginTop: '0.5rem' }}>SUBJECT: {selectedNotif.emailSubject || selectedNotif.message}</div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', color: '#f8fafc', whiteSpace: 'pre-wrap' }}>
                {selectedNotif.emailBody || selectedNotif.message}
              </div>
            </div>
          ) : (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Select any notification event from the left list to view raw SMTP email dispatch headers & Nodemailer payload.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
