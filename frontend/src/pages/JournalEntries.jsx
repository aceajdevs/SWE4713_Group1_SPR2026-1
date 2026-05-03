import React, { useState, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  getEnrichedJournalEntries,
  approveJournalEntry,
  rejectJournalEntry,
  searchJournalEntries,
  filterByDateRange,
} from '../services/journalService';
import { getJournalEntryTypeLabel } from '../utils/journalEntryTypes';
import { HelpTooltip } from '../components/HelpTooltip';
import '../global.css';
import './JournalEntries.css';

function JournalEntries() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const formId = useId();

  const [entries, setEntries] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  const isManager = user?.role === 'manager';
  const isAccountant = user?.role === 'accountant';
  const isAdmin = user?.role === 'administrator';
  const canView = isManager || isAccountant || isAdmin;
  const canOpenLedger = !isAdmin;
  const ledgerBasePath = '/admin/ledger';

  useEffect(() => {
    loadEntries();
  }, [statusFilter]);

  useEffect(() => {
    if (rejectingId === null) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setRejectingId(null);
        setRejectReason('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rejectingId]);

  const loadEntries = async () => {
    setLoading(true);
    setErrors([]);
    try {
      const data = await getEnrichedJournalEntries(statusFilter);
      setEntries(data);
    } catch (err) {
      console.error('Failed to load entries:', err);
      setErrors([`Failed to load journal entries: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (entryId) => {
    try {
      await approveJournalEntry(entryId, user.userID);
      alert('Journal entry approved.');
      loadEntries();
    } catch (err) {
      alert(`Error approving: ${err.message}`);
    }
  };

  const handleReject = async (entryId) => {
    if (!rejectReason.trim()) {
      alert('You must enter a reason for rejection.');
      return;
    }
    try {
      await rejectJournalEntry(entryId, rejectReason);
      alert('Journal entry rejected.');
      setRejectingId(null);
      setRejectReason('');
      loadEntries();
    } catch (err) {
      alert(`Error rejecting: ${err.message}`);
    }
  };

  let displayed = entries;
  if (searchQuery.trim()) {
    displayed = searchJournalEntries(displayed, searchQuery);
  }
  if (startDate || endDate) {
    displayed = filterByDateRange(displayed, startDate, endDate);
  }

  const formatDate = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  };

  const statusColor = (status) => {
    if (status === 'approved') return 'var(--bff-green)';
    if (status === 'rejected') return 'var(--bff-red)';
    return 'var(--bff-accent)';
  };

  if (!canView) {
    return <p style={{ color: 'var(--bff-red)' }}>You do not have permission to view journal entries.</p>;
  }

  return (
    <div className="container">
      <h1>Journal Entries</h1>

      {errors.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {errors.map((err, i) => (
            <p key={i} style={{ color: 'var(--bff-red)' }}>{err}</p>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '10px', margin: '0 auto 16px auto', width: '90vw', maxWidth: '90vw', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <h5 className='h5'>Search:</h5>
            <div className="clear-input-container" role="group">
              <HelpTooltip text="Search by account name, amount, or date.">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Account name, amount, date..."
                  className="input"
                  style={{ width: '400px' }}
                />
              </HelpTooltip>
              <button type="button" className="button-clear" onClick={() => setSearchQuery('')} aria-label="Clear search input">X</button>
            </div>
          </div>

          <div>
            <h5 className='h5'>Status:</h5>
            <HelpTooltip text="Filter entries by their approval status.">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </HelpTooltip>
          </div>

          <div>
            <h5 className='h5'>From:</h5>
            <HelpTooltip text="Show entries created on or after this date.">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
              />
            </HelpTooltip>
          </div>

          <div>
            <h5 className='h5'>To:</h5>
            <HelpTooltip text="Show entries created on or before this date.">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
              />
            </HelpTooltip>
          </div>
        </div>

        {(isAccountant || isManager) && (
          <HelpTooltip text="Create a new journal entry with debits and credits.">
            <button onClick={() => navigate('/journal-entry/new')} className="button-primary">
              New Journal Entry
            </button>
          </HelpTooltip>
        )}
      </div>

      {loading ? (
        <p>Loading journal entries...</p>
      ) : displayed.length === 0 ? (
        <p>No journal entries found.</p>
      ) : (
        <table style={{ width: '90vw', borderCollapse: 'collapse' }} className={`table user-report-table${isManager ? ' has-actions' : ''}`}> 
          <thead>
            <tr>
              <th className="JE-id">ID</th>
              <th className="JE-date">Date</th>
              <th className="JE-type">Entry Type</th>
              <th className="JE-accounts">Accounts</th>
              <th className="JE-money">Total</th>
              <th className="JE-status">Status</th>
              <th className="JE-createdby">Created By</th>
              {isManager && <th className="JE-actions">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {displayed.map((entry) => {
              const totalDebit = (entry.lines || []).reduce((s, l) => s + (l.debit || 0), 0);
              return (
                <tr key={entry.journalEntryID}>
                  <td className="JE-id">
                    <button
                      type="button-primary"
                      onClick={() => navigate(`/journal-entry/${entry.journalEntryID}`)}
                      style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {entry.journalEntryID}
                    </button>
                  </td>
                  <td className="JE-date">{formatDate(entry.createdAt)}</td>
                  <td className="JE-type">{getJournalEntryTypeLabel(entry.entryType, { emptyLabel: '-' })}</td>
                  <td className="JE-accounts">
                    {(entry.lines || []).length > 0 ? (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {(entry.lines || [])
                            .filter((l) => l.accountID && l.accountName && l.accountNumber && Number(l.debit) > 0)
                            .filter((line, index, all) => all.findIndex((x) => x.accountID === line.accountID) === index)
                            .map((line) => (
                              canOpenLedger ? (
                                <button
                                  key={`debit-${entry.journalEntryID}-${line.accountID}`}
                                  type="button"
                                  onClick={() => navigate(`${ledgerBasePath}/${line.accountNumber}`)}
                                  style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', textDecoration: 'underline', padding: 0, display: 'block', textAlign: 'left' }}
                                  title="Open account ledger"
                                >
                                  {line.accountNumber} - {line.accountName}
                                </button>
                              ) : (
                                <span key={`debit-${entry.journalEntryID}-${line.accountID}`} style={{ display: 'block' }}>
                                  {line.accountNumber} - {line.accountName}
                                </span>
                              )
                            ))}
                          {(entry.lines || []).filter((l) => l.accountID && l.accountName && l.accountNumber && Number(l.debit) > 0).length === 0 && '-'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '18px', marginTop: '4px' }}>
                          {(entry.lines || [])
                            .filter((l) => l.accountID && l.accountName && l.accountNumber && Number(l.credit) > 0)
                            .filter((line, index, all) => all.findIndex((x) => x.accountID === line.accountID) === index)
                            .map((line) => (
                              canOpenLedger ? (
                                <button
                                  key={`credit-${entry.journalEntryID}-${line.accountID}`}
                                  type="button"
                                  onClick={() => navigate(`${ledgerBasePath}/${line.accountNumber}`)}
                                  style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', textDecoration: 'underline', padding: 0, display: 'block', textAlign: 'left' }}
                                  title="Open account ledger"
                                >
                                  {line.accountNumber} - {line.accountName}
                                </button>
                              ) : (
                                <span key={`credit-${entry.journalEntryID}-${line.accountID}`} style={{ display: 'block' }}>
                                  {line.accountNumber} - {line.accountName}
                                </span>
                              )
                            ))}
                          {(entry.lines || []).filter((l) => l.accountID && l.accountName && l.accountNumber && Number(l.credit) > 0).length === 0 && '-'}
                        </div>
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="JE-money money">${totalDebit.toFixed(2)}</td>
                  <td className="JE-status" style={{ color: statusColor(entry.status), fontWeight: 'bold' }}>
                    {entry.status}
                    {entry.status === 'rejected' && entry.rejectReason && (
                      <span style={{ display: 'block', fontWeight: 'normal', fontSize: '12px' }}>
                        Reason: {entry.rejectReason}
                      </span>
                    )}
                  </td>
                  <td className="JE-createdby">{entry.createdBy}</td>
                  {isManager && (
                    <td className="JE-actions">
                      {entry.status === 'pending' && (
                        <div className="action-buttons" style={{ display: 'flex', alignItems: 'center'}}>
                          <HelpTooltip text="Approve this journal entry and post it to the ledger.">
                            <button
                            className="button-table-action-approve"
                            style={{ marginRight: '8px', width: '25px', height: '25px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => handleApprove(entry.journalEntryID)}
                            >
                              ✓
                            </button>
                          </HelpTooltip>
                          <HelpTooltip text="Reject this entry. You must provide a reason.">
                            <button
                              className="button-table-action-reject"
                              style={{ marginRight: '8px', width: '25px', height: '25px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => {
                                setRejectingId(entry.journalEntryID);
                                setRejectReason('');
                              }}
                            >
                              X
                            </button>
                          </HelpTooltip>
                        </div>
                      )}
                      {entry.status !== 'pending' && <span>-</span>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      
      /* Reject Modal * /
      {isManager && rejectingId !== null && (
        <div
          role="presentation"
          onClick={() => {
            setRejectingId(null);
            setRejectReason('');
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${formId}-reject-title`}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              background: 'var(--bff-light-text)',
              borderRadius: '12px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
              padding: '20px',
            }}
          >
            <h3 id={`${formId}-reject-title`} style={{ marginBottom: '10px' }}>Reject Journal Entry #{rejectingId}</h3>
            <p style={{ marginBottom: '10px', fontSize: '0.95rem' }}>
              Enter a rejection reason. This note will be visible in the journal entries report.
            </p>
            <textarea
              id={`${formId}-reject-reason`}
              className="input"
              style={{ minHeight: '110px', resize: 'vertical' }}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)"
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  setRejectingId(null);
                  setRejectReason('');
                }}
              >
                Cancel
              </button>
              <HelpTooltip text="Confirm the rejection with the reason provided.">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => handleReject(rejectingId)}
                >
                  Confirm Reject
                </button>
              </HelpTooltip>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JournalEntries;
