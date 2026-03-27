import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchFromTable } from '../supabaseUtils';
import '../global.css';

function JournalEntry() {
  const { journalEntryID } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entries, setEntries] = useState([]);
  const [accountsById, setAccountsById] = useState({});

  const pr = useMemo(() => {
    if (journalEntryID === undefined || journalEntryID === null || journalEntryID === '') return null;
    return journalEntryID;
  }, [journalEntryID]);

  useEffect(() => {
    const loadJournalEntry = async () => {
      setLoading(true);
      setError(null);

      if (!pr) {
        setError('Journal entry not found.');
        setLoading(false);
        return;
      }

      const prNum = parseInt(pr, 10);
      if (!Number.isFinite(prNum)) {
        setError('Invalid post reference (PR).');
        setLoading(false);
        return;
      }

      // We treat the ledger's `journalEntryID` as the post reference (PR).
      const { data: ledgerData, error: ledgerError } = await fetchFromTable('Ledger', {
        select: 'ledgerID, journalEntryID, accountID, entryDate, description, debit, credit, runningBalance',
        filters: { journalEntryID: prNum },
        orderBy: { column: 'entryDate', ascending: false }
      });

      if (ledgerError) {
        console.error('Journal entry fetch error:', ledgerError);
        setError('Failed to load journal entry.');
        setLoading(false);
        return;
      }

      const loadedEntries = ledgerData || [];
      setEntries(loadedEntries);

      const uniqueAccountIDs = Array.from(
        new Set((loadedEntries || [])
          .map((e) => e.accountID)
          .filter((id) => id !== null && id !== undefined))
      );

      if (uniqueAccountIDs.length === 0) {
        setAccountsById({});
        setLoading(false);
        return;
      }

      // Supabase utils don't support `in` clauses; load account details one-by-one.
      const accountResults = await Promise.all(
        uniqueAccountIDs.map(async (id) => {
          const { data: accountData, error: accountError } = await fetchFromTable('chartOfAccounts', {
            select: 'accountID, accountNumber, accountName, active',
            filters: { accountID: id },
            single: true
          });

          return {
            accountID: id,
            data: accountData || null,
            error: accountError || null
          };
        })
      );

      const byId = {};
      for (const r of accountResults) {
        byId[r.accountID] = r.data;
      }
      setAccountsById(byId);
      setLoading(false);
    };

    loadJournalEntry();
  }, [pr]);

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    return `$${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

  const headerEntryDate = entries[0]?.entryDate;
  const canViewInactiveAccounts = user?.role === 'administrator';

  if (loading) return <p>Loading journal entry...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div className="container">
      <div className="header-row">
        <h1>Journal Entry</h1>
        <button type="button" onClick={() => navigate(-1)} className="button">
          Back
        </button>
      </div>

      <div style={{ marginBottom: '24px', lineHeight: '1.8' }}>
        <p><strong>Post Reference (PR):</strong> {pr}</p>
        <p><strong>Date:</strong> {formatDate(headerEntryDate)}</p>
        <p><strong>Total Debits:</strong> {formatCurrency(totalDebits)}</p>
        <p><strong>Total Credits:</strong> {formatCurrency(totalCredits)}</p>
      </div>

      {entries.length === 0 ? (
        <p>No ledger lines found for this post reference.</p>
      ) : (
        <table className="user-report-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Description</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Running Balance</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const account = accountsById[entry.accountID];
              const accountLabel = account
                ? `${account.accountNumber} - ${account.accountName}`
                : `Account ID ${entry.accountID}`;

              // If RLS allowed the ledger lines but account lookup is incomplete, we still show something.
              const hiddenInactive = !canViewInactiveAccounts && account && account.active === false;

              return (
                <tr key={entry.ledgerID} style={hiddenInactive ? { display: 'none' } : undefined}>
                  <td>{accountLabel}</td>
                  <td>{entry.description || 'N/A'}</td>
                  <td>{entry.debit ? formatCurrency(entry.debit) : '-'}</td>
                  <td>{entry.credit ? formatCurrency(entry.credit) : '-'}</td>
                  <td>{formatCurrency(entry.runningBalance)}</td>
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

