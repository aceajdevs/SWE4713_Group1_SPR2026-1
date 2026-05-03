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
 * @param {string} label e.g. 2026-05-02 (week ending)
 * @returns {string | null}
 */
export function parsePeriodEndLabel(label) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(label).trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function shiftYmd(ymd, deltaDays) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
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
const SALES_NAME_RE = /\bsales\b|service\s+revenue|\brevenue\b/i;
const COGS_SUBTYPE_RE = /cost\s+of\s+goods|cost\s+of\s+sales|cost\s+of\s+revenue/i;
const INTEREST_CHARGE_NAME_RE = /\binterest\b|finance\s*charge|borrowing\s*cost|loan\s*cost|debt\s*service/i;
const FINANCIAL_SUBTYPE_RE = /financial\s+expenses?|financing\s+expenses?/i;
const AR_NAME_RE = /receivable|a\/r|accounts\s+receivable/i;
const INV_NAME_RE = /inventory|merchandise|finished\s*goods|supplies/i;
const FIXED_ASSET_NAME_RE = /equipment|machinery|building|land|vehicle|furniture|fixture|plant/i;
const CONTRA_ASSET_RE = /accumulated\s+depreciation|allowance/i;
const LEASE_NAME_RE = /lease|rent/i;
const TAX_NAME_RE = /tax|income\s+tax/i;

function classifyAccount(a) {
  const type = String(a.type || '').toLowerCase();
  const sub = String(a.subType || '').toLowerCase();
  const name = String(a.accountName || '').toLowerCase();
  return {
    isRevenue: type === 'revenue',
    isExpense: type === 'expenses',
    isSales: type === 'revenue' && SALES_NAME_RE.test(a.accountName || ''),
    isAsset: type === 'assets',
    isLiability: type === 'liabilities',
    isEquity: type === 'equity',
    isCurrentAsset: type === 'assets' && sub.includes('current asset'),
    isCurrentLiab: type === 'liabilities' && sub === 'current liabilities',
    isLongTermLiab: type === 'liabilities' && sub === 'long-term liabilities',
    isFixedAsset:
      type === 'assets' &&
      !sub.includes('current asset') &&
      !CONTRA_ASSET_RE.test(a.accountName || '') &&
      (sub.includes('fixed asset') || FIXED_ASSET_NAME_RE.test(a.accountName || '')),
    isFinancialExpense: type === 'expenses' && FINANCIAL_SUBTYPE_RE.test(a.subType || ''),
    isInterestCharge:
      type === 'expenses' &&
      (INTEREST_CHARGE_NAME_RE.test(a.accountName || '') || INTEREST_CHARGE_NAME_RE.test(a.subType || '')),
    isLeaseObligation:
      (type === 'expenses' || type === 'liabilities') &&
      (LEASE_NAME_RE.test(a.accountName || '') || LEASE_NAME_RE.test(a.subType || '')),
    isTaxExpense:
      type === 'expenses' &&
      (TAX_NAME_RE.test(a.accountName || '') || TAX_NAME_RE.test(a.subType || '')),
    isCogs:
      type === 'expenses' &&
      (COGS_NAME_RE.test(a.accountName || '') || COGS_SUBTYPE_RE.test(a.subType || '')),
    isInventory: type === 'assets' && sub.includes('current asset') && INV_NAME_RE.test(name),
    isReceivable: type === 'assets' && sub.includes('current asset') && AR_NAME_RE.test(a.accountName || ''),
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
 * Per-account ending balances after each period end, in order of `periodEnds`.
 * @param {object} account
 * @param {object[]} entriesSorted — ascending by date for this account
 * @param {string[]} periodEnds - YYYY-MM-DD period end labels
 */
function endingBalancesForPeriods(account, entriesSorted, periodEnds) {
  let balance = Number(account.initBalance) || 0;
  let ei = 0;
  const out = [];
  const credit = isCreditNormal(account);

  for (const endStr of periodEnds) {
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
function computeEndingBalancesByPeriod(accounts, entriesByAccount, periodEnds) {
  /** @type {Record<string, number[]>} */
  const map = {};
  for (const account of accounts) {
    const id = account.accountID;
    const entries = entriesByAccount.get(id) || [];
    map[id] = endingBalancesForPeriods(account, entries, periodEnds);
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
  const periodEnds = periodLabels.map(parsePeriodEndLabel).filter(Boolean);
  if (!periodEnds.length) {
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

    const balanceAt = computeEndingBalancesByPeriod(accounts, entriesByAccount, periodEnds);

    const n = periodEnds.length;
    const z = () => Array(n).fill(null);

    const revenue = [...z()];
    const sales = [...z()];
    const cogs = [...z()];
    const interestExp = [...z()];
    const leaseObligations = [...z()];
    const taxExp = [...z()];

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
      const end = periodEnds[i];
      const start = shiftYmd(end, -6);

      let rev = 0;
      let salesQ = 0;
      let exp = 0;
      let cogsQ = 0;
      let intByNameQ = 0;
      let intFinancialQ = 0;
      let leaseQ = 0;
      let taxQ = 0;

      for (const e of ledgerRows) {
        const dStr = e.entryDate ? String(e.entryDate).slice(0, 10) : '';
        if (!dStr || dStr < start || dStr > end) continue;
        const acct = accountsById.get(e.accountID);
        if (!acct) continue;
        const c = classifyAccount(acct);
        const amt = absAmount(acct, e.debit, e.credit);
        if (c.isRevenue) {
          rev += amt;
          if (c.isSales) salesQ += amt;
        }
        if (c.isExpense) {
          exp += amt;
          if (c.isCogs) cogsQ += amt;
          if (c.isInterestCharge) intByNameQ += amt;
          if (c.isFinancialExpense) intFinancialQ += amt;
          if (c.isTaxExpense) taxQ += amt;
        }
        if (c.isLeaseObligation) {
          leaseQ += amt;
        }
      }

      revenue[i] = rev;
      sales[i] = salesQ > 0 ? salesQ : rev;
      cogs[i] = cogsQ;
      const intQ = intByNameQ > 0 ? intByNameQ : intFinancialQ;
      interestExp[i] = intQ;
      leaseObligations[i] = leaseQ;
      taxExp[i] = taxQ;
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
      const rev = sales[i] || 0;
      const cogsQ = cogs[i] || 0;
      const intQ = interestExp[i] || 0;
      const leaseQ = leaseObligations[i] || 0;
      const taxQ = taxExp[i] || 0;
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

      grossMargin[i] = rev > 0 ? (rev - cogsQ) / rev : null;

      const ebitProxy = ni + intQ + taxQ;
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
      fixedCharge[i] = (intQ + leaseQ) > 0 ? (ebitProxy + leaseQ) / (intQ + leaseQ) : null;

      invTurnover[i] = inv > 0 ? rev / inv : null;

      faturn[i] = fa > 0 ? rev / fa : null;
      taturn[i] = ta > 0 ? rev / ta : null;

      const annualCreditSales = rev * 52;
      arTurnover[i] = arV > 0 && annualCreditSales > 0 ? annualCreditSales / arV : null;
      const avgDailySales = annualCreditSales > 0 ? annualCreditSales / 365 : 0;
      collectionDays[i] = arV > 0 && avgDailySales > 0 ? arV / avgDailySales : null;
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
