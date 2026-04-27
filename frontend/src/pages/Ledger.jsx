import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  sortLedgerEntriesChronological,
  computeLedgerRunningBalances,
  subscribeToAccountLedger,
} from '../services/ledgerService';
import { supabase } from '../supabaseClient';
import { HelpTooltip } from '../components/HelpTooltip';
import '../global.css';

const LEDGER_SELECT =
  'ledgerID, accountID, journalEntryID, entryDate, description, debit, credit, runningBalance';

function shouldTryLowercaseLedgerTable(error) {
  const errMsg = (error?.message || '').toLowerCase();
  const isPermission =
    error?.code === '42501' ||
    errMsg.includes('permission denied') ||
    errMsg.includes('row-level security');
  return (
    !isPermission &&
    (error?.code === 'PGRST205' ||
      errMsg.includes('schema cache') ||
      errMsg.includes('does not exist') ||
      (errMsg.includes('could not find') && errMsg.includes('table')))
  );
}

/** Map DB/API row to the shape the table expects; supports camelCase or snake_case. */
function normalizeLedgerRow(row) {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    ledgerID: row.ledgerID ?? row.ledger_id,
    accountID: row.accountID ?? row.account_id,
    journalEntryID: row.journalEntryID ?? row.journal_entry_id,
    entryDate: row.entryDate ?? row.entry_date,
    description: row.description,
    debit: row.debit,
    credit: row.credit,
    runningBalance: row.runningBalance ?? row.running_balance,
  };
}

function ledgerReadErrorMessage(ledgerError) {
  if (!ledgerError) return 'Failed to load ledger entries.';
  const msg = ledgerError.message || '';
  const isRlsOrDenied =
    ledgerError.code === '42501' || /permission denied|violates row-level security|rls/i.test(msg);
  const rlsHint = isRlsOrDenied
    ? 'Check Row Level Security (RLS) policies on the Ledger table for SELECT for authenticated users.'
    : '';
  const base = msg || ledgerError.details || String(ledgerError);
  const extra = ledgerError.hint ? ` ${ledgerError.hint}` : '';
  return rlsHint ? `${base}${extra} ${rlsHint}` : `${base}${extra}`;
}

async function fetchChartAccountByAccountNumber(accountNumber) {
  const trimmed = String(accountNumber ?? '').trim();
  if (!trimmed) {
    return { accountData: null, error: new Error('Invalid account number.') };
  }

  const { data: byString, error: errString } = await supabase
    .from('chartOfAccounts')
    .select('accountID, accountNumber, accountName, normalSide, initBalance, active')
    .eq('accountNumber', trimmed)
    .maybeSingle();

  if (errString) {
    return { accountData: null, error: new Error(errString.message || 'Account lookup failed.') };
  }
  if (byString) {
    return { accountData: byString, error: null };
  }

  if (/^\d+$/.test(trimmed)) {
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      const { data: byNum, error: errNum } = await supabase
        .from('chartOfAccounts')
        .select('accountID, accountNumber, accountName, normalSide, initBalance, active')
        .eq('accountNumber', asNumber)
        .maybeSingle();

      if (errNum) {
        return { accountData: null, error: new Error(errNum.message || 'Account lookup failed.') };
      }
      if (byNum) {
        return { accountData: byNum, error: null };
      }
    }
  }

  return { accountData: null, error: new Error('Account not found.') };
}

async function fetchLedgerRowsFromTable(accountId) {
  const idFilter = Number.isFinite(Number(accountId)) ? Number(accountId) : accountId;
  const primary = await supabase
    .from('Ledger')
    .select(LEDGER_SELECT)
    .eq('accountID', idFilter)
    .order('ledgerID', { ascending: true });

  if (!primary.error) {
    return { data: (primary.data || []).map(normalizeLedgerRow), error: null };
  }
  if (shouldTryLowercaseLedgerTable(primary.error)) {
    const fallback = await supabase
      .from('ledger')
      .select(LEDGER_SELECT)
      .eq('accountID', idFilter)
      .order('ledgerID', { ascending: true });
    if (!fallback.error) {
      return { data: (fallback.data || []).map(normalizeLedgerRow), error: null };
    }
  }
  return { data: null, error: primary.error };
}

function withDisplayBalances(account, sortedEntries) {
  const rows = sortedEntries.map(normalizeLedgerRow);
  const storedOk =
    rows.length > 0 &&
    rows.every(
      (e) =>
        e.runningBalance !== null &&
        e.runningBalance !== undefined &&
        e.runningBalance !== '' &&
        Number.isFinite(Number(e.runningBalance))
    );

  if (storedOk) {
    return rows.map((e) => ({
      ...e,
      displayBalance: Number(e.runningBalance),
    }));
  }

  const forCompute = rows.map(({ runningBalance: _rb, ...rest }) => rest);
  return computeLedgerRunningBalances(account, forCompute);
}

