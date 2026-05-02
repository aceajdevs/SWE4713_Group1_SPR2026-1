import { supabase } from '../supabaseClient';

function parseToLocalDate(isoOrDate) {
  if (isoOrDate == null || isoOrDate === '') return null;
  const s = String(isoOrDate);
  if (s.length >= 10 && !s.includes('T')) {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    if (Number.isFinite(y) && Number.isFinite(m)) {
      return new Date(y, m - 1, Number.isFinite(d) ? d : 1);
    }
  }
  const d = new Date(isoOrDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfCurrentQuarter(anchor = new Date()) {
  const y = anchor.getFullYear();
  const qStartMonth = Math.floor(anchor.getMonth() / 3) * 3;
  return new Date(y, qStartMonth, 1);
}

/**
 * Weekly period labels from start of current quarter to `anchor` (inclusive).
 * Each label is the period end date in YYYY-MM-DD format.
 * @param {Date} [anchor]
 * @returns {string[]}
 */
export function currentQuarterWeekLabels(anchor = new Date()) {
  const today = parseToLocalDate(anchor) || new Date();
  const quarterStart = startOfCurrentQuarter(today);

  /** @type {string[]} */
  const labels = [];
  const cursor = new Date(quarterStart);

  while (cursor <= today) {
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    if (end > today) end.setTime(today.getTime());
    labels.push(toYmd(end));
    end.setDate(end.getDate() + 1);
    cursor.setTime(end.getTime());
  }

  return labels;
}

async function fetchLedgerEntryDates(limit = 800) {
  const primary = await supabase
    .from('Ledger')
    .select('entryDate')
    .not('entryDate', 'is', null)
    .order('entryDate', { ascending: false })
    .limit(limit);

  if (!primary.error && primary.data?.length) return primary.data;

  const fallback = await supabase
    .from('ledger')
    .select('entryDate')
    .not('entryDate', 'is', null)
    .order('entryDate', { ascending: false })
    .limit(limit);

  if (!fallback.error && fallback.data?.length) return fallback.data;

  return [];
}

/**
 * @param {{ entryDate?: string | null }[]} rows
 * @returns {{ min: string | null, max: string | null }}
 */
export function ledgerDateBoundsFromRows(rows) {
  if (!rows?.length) return { min: null, max: null };
  const dates = rows.map((r) => r.entryDate).filter(Boolean).sort();
  return { min: dates[0] || null, max: dates[dates.length - 1] || null };
}

/**
 * @param {{ entryDate?: string | null }[]} _rows
 * @param {Date} anchor
 * @returns {string[]}
 */
export function buildRatioPeriodLabelsFromRows(_rows, anchor = new Date()) {
  return currentQuarterWeekLabels(anchor);
}

/**
 * Weekly labels for charts from current quarter start through present.
 * @returns {Promise<string[]>}
 */
export async function fetchRatioChartPeriodLabels() {
  return currentQuarterWeekLabels(new Date());
}

/**
 * Earliest and latest `entryDate` from the same ledger query (for UI).
 * @returns {Promise<{ min: string | null, max: string | null }>}
 */
export async function fetchLedgerEntryDateRange() {
  const rows = await fetchLedgerEntryDates(800);
  return ledgerDateBoundsFromRows(rows);
}

/**
 * Single Supabase round-trip: weekly labels plus ledger date bounds for the ratio page.
 * @returns {Promise<{ periods: string[], ledgerMin: string | null, ledgerMax: string | null }>}
 */
export async function fetchRatioPagePeriodContext() {
  const rows = await fetchLedgerEntryDates(800);
  const { min: ledgerMin, max: ledgerMax } = ledgerDateBoundsFromRows(rows);
  const periods = currentQuarterWeekLabels(new Date());
  return { periods, ledgerMin, ledgerMax };
}
