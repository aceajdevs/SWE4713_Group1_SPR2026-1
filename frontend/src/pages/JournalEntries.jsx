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
import { JournalStackedAccountsCell } from '../components/JournalStackedAccountsCell';
import { HelpTooltip } from '../components/HelpTooltip';
import '../global.css';

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

        <fieldset
          style={{
            border: '1px solid var(--bff-border, #d1d5db)',
            borderRadius: 8,
            padding: '10px 12px',
            margin: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'flex-end',
          }}
        >
          <legend style={{ fontSize: '12px', padding: '0 6px', color: '#374151' }}>Date range</legend>
          <div>
            <label style={{ display: 'block', fontSize: '12px' }} htmlFor={`${formId}-from`}>
              From
            </label>
            <HelpTooltip text="Show entries created on or after this date.">
              <input
                id={`${formId}-from`}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
              />
            </HelpTooltip>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px' }} htmlFor={`${formId}-to`}>
              To
            </label>
            <HelpTooltip text="Show entries created on or before this date.">
              <input
                id={`${formId}-to`}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field"
              />
            </HelpTooltip>
          </div>
        </fieldset>

        <fieldset
          style={{
            border: '1px solid var(--bff-border, #d1d5db)',
            borderRadius: 8,
            padding: '10px 12px',
            margin: 0,
            minWidth: '200px',
            flex: '1 1 220px',
          }}
        >
          <legend style={{ fontSize: '12px', padding: '0 6px', color: '#374151' }}>Search</legend>
          <HelpTooltip text="Search by account name, amount, or date.">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Account name, amount, or date"
              className="input-field"
              style={{ width: '100%' }}
              id={`${formId}-search`}
              aria-label="Search journals by account name, amount, or date"
            />
          </HelpTooltip>
        </fieldset>
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
                  <td>{getJournalEntryTypeLabel(entry.entryType, { emptyLabel: '-' })}</td>
                  <JournalStackedAccountsCell
                    lines={entry.lines}
                    journalEntryId={entry.journalEntryID}
                    navigate={navigate}
                    ledgerBasePath={ledgerBasePath}
                    emptyLabel="-"
                  />
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
