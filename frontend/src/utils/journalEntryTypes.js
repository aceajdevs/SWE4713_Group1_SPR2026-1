/** Matches `JournalEntryForm` option values stored on `journalEntry.entryType`. */
const ENTRY_TYPE_LABELS = {
  1: 'Regular',
  2: 'Adjusting',
  3: 'Closing',
};

/**
 * @param {number|string|null|undefined} value
 * @param {{ emptyLabel?: string }} [options]
 * @returns {string}
 */
export function getJournalEntryTypeLabel(value, options = {}) {
  const { emptyLabel = '—' } = options;
  if (value === null || value === undefined || value === '') {
    return emptyLabel;
  }
  const n = Number(value);
  if (Number.isFinite(n) && ENTRY_TYPE_LABELS[n] != null) {
    return ENTRY_TYPE_LABELS[n];
  }
  return String(value);
}
