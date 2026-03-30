import React, { useEffect, useState } from 'react';
import { HelpTooltip } from '../HelpTooltip';
import { sendPasswordExpiryNotifications } from '../../services/passwordExpiryNotificationService';
import { useAuth } from '../../AuthContext';

export default function PasswordExpiryNotifyPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const handleSend = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const summary = await sendPasswordExpiryNotifications(3);
      setResult(summary);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'administrator') return;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const lastRun = localStorage.getItem('passwordExpiryNotifyLastRunDate');
    if (lastRun === today) return;

    let cancelled = false;
    localStorage.setItem('passwordExpiryNotifyLastRunDate', today);

    (async () => {
      try {
        await handleSend();
      } catch (e) {
        if (cancelled) return;
        setError(e?.message ?? String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  return (
    <div className="password-expiry-notify-panel">
      <h2>Password expiry emails</h2>
      <p style={{ marginBottom: '0.75rem', fontSize: '0.95rem', color: '#374151' }}>
        Sends a reminder to users whose password expires within 3 days (based on{' '}
        <code>user.passwordExpires</code>), using the admin email template. Users already marked with{' '}
        <code>user.passwordExpiryWarningSentAt</code> are skipped. After each successful send, that timestamp is updated.
      </p>
      <HelpTooltip text="Send reminder emails now for accounts in the 3-day expiry window that do not yet have passwordExpiryWarningSentAt set.">
        <button type="button" disabled={loading} onClick={handleSend}>
          {loading ? 'Sending…' : 'Send password expiry emails'}
        </button>
      </HelpTooltip>
      {error && (
        <p style={{ color: '#b91c1c', marginTop: '0.75rem' }} role="alert">
          {error}
        </p>
      )}
      {result && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
          <p>
            Sent: <strong>{result.sent}</strong>, failed: <strong>{result.failed}</strong>
          </p>
          {result.errors?.length > 0 && (
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
              {result.errors.map((e) => (
                <li key={`${e.userID}-${e.error}`}>
                  User {e.userID}: {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
