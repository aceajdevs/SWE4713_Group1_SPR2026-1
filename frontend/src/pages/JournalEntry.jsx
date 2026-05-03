import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  getLedgerByAccountId,
  sortLedgerEntriesChronological,
  fetchLedgerEntriesByJournalEntryId,
} from '../services/ledgerService';
import { getErrorMessage, logErrorWithCode, ERROR_IDS } from '../services/errorMessages';
import StaffEmailModal from '../components/StaffEmailModal';
import '../global.css';

function JournalEntry() {
  const { journalEntryID } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entries, setEntries] = useState([]);
  const [accountsById, setAccountsById] = useState({});
  const [accountLedgerRowsById, setAccountLedgerRowsById] = useState({});
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const isAccountant = user?.role === 'accountant';

  const pr = useMemo(() => {
    if (journalEntryID === undefined || journalEntryID === null || journalEntryID === '') return null;
    return journalEntryID;
  }, [journalEntryID]);

  useEffect(() => {
    const loadJournalEntry = async () => {
      setLoading(true);
      setError(null);
      setAccountLedgerRowsById({});

      if (!pr) {
        setError(await getErrorMessage(ERROR_IDS.JOURNAL_NOT_FOUND));
        setLoading(false);
        return;
      }

      const prNum = parseInt(pr, 10);
      if (!Number.isFinite(prNum)) {
        setError(await getErrorMessage(ERROR_IDS.INVALID_POST_REFERENCE));
        setLoading(false);
        return;
      }

      const { data: ledgerData, error: ledgerError } = await fetchLedgerEntriesByJournalEntryId(prNum);

      if (ledgerError) {
        await logErrorWithCode(ERROR_IDS.LOAD_JOURNAL_ENTRY_FAILED, ledgerError);
        setError(await getErrorMessage(ERROR_IDS.LOAD_JOURNAL_ENTRY_FAILED));
        setLoading(false);
        return;
      }

      const loadedEntries = sortLedgerEntriesChronological(ledgerData || []);
      setEntries(loadedEntries);

      const uniqueAccountIDs = Array.from(
        new Set(loadedEntries.map((e) => e.accountID).filter((id) => id !== null && id !== undefined))
      );

      if (uniqueAccountIDs.length === 0) {
        setAccountsById({});
        setAccountLedgerRowsById({});
        setLoading(false);
        return;
      }

      const results = await Promise.all(
        uniqueAccountIDs.map((id) => getLedgerByAccountId(id, user?.role))
      );

      const byAccountId = {};
      const rowsByAccountId = {};

      for (const res of results) {
        if (res.error || !res.account) continue;
        const a = res.account;
        byAccountId[a.accountID] = {
          accountID: a.accountID,
          accountNumber: a.accountNumber,
          accountName: a.accountName,
          active: a.active
        };
        rowsByAccountId[a.accountID] = res.entries;
      }

      setAccountsById(byAccountId);
      setAccountLedgerRowsById(rowsByAccountId);
      setLoading(false);
    };

    loadJournalEntry();
  }, [pr, user?.role]);

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    return `$${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDebitCreditCell = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return '-';
    return formatCurrency(n);
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const formatDescription = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return '-';
    if (/^journal\s+entry\s*#?\s*\d+$/i.test(text)) return '-';
    return text;
  };

  const totalDebits = entries.reduce((sum, e) => sum + (parseFloat(e.debit) || 0), 0);
  const totalCredits = entries.reduce((sum, e) => sum + (parseFloat(e.credit) || 0), 0);

  const headerEntryDate = entries[0]?.entryDate;
  const canViewInactiveAccounts = user?.role === 'administrator';

  if (loading) return <p>Loading journal entry...</p>;
  if (error) return <p style={{ color: 'var(--bff-red)' }}>{error}</p>;

  return (
    <div className="container">
      <div className="header-row">
        <h1 style={{ margin: '0 20px' }}>Journal Entry</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isAccountant && (
            <button type="button" className="button-primary" onClick={() => setEmailModalOpen(true)}>Email User</button>
          )}
          <button type="button" className="button-primary" onClick={() => navigate(-1)}>Back</button>
        </div>
      </div>
      <StaffEmailModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        defaultSubject={`Question about Journal Entry ${pr}`}
      />
      <div style={{ marginBottom: '24px', lineHeight: '1.8' }}>
        <p><strong>Post Reference (PR):</strong> {pr}</p>
        <p><strong>Date:</strong> {formatDate(headerEntryDate)}</p>
        <p><strong>Total Debits:</strong> {formatCurrency(totalDebits)}</p>
        <p><strong>Total Credits:</strong> {formatCurrency(totalCredits)}</p>
      </div>

      {entries.length === 0 ? (
        <p>No ledger lines found for this post reference.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Description</th>
              <th className='money'>Debit</th>
              <th className='money'>Credit</th>
              <th className='money'>Balance</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const acct = accountsById[entry.accountID];
              const accountLabel = acct
                ? `${acct.accountNumber} - ${acct.accountName}`
                : `Account ID ${entry.accountID}`;

              const hiddenInactive = !canViewInactiveAccounts && acct && acct.active === false;
              const linesForAcct = accountLedgerRowsById[entry.accountID];
              const matchedRow = linesForAcct?.find(
                (r) => String(r.ledgerID) === String(entry.ledgerID)
              );
              const rowBalance = matchedRow?.displayBalance;

              return (
                <tr key={entry.ledgerID} style={hiddenInactive ? { display: 'none' } : undefined}>
                  <td>{accountLabel}</td>
                  <td>{formatDescription(entry.description)}</td>
                  <td className='money'>{formatDebitCreditCell(entry.debit)}</td>
                  <td className='money'>{formatDebitCreditCell(entry.credit)}</td>
                  <td className='money'>{rowBalance !== undefined && rowBalance !== null ? formatCurrency(rowBalance) : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default JournalEntry;
