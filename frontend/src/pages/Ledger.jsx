import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getLedgerByAccountNumber, subscribeToAccountLedger } from '../services/ledgerService';
import { supabase } from '../supabaseClient';
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountSearch, setAmountSearch] = useState('');
  const [accountNameQuery, setAccountNameQuery] = useState('');
  const [accountPickList, setAccountPickList] = useState([]);

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


  useEffect(() => {
    if (!account?.accountID) return undefined;
    return subscribeToAccountLedger(account.accountID, loadLedger);
  }, [account?.accountID, loadLedger]);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: listError } = await supabase
        .from('chartOfAccounts')
        .select('accountNumber, accountName, active')
        .order('accountNumber', { ascending: true });

      if (cancelled || listError || !data) return;

      const canView = (row) => row.active === true || user?.role === 'administrator';
      setAccountPickList(data.filter(canView));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role]);


  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (dateFrom) {
        const rowDay = new Date(e.entryDate);
        const start = new Date(`${dateFrom}T00:00:00`);
        if (rowDay < start) return false;
      }
      if (dateTo) {
        const rowDay = new Date(e.entryDate);
        const end = new Date(`${dateTo}T23:59:59.999`);
        if (rowDay > end) return false;
      }
      const rawAmt = amountSearch.trim();
      if (rawAmt !== '') {
        const n = parseFloat(rawAmt.replace(/[^0-9.-]/g, ''));
        if (!Number.isFinite(n)) {
          return false;
        }
        const debit = parseFloat(e.debit) || 0;
        const credit = parseFloat(e.credit) || 0;
        const match =
          Math.abs(debit - n) < 0.005 ||
          Math.abs(credit - n) < 0.005;
        if (!match) return false;
      }
      return true;
    });
  }, [entries, dateFrom, dateTo, amountSearch]);


  const accountMatches = useMemo(() => {
    const q = accountNameQuery.trim().toLowerCase();
    if (!q) return [];
    return accountPickList.filter(
      (row) =>
        (row.accountName && row.accountName.toLowerCase().includes(q)) ||
        (row.accountNumber && row.accountNumber.toString().includes(q))
    );
  }, [accountPickList, accountNameQuery]);


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

  const totalDebits = filteredEntries.reduce((sum, e) => sum + (parseFloat(e.debit) || 0), 0);
  const totalCredits = filteredEntries.reduce((sum, e) => sum + (parseFloat(e.credit) || 0), 0);

  const openingNum = parseFloat(account?.initBalance) || 0;

  const endingBalance =
    filteredEntries.length > 0
      ? filteredEntries[filteredEntries.length - 1].displayBalance
      : openingNum;

  if (loading) return <p>Loading ledger...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!account) {
    return <p style={{ color: 'red' }}>Unable to load this account.</p>;
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>General Ledger</h1>
        <HelpTooltip text="Return to the chart of accounts list.">
          <button type="button" onClick={() => navigate('/admin/chart-of-accounts')} className="button-primary" style={{ marginLeft: '12px' }}>
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

      <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
        <div>
          <label htmlFor="ledger-date-from" style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
            From date
          </label>
          <input
            id="ledger-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              padding: '6px 8px',
              minWidth: '140px',
              border: `1px solid var(--bff-border)`,
              borderRadius: '4px',
              font: 'inherit',
              backgroundColor: 'var(--bff-light-text)'
            }}
          />
        </div>
        <div>
          <label htmlFor="ledger-date-to" style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
            To date
          </label>
          <input
            id="ledger-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              padding: '6px 8px',
              minWidth: '140px',
              border: `1px solid var(--bff-border)`,
              borderRadius: '4px',
              font: 'inherit',
              backgroundColor: 'var(--bff-light-text)'
            }}
          />
        </div>
        <div>
          <label htmlFor="ledger-amount" style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
            Amount
          </label>
          <input
            id="ledger-amount"
            type="text"
            inputMode="decimal"
            placeholder="Match debit or credit"
            value={amountSearch}
            onChange={(e) => setAmountSearch(e.target.value)}
            style={{
              padding: '6px 8px',
              width: '160px',
              border: `1px solid var(--bff-border)`,
              borderRadius: '4px',
              font: 'inherit',
              backgroundColor: 'var(--bff-light-text)'
            }}
          />
        </div>
        <HelpTooltip text="Clear date and amount filters.">
          <button
            type="button"
            className="button"
            onClick={() => {
              setDateFrom('');
              setDateTo('');
              setAmountSearch('');
            }}
            style={{ padding: '8px 14px' }}
          >
            Clear filters
          </button>
        </HelpTooltip>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label htmlFor="ledger-account-search" style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>
          Search by account name or number (open another ledger)
        </label>
        <input
          id="ledger-account-search"
          type="text"
          placeholder="e.g. Cash or 1000"
          value={accountNameQuery}
          onChange={(e) => setAccountNameQuery(e.target.value)}
          style={{
            padding: '8px',
            width: '100%',
            maxWidth: '400px',
            border: `1px solid var(--bff-border)`,
            borderRadius: '4px',
            font: 'inherit',
            backgroundColor: 'var(--bff-light-text)'
          }}
        />
        {accountMatches.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              margin: '8px 0 0',
              padding: 0,
              border: `1px solid var(--bff-border)`,
              borderRadius: '6px',
              maxWidth: '400px',
              maxHeight: '180px',
              overflowY: 'auto',
              background: 'var(--bff-light-text)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            {accountMatches.slice(0, 12).map((row) => (
              <li key={row.accountNumber}>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/ledger/${row.accountNumber}`)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    border: 'none',
                    borderBottom: `1px solid var(--bff-border)`,
                    background: 'var(--bff-light-text)',
                    cursor: 'pointer',
                    fontSize: 'inherit',
                    fontFamily: 'inherit',
                    color: 'var(--bff-dark-text)',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bff-table-hover)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--bff-light-text)'}
                >
                  {row.accountNumber} — {row.accountName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {entries.length === 0 ? (
        <p>No ledger activity has been posted for this account yet.</p>
      ) : null}

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Post Reference (PR)</th>
            <th>Description</th>
            <th>Debit</th>
            <th>Credit</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ fontStyle: 'italic', backgroundColor: 'var(--bff-background)' }}>
            <td>-</td>
            <td>-</td>
            <td>Opening Balance</td>
            <td>{account.normalSide === 'Debit' ? formatCurrency(account.initBalance) : '-'}</td>
            <td>{account.normalSide === 'Credit' ? formatCurrency(account.initBalance) : '-'}</td>
            <td>{formatCurrency(account.initBalance)}</td>
          </tr>
          {filteredEntries.length === 0 && entries.length > 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--bff-border)' }}>
                No rows match the current filters. Adjust date range or amount.
              </td>
            </tr>
          ) : null}
          {filteredEntries.map((entry) => (
            <tr key={entry.ledgerID}>
              <td>{formatDate(entry.entryDate)}</td>
              <td>
                {entry.journalEntryID ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/journal-entry/${entry.journalEntryID}`)}
                    className="link"
                    style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                    aria-label={`Open journal entry ${entry.journalEntryID}`}
                  >
                    {entry.journalEntryID}
                  </button>
                ) : (
                  '-'
                )}
              </td>
              <td>{entry.description?.trim() ? entry.description : ''}</td>
              <td>{formatDebitCreditCell(entry.debit)}</td>
              <td>{formatDebitCreditCell(entry.credit)}</td>
              <td>{formatCurrency(entry.displayBalance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--bff-dark-text)' }}>
            <td colSpan={3}>Totals (filtered)</td>
            <td>{formatCurrency(totalDebits)}</td>
            <td>{formatCurrency(totalCredits)}</td>
            <td>{formatCurrency(endingBalance)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default Ledger;
