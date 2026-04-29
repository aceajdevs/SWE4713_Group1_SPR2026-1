import { supabase } from '../supabaseClient';
import { fetchFromTable, insertRecord, uploadFile } from '../supabaseUtils';
import { createAppError, ERROR_IDS, logErrorWithCode } from './errorMessages';
import { getManagerWithLargestUserId } from './adminService';
import { sendJournalPendingApprovalToManager } from './emailService';

async function notifyManagerJournalSubmittedForApproval(journalEntryID, createdBy) {
  try {
    const manager = await getManagerWithLargestUserId();
    if (!manager?.email || !String(manager.email).trim()) {
      console.warn('Journal submitted: no active manager with an email address to notify.');
      return;
    }

    const { data: submitter } = await supabase
      .from('user')
      .select('fName, lName, username')
      .eq('userID', createdBy)
      .maybeSingle();

    const submitterDisplayName =
      [submitter?.fName, submitter?.lName].filter(Boolean).join(' ').trim() ||
      submitter?.username?.trim() ||
      `User ${createdBy}`;

    const managerDisplayName =
      [manager.fName, manager.lName].filter(Boolean).join(' ').trim() ||
      manager.username?.trim() ||
      'Manager';

    await sendJournalPendingApprovalToManager({
      managerEmail: manager.email,
      managerDisplayName,
      journalEntryId: journalEntryID,
      submitterDisplayName,
    });
  } catch (err) {
    console.error('Failed to send journal approval notification to manager:', err);
  }
}


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

  void notifyManagerJournalSubmittedForApproval(entryId, createdBy);

  return header;
}



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
    .eq('status', 'pending')
    .select();

  if (error) throw createAppError(ERROR_IDS.APPROVE_JOURNAL_FAILED, error);

  const approvedEntry = data?.[0];
  if (!approvedEntry) {
    throw createAppError(ERROR_IDS.APPROVE_JOURNAL_FAILED, {
      message: 'Entry is not pending approval, or it was already processed.',
    });
  }


  return approvedEntry;
}



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
    .eq('status', 'pending')
    .select();

  if (error) throw createAppError(ERROR_IDS.REJECT_JOURNAL_FAILED, error);
  const rejected = data?.[0];
  if (!rejected) {
    throw createAppError(ERROR_IDS.REJECT_JOURNAL_FAILED, {
      message: 'Entry is not pending, or it was already approved or rejected.',
    });
  }
  return rejected;
}

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

export async function getJournalAttachments(entryId) {
  const normalizedEntryId = Number(entryId);
  const tableAttempts = [
    { table: 'journalAttachment', fk: 'journalEntryID', order: 'uploadedAt' },
    { table: 'jAttachment', fk: 'journalEntryID', order: 'uploadedAt' },
    { table: 'journalAttachments', fk: 'journalEntryID', order: 'uploadedAt' },
    { table: 'journalAttachment', fk: 'journalEntryId', order: 'uploadedAt' },
    { table: 'journalAttachment', fk: 'journalID', order: 'uploadedAt' },
    { table: 'jAttachment', fk: 'journalID', order: 'uploadedAt' },
  ];

  let lastError = null;
  let rows = [];
  for (const attempt of tableAttempts) {
    const { data, error } = await fetchFromTable(attempt.table, {
      filters: { [attempt.fk]: normalizedEntryId },
      orderBy: { column: attempt.order, ascending: true },
    });
    if (!error) {
      rows = data || [];
      break;
    }
    const msg = String(error?.message || '').toLowerCase();
    const isMissingSchemaObj =
      error?.code === 'PGRST205' ||
      msg.includes('does not exist') ||
      msg.includes('could not find') ||
      msg.includes('schema cache');
    if (!isMissingSchemaObj) {
      throw error;
    }
    lastError = error;
  }

  if (!rows.length && lastError) throw lastError;

  const withUrls = await Promise.all(
    rows.map(async (att) => {
      const filePath = att.filePath || att.path || att.file_path || '';
      let fileUrl = null;
      if (filePath) {
        const signed = await supabase.storage
          .from('attachments')
          .createSignedUrl(filePath, 60 * 60);
        if (!signed.error && signed.data?.signedUrl) {
          fileUrl = signed.data.signedUrl;
        } else {
          const { data: publicData } = supabase.storage.from('attachments').getPublicUrl(filePath);
          fileUrl = publicData?.publicUrl || null;
        }
      }
      return {
        ...att,
        filePath,
        fileType: att.fileType || att.file_type || 'unknown',
        fileUrl,
      };
    }),
  );

  return withUrls;
}

export async function getEnrichedJournalEntries(status) {
  const entries = await getJournalEntries(status);
  if (entries.length === 0) return entries;

  const entryIds = entries.map((e) => e.journalEntryID);
  const { data: allLines, error: linesError } = await supabase
    .from('journalLine')
    .select('journalEntryID, accountID, debit, credit')
    .in('journalEntryID', entryIds);

  if (linesError) {
    void logErrorWithCode(ERROR_IDS.LOAD_JOURNAL_ENTRIES_FAILED, linesError);
    return entries;
  }

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


export function searchJournalEntries(entries, query) {
  if (!query || !query.trim()) return entries;

  const q = query.trim().toLowerCase();

  return entries.filter((entry) => {
    if (entry.createdAt?.includes(q)) return true;

    if (entry.lines?.some((l) => l.accountName?.toLowerCase().includes(q))) return true;

    if (entry.lines?.some((l) => String(l.accountNumber).includes(q))) return true;

    if (entry.lines) {
      const total = entry.lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
      if (total.toFixed(2).startsWith(q)) return true;
    }

    return false;
  });
}

export function filterByDateRange(entries, startDate, endDate) {
  return entries.filter((entry) => {
    if (!entry.createdAt) return false;
    const date = entry.createdAt.slice(0, 10);
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  });
}

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
