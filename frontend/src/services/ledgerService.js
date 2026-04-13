import { supabase } from '../supabaseClient';

export function sortLedgerEntriesChronological(entries) {
  return [...(entries || [])].sort((a, b) => {
    const ta = a.entryDate ? new Date(a.entryDate).getTime() : 0;
    const tb = b.entryDate ? new Date(b.entryDate).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return (a.ledgerID || 0) - (b.ledgerID || 0);
  });
}

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

function isMissingLedgerRpcError(error) {
  if (!error) return false;
  const msg = String(error.message || '');
  if (error.code === 'PGRST202') return true;
  return /could not find the function.*get_ledger_entries/i.test(msg);
}

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

async function selectLedgerByAccountFromTable(idFilter) {
  const selectCols = 'ledgerID, journalEntryID, entryDate, description, debit, credit';
  const primary = await supabase
    .from('Ledger')
    .select(selectCols)
    .eq('accountID', idFilter)
    .order('ledgerID', { ascending: true });
  if (!primary.error) return primary;
  if (shouldTryLowercaseLedgerTable(primary.error)) {
    const fallback = await supabase
      .from('ledger')
      .select(selectCols)
      .eq('accountID', idFilter)
      .order('ledgerID', { ascending: true });
    if (!fallback.error) return fallback;
  }
  return primary;
}

async function selectLedgerByJournalEntryFromTable(journalEntryId) {
  const selectCols = 'ledgerID, journalEntryID, accountID, entryDate, description, debit, credit';
  const primary = await supabase.from('Ledger').select(selectCols).eq('journalEntryID', journalEntryId);
  if (!primary.error) return primary;
  if (shouldTryLowercaseLedgerTable(primary.error)) {
    const fallback = await supabase.from('ledger').select(selectCols).eq('journalEntryID', journalEntryId);
    if (!fallback.error) return fallback;
  }
  return primary;
}


export async function fetchLedgerEntriesByAccountId(accountId) {
  const idFilter = Number.isFinite(Number(accountId)) ? Number(accountId) : accountId;

  const { data, error } = await supabase.rpc('get_ledger_entries', { p_account_id: idFilter });
  if (!error) {
    return { data: Array.isArray(data) ? data : [], error: null };
  }
  if (!isMissingLedgerRpcError(error)) {
    return { data: null, error };
  }

  const fb = await selectLedgerByAccountFromTable(idFilter);
  return { data: fb.data || [], error: fb.error };
}

export async function fetchLedgerEntriesByJournalEntryId(journalEntryId) {
  const jid = Number.isFinite(Number(journalEntryId)) ? Number(journalEntryId) : journalEntryId;

  const { data, error } = await supabase.rpc('get_ledger_entries_by_journal_entry', {
    p_journal_entry_id: jid
  });
  if (!error) {
    return { data: Array.isArray(data) ? data : [], error: null };
  }
  if (!isMissingLedgerRpcError(error)) {
    return { data: null, error };
  }

  const fb = await selectLedgerByJournalEntryFromTable(jid);
  return { data: fb.data || [], error: fb.error };
}

async function loadLedgerEntriesWithBalances(accountData, role) {
  if (!accountData.active && role !== 'administrator') {
    return {
      account: null,
      entries: [],
      error: new Error('You do not have permission to view this account.')
    };
  }

  const accountIdForQuery = Number(accountData.accountID);
  const idFilter = Number.isFinite(accountIdForQuery)
    ? accountIdForQuery
    : accountData.accountID;

  const { data: ledgerData, error: ledgerError } = await fetchLedgerEntriesByAccountId(idFilter);

  if (ledgerError) {
    console.error('Ledger select failed:', ledgerError);
    return {
      account: accountData,
      entries: [],
      error: new Error(ledgerReadErrorMessage(ledgerError))
    };
  }

  const sorted = sortLedgerEntriesChronological(ledgerData || []);
  const withBalances = computeLedgerRunningBalances(accountData, sorted);

  return { account: accountData, entries: withBalances, error: null };
}

async function fetchChartAccountByAccountNumberParam(accountNumber) {
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


export async function getLedgerByAccountNumber(accountNumber, role) {
  try {
    const { accountData, error: lookupError } = await fetchChartAccountByAccountNumberParam(accountNumber);
    if (lookupError || !accountData) {
      return { account: null, entries: [], error: lookupError || new Error('Account not found.') };
    }

    return await loadLedgerEntriesWithBalances(accountData, role);
  } catch (error) {
    console.error('getLedgerByAccountNumber error:', error);
    return { account: null, entries: [], error: new Error('Failed to load ledger entries.') };
  }
}

export async function getLedgerByAccountId(accountID, role) {
  if (accountID === null || accountID === undefined) {
    return { account: null, entries: [], error: new Error('Account not found.') };
  }

  try {
    const idKey = Number.isFinite(Number(accountID)) ? Number(accountID) : accountID;
    const { data: accountData, error: accountError } = await supabase
      .from('chartOfAccounts')
      .select('accountID, accountNumber, accountName, normalSide, initBalance, active')
      .eq('accountID', idKey)
      .maybeSingle();

    if (accountError || !accountData) {
      return { account: null, entries: [], error: new Error(accountError?.message || 'Account not found.') };
    }

    return await loadLedgerEntriesWithBalances(accountData, role);
  } catch (error) {
    console.error('getLedgerByAccountId error:', error);
    return { account: null, entries: [], error: new Error('Failed to load ledger entries.') };
  }
}

export function subscribeToAccountLedger(accountID, onChange) {
  if (accountID === null || accountID === undefined) {
    return () => {};
  }

  const filterId = Number.isFinite(Number(accountID)) ? Number(accountID) : accountID;

  const channel = supabase
    .channel(`ledger-account-${filterId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'Ledger',
        filter: `accountID=eq.${filterId}`
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
