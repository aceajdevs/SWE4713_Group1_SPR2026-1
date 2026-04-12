import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  getEnrichedJournalEntries,
  approveJournalEntry,
  rejectJournalEntry,
  searchJournalEntries,
  filterByDateRange,
} from '../services/journalService';
import { HelpTooltip } from '../components/HelpTooltip';
import { getErrorMessage, resolveThrownErrorMessage, logErrorWithCode, ERROR_IDS } from '../services/errorMessages';
import '../global.css';

function JournalEntries() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
  const canView = isManager || isAccountant || user?.role === 'administrator';
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
      await logErrorWithCode(ERROR_IDS.LOAD_JOURNAL_ENTRIES_FAILED, err);
      setErrors([await resolveThrownErrorMessage(err, ERROR_IDS.LOAD_JOURNAL_ENTRIES_FAILED)]);
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
      await logErrorWithCode(err?.errorID ?? ERROR_IDS.APPROVE_JOURNAL_FAILED, err);
      alert(await resolveThrownErrorMessage(err, ERROR_IDS.APPROVE_JOURNAL_FAILED));
    }
  };

  const handleReject = async (entryId) => {
    if (!rejectReason.trim()) {
      alert(await getErrorMessage(ERROR_IDS.REJECT_REASON_REQUIRED));
      return;
    }
    try {
      await rejectJournalEntry(entryId, rejectReason);
      alert('Journal entry rejected.');
      setRejectingId(null);
      setRejectReason('');
      loadEntries();
    } catch (err) {
      await logErrorWithCode(err?.errorID ?? ERROR_IDS.REJECT_JOURNAL_FAILED, err);
      alert(await resolveThrownErrorMessage(err, ERROR_IDS.REJECT_JOURNAL_FAILED));
    }
  };

  // Apply client-side search and date filters
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
    if (status === 'approved') return 'green';
    if (status === 'rejected') return 'red';
    return '#c58b00';
  };

  if (!canView) {
    return <p style={{ color: 'red' }}>You do not have permission to view journal entries.</p>;
  }

  return (
    <div className="container">
      <h1>Journal Entries</h1>

      {errors.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {errors.map((err, i) => (
            <p key={i} style={{ color: 'red' }}>{err}</p>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {(isAccountant || isManager) && (
          <HelpTooltip text="Create a new journal entry with debits and credits.">
            <button onClick={() => navigate('/journal-entry/new')} className="button-primary">
              New Journal Entry
            </button>
          </HelpTooltip>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '12px' }}>Status:</label>
          <HelpTooltip text="Filter entries by their approval status.">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </HelpTooltip>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px' }}>From:</label>
          <HelpTooltip text="Show entries created on or after this date.">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </HelpTooltip>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px' }}>To:</label>
          <HelpTooltip text="Show entries created on or before this date.">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </HelpTooltip>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px' }}>Search:</label>
          <HelpTooltip text="Search by account name, amount, or date.">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Account name, amount, or date"
              className="input-field"
            />
          </HelpTooltip>
        </div>
      </div>

      {loading ? (
        <p>Loading journal entries...</p>
      ) : displayed.length === 0 ? (
        <p>No journal entries found.</p>
      ) : (
        <table className="user-report-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Entry Type</th>
              <th>Accounts</th>
              <th>Total</th>
              <th>Status</th>
              <th>Created By</th>
              {isManager && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {displayed.map((entry) => {
              const totalDebit = (entry.lines || []).reduce((s, l) => s + (l.debit || 0), 0);
              return (
                <tr key={entry.journalEntryID}>
                  <td>
                    <button
                      type="button-primary"
                      onClick={() => navigate(`/journal-entry/${entry.journalEntryID}`)}
                      style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {entry.journalEntryID}
                    </button>
                  </td>
                  <td>{formatDate(entry.createdAt)}</td>
                  <td>{entry.entryType || '-'}</td>
                  <td>
                    {(entry.lines || []).length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {(entry.lines || [])
                          .filter((l) => l.accountID && l.accountName && l.accountNumber)
                          .filter((line, index, all) => all.findIndex((x) => x.accountID === line.accountID) === index)
                          .map((line) => (
                            <button
                              key={`${entry.journalEntryID}-${line.accountID}`}
                              type="button"
                              onClick={() => navigate(`${ledgerBasePath}/${line.accountNumber}`)}
                              style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                              title="Open account ledger"
                            >
                              {line.accountNumber} - {line.accountName}
                            </button>
                          ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>${totalDebit.toFixed(2)}</td>
                  <td style={{ color: statusColor(entry.status), fontWeight: 'bold' }}>
                    {entry.status}
                    {entry.status === 'rejected' && entry.rejectReason && (
                      <span style={{ display: 'block', fontWeight: 'normal', fontSize: '12px' }}>
                        Reason: {entry.rejectReason}
                      </span>
                    )}
                  </td>
                  <td>{entry.createdBy}</td>
                  {isManager && (
                    <td>
                      {entry.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <HelpTooltip text="Approve this journal entry and post it to the ledger.">
                            <button
                            className="button-table"
                              style={{ width: '30px', height: '30px', justifyContent: 'center', fontSize: '16px'}}
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
                                className="input-field"
                                style={{ marginBottom: '4px' }}
                              />
                              <HelpTooltip text="Confirm the rejection with the reason provided.">
                                <button
                                  onClick={() => handleReject(entry.journalEntryID)}
                                  style={{ color: 'red' }}
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
                                className="button-table"
                                style={{ width: '30px', height: '30px', justifyContent: 'center', fontSize: '16px'}}
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
