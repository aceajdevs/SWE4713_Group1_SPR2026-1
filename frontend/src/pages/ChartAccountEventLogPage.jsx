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

function parseSnapshotJson(text) {
  if (text == null || String(text).trim() === '') return null;
  const s = String(text).trim();
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { _value: parsed };
  } catch {
    return { _raw: s };
  }
}

function formatFieldValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function sortedSnapshotKeys(beforeObj, afterObj) {
  const a = beforeObj && typeof beforeObj === 'object' ? beforeObj : {};
  const b = afterObj && typeof afterObj === 'object' ? afterObj : {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort((x, y) =>
    x.localeCompare(y, undefined, { sensitivity: 'base' })
  );
}

function fieldValuesDiffer(beforeVal, afterVal) {
  const b = beforeVal === undefined ? undefined : beforeVal;
  const a = afterVal === undefined ? undefined : afterVal;
  return JSON.stringify(b) !== JSON.stringify(a);
}

function snapshotObjects(beforeJSON, afterJSON) {
  const b = parseSnapshotJson(beforeJSON);
  const a = parseSnapshotJson(afterJSON);
  const beforeObj = b && typeof b === 'object' ? b : {};
  const afterObj = a && typeof a === 'object' ? a : {};
  return { beforeObj, afterObj };
}

function renderFieldCells(keys, beforeObj, afterObj, row) {
  const isBefore = row === 'before';
  return keys.map((key) => {
    const hasBefore = Object.prototype.hasOwnProperty.call(beforeObj, key);
    const hasAfter = Object.prototype.hasOwnProperty.call(afterObj, key);
    const bv = hasBefore ? beforeObj[key] : undefined;
    const av = hasAfter ? afterObj[key] : undefined;
    const changed = fieldValuesDiffer(
      hasBefore ? bv : undefined,
      hasAfter ? av : undefined
    );
    const missing = isBefore ? !hasBefore : !hasAfter;
    const tdClass = [
      'event-field-td',
      isBefore ? 'event-field-td--before' : 'event-field-td--after',
      changed && 'event-field-td--changed',
      missing && 'event-field-td--missing',
    ]
      .filter(Boolean)
      .join(' ');
    const content = isBefore
      ? hasBefore
        ? formatFieldValue(bv)
        : '—'
      : hasAfter
        ? formatFieldValue(av)
        : '—';
    return (
      <td key={`${row}-${key}`} className={tdClass}>
        {content}
      </td>
    );
  });
}

function EventLogEventTable({ ev }) {
  const when = ev.changedAt ? new Date(ev.changedAt).toLocaleString() : '—';
  const { beforeObj, afterObj } = snapshotObjects(ev.beforeJSON, ev.afterJSON);
  const keys = sortedSnapshotKeys(beforeObj, afterObj);
  const hasFieldCols = keys.length > 0;

  return (
    <div className="event-log-event-card">
      <div className="event-log-meta-strip" aria-label="Event metadata">
        <div className="event-log-meta-item">
          <span className="event-log-meta-label">Event ID</span>
          <span className="event-log-meta-value">{ev.eventID ?? '—'}</span>
        </div>
        <div className="event-log-meta-item">
          <span className="event-log-meta-label">When</span>
          <span className="event-log-meta-value event-log-meta-value--when">{when}</span>
        </div>
        <div className="event-log-meta-item">
          <span className="event-log-meta-label">Action</span>
          <span className="event-log-meta-value">{ev.action ?? '—'}</span>
        </div>
        <div className="event-log-meta-item">
          <span className="event-log-meta-label">Changed by (user ID)</span>
          <span className="event-log-meta-value">{ev.changedBy ?? '—'}</span>
        </div>
      </div>
      <div
        className="event-log-fields-scroll"
        role="region"
        aria-label="Before and after snapshot fields. Scroll horizontally for more columns."
      >
        <p className="event-log-fields-hint">Scroll → for more fields (~5–6 columns visible).</p>
        <table className="chart-account-event-fields-table">
          <thead>
            <tr>
              {hasFieldCols ? (
                keys.map((key) => (
                  <th key={key} scope="col" className="event-field-th" title={key}>
                    {key}
                  </th>
                ))
              ) : (
                <th scope="col" className="event-field-th event-field-th--placeholder">
                  Snapshot
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="event-snapshot-row event-snapshot-row--before" aria-label="Before snapshot">
              {hasFieldCols ? (
                renderFieldCells(keys, beforeObj, afterObj, 'before')
              ) : (
                <td className="event-field-td event-field-td--before event-field-td--empty">—</td>
              )}
            </tr>
            <tr className="event-snapshot-row event-snapshot-row--after" aria-label="After snapshot">
              {hasFieldCols ? (
                renderFieldCells(keys, beforeObj, afterObj, 'after')
              ) : (
                <td className="event-field-td event-field-td--after event-field-td--empty">—</td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
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
          <button type="button" className="button" onClick={() => navigate('/admin/chart-of-accounts')}>
            Back to Chart of Accounts
          </button>
        </HelpTooltip>
      </div>

      {loading && <p>Loading event log…</p>}
      {error && (
        <p style={{ color: '#b91c1c' }} role="alert">
          {error}
        </p>
      )}

      {!loading && !error && account && (
        <>
          <p style={{ fontSize: '0.95rem', color: '#374151', marginBottom: '16px' }}>
            Event details stay on the left. Snapshot columns scroll horizontally (roughly <strong>5–6 fields</strong> visible at
            a time); the first row is <strong>before</strong>, the second is <strong>after</strong>. Changed values are
            highlighted.
          </p>

          {events.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No events recorded for this account yet.</p>
          ) : (
            <div className="event-log-horizontal-outer">
              {events.map((ev) => (
                <EventLogEventTable key={ev.eventID ?? `${ev.changedAt}-${ev.action}`} ev={ev} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ChartAccountEventLogPage;
