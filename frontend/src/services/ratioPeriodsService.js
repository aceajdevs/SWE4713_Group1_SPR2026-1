import { supabase } from '../supabaseClient';

/** @typedef {{ y: number, q: number, sort: number }} QuarterKey */

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

/**
 * @param {string|Date} isoOrDate
 * @returns {QuarterKey | null}
 */
export function quarterKeyFromDate(isoOrDate) {
  const d = parseToLocalDate(isoOrDate);
  if (!d) return null;
  const y = d.getFullYear();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return { y, q, sort: y * 10 + q };
}

/**
 * @param {QuarterKey} k
 * @returns {string} e.g. Q1 '26
 */
export function formatQuarterLabel(k) {
  return `Q${k.q} '${String(k.y).slice(-2)}`;
}

/**
 * Last `count` calendar quarters ending at the quarter that contains `anchor`. Oldest first.
 * @param {Date} [anchor]
 * @param {number} [count]
 * @returns {string[]}
 */
export function calendarQuarterLabels(anchor = new Date(), count = 5) {
  const end = quarterKeyFromDate(anchor);
  if (!end) return [];
  const keys = [];
  let y = end.y;
  let q = end.q;
  for (let i = 0; i < count; i++) {
    keys.unshift({ y, q, sort: y * 10 + q });
    q -= 1;
    if (q < 1) {
      q = 4;
      y -= 1;
    }
  }
  return keys.map(formatQuarterLabel);
}

function sortKeyToKey(sort) {
  const y = Math.floor(sort / 10);
  const q = sort % 10;
  return { y, q, sort };
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
 * @param {string[]} isoDates
 * @returns {QuarterKey[]}
 */
function distinctQuarterKeys(isoDates) {
  const map = new Map();
  for (const iso of isoDates) {
    const k = quarterKeyFromDate(iso);
    if (k) map.set(k.sort, k);
  }
  return Array.from(map.values()).sort((a, b) => a.sort - b.sort);
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
 * @param {{ entryDate?: string | null }[]} rows
 * @param {Date} anchor
 * @param {{ calendarQuarterCount?: number, maxMergedLabels?: number, minLabels?: number }} [opts]
 * @returns {string[]}
 */
export function buildRatioPeriodLabelsFromRows(
  rows,
  anchor = new Date(),
  { calendarQuarterCount = 5, maxMergedLabels = 10, minLabels = 5 } = {},
) {
  const now = anchor;
  const calendarKeys = /** @type {QuarterKey[]} */ (() => {
    const end = quarterKeyFromDate(now);
    if (!end) return [];
    const keys = [];
    let y = end.y;
    let q = end.q;
    for (let i = 0; i < calendarQuarterCount; i++) {
      keys.unshift({ y, q, sort: y * 10 + q });
      q -= 1;
      if (q < 1) {
        q = 4;
        y -= 1;
      }
    }
    return keys;
  })();

  const mergedSortSet = new Set(calendarKeys.map((k) => k.sort));

  const dbKeys = distinctQuarterKeys(rows.map((r) => r.entryDate));
  for (const k of dbKeys) {
    mergedSortSet.add(k.sort);
  }

  let sorted = Array.from(mergedSortSet).sort((a, b) => a - b);

  if (sorted.length > maxMergedLabels) {
    sorted = sorted.slice(-maxMergedLabels);
  }

  if (sorted.length < minLabels) {
    return calendarQuarterLabels(now, minLabels);
  }

  return sorted.map((sort) => formatQuarterLabel(sortKeyToKey(sort)));
}

/**
 * Merges calendar quarters (from the current date) with calendar quarters that appear
 * on `Ledger` / `ledger` rows (`entryDate`). Returns sorted unique labels, newest last,
 * length between `minLabels` and `maxMergedLabels`.
 *
 * @param {{ calendarQuarterCount?: number, maxMergedLabels?: number, minLabels?: number }} [opts]
 * @returns {Promise<string[]>}
 */
export async function fetchRatioChartPeriodLabels(opts) {
  const rows = await fetchLedgerEntryDates(800);
  return buildRatioPeriodLabelsFromRows(rows, new Date(), opts);
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
 * Single Supabase round-trip: merged period labels plus ledger date bounds for the ratio page.
 * @param {{ calendarQuarterCount?: number, maxMergedLabels?: number, minLabels?: number }} [opts]
 * @returns {Promise<{ periods: string[], ledgerMin: string | null, ledgerMax: string | null }>}
 */
export async function fetchRatioPagePeriodContext(opts) {
  const rows = await fetchLedgerEntryDates(800);
  const { min: ledgerMin, max: ledgerMax } = ledgerDateBoundsFromRows(rows);
  const periods = buildRatioPeriodLabelsFromRows(rows, new Date(), opts);
  return { periods, ledgerMin, ledgerMax };
}
