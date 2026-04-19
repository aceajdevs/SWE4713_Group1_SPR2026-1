import { supabase } from '../supabaseClient';

function shouldTryLowercaseLedgerTable(error) {
  const message = String(error?.message || '').toLowerCase();
  const isPermission =
    error?.code === '42501' ||
    message.includes('permission denied') ||
    message.includes('row-level security');
  return (
    !isPermission &&
    (error?.code === 'PGRST205' ||
      message.includes('schema cache') ||
      message.includes('does not exist') ||
      (message.includes('could not find') && message.includes('table')))
  );
}

/**
 * @param {string} label e.g. Q1 '26
 * @returns {{ y: number, q: number } | null}
 */
export function parseQuarterLabel(label) {
  const m = /^Q([1-4])\s+'(\d{2})$/i.exec(String(label).trim());
  if (!m) return null;
  const q = Number(m[1]);
  const yy = Number(m[2]);
  const y = yy <= 50 ? 2000 + yy : 1900 + yy;
  if (!Number.isFinite(q) || !Number.isFinite(y)) return null;
  return { y, q };
}

function quarterEndYmd(y, q) {
  const m = q * 3;
  const last = new Date(y, m, 0);
  const mm = String(last.getMonth() + 1).padStart(2, '0');
  const dd = String(last.getDate()).padStart(2, '0');
  return `${last.getFullYear()}-${mm}-${dd}`;
}

