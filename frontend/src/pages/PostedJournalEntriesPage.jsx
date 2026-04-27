import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  getPostedJournalEntriesReport,
  searchJournalEntries,
  filterByDateRange,
} from '../services/journalService';
import {
  validateDebitsEqualCredits,
  validateDebitBeforeCredit,
  validateHasDebitAndCredit,
  validateLineAmounts,
} from '../utils/journalValidation';
import { getJournalEntryTypeLabel } from '../utils/journalEntryTypes';
import { HelpTooltip } from '../components/HelpTooltip';
import '../global.css';
import './PostedJournalEntriesPage.css';

function summarizeAccountingRules(lines) {
  if (!lines?.length) {
    return { compliant: false, labels: ['No lines'] };
  }
  const checks = [
    { name: 'Debits & credits present', ...validateHasDebitAndCredit(lines) },
    { name: 'Line amounts valid', ...validateLineAmounts(lines) },
    { name: 'Debit-before-credit order', ...validateDebitBeforeCredit(lines) },
    { name: 'Debits equal credits', ...validateDebitsEqualCredits(lines) },
  ];
  const failed = checks.filter((c) => !c.valid).map((c) => c.name);
  return {
    compliant: failed.length === 0,
    labels: failed.length === 0 ? ['Double-entry rules satisfied'] : failed,
  };
}

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
    user?.role === 'accountant';
  const canOpenLedger = user?.role !== 'administrator';

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
        if (!cancelled) setError(err.message || 'Failed to load posted journal entries.');
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
    return (
      <p style={{ color: 'var(--bff-red)', padding: '1rem' }}>
        You do not have permission to view posted journal entries.
      </p>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '90%', margin: '0 auto', padding: '1rem 1.25rem' }}>
      <div className="header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: '1.35rem' }}>Posted Journal Entries</h1>
      </div>

      {error && (
        <p style={{ color: 'var(--bff-red)', marginBottom: 12 }} role="alert">
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <h5 className='h5'>From</h5>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
        </div>
        <div>
          <h5 className='h5'>To</h5>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 180}}>
          <h5 className='h5'>Search</h5>
          <div className="clear-input-container" role="group">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Account, amount, or date"
            className="input"
            style={{ width: '100%' }}
            aria-label="Search posted journals by account, amount, or date"
          />
          <button type="button" className="button-clear" onClick={() => setSearchQuery('')} aria-label="Clear search input">X</button>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading posted entries…</p>
      ) : displayed.length === 0 ? (
        <p>No posted journal entries match your filters.</p>
      ) : (
        <table className="user-report-table">
          <thead>
            <tr>
              <th className="PJE-pr">PR</th>
              <th className="PJE-created">Created</th>
              <th className="PJE-posted">Posted</th>
              <th className="PJE-type">Type</th>
              <th className="PJE-debited">Debited Accounts</th>
              <th className="PJE-credited">Credited Accounts</th>
              <th className="PJE-amount">Amount</th>
              <th className="PJE-rules">Rules</th>
              <th className="PJE-ledger">Ledger</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((entry) => {
              const totalDebit = (entry.lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
              const rules = summarizeAccountingRules(entry.lines || []);
              return (
                <tr key={entry.journalEntryID}>
                  <td className="pr">
                    <button
                      type="button"
                      className="link"
                      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit' }}
                      onClick={() => navigate(`/journal-entry/${entry.journalEntryID}`)}
                    >
                      {entry.journalEntryID}
                    </button>
                  </td>
                  <td className="PJE-created">{formatDate(entry.createdAt)}</td>
                  <td className="PJE-posted">{formatDate(entry.postedAt)}</td>
                  <td className="PJE-type">{getJournalEntryTypeLabel(entry.entryType, { emptyLabel: '—' })}</td>
                  <td className="PJE-debited">
                    {(entry.lines || []).length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(entry.lines || [])
                          .filter((l) => l.accountID && l.accountName && l.accountNumber && Number(l.debit) > 0)
                          .map((line) => (
                            canOpenLedger ? (
                              <button
                                key={`debited-${entry.journalEntryID}-${line.accountID}`}
                                type="button"
                                className="link"
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                onClick={() => navigate(`${ledgerBasePath}/${line.accountNumber}`)}
                                title="Open account ledger"
                              >
                                {line.accountNumber} — {line.accountName}
                              </button>
                            ) : (
                              <span key={`debited-${entry.journalEntryID}-${line.accountID}`}>
                                {line.accountNumber} — {line.accountName}
                              </span>
                            )
                          ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="PJE-credited">
                    {(entry.lines || []).length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(entry.lines || [])
                          .filter((l) => l.accountID && l.accountName && l.accountNumber && Number(l.credit) > 0)
                          .map((line) => (
                            canOpenLedger ? (
                              <button
                                key={`credited-${entry.journalEntryID}-${line.accountID}`}
                                type="button"
                                className="link"
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                onClick={() => navigate(`${ledgerBasePath}/${line.accountNumber}`)}
                                title="Open account ledger"
                              >
                                {line.accountNumber} — {line.accountName}
                              </button>
                            ) : (
                              <span key={`credited-${entry.journalEntryID}-${line.accountID}`}>
                                {line.accountNumber} — {line.accountName}
                              </span>
                            )
                          ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="PJE-amount money">{formatMoney(totalDebit)}</td>
                  <td className="PJE-rules">
                    <span style={{ color: rules.compliant ? 'var(--bff-green)' : 'var(--bff-red)', fontWeight: 600 }}>
                      {rules.compliant ? 'OK' : 'Review'}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 400, marginTop: 4 }}>
                      {rules.labels.join(' · ')}
                    </span>
                  </td>
                  <td className="PJE-ledger">
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => navigate(`/admin/journal-entry/${entry.journalEntryID}`)}
                    >
                      View GL Details
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
