import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchFromTable } from '../supabaseUtils';
import { fetchChartAccountEventLog } from '../services/chartOfAccountsService';
import { HelpTooltip } from '../components/HelpTooltip';
import '../global.css';
import './ChartAccountEventLogPage.css';

function normalizeEventRow(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    eventID: row.eventID ?? row.eventid,
    accountID: row.accountID ?? row.accountid,
    action: row.action,
    beforeJSON: row.beforeJSON ?? row.beforejson,
    afterJSON: row.afterJSON ?? row.afterjson,
    changedBy: row.changedBy ?? row.changedby,
    changedByUsername: row.changedByUsername ?? row.changedbyusername,
    changedAt: row.changedAt ?? row.changedat,
  };
}

function formatJsonBlock(text) {
  if (text == null || String(text).trim() === '') return null;
  const s = String(text).trim();
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function ChartAccountEventLogPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [account, setAccount] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const id = parseInt(accountId, 10);
    if (!Number.isFinite(id)) {
      setError('Invalid account.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: acc, error: accErr } = await fetchFromTable('chartOfAccounts', {
          select: 'accountID, accountNumber, accountName',
          filters: { accountID: id },
          single: true,
        });
        if (accErr || !acc) {
          setError('Account not found.');
          setAccount(null);
          setEvents([]);
          return;
        }
        if (cancelled) return;
        setAccount(acc);

        const rows = await fetchChartAccountEventLog(id);
        if (cancelled) return;
        setEvents(Array.isArray(rows) ? rows.map(normalizeEventRow).filter(Boolean) : []);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message ?? String(e));
          setEvents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, user, navigate]);

  return (
    <div className="container chart-account-event-log-page">
      <div className="header-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Account event log</h1>
          {account && (
            <p className="muted" style={{ margin: 0 }}>
              <strong>{account.accountNumber}</strong> — {account.accountName}
            </p>
          )}
        </div>
        <HelpTooltip text="Return to the chart of accounts list.">
          <button type="button" className="button-primary" onClick={() => navigate('/admin/chart-of-accounts')}>
            Back to Chart of Accounts
          </button>
        </HelpTooltip>
      </div>

      {loading && <p>Loading event log…</p>}
      {error && (
        <p style={{ color: 'var(--bff-red)' }} role="alert">
          {error}
        </p>
      )}

      {!loading && !error && account && (
        <>
          <p style={{ fontSize: '0.95rem', color: '#374151', marginBottom: '16px' }}>
            Each row shows the action, who made the change, when it occurred, and the before/after snapshot of the account
            record. New accounts may have no <strong>before</strong> image; updates show both sides when available.
          </p>

          {events.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No events recorded for this account yet.</p>
          ) : (
            <div className="event-log-table-wrap">
              <table className="user-report-table chart-account-event-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Changed by (user ID)</th>
                    <th>Username</th>
                    <th>Before</th>
                    <th>After</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => {
                    const when = ev.changedAt ? new Date(ev.changedAt).toLocaleString() : '—';
                    const beforeFmt = formatJsonBlock(ev.beforeJSON);
                    const afterFmt = formatJsonBlock(ev.afterJSON);
                    return (
                      <tr key={ev.eventID ?? `${ev.changedAt}-${ev.action}`}>
                        <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>{when}</td>
                        <td style={{ verticalAlign: 'top' }}>{ev.action ?? '—'}</td>
                        <td style={{ verticalAlign: 'top' }}>{ev.changedBy ?? '—'}</td>
                        <td style={{ verticalAlign: 'top' }}>{ev.changedByUsername ?? '—'}</td>
                        <td className="event-json-cell">
                          {beforeFmt ? (
                            <pre className="event-json-pre">{beforeFmt}</pre>
                          ) : (
                            <span className="event-json-empty">— (none — e.g. first insert)</span>
                          )}
                        </td>
                        <td className="event-json-cell">
                          {afterFmt ? (
                            <pre className="event-json-pre">{afterFmt}</pre>
                          ) : (
                            <span className="event-json-empty">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ChartAccountEventLogPage;
