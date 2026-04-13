import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  getPostedJournalEntriesReport,
  searchJournalEntries,
  filterByDateRange,
} from '../services/journalService';
import { HelpTooltip } from '../components/HelpTooltip';
import { JournalStackedAccountsCell } from '../components/JournalStackedAccountsCell';
import { getJournalEntryTypeLabel } from '../utils/journalEntryTypes';
import '../global.css';

function PostedJournalEntriesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const canView =
    user?.role === 'manager' ||
    user?.role === 'accountant' ||
    user?.role === 'administrator';

  const ledgerBasePath = '/admin/ledger';

  useEffect(() => {
    if (!canView) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPostedJournalEntriesReport();
        if (!cancelled) setEntries(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          const msg = typeof err?.message === 'string' ? err.message.trim() : '';
          setError(msg || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [canView]);

  const displayed = useMemo(() => {
    let list = entries;
    if (searchQuery.trim()) list = searchJournalEntries(list, searchQuery);
    if (startDate || endDate) list = filterByDateRange(list, startDate, endDate);
    return list;
  }, [entries, searchQuery, startDate, endDate]);

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  };

  const formatMoney = (n) =>
    `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (!canView) {
    return null;
  }

  return (
    <div className="container" style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem 1.25rem' }}>
      <div className="header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: '1.35rem' }}>Posted journal entries</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <HelpTooltip text="Open the full journal workflow (pending, approve, reject).">
            <button type="button" className="button-secondary" onClick={() => navigate('/journal-entries')}>
              All journal entries
            </button>
          </HelpTooltip>
        </div>
      </div>

      {error ? (
        <p style={{ color: 'var(--bff-error)', marginBottom: 12 }} role="alert">
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <fieldset
          style={{
            border: '1px solid var(--bff-border, #d1d5db)',
            borderRadius: 8,
            padding: '10px 12px',
            margin: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'flex-end',
          }}
        >
          <legend style={{ fontSize: 12, padding: '0 6px', color: '#374151' }}>Date range</legend>
          <div>
            <label style={{ display: 'block', fontSize: 12 }}>From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12 }}>To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" />
          </div>
        </fieldset>
        <fieldset
          style={{
            border: '1px solid var(--bff-border, #d1d5db)',
            borderRadius: 8,
            padding: '10px 12px',
            margin: 0,
            flex: '1 1 200px',
            minWidth: 180,
          }}
        >
          <legend style={{ fontSize: 12, padding: '0 6px', color: '#374151' }}>Search</legend>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Account, amount, or date"
            className="input-field"
            style={{ width: '100%' }}
            aria-label="Search posted journals by account, amount, or date"
          />
        </fieldset>
      </div>

      {loading ? (
        <p aria-busy="true" aria-live="polite">
          Loading…
        </p>
      ) : displayed.length === 0 ? (
        <p role="status">No entries match the current filters.</p>
      ) : (
        <table className="user-report-table posted-journal-entries-table">
          <thead>
            <tr>
              <th>PR</th>
              <th>Created</th>
              <th>Posted</th>
              <th>Type</th>
              <th>Accounts</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Ledger</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((entry) => {
              const totalDebit = (entry.lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
              return (
                <tr key={entry.journalEntryID}>
                  <td>
                    <button
                      type="button"
                      className="link"
                      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit' }}
                      onClick={() => navigate(`/journal-entry/${entry.journalEntryID}`)}
                    >
                      {entry.journalEntryID}
                    </button>
                  </td>
                  <td>{formatDate(entry.createdAt)}</td>
                  <td>{formatDate(entry.postedAt)}</td>
                  <td>{getJournalEntryTypeLabel(entry.entryType)}</td>
                  <JournalStackedAccountsCell
                    lines={entry.lines}
                    journalEntryId={entry.journalEntryID}
                    navigate={navigate}
                    ledgerBasePath={ledgerBasePath}
                  />
                  <td style={{ textAlign: 'right' }}>{formatMoney(totalDebit)}</td>
                  <td>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => navigate(`/admin/journal-entry/${entry.journalEntryID}`)}
                    >
                      GL view
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default PostedJournalEntriesPage;
