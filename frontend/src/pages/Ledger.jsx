// TODO: hook up get-accounts edge function for inactive account protection once deployed

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getLedgerByAccountNumber } from '../services/ledgerService';
import { HelpTooltip } from '../components/HelpTooltip';
import '../global.css';

function Ledger() {
  const { accountNumber } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [account, setAccount] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { account: loadedAccount, entries: loadedEntries, error: loadError } = await getLedgerByAccountNumber(
      accountNumber,
      user?.role
    );

    if (loadError) {
      setError(loadError.message);
      setAccount(null);
      setEntries([]);
    } else {
      setAccount(loadedAccount);
      setEntries(loadedEntries);
    }
    setLoading(false);
  }, [accountNumber, user?.role]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

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

  if (loading) return <p>Loading ledger...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div className="container">
      <div className="header-row">
        <h1>General Ledger</h1>
        <HelpTooltip text="Return to the chart of accounts list.">
          <button type="button" onClick={() => navigate('/admin/chart-of-accounts')} className="button">
            Back to Chart of Accounts
          </button>
        </HelpTooltip>
      </div>

      <div style={{ marginBottom: '24px', lineHeight: '1.8' }}>
        <p><strong>Account Number:</strong> {account.accountNumber}</p>
        <p><strong>Account Name:</strong> {account.accountName}</p>
        <p><strong>Normal Side:</strong> {account.normalSide}</p>
        <p><strong>Opening Balance:</strong> {formatCurrency(account.initBalance)}</p>
      </div>

      {entries.length === 0 ? (
        <p>No ledger entries found for this account.</p>
      ) : (
        <>
          <table className="user-report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Post Reference (PR)</th>
                <th>Description</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ fontStyle: 'italic', backgroundColor: '#f9f9f9' }}>
                <td>-</td>
                <td>-</td>
                <td>Opening Balance</td>
                <td>{account.normalSide === 'Debit' ? formatCurrency(account.initBalance) : '-'}</td>
                <td>{account.normalSide === 'Credit' ? formatCurrency(account.initBalance) : '-'}</td>
                <td>{formatCurrency(account.initBalance)}</td>
              </tr>
              {entries.map((entry) => (
                <tr key={entry.ledgerID}>
                  <td>{formatDate(entry.entryDate)}</td>
                  <td>
                    {entry.journalEntryID ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/journal-entry/${entry.journalEntryID}`)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          color: '#007bff',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                        aria-label={`Open journal entry ${entry.journalEntryID}`}
                      >
                        {entry.journalEntryID}
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{entry.description || 'N/A'}</td>
                  <td>{entry.debit ? formatCurrency(entry.debit) : '-'}</td>
                  <td>{entry.credit ? formatCurrency(entry.credit) : '-'}</td>
                  <td>{formatCurrency(entry.runningBalance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold', borderTop: '2px solid #333' }}>
                <td colSpan={3}>Totals</td>
                <td>{formatCurrency(totalDebits)}</td>
                <td>{formatCurrency(totalCredits)}</td>
                <td>{entries.length > 0 ? formatCurrency(entries[entries.length - 1].runningBalance) : formatCurrency(account.initBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  );
}

export default Ledger;