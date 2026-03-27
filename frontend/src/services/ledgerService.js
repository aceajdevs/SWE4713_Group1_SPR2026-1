import { supabase } from '../supabaseClient';

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

    if (!accountData.active && role !== 'administrator') {
      return { account: null, entries: [], error: new Error('You do not have permission to view this account.') };
    }

    const { data: ledgerData, error: ledgerError } = await supabase
      .from('Ledger')
      .select('ledgerID, journalEntryID, entryDate, description, debit, credit, runningBalance')
      .eq('accountID', accountData.accountID)
      .order('entryDate', { ascending: false });

    if (ledgerError) {
      return { account: accountData, entries: [], error: new Error('Failed to load ledger entries.') };
    }

    return { account: accountData, entries: ledgerData || [], error: null };
  } catch (error) {
    console.error('getLedgerByAccountNumber error:', error);
    return { account: null, entries: [], error: new Error('Failed to load ledger entries.') };
  }
}