function Ledger() {
  const { accountNumber } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'administrator';
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
    if (isAdmin) {
      setError('Administrators do not have permission to view the ledger.');
      setAccount(null);
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { accountData, error: lookupError } = await fetchChartAccountByAccountNumber(accountNumber);
      if (lookupError || !accountData) {
        setError((lookupError || new Error('Account not found.')).message);
        setAccount(null);
        setEntries([]);
        setLoading(false);
        return;
      }

      if (!accountData.active && user?.role !== 'administrator') {
        setError('You do not have permission to view this account.');
        setAccount(null);
        setEntries([]);
        setLoading(false);
        return;
      }

      const { data: ledgerRows, error: ledgerError } = await fetchLedgerRowsFromTable(accountData.accountID);
      if (ledgerError) {
        console.error('Ledger select failed:', ledgerError);
        setError(ledgerReadErrorMessage(ledgerError));
        setAccount(accountData);
        setEntries([]);
        setLoading(false);
        return;
      }

      const sorted = sortLedgerEntriesChronological(ledgerRows || []);
      const withBalances = withDisplayBalances(accountData, sorted);
      setAccount(accountData);
      setEntries(withBalances);
    } catch (err) {
      console.error('loadLedger error:', err);
      setError(err?.message || 'Failed to load ledger entries.');
      setAccount(null);
      setEntries([]);
    }
    setLoading(false);
  }, [accountNumber, isAdmin, user?.role]);


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
            className='input'
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
            className='input'
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
            className='input'
          />
        </div>
        <HelpTooltip text="Clear date and amount filters.">
          <button
            type="button"
            className="button-primary"
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

      <div style={{ marginBottom: '24px', width: '100%', maxWidth: '600px' }}>
        <label htmlFor="ledger-account-search" style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px' }}>
          Search (Opens another ledger)
        </label>
        <div className="clear-input-container">
        <input
          id="ledger-account-search"
          type="text"
          placeholder="e.g. Cash or 1000"
          value={accountNameQuery}
          onChange={(e) => setAccountNameQuery(e.target.value)}
          className='input'
        />
        <button type="button" className="button-clear" onClick={() => setAccountNameQuery('')} aria-label="Clear account search input">X</button>
        </div>
        
        {accountMatches.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              margin: '8px 0 0',
              padding: 0,
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
                    borderBottom: `1px solid var(--bff-primary)`,
                    background: 'var(--bff-light-text)',
                    cursor: 'pointer',
                    fontSize: 'inherit',
                    fontFamily: 'inherit',
                    color: 'var(--bff-dark-text)',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bff-extra-light-accent)'}
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
            <th>PR</th>
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
            <td className='money'>{account.normalSide === 'Debit' ? formatCurrency(account.initBalance) : '-'}</td>
            <td className='money'>{account.normalSide === 'Credit' ? formatCurrency(account.initBalance) : '-'}</td>
            <td className='money'>{formatCurrency(account.initBalance)}</td>
          </tr>
          {filteredEntries.length === 0 && entries.length > 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '16px' }}>
                No rows match the current filters. Adjust date range or amount.
              </td>
            </tr>
          ) : null}
          {filteredEntries.map((entry, idx) => {
            // For all rows after the first (idx >= 0, since opening balance is not in filteredEntries),
            // display '-' for 0 or $0.00 in debit, credit, and balance cells
            const showDash = (val) => {
              const n = parseFloat(val);
              return n === 0 || val === 0 || val === '$0.00' || val === 0.0;
            };
            const debitCell = showDash(entry.debit) ? '-' : formatDebitCreditCell(entry.debit);
            const creditCell = showDash(entry.credit) ? '-' : formatDebitCreditCell(entry.credit);
            const balanceCell = showDash(entry.displayBalance) ? '-' : formatCurrency(entry.displayBalance);
            return (
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
                <td className='money'>{debitCell}</td>
                <td className='money'>{creditCell}</td>
                <td className='money'>{balanceCell}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--bff-dark-text)' }}>
            <td colSpan={3}>Totals (filtered)</td>
            <td className='money'>{formatCurrency(totalDebits)}</td>
            <td className='money'>{formatCurrency(totalCredits)}</td>
            <td className='money'>{formatCurrency(endingBalance)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default Ledger;
