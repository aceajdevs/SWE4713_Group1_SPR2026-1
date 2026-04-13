import { supabase } from '../supabaseClient';

/**
 * Fallback copy — keep in sync with database/seed_public_Error.sql when IDs overlap.
 * Used when the Error table cannot be read (offline, RLS, network).
 */
export const ERROR_FALLBACK = {
  1001: 'No account selected.',
  1002: 'Account is inactive or does not exist.',
  1003: 'Journal entry must have at least one debit line.',
  1004: 'Journal entry must have at least one credit line.',
  1005: 'Total debits must equal total credits.',
  1006: 'A line must have either a debit or a credit amount.',
  1007: 'Amounts cannot be negative.',
  1008: 'All debit lines must appear before credit lines in the journal entry.',
  1009: 'Entry type must be selected.',
  1010: 'Attachment file type is not allowed.',
  1011: 'Failed to submit journal entry.',
  1012: 'Failed to load journal entries.',
  1013: 'Journal entry not found.',
  1014: 'Failed to approve journal entry.',
  1015: 'Failed to reject journal entry.',
  1016: 'A comment is required when rejecting a journal entry.',
  1017: 'Failed to post journal entry to the ledger.',
  1018: 'No journal lines found for this entry.',
  1019: 'Failed to load journal entry.',
  1020: 'You do not have permission to create journal entries.',
  1021: 'Failed to save attachment reference.',
  1022: 'Invalid post reference.',
  1023: 'Failed to create journal entry header.',
  1024: 'Failed to insert journal lines.',
  1025: 'Failed to upload attachment.',
  1099: 'An unexpected error occurred.',
};

/** @type {Map<number, string>} */
const messageCache = new Map();

export const ERROR_IDS = {
  NO_ACCOUNT: 1001,
  ACCOUNT_INACTIVE_OR_MISSING: 1002,
  NEED_DEBIT_LINE: 1003,
  NEED_CREDIT_LINE: 1004,
  DEBITS_CREDITS_UNEQUAL: 1005,
  LINE_NEEDS_DEBIT_OR_CREDIT: 1006,
  NEGATIVE_AMOUNT: 1007,
  DEBITS_BEFORE_CREDITS: 1008,
  ENTRY_TYPE_REQUIRED: 1009,
  ATTACHMENT_TYPE_INVALID: 1010,
  SUBMIT_JOURNAL_FAILED: 1011,
  LOAD_JOURNAL_ENTRIES_FAILED: 1012,
  JOURNAL_NOT_FOUND: 1013,
  APPROVE_JOURNAL_FAILED: 1014,
  REJECT_JOURNAL_FAILED: 1015,
  REJECT_REASON_REQUIRED: 1016,
  LEDGER_POST_FAILED: 1017,
  NO_JOURNAL_LINES: 1018,
  LOAD_JOURNAL_ENTRY_FAILED: 1019,
  NO_PERMISSION_CREATE_JOURNAL: 1020,
  ATTACHMENT_REF_FAILED: 1021,
  INVALID_POST_REFERENCE: 1022,
  JOURNAL_HEADER_FAILED: 1023,
  JOURNAL_LINES_INSERT_FAILED: 1024,
  ATTACHMENT_UPLOAD_FAILED: 1025,
  UNEXPECTED: 1099,
};

/**
 * @param {number} errorId
 * @param {unknown} [cause]
 * @returns {Error & { errorID: number, cause?: unknown }}
 */
export function createAppError(errorId, cause) {
  const err = new Error(`E${errorId}`);
  err.errorID = errorId;
  if (cause !== undefined && cause !== null) err.cause = cause;
  return err;
}

function normalizeId(id) {
  const n = typeof id === 'string' ? parseInt(id, 10) : Number(id);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {number|string} errorId
 */
export async function getErrorMessage(errorId) {
  const id = normalizeId(errorId);
  if (id == null) return ERROR_FALLBACK[1099];

  if (messageCache.has(id)) {
    return messageCache.get(id);
  }

  const { data, error } = await supabase
    .from('Error')
    .select('message')
    .eq('errorID', id)
    .maybeSingle();

  if (error || !data?.message) {
    const fb = ERROR_FALLBACK[id] ?? ERROR_FALLBACK[1099];
    messageCache.set(id, fb);
    return fb;
  }

  messageCache.set(id, data.message);
  return data.message;
}

/**
 * @param {Array<string|number>} errorIds
 * @returns {Promise<Record<string, string>>}
 */
export async function getErrorMessagesByIds(errorIds) {
  const ids = [...new Set((errorIds || []).map(normalizeId).filter((n) => n != null))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from('Error')
    .select('errorID, message')
    .in('errorID', ids);

  if (error || !data) {
    return Object.fromEntries(ids.map((id) => [String(id), ERROR_FALLBACK[id] ?? ERROR_FALLBACK[1099]]));
  }

  const out = {};
  data.forEach((row) => {
    const id = row.errorID;
    const msg = row.message || ERROR_FALLBACK[id];
    out[String(id)] = msg;
    messageCache.set(Number(id), msg);
  });
  ids.forEach((id) => {
    if (!out[String(id)]) out[String(id)] = ERROR_FALLBACK[id] ?? ERROR_FALLBACK[1099];
  });
  return out;
}

/**
 * Resolve a thrown value for display: prefers createAppError().errorID, then maps generic errors.
 * @param {unknown} err
 * @param {number} [fallbackId=1099]
 */
export async function resolveThrownErrorMessage(err, fallbackId = ERROR_IDS.UNEXPECTED) {
  if (err && typeof err === 'object' && 'errorID' in err && err.errorID != null) {
    return getErrorMessage(err.errorID);
  }
  const msg =
    err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
      ? err.message
      : String(err ?? '');
  const base = await getErrorMessage(fallbackId);
  if (!msg || msg === `${fallbackId}` || msg.startsWith('E')) return base;
  return `${base} (${msg})`;
}

/**
 * Log to console with stable error id: [E1012] <message from table>
 * @param {number} errorId
 * @param {unknown} [nativeError]
 */
export async function logErrorWithCode(errorId, nativeError) {
  const text = await getErrorMessage(errorId);
  if (nativeError !== undefined && nativeError !== null) {
    console.error(`[E${errorId}] ${text}`, nativeError);
  } else {
    console.error(`[E${errorId}] ${text}`);
  }
}
