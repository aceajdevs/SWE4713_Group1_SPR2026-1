import { supabase } from '../supabaseClient';
import { fetchFromTable, insertRecord, uploadFile } from '../supabaseUtils';
import { createAppError, ERROR_IDS, logErrorWithCode } from './errorMessages';

/**
 * Create a new journal entry with its lines.
 * @param {{ entryType: string, createdBy: number, lines: Array }} entry
 * @returns {Promise<object>} the created journal entry
 */
export async function createJournalEntry({ entryType, createdBy, lines }) {
  const { data: header, error: headerError } = await insertRecord('journalEntry', {
entryType: parseInt(entryType, 10) || null,
    status: 'pending',
    createdBy,
    createdAt: new Date().toISOString(),
  });

  if (headerError || !header) {
    throw createAppError(ERROR_IDS.JOURNAL_HEADER_FAILED, headerError);
  }

  const entryId = header.journalEntryID;

  const lineRecords = lines.map((line) => ({
    journalEntryID: entryId,
    accountID: line.accountID,
    debit: parseFloat(line.debit) || 0,
    credit: parseFloat(line.credit) || 0,
  }));

  const { error: linesError } = await supabase
    .from('journalLine')
    .insert(lineRecords);

  if (linesError) {
    throw createAppError(ERROR_IDS.JOURNAL_LINES_INSERT_FAILED, linesError);
  }

  return header;
}


// Fetch journal entries with optional status filter.

export async function getJournalEntries(status) {
  const options = {
    orderBy: { column: 'createdAt', ascending: false },
  };

  if (status) {
    options.filters = { status };
  }

  const { data, error } = await fetchFromTable('journalEntry', options);

  if (error) throw error;
  return data || [];
}


 // Fetch a single journal entry with its lines.

export async function getJournalEntryWithLines(entryId) {
  const { data: entry, error: entryError } = await fetchFromTable('journalEntry', {
    filters: { journalEntryID: entryId },
    single: true,
  });

  if (entryError || !entry) throw createAppError(ERROR_IDS.JOURNAL_NOT_FOUND, entryError);

  const { data: lines, error: linesError } = await fetchFromTable('journalLine', {
    filters: { journalEntryID: entryId },
  });

  if (linesError) throw linesError;

  return { entry, lines: lines || [] };
}


// Approve a journal entry (manager only).

export async function approveJournalEntry(entryId, approvedBy) {
  const approvedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('journalEntry')
    .update({
      status: 'approved',
      approvedBy,
      approvedAt,
    })
    .eq('journalEntryID', entryId)
    .select();

  if (error) throw createAppError(ERROR_IDS.APPROVE_JOURNAL_FAILED, error);

  const approvedEntry = data?.[0];
  if (!approvedEntry) throw createAppError(ERROR_IDS.APPROVE_JOURNAL_FAILED);

  // Fetch the journal lines
  const { data: lines, error: linesError } = await supabase
    .from('journalLine')
    .select('accountID, debit, credit')
    .eq('journalEntryID', entryId);

  if (linesError) throw createAppError(ERROR_IDS.APPROVE_JOURNAL_FAILED, linesError);

  if (!lines || lines.length === 0) throw createAppError(ERROR_IDS.NO_JOURNAL_LINES);

  // Post to ledger
  const ledgerRecords = lines.map((line) => ({
    journalEntryID: entryId,
    accountID: line.accountID,
    entryDate: approvedAt,
    description: `Journal Entry ${entryId}`,
    debit: line.debit,
    credit: line.credit,
  }));

  const { error: ledgerError } = await supabase
    .from('Ledger')
    .insert(ledgerRecords);

  if (ledgerError) throw createAppError(ERROR_IDS.LEDGER_POST_FAILED, ledgerError);

  return approvedEntry;
}


 // Reject a journal entry with a reason (manager only).

export async function rejectJournalEntry(entryId, rejectReason) {
  if (!rejectReason || !rejectReason.trim()) {
    throw createAppError(ERROR_IDS.REJECT_REASON_REQUIRED);
  }

  const { data, error } = await supabase
    .from('journalEntry')
    .update({
      status: 'rejected',
      rejectReason: rejectReason.trim(),
    })
    .eq('journalEntryID', entryId)
    .select();

  if (error) throw createAppError(ERROR_IDS.REJECT_JOURNAL_FAILED, error);
  return data?.[0];
}

