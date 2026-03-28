import { supabase } from '../supabaseClient';

// Sort ledger entries by entryDate ascending, then ledgerID ascending (for stable order of same-day entries).
export function sortLedgerEntriesChronological(entries) {
  return [...(entries || [])].sort((a, b) => {
    const ta = a.entryDate ? new Date(a.entryDate).getTime() : 0;
    const tb = b.entryDate ? new Date(b.entryDate).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return (a.ledgerID || 0) - (b.ledgerID || 0);
  });
}

// Compute running balances for a list of ledger entries, starting from the account's initial balance.
export function computeLedgerRunningBalances(account, entriesAscending) {
  let balance = parseFloat(account.initBalance) || 0;
  return entriesAscending.map((e) => {
    const debit = parseFloat(e.debit) || 0;
    const credit = parseFloat(e.credit) || 0;
    if (account.normalSide === 'Credit') {
      balance += credit - debit;
    } else {
      balance += debit - credit;
    }
    return { ...e, displayBalance: balance };
  });
}

// Load ledger entries for an account and compute running balances, with permission check for inactive accounts.
async function loadLedgerEntriesWithBalances(accountData, role) {
  if (!accountData.active && role !== 'administrator') {
    return {
      account: null,
      entries: [],
      error: new Error('You do not have permission to view this account.')
    };
  }

  const { data: ledgerData, error: ledgerError } = await supabase
    .from('Ledger')
    .select('ledgerID, journalEntryID, entryDate, description, debit, credit, runningBalance')
    .eq('accountID', accountData.accountID)
    .order('entryDate', { ascending: true })
    .order('ledgerID', { ascending: true });

  if (ledgerError) {
    return { account: accountData, entries: [], error: new Error('Failed to load ledger entries.') };
  }

  const sorted = sortLedgerEntriesChronological(ledgerData);
  const withBalances = computeLedgerRunningBalances(accountData, sorted);

  return { account: accountData, entries: withBalances, error: null };
}

// Fetch ledger entries for an account by its account number, with permission check for inactive accounts.
export async function getLedgerByAccountNumber(accountNumber, role) {
  const parsedAccountNumber = parseInt(accountNumber, 10);
  if (!Number.isFinite(parsedAccountNumber)) {
    return { account: null, entries: [], error: new Error('Invalid account number.') };
  }

  try {
    const { data: accountData, error: accountError } = await supabase
      .from('chartOfAccounts')
      .select('accountID, accountNumber, accountName, normalSide, initBalance, active')
      .eq('accountNumber', parsedAccountNumber)
      .single();

    if (accountError || !accountData) {
      return { account: null, entries: [], error: new Error('Account not found.') };
    }

    return await loadLedgerEntriesWithBalances(accountData, role);
  } catch (error) {
    console.error('getLedgerByAccountNumber error:', error);
    return { account: null, entries: [], error: new Error('Failed to load ledger entries.') };
  }
}

// Fetch ledger entries for an account by its account ID, with permission check for inactive accounts.
export async function getLedgerByAccountId(accountID, role) {
  if (accountID === null || accountID === undefined) {
    return { account: null, entries: [], error: new Error('Account not found.') };
  }

  try {
    const { data: accountData, error: accountError } = await supabase
      .from('chartOfAccounts')
      .select('accountID, accountNumber, accountName, normalSide, initBalance, active')
      .eq('accountID', accountID)
      .single();

    if (accountError || !accountData) {
      return { account: null, entries: [], error: new Error('Account not found.') };
    }

    return await loadLedgerEntriesWithBalances(accountData, role);
  } catch (error) {
    console.error('getLedgerByAccountId error:', error);
    return { account: null, entries: [], error: new Error('Failed to load ledger entries.') };
  }
}

// Subscribe to real-time updates for ledger entries of a specific account. Calls onChange callback when changes occur.
export function subscribeToAccountLedger(accountID, onChange) {
  if (accountID === null || accountID === undefined) {
    return () => {};
  }

  const channel = supabase
    .channel(`ledger-account-${accountID}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'Ledger',
        filter: `accountID=eq.${accountID}`
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
