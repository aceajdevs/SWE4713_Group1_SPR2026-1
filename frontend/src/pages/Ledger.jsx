// TODO: hook up get-accounts edge function for inactive account protection once deployed

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchFromTable } from '../supabaseUtils';
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

  useEffect(() => {
    loadLedger();
  }, [accountNumber]);

  const loadLedger = async () => {
    setLoading(true);
    setError(null);

    const { data: accountData, error: accountError } = await fetchFromTable('chartOfAccounts', {
      select: 'accountID, accountNumber, accountName, normalSide, initBalance, active',
      filters: { accountNumber: parseInt(accountNumber, 10) },
      single: true
    });

    if (accountError || !accountData) {
      setError('Account not found.');
      setLoading(false);
      return;
    }

    if (!accountData.active && user?.role !== 'administrator') {
      setError('You do not have permission to view this account.');
      setLoading(false);
      return;
    }

    setAccount(accountData);

    const { data: ledgerData, error: ledgerError } = await fetchFromTable('Ledger', {
      select: 'ledgerID, journalEntryID, entryDate, description, debit, credit, runningBalance',
      filters: { accountID: accountData.accountID },
      orderBy: { column: 'entryDate', ascending: false }
    });

    if (ledgerError) {
      setError('Failed to load ledger entries.');
      console.error('Ledger fetch error:', ledgerError);
    } else {
      setEntries(ledgerData || []);
    }

    setLoading(false);
  };

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
                <th>Journal Entry #</th>
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
                  <td>{entry.journalEntryID}</td>
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