// Upload an attachment for a journal entry.
export async function uploadJournalAttachment(entryId, file) {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `journal-attachments/${entryId}/${timestamp}_${safeName}`;

  const { data, error } = await uploadFile('attachments', path, file);

  if (error) throw createAppError(ERROR_IDS.ATTACHMENT_UPLOAD_FAILED, error);

  const { error: refError } = await insertRecord('journalAttachment', {
    journalEntryID: entryId,
    filePath: path,
    fileType: file.type,
    uploadedAt: new Date().toISOString(),
  });

  if (refError) {
    void logErrorWithCode(ERROR_IDS.ATTACHMENT_REF_FAILED, refError);
    throw createAppError(ERROR_IDS.ATTACHMENT_REF_FAILED, refError);
  }

  return { path };
}

// Fetch attachments for a journal entry.
export async function getJournalAttachments(entryId) {
  const { data, error } = await fetchFromTable('journalAttachment', {
    filters: { journalEntryID: entryId },
    orderBy: { column: 'uploadedAt', ascending: true },
  });

  if (error) throw error;
  return data || [];
}

/**
 * Fetch journal entries enriched with their lines and account names.
 * @param {string} [status] - optional status filter
 * @returns {Promise<Array>}
 */
export async function getEnrichedJournalEntries(status) {
  const entries = await getJournalEntries(status);
  if (entries.length === 0) return entries;

  // Fetch all lines for these entries
  const entryIds = entries.map((e) => e.journalEntryID);
  const { data: allLines, error: linesError } = await supabase
    .from('journalLine')
    .select('journalEntryID, accountID, debit, credit')
    .in('journalEntryID', entryIds);

  if (linesError) {
    void logErrorWithCode(ERROR_IDS.LOAD_JOURNAL_ENTRIES_FAILED, linesError);
    return entries;
  }

  // Fetch account names for all referenced accounts
  const accountIds = [...new Set((allLines || []).map((l) => l.accountID))];
  let accountMap = {};

  if (accountIds.length > 0) {
    const { data: accounts, error: accError } = await supabase
      .from('chartOfAccounts')
      .select('accountID, accountName, accountNumber')
      .in('accountID', accountIds);

    if (!accError && accounts) {
      accounts.forEach((a) => {
        accountMap[a.accountID] = a;
      });
    }
  }

  // Attach lines with account names to each entry
  return entries.map((entry) => ({
    ...entry,
    lines: (allLines || [])
      .filter((l) => l.journalEntryID === entry.journalEntryID)
      .map((l) => ({
        ...l,
        accountName: accountMap[l.accountID]?.accountName || '',
        accountNumber: accountMap[l.accountID]?.accountNumber || '',
      })),
  }));
}


// Search journal entries by account name, amount, date, entryType, or ID.
export function searchJournalEntries(entries, query) {
  if (!query || !query.trim()) return entries;

  const q = query.trim().toLowerCase();

  return entries.filter((entry) => {
    // Match on date
    if (entry.createdAt?.includes(q)) return true;

    // Match on account name in lines
    if (entry.lines?.some((l) => l.accountName?.toLowerCase().includes(q))) return true;

    // Match on account number in lines
    if (entry.lines?.some((l) => String(l.accountNumber).includes(q))) return true;

    // Match on total amount (sum of debits)
    if (entry.lines) {
      const total = entry.lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
      if (total.toFixed(2).startsWith(q)) return true;
    }

    return false;
  });
}

// Filter journal entries by date range.
export function filterByDateRange(entries, startDate, endDate) {
  return entries.filter((entry) => {
    if (!entry.createdAt) return false;
    const date = entry.createdAt.slice(0, 10);
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  });
}

/**
 * Approved (posted) journal entries with lines, merged with earliest ledger post date per entry.
 * Uses the Supabase client configured from VITE_* env (e.g. .env.local).
 */
export async function getPostedJournalEntriesReport() {
  const entries = await getEnrichedJournalEntries('approved');
  if (!entries.length) return [];

  const ids = entries.map((e) => e.journalEntryID);
  const { data: ledgerRows, error } = await supabase
    .from('Ledger')
    .select('journalEntryID, entryDate')
    .in('journalEntryID', ids)
    .order('entryDate', { ascending: true });

  if (error) {
    console.error('Ledger fetch for posted journal report:', error);
    return entries.map((e) => ({ ...e, postedAt: e.approvedAt ?? null }));
  }

  const firstDateByJe = {};
  for (const row of ledgerRows || []) {
    if (firstDateByJe[row.journalEntryID] == null) {
      firstDateByJe[row.journalEntryID] = row.entryDate;
    }
  }

  return entries.map((e) => ({
    ...e,
    postedAt: firstDateByJe[e.journalEntryID] ?? e.approvedAt ?? null,
  }));
}