function quarterStartYmd(y, q) {
  const m = (q - 1) * 3 + 1;
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

function isCreditNormal(account) {
  return String(account.normalSide || '').toLowerCase() === 'credit';
}

function netMovement(account, debit, credit) {
  const d = Number(debit) || 0;
  const c = Number(credit) || 0;
  return isCreditNormal(account) ? c - d : d - c;
}

/** Absolute amount for income-statement style display (matches Report.js spirit). */
function absAmount(account, debit, credit) {
  return Math.abs(netMovement(account, debit, credit));
}

const COGS_NAME_RE = /cost\s+of\s+goods|cost\s+of\s+sales|\bcogs\b/i;
const AR_NAME_RE = /receivable|a\/r|accounts\s+receivable/i;
const INV_NAME_RE = /inventory|merchandise/i;

function classifyAccount(a) {
  const type = String(a.type || '').toLowerCase();
  const sub = String(a.subType || '').toLowerCase();
  const name = String(a.accountName || '').toLowerCase();
  return {
    isRevenue: type === 'revenue',
    isExpense: type === 'expenses',
    isAsset: type === 'assets',
    isLiability: type === 'liabilities',
    isEquity: type === 'equity',
    isCurrentAsset: type === 'assets' && sub === 'current assets',
    isCurrentLiab: type === 'liabilities' && sub === 'current liabilities',
    isLongTermLiab: type === 'liabilities' && sub === 'long-term liabilities',
    isFixedAsset: type === 'assets' && sub === 'fixed assets',
    isFinancialExpense: type === 'expenses' && sub === 'financial expenses',
    isCogs: type === 'expenses' && COGS_NAME_RE.test(a.accountName || ''),
    isInventory: type === 'assets' && sub === 'current assets' && INV_NAME_RE.test(name),
    isReceivable: type === 'assets' && sub === 'current assets' && AR_NAME_RE.test(a.accountName || ''),
  };
}

async function fetchAccounts() {
  const { data, error } = await supabase
    .from('chartOfAccounts')
    .select('accountID, accountNumber, accountName, normalSide, initBalance, type, subType, active')
    .order('accountNumber', { ascending: true });

  if (error) throw error;
  return (data || []).filter((a) => a.active !== false);
}

async function fetchAllLedgerRows() {
  const columns = 'ledgerID, accountID, debit, credit, entryDate';
  const primary = await supabase
    .from('Ledger')
    .select(columns)
    .order('entryDate', { ascending: true })
    .order('ledgerID', { ascending: true })
    .limit(25000);

  if (!primary.error) return primary.data || [];

  if (shouldTryLowercaseLedgerTable(primary.error)) {
    const fallback = await supabase
      .from('ledger')
      .select(columns)
      .order('entryDate', { ascending: true })
      .order('ledgerID', { ascending: true })
      .limit(25000);
    if (!fallback.error) return fallback.data || [];
  }
  throw primary.error;
}

/**
 * Per-account ending balances after each quarter end, in order of `quarters`.
 * @param {object} account
 * @param {object[]} entriesSorted — ascending by date for this account
 * @param {{ y: number, q: number }[]} quarters
 */
function endingBalancesForQuarters(account, entriesSorted, quarters) {
  let balance = Number(account.initBalance) || 0;
  let ei = 0;
  const out = [];
  const credit = isCreditNormal(account);

  for (const { y, q } of quarters) {
    const endStr = quarterEndYmd(y, q);
    while (ei < entriesSorted.length) {
      const e = entriesSorted[ei];
      const dStr = e.entryDate ? String(e.entryDate).slice(0, 10) : '';
      if (!dStr || dStr > endStr) break;
      const debit = Number(e.debit) || 0;
      const cr = Number(e.credit) || 0;
      balance += credit ? cr - debit : debit - cr;
      ei += 1;
    }
    out.push(balance);
  }
  return out;
}

/** @returns {Record<string, number[]>} accountID -> balance at each quarter end */
function computeEndingBalancesByQuarter(accounts, entriesByAccount, quarters) {
  /** @type {Record<string, number[]>} */
  const map = {};
  for (const account of accounts) {
    const id = account.accountID;
    const entries = entriesByAccount.get(id) || [];
    map[id] = endingBalancesForQuarters(account, entries, quarters);
  }
  return map;
}

function absBalanceAtIndex(balanceArrays, account, quarterIndex) {
  const arr = balanceArrays[account.accountID];
  if (!arr || arr[quarterIndex] === undefined) return 0;
  return Math.abs(arr[quarterIndex]);
}

/**
 * @param {string[]} periodLabels — oldest first (same order as charts)
 * @returns {Promise<{
 *   error: Error | null,
 *   series: Record<string, (number|null)[]>
 * }>}
 */
export async function fetchRatioSeriesFromLedger(periodLabels) {
  const quarters = periodLabels.map(parseQuarterLabel).filter(Boolean);
  if (!quarters.length) {
    return { error: null, series: {} };
  }

  try {
    const [accounts, ledgerRows] = await Promise.all([fetchAccounts(), fetchAllLedgerRows()]);

    const accountsById = new Map(accounts.map((a) => [a.accountID, a]));
    const classified = accounts.map((a) => ({ account: a, c: classifyAccount(a) }));

    /** @type {Map<number| string, object[]>} */
    const entriesByAccount = new Map();
    for (const e of ledgerRows) {
      const id = e.accountID;
      if (!entriesByAccount.has(id)) entriesByAccount.set(id, []);
      entriesByAccount.get(id).push(e);
    }
    for (const [, list] of entriesByAccount) {
      list.sort((a, b) => {
        const da = a.entryDate ? String(a.entryDate).slice(0, 10) : '';
        const db = b.entryDate ? String(b.entryDate).slice(0, 10) : '';
        if (da !== db) return da < db ? -1 : 1;
        return (a.ledgerID || 0) - (b.ledgerID || 0);
      });
    }

    const balanceAt = computeEndingBalancesByQuarter(accounts, entriesByAccount, quarters);

    const n = quarters.length;
    const z = () => Array(n).fill(null);

    const revenue = [...z()];
    const cogs = [...z()];
    const interestExp = [...z()];

    const totalAssets = [...z()];
    const totalLiab = [...z()];
    const totalEquity = [...z()];
    const currentAssets = [...z()];
    const currentLiab = [...z()];
    const longTermLiab = [...z()];
    const fixedAssets = [...z()];
    const inventory = [...z()];
    const ar = [...z()];

    const netIncome = [...z()];

    for (let i = 0; i < n; i++) {
      const { y, q } = quarters[i];

      let rev = 0;
      let exp = 0;
      let cogsQ = 0;
      let intQ = 0;

      for (const e of ledgerRows) {
        const dStr = e.entryDate ? String(e.entryDate).slice(0, 10) : '';
        const start = quarterStartYmd(y, q);
        const end = quarterEndYmd(y, q);
        if (!dStr || dStr < start || dStr > end) continue;
        const acct = accountsById.get(e.accountID);
        if (!acct) continue;
        const c = classifyAccount(acct);
        if (c.isRevenue) rev += absAmount(acct, e.debit, e.credit);
        if (c.isExpense) {
          exp += absAmount(acct, e.debit, e.credit);
          if (c.isCogs) cogsQ += absAmount(acct, e.debit, e.credit);
          if (c.isFinancialExpense || /interest/i.test(acct.accountName || '')) {
            intQ += absAmount(acct, e.debit, e.credit);
          }
        }
      }

      revenue[i] = rev;
      cogs[i] = cogsQ;
      interestExp[i] = intQ;
      netIncome[i] = rev - exp;

      let ta = 0;
      let tl = 0;
      let te = 0;
      let ca = 0;
      let cl = 0;
      let lt = 0;
      let fa = 0;
      let inv = 0;
      let arVal = 0;

      for (const { account: a, c } of classified) {
        if (c.isAsset) ta += absBalanceAtIndex(balanceAt, a, i);
        if (c.isLiability) tl += absBalanceAtIndex(balanceAt, a, i);
        if (c.isEquity) te += absBalanceAtIndex(balanceAt, a, i);
        if (c.isCurrentAsset) ca += absBalanceAtIndex(balanceAt, a, i);
        if (c.isCurrentLiab) cl += absBalanceAtIndex(balanceAt, a, i);
        if (c.isLongTermLiab) lt += absBalanceAtIndex(balanceAt, a, i);
        if (c.isFixedAsset) fa += absBalanceAtIndex(balanceAt, a, i);
        if (c.isInventory) inv += absBalanceAtIndex(balanceAt, a, i);
        if (c.isReceivable) arVal += absBalanceAtIndex(balanceAt, a, i);
      }

      totalAssets[i] = ta;
      totalLiab[i] = tl;
      totalEquity[i] = te;
      currentAssets[i] = ca;
      currentLiab[i] = cl;
      longTermLiab[i] = lt;
      fixedAssets[i] = fa;
      inventory[i] = inv;
      ar[i] = arVal;
    }

    const grossMargin = z();
    const operatingMargin = z();
    const netMargin = z();
    const roa = z();
    const roe = z();
    const roce = z();

    const currentRatio = z();
    const quickRatio = z();
    const invToNwc = z();

    const debtToAssets = z();
    const debtToEquity = z();
    const ltDebtToEquity = z();
    const tie = z();
    const fixedCharge = z();

    const invTurnover = z();
    const faturn = z();
    const taturn = z();
    const arTurnover = z();
    const collectionDays = z();

    for (let i = 0; i < n; i++) {
      const rev = revenue[i] || 0;
      const cogsQ = cogs[i] || 0;
      const intQ = interestExp[i] || 0;
      const ni = netIncome[i] ?? 0;
      const ta = totalAssets[i] || 0;
      const teq = totalEquity[i] || 0;
      const tl = totalLiab[i] || 0;
      const ca = currentAssets[i] || 0;
      const cl = currentLiab[i] || 0;
      const inv = inventory[i] || 0;
      const fa = fixedAssets[i] || 0;
      const arV = ar[i] || 0;
      const lt = longTermLiab[i] || 0;

      grossMargin[i] = rev > 0 && cogsQ > 0 ? (rev - cogsQ) / rev : null;

      const ebitProxy = ni + intQ;
      operatingMargin[i] = rev > 0 ? ebitProxy / rev : null;
      netMargin[i] = rev > 0 ? ni / rev : null;

      roa[i] = ta > 0 ? ni / ta : null;
      roe[i] = teq > 0 ? ni / teq : null;

      const commonEquity = teq;
      roce[i] = commonEquity > 0 ? ni / commonEquity : null;

      currentRatio[i] = cl > 0 ? ca / cl : null;
      quickRatio[i] = cl > 0 ? (ca - inv) / cl : null;
      const nwc = ca - cl;
      invToNwc[i] = nwc !== 0 ? inv / nwc : null;

      debtToAssets[i] = ta > 0 ? tl / ta : null;
      debtToEquity[i] = teq > 0 ? tl / teq : null;
      ltDebtToEquity[i] = teq > 0 ? lt / teq : null;

      tie[i] = intQ > 0 ? ebitProxy / intQ : null;
      fixedCharge[i] = intQ > 0 ? ebitProxy / intQ : null;

      const prevInv = i > 0 ? inventory[i - 1] || 0 : null;
      const avgInv =
        prevInv !== null && inv + prevInv > 0 ? (inv + prevInv) / 2 : inv > 0 ? inv : null;
      invTurnover[i] = avgInv && cogsQ > 0 ? cogsQ / avgInv : null;

      faturn[i] = fa > 0 ? rev / fa : null;
      taturn[i] = ta > 0 ? rev / ta : null;

      const prevAr = i > 0 ? ar[i - 1] || 0 : null;
      const avgAr = prevAr !== null && arV + prevAr > 0 ? (arV + prevAr) / 2 : arV > 0 ? arV : null;
      arTurnover[i] = avgAr && rev > 0 ? rev / avgAr : null;
      collectionDays[i] =
        arTurnover[i] && arTurnover[i] > 0 ? 365 / arTurnover[i] : null;
    }

    return {
      error: null,
      series: {
        grossMargin,
        operatingMargin,
        netMargin,
        roa,
        roe,
        roce,
        currentRatio,
        quickRatio,
        invToNwc,
        debtToAssets,
        debtToEquity,
        ltDebtToEquity,
        tie,
        fixedCharge,
        invTurnover,
        faturn,
        taturn,
        arTurnover,
        collectionDays,
      },
    };
  } catch (err) {
    console.error('fetchRatioSeriesFromLedger:', err);
    return {
      error: err instanceof Error ? err : new Error(String(err)),
      series: {},
    };
  }
}
