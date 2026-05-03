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
    return 'var(--bff-light-primary)';
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

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'flex-end' }}>
        {(isAccountant || isManager) && (
          <HelpTooltip text="Create a new journal entry with debits and credits.">
            <button onClick={() => navigate('/journal-entry/new')} className="button-primary">
              New Journal Entry
            </button>
          </HelpTooltip>
        )}
        <div>
          <h5 className='h5'>Search:</h5>
          <div className="clear-input-container" role="group">
            <div>
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
            </div>
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

      {loading ? (
        <p>Loading journal entries...</p>
      ) : displayed.length === 0 ? (
        <p>No journal entries found.</p>
      ) : (
        <table className={`user-report-table${isManager ? ' has-actions' : ''}`}> 
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
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {(entry.lines || [])
                          .filter((l) => l.accountID && l.accountName && l.accountNumber)
                          .filter((line, index, all) => all.findIndex((x) => x.accountID === line.accountID) === index)
                          .map((line) => (
                            canOpenLedger ? (
                              <button
                                key={`${entry.journalEntryID}-${line.accountID}`}
                                type="button"
                                onClick={() => navigate(`${ledgerBasePath}/${line.accountNumber}`)}
                                style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                                title="Open account ledger"
                              >
                                {line.accountNumber} - {line.accountName}
                              </button>
                            ) : (
                              <span key={`${entry.journalEntryID}-${line.accountID}`}>
                                {line.accountNumber} - {line.accountName}
                              </span>
                            )
                          ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="JE-money">${totalDebit.toFixed(2)}</td>
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
                          {rejectingId === entry.journalEntryID ? (
                            <div>
                              <input
                                type="text"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Reason for rejection (required)"
                                className="input"
                              />
                              <HelpTooltip text="Confirm the rejection with the reason provided.">
                                <button
                                  onClick={() => handleReject(entry.journalEntryID)}
                                  style={{ color: 'var(--bff-red)' }}
                                >
                                  Confirm Reject
                                </button>
                              </HelpTooltip>
                              <button onClick={() => { setRejectingId(null); setRejectReason(''); }}>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <HelpTooltip text="Reject this entry. You must provide a reason.">
                              <button
                                className="button-table-action-reject"
                                style={{ marginRight: '8px', width: '25px', height: '25px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => setRejectingId(entry.journalEntryID)}
                              >
                                X
                              </button>
                            </HelpTooltip>
                          )}
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
    </div>
  );
}

export default JournalEntries;
