import { supabase } from '../supabaseClient';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const REPORT_TYPES = {
  TRIAL_BALANCE: "trial-balance",
  INCOME_STATEMENT: "income-statement",
  BALANCE_SHEET: "balance-sheet",
  RETAINED_EARNINGS: "retained-earnings",
};

const DURATION_REPORT_TYPES = new Set([
  REPORT_TYPES.INCOME_STATEMENT,
  REPORT_TYPES.RETAINED_EARNINGS,
]);

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function ledgerAccountLabelHtml(account) {
  const name = account?.accountName != null ? String(account.accountName) : '';
  const numRaw = account?.accountNumber != null ? String(account.accountNumber).trim() : '';
  if (!numRaw) return escapeHtml(name);
  return `<span class="report-ledger-link" data-ledger-account="${escapeHtml(numRaw)}" role="link" tabindex="0">${escapeHtml(name)}</span>`;
}

function formatDisplayDate(rawDate) {
  if (!rawDate) return '';
  const date = new Date(`${rawDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(rawDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function periodLabelForType(typeKey, options = {}) {
  const todayRaw = new Date().toISOString().slice(0, 10);
  const startRaw = options.startDate || '';
  const endRaw = options.endDate || options.asOfDate || todayRaw;
  const asOfRaw = options.asOfDate || options.endDate || todayRaw;
  const endText = formatDisplayDate(endRaw);
  const startText = formatDisplayDate(startRaw);

  if (DURATION_REPORT_TYPES.has(typeKey)) {
    if (typeKey === REPORT_TYPES.RETAINED_EARNINGS) {
      return `For the Year Ended ${endText}`;
    }
    if (startText) {
      return `For the Period ${startText} to ${endText}`;
    }
    return `For the Period Ended ${endText}`;
  }

  if (typeKey === REPORT_TYPES.BALANCE_SHEET) {
    return `At ${formatDisplayDate(asOfRaw)}`;
  }

  return `As of ${formatDisplayDate(asOfRaw)}`;
}

function safeCssClassSuffix(text) {
  return String(text || 'report').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function wrapReportWithHeader({ title, bodyHtml, periodLabel, typeKey }) {
  const typeClass = safeCssClassSuffix(typeKey);
  return {
    title,
    html: `
      <section class="report-bw report-type-${typeClass}">
        <header class="report-header-block">
          <p class="report-company">Addams &amp; Family Inc.</p>
          <p class="report-name">${escapeHtml(title)}</p>
          <p class="report-period">${escapeHtml(periodLabel)}</p>
        </header>
        <hr class="report-header-divider" />
        ${bodyHtml}
      </section>`,
  };
}


export function reportFilenameBase(typeKey) {
  const date = new Date().toISOString().slice(0, 10);
  const filename = String(typeKey || "report").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `${filename}-${date}`;
}

function formatMoney(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

function formatMoneyAbs(value) {
  return formatMoney(Math.abs(Number(value) || 0));
}

function formatMoneyInParentheses(value) {
  return `(${formatMoneyAbs(value)})`;
}

function formatShortDate(rawDate) {
  if (!rawDate) return '';
  const date = new Date(`${rawDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(rawDate);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

function signedBalance(account) {
  return Number(account.currentBalance) || 0;
}

function splitBalanceBySide(account) {
  const balance = signedBalance(account);
  const isCreditNormal = String(account.normalSide || '').toLowerCase() === 'credit';
  if (isCreditNormal) {
    return balance >= 0
      ? { debit: 0, credit: balance }
      : { debit: Math.abs(balance), credit: 0 };
  }
  return balance >= 0
    ? { debit: balance, credit: 0 }
    : { debit: 0, credit: Math.abs(balance) };
}

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

async function fetchLedgerRows() {
  const columns = 'accountID, debit, credit';
  const primary = await supabase.from('Ledger').select(columns);
  if (!primary.error) return primary.data || [];

  if (shouldTryLowercaseLedgerTable(primary.error)) {
    const fallback = await supabase.from('ledger').select(columns);
    if (!fallback.error) return fallback.data || [];
  }
  throw primary.error;
}

async function fetchReportAccounts() {
  const { data: accounts, error: accountsError } = await supabase
    .from('chartOfAccounts')
    .select('accountID, accountNumber, accountName, normalSide, initBalance, type, subType, active')
    .order('accountNumber', { ascending: true });

  if (accountsError) throw accountsError;

  const ledgerRows = await fetchLedgerRows();
  const movementByAccount = new Map();

  for (const row of ledgerRows) {
    const accountId = row.accountID;
    const debit = Number(row.debit) || 0;
    const credit = Number(row.credit) || 0;
    const existing = movementByAccount.get(accountId) || { debit: 0, credit: 0 };
    existing.debit += debit;
    existing.credit += credit;
    movementByAccount.set(accountId, existing);
  }

  return (accounts || []).map((account) => {
    const movement = movementByAccount.get(account.accountID) || { debit: 0, credit: 0 };
    const opening = Number(account.initBalance) || 0;
    const isCreditNormal = String(account.normalSide || '').toLowerCase() === 'credit';
    const netMovement = isCreditNormal
      ? movement.credit - movement.debit
      : movement.debit - movement.credit;
    return {
      ...account,
      currentBalance: opening + netMovement,
    };
  });
}

function buildTrialBalance(accounts) {
  const rows = accounts
    .filter((a) => a.active !== false)
    .map((a) => {
      const { debit, credit } = splitBalanceBySide(a);
      return {
        accountNumber: a.accountNumber,
        accountName: a.accountName,
        debit,
        credit,
      };
    })
    .filter((r) => r.debit !== 0 || r.credit !== 0);

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);

  const bodyRows = rows
    .map(
      (row) =>
        `<tr>
          <td class="label">${ledgerAccountLabelHtml(row)}</td>
          <td class="money">${row.debit === 0 ? '' : formatMoney(row.debit)}</td>
          <td class="money">${row.credit === 0 ? '' : formatMoney(row.credit)}</td>
        </tr>`,
    )
    .join('');

  return {
    title: 'Trial Balance',
    html: `<table class="report-table trial-balance-table">
        <thead>
          <tr class="trial-balance-column-headings">
            <th></th>
            <th class="money amount-single-underline">Debit</th>
            <th class="money amount-single-underline">Credit</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
        <tfoot class="trial-balance-footer">
          <tr class="trial-balance-total-row">
            <th></th>
            <th class="money amount-double-underline">${formatMoney(totalDebit)}</th>
            <th class="money amount-double-underline">${formatMoney(totalCredit)}</th>
          </tr>
        </tfoot>
      </table>`,
  };
}

function buildIncomeStatement(accounts) {
  const revenues = accounts.filter((a) => String(a.type || '').toLowerCase() === 'revenue');
  const expenses = accounts.filter((a) => String(a.type || '').toLowerCase() === 'expenses');
  const revenueTotal = revenues.reduce((sum, a) => sum + signedBalance(a), 0);
  const expenseTotal = expenses.reduce((sum, a) => sum + signedBalance(a), 0);
  const netIncome = revenueTotal - expenseTotal;

  const revenueRows = revenues
    .map(
      (a) => {
        const val = signedBalance(a);
        return `<tr><td class="label indent-1">${ledgerAccountLabelHtml(a)}</td><td class="money">${val === 0 ? '' : formatMoney(val)}</td></tr>`;
      },
    )
    .join('');
  const expenseRows = expenses
    .map(
      (a) => {
        const val = signedBalance(a);
        return `<tr><td class="label indent-1">${ledgerAccountLabelHtml(a)}</td><td class="money">${val === 0 ? '' : formatMoney(val)}</td></tr>`;
      },
    )
    .join('');

  return {
    title: 'Income Statement',
    html: `
      <section class="statement-section">
        <h3 class="statement-group-title">Revenues</h3>
        <table class="report-table income-statement-table">
          <tbody>
            ${revenueRows}
            <tr class="statement-total-row">
              <th class="label">Total Revenues</th>
              <th class="money amount-single-underline">${formatMoney(revenueTotal)}</th>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="statement-section">
        <h3 class="statement-group-title">Expenses</h3>
        <table class="report-table income-statement-table">
          <tbody>
            ${expenseRows}
            <tr class="statement-total-row">
              <th class="label">Total Expenses</th>
              <th class="money amount-single-underline">${formatMoney(expenseTotal)}</th>
            </tr>
          </tbody>
        </table>
      </section>

      <table class="report-table income-statement-table statement-net-table">
        <tbody>
          <tr class="statement-net-row">
            <th class="label">Net Income (Loss)</th>
            <th class="money amount-double-underline">${formatMoney(netIncome)}</th>
          </tr>
        </tbody>
      </table>`,
  };
}

function buildBalanceSheet(accounts) {
  const assets = accounts.filter((a) => String(a.type || '').toLowerCase() === 'assets');

  const normalize = (text) => String(text || '').toLowerCase();
  const isCurrentAsset = (account) => {
    const subType = normalize(account.subType);
    const name = normalize(account.accountName);
    const knownCurrentAssets = [
      'cash',
      'accounts receivable',
      'prepaid rent',
      'prepaid insurance',
      'supplies',
    ];
    return (
      subType.includes('current asset') ||
      knownCurrentAssets.some((assetName) => name.includes(assetName))
    );
  };
  const isContraAsset = (account) => normalize(account.accountName).includes('accumulated depreciation');

  const currentAssets = assets.filter(isCurrentAsset);
  const contraAssets = assets.filter(isContraAsset);
  const propertyPlantEquipment = assets.filter(
    (a) => !isCurrentAsset(a) && !isContraAsset(a),
  );

  const liabilityRows = new Map();
  for (const account of accounts) {
    const type = normalize(account.type);
    const name = normalize(account.accountName);
    const isLiability = type === 'liabilities';
    const isUnearnedRevenue = name.includes('unearned revenue');
    if (isLiability || isUnearnedRevenue) {
      const key = account.accountID || account.accountName;
      liabilityRows.set(key, account);
    }
  }
  const liabilities = Array.from(liabilityRows.values());

  const currentLiabilities = liabilities.filter((a) => normalize(a.subType).includes('current liabilities'));
  const otherLiabilities = liabilities.filter((a) => !normalize(a.subType).includes('current liabilities'));

  const equity = accounts.filter((a) => String(a.type || '').toLowerCase() === 'equity');
  const revenues = accounts.filter((a) => String(a.type || '').toLowerCase() === 'revenue');
  const expenses = accounts.filter((a) => String(a.type || '').toLowerCase() === 'expenses');
  const retainedAccounts = accounts.filter(
    (a) => String(a.subType || '').toLowerCase() === 'retained earnings',
  );

  const beginningRetained = retainedAccounts.reduce((sum, a) => sum + (Number(a.initBalance) || 0), 0);
  const revenueTotal = revenues.reduce((sum, a) => sum + signedBalance(a), 0);
  const expenseTotal = expenses.reduce((sum, a) => sum + signedBalance(a), 0);
  const netIncome = revenueTotal - expenseTotal;
  const endingRetained = beginningRetained + netIncome;

  // Always build retained earnings inside the balance sheet logic so equity
  // includes period earnings even if the retained earnings account is missing or stale.
  const equityWithoutRetained = equity.filter(
    (a) => String(a.subType || '').toLowerCase() !== 'retained earnings',
  );
  const equityForDisplay = [
    ...equityWithoutRetained,
    {
      accountNumber: '',
      accountName: 'Retained Earnings',
      currentBalance: endingRetained,
    },
  ];

  const renderRows = (list, options = {}) => {
    const amountGetter = options.amountGetter || signedBalance;
    const amountFormatter = options.amountFormatter || formatMoney;
    const indentClass = options.indentClass || 'indent-1';

    return list
      .map(
        (a) => {
          const val = amountGetter(a);
          return `<tr><td class="label ${indentClass}">${ledgerAccountLabelHtml(a)}</td><td class="money">${val === 0 ? '' : amountFormatter(val)}</td></tr>`;
        },
      )
      .join('');
  };

  const currentAssetTotal = currentAssets.reduce((sum, a) => sum + signedBalance(a), 0);
  const ppeGross = propertyPlantEquipment.reduce((sum, a) => sum + signedBalance(a), 0);
  const contraAssetTotal = contraAssets.reduce((sum, a) => sum + Math.abs(signedBalance(a)), 0);
  const ppeNet = ppeGross - contraAssetTotal;
  const totalAssets = currentAssetTotal + ppeNet;

  const liabilityAmount = (a) => Math.abs(signedBalance(a));
  const totalCurrentLiabilities = currentLiabilities.reduce((sum, a) => sum + liabilityAmount(a), 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + liabilityAmount(a), 0);
  const totalEquity = equityForDisplay.reduce((sum, a) => sum + signedBalance(a), 0);

  return {
    title: 'Balance Sheet',
    html: `<section class="balance-sheet-section">
      <h3 class="statement-group-title">Assets</h3>
      <table class="report-table balance-sheet-table">
        <tbody>
          <tr class="balance-sheet-heading-row"><th class="label indent-1">Current Assets</th><th class="money"></th></tr>
          ${renderRows(currentAssets, { indentClass: 'indent-2' })}
          <tr class="balance-sheet-total-row">
            <th class="label indent-1">Total Current Assets</th>
            <th class="money amount-single-underline">${formatMoney(currentAssetTotal)}</th>
          </tr>

          <tr class="balance-sheet-heading-row"><th class="label indent-1">Property Plant &amp; Equipment</th><th class="money"></th></tr>
          ${renderRows(propertyPlantEquipment, { indentClass: 'indent-2' })}
          ${renderRows(contraAssets, {
            indentClass: 'indent-2',
            amountGetter: (a) => Math.abs(signedBalance(a)),
            amountFormatter: formatMoneyInParentheses,
          })}
          <tr class="balance-sheet-total-row">
            <th class="label indent-1">Property Plant &amp; Equipment, Net</th>
            <th class="money amount-single-underline">${formatMoney(ppeNet)}</th>
          </tr>

          <tr class="balance-sheet-grand-total-row">
            <th class="label">Total Assets</th>
            <th class="money amount-double-underline">${formatMoney(totalAssets)}</th>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="balance-sheet-section">
      <h3 class="statement-group-title">Liabilities &amp; Stockholders&#39; Equity</h3>
      <table class="report-table balance-sheet-table">
        <tbody>
          <tr class="balance-sheet-heading-row"><th class="label">Liabilities</th><th class="money"></th></tr>
          <tr class="balance-sheet-heading-row"><th class="label indent-1">Current Liabilities</th><th class="money"></th></tr>
          ${renderRows(currentLiabilities, {
            indentClass: 'indent-2',
            amountGetter: liabilityAmount,
          })}
          <tr class="balance-sheet-total-row">
            <th class="label indent-1">Total Current Liabilities</th>
            <th class="money amount-single-underline">${formatMoney(totalCurrentLiabilities)}</th>
          </tr>
          ${renderRows(otherLiabilities, {
            indentClass: 'indent-1',
            amountGetter: liabilityAmount,
          })}
          <tr class="balance-sheet-total-row">
            <th class="label">Total Liabilities</th>
            <th class="money amount-single-underline">${formatMoney(totalLiabilities)}</th>
          </tr>

          <tr class="balance-sheet-spacer-row"><td></td><td></td></tr>

          <tr class="balance-sheet-heading-row"><th class="label">Stockholders&#39; Equity</th><th class="money"></th></tr>
          ${renderRows(equityForDisplay, { indentClass: 'indent-1' })}
          <tr class="balance-sheet-total-row">
            <th class="label">Total Stockholders&#39; Equity</th>
            <th class="money amount-single-underline">${formatMoney(totalEquity)}</th>
          </tr>

          <tr class="balance-sheet-grand-total-row">
            <th class="label">Total Liabilities &amp; Stockholders&#39; Equity</th>
            <th class="money amount-double-underline">${formatMoney(totalLiabilities + totalEquity)}</th>
          </tr>
        </tbody>
      </table>
    </section>`,
  };
}

function buildRetainedEarnings(accounts, options = {}) {
  const revenues = accounts.filter((a) => String(a.type || '').toLowerCase() === 'revenue');
  const expenses = accounts.filter((a) => String(a.type || '').toLowerCase() === 'expenses');
  const retained = accounts.filter((a) => String(a.subType || '').toLowerCase() === 'retained earnings');
  const dividends = accounts.filter((a) => String(a.accountName || '').toLowerCase().includes('dividend'));

  const beginningRetained = retained.reduce((sum, a) => sum + (Number(a.initBalance) || 0), 0);
  const revenueTotal = revenues.reduce((sum, a) => sum + signedBalance(a), 0);
  const expenseTotal = expenses.reduce((sum, a) => sum + signedBalance(a), 0);
  const netIncome = revenueTotal - expenseTotal;
  const dividendsTotal = dividends.reduce((sum, a) => sum + Math.abs(signedBalance(a)), 0);
  const endingRetained = beginningRetained + netIncome - dividendsTotal;

  const startLabel = formatShortDate(options.startDate);
  const endLabel = formatShortDate(options.endDate || options.asOfDate || new Date().toISOString().slice(0, 10));

  return {
    title: 'Statement of Retained Earnings',
    html: `<section class="retained-earnings-section">
      <table class="report-table retained-earnings-table">
        <tbody>
          <tr class="retained-earnings-detail-row">
            <td class="label indent-0">Beginning Retained Earnings${startLabel ? `, ${escapeHtml(startLabel)}` : ''}</td>
            <td class="money">${formatMoney(beginningRetained)}</td>
          </tr>
          <tr class="retained-earnings-detail-row">
            <td class="label indent-0">Add: Net Income</td>
            <td class="money">${formatMoney(netIncome)}</td>
          </tr>
          <tr class="retained-earnings-detail-row retained-earnings-less-row">
            <td class="label indent-0">Less: Dividends</td>
            <td class="money amount-single-underline">${formatMoney(dividendsTotal)}</td>
          </tr>
          <tr class="retained-earnings-final-row">
            <th class="label indent-0">End Retained Earnings${endLabel ? `, ${escapeHtml(endLabel)}` : ''}</th>
            <th class="money amount-double-underline">${formatMoney(endingRetained)}</th>
          </tr>
        </tbody>
      </table>
    </section>`,
  };
}

export async function generateReportHtml(typeKey, options = {}) {
  const accounts = await fetchReportAccounts();
  let baseReport;
  if (typeKey === REPORT_TYPES.TRIAL_BALANCE) baseReport = buildTrialBalance(accounts);
  else if (typeKey === REPORT_TYPES.INCOME_STATEMENT) baseReport = buildIncomeStatement(accounts);
  else if (typeKey === REPORT_TYPES.BALANCE_SHEET) baseReport = buildBalanceSheet(accounts);
  else if (typeKey === REPORT_TYPES.RETAINED_EARNINGS) baseReport = buildRetainedEarnings(accounts, options);
  else baseReport = { title: 'Report', html: '<p>No report type selected.</p>' };

  return wrapReportWithHeader({
    title: baseReport.title,
    bodyHtml: baseReport.html,
    periodLabel: periodLabelForType(typeKey, options),
    typeKey,
  });
}



// Temporary sample HTML reports for download button use REPLACE LATER
export function getSampleReportHtml(typeKey) {
  const samples = {
    [REPORT_TYPES.TRIAL_BALANCE]: {
      title: "Trial Balance",
      html: "<h1>Trial Balance</h1>",
    },
    [REPORT_TYPES.INCOME_STATEMENT]: {
      title: "Income Statement",
      html: "<h1>Income Statement</h1>",
    },
    [REPORT_TYPES.BALANCE_SHEET]: {
      title: "Balance Sheet",
      html: "<h1>Balance Sheet</h1>",
    },
    [REPORT_TYPES.RETAINED_EARNINGS]: {
      title: "Statement of Retained Earnings",
      html: "<h1>Statement of Retained Earnings</h1>",
    },
  };

  return (
    samples[typeKey] || {
      title: "Report",
      html: "<p>No report type selected.</p>",
    }
  );
}


// Downlaods the HTML fragment as .html file (DON'T REMOVE)
export function downloadHtmlReport({ title, htmlFragment, filenameBase }) {
  const safeTitle = escapeHtml(title);
  const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
  body { font-family: system-ui, "Segoe UI", sans-serif; padding: 24px; color: #111; max-width: 900px; margin: 0 auto; }
  .report-bw { color: #000; background: #fff; }
  .report-header-block { text-align: center; }
  .report-company, .report-name, .report-period { margin: 0; font-weight: 700; }
  .report-company, .report-name { font-size: 1.35rem; }
  .report-period { font-size: 1rem; margin-top: 4px; }
  .report-header-divider { border: 0; border-top: 2px solid #000; margin: 10px 0 18px; }

  .report-table { display: table; width: 100%; border-collapse: collapse; border-spacing: 0; margin: 0; }
  .report-table tbody tr { background: #fff; }
  .report-table td, .report-table th {
    border: 0;
    padding: 4px 0;
    text-align: left;
    color: #000;
    background: #fff;
    font-weight: 400;
  }
  .report-table .label.indent-1 { padding-left: 44px; }
  .report-table .label.indent-2 { padding-left: 72px; }
  .report-table td.money, .report-table th.money { text-align: right; width: 220px; white-space: nowrap; }

  .statement-section { margin: 0 0 20px; }
  .statement-group-title { margin: 0 0 6px; font-size: 1.85rem; }
  .statement-total-row th { font-size: 1.9rem; font-weight: 700; padding-top: 2px; }
  .statement-net-table { margin-top: 4px; }
  .statement-net-row th { font-size: 1.9rem; font-weight: 700; }

  .amount-single-underline, .amount-double-underline {
    text-decoration-line: underline;
    text-decoration-color: #000;
    text-decoration-style: solid;
  }
  .amount-single-underline { text-decoration-thickness: 1px; text-underline-offset: 8px; }
  .amount-double-underline {
    text-decoration-thickness: 2px;
    text-decoration-style: double;
    text-underline-offset: 8px;
  }

  .trial-balance-table { table-layout: fixed; }
  .trial-balance-table thead th,
  .trial-balance-table tbody td,
  .trial-balance-table tfoot th {
    border: 0;
    background: #fff;
    color: #000;
  }
  .trial-balance-table .label { padding-left: 16px; }
  .trial-balance-table tbody tr td { border-bottom: 2px solid #000; }
  .trial-balance-table .money { width: 170px; }
  .trial-balance-table .trial-balance-column-headings th {
    font-size: 1.9rem;
    font-weight: 700;
    padding-bottom: 2px;
  }
  .trial-balance-table .trial-balance-column-headings th:first-child {
    padding: 0;
    width: auto;
  }
  .trial-balance-table .trial-balance-total-row th {
    font-size: 2rem;
    font-weight: 700;
    border: 0;
    padding-top: 8px;
  }

  .balance-sheet-section { margin: 0 0 20px; }
  .balance-sheet-table { table-layout: fixed; }
  .balance-sheet-table .money { width: 190px; }
  .balance-sheet-table .balance-sheet-heading-row th {
    font-size: 1.85rem;
    font-weight: 700;
    padding-top: 2px;
    padding-bottom: 2px;
  }
  .balance-sheet-table .balance-sheet-total-row th {
    font-size: 1.85rem;
    font-weight: 700;
    padding-top: 2px;
    padding-bottom: 2px;
  }
  .balance-sheet-table .balance-sheet-grand-total-row th {
    font-size: 1.95rem;
    font-weight: 700;
    padding-top: 4px;
  }
  .balance-sheet-table .balance-sheet-spacer-row td { padding: 10px 0; }

  .retained-earnings-section { margin: 0 0 20px; }
  .retained-earnings-table { table-layout: fixed; }
  .retained-earnings-table .money { width: 190px; }
  .retained-earnings-table .retained-earnings-detail-row td {
    font-size: 1.85rem;
    font-weight: 400;
    padding-top: 1px;
    padding-bottom: 1px;
  }
  .retained-earnings-table .retained-earnings-final-row th {
    font-size: 1.95rem;
    font-weight: 700;
    padding-top: 2px;
  }
</style>
</head>
<body>
${htmlFragment}
</body>
</html>`;

  const blob = new Blob([fullDoc], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildPrintableReportDocument({ title, htmlFragment }) {
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
  body { font-family: system-ui, "Segoe UI", sans-serif; padding: 24px; color: #111; max-width: 900px; margin: 0 auto; }
  .report-bw { color: #000; background: #fff; }
  .report-header-block { text-align: center; }
  .report-company, .report-name, .report-period { margin: 0; font-weight: 700; }
  .report-company, .report-name { font-size: 1.35rem; }
  .report-period { font-size: 1rem; margin-top: 4px; }
  .report-header-divider { border: 0; border-top: 2px solid #000; margin: 10px 0 18px; }

  .report-table { display: table; width: 100%; border-collapse: collapse; border-spacing: 0; margin: 0; }
  .report-table tbody tr { background: #fff; }
  .report-table td, .report-table th {
    border: 0;
    padding: 4px 0;
    text-align: left;
    color: #000;
    background: #fff;
    font-weight: 400;
  }
  .report-table .label.indent-1 { padding-left: 44px; }
  .report-table .label.indent-2 { padding-left: 72px; }
  .report-table td.money, .report-table th.money { text-align: right; width: 220px; white-space: nowrap; }

  .statement-section { margin: 0 0 20px; }
  .statement-group-title { margin: 0 0 6px; font-size: 1.85rem; }
  .statement-total-row th { font-size: 1.9rem; font-weight: 700; padding-top: 2px; }
  .statement-net-table { margin-top: 4px; }
  .statement-net-row th { font-size: 1.9rem; font-weight: 700; }

  .amount-single-underline, .amount-double-underline {
    text-decoration-line: underline;
    text-decoration-color: #000;
    text-decoration-style: solid;
  }
  .amount-single-underline { text-decoration-thickness: 1px; text-underline-offset: 8px; }
  .amount-double-underline {
    text-decoration-thickness: 2px;
    text-decoration-style: double;
    text-underline-offset: 8px;
  }

  .trial-balance-table { table-layout: fixed; }
  .trial-balance-table thead th,
  .trial-balance-table tbody td,
  .trial-balance-table tfoot th {
    border: 0;
    background: #fff;
    color: #000;
  }
  .trial-balance-table .label { padding-left: 16px; }
  .trial-balance-table tbody tr td { border-bottom: 2px solid #000; }
  .trial-balance-table .money { width: 170px; }
  .trial-balance-table .trial-balance-column-headings th {
    font-size: 1.9rem;
    font-weight: 700;
    padding-bottom: 2px;
  }
  .trial-balance-table .trial-balance-column-headings th:first-child {
    padding: 0;
    width: auto;
  }
  .trial-balance-table .trial-balance-total-row th {
    font-size: 2rem;
    font-weight: 700;
    border: 0;
    padding-top: 8px;
  }

  .balance-sheet-section { margin: 0 0 20px; }
  .balance-sheet-table { table-layout: fixed; }
  .balance-sheet-table .money { width: 190px; }
  .balance-sheet-table .balance-sheet-heading-row th {
    font-size: 1.85rem;
    font-weight: 700;
    padding-top: 2px;
    padding-bottom: 2px;
  }
  .balance-sheet-table .balance-sheet-total-row th {
    font-size: 1.85rem;
    font-weight: 700;
    padding-top: 2px;
    padding-bottom: 2px;
  }
  .balance-sheet-table .balance-sheet-grand-total-row th {
    font-size: 1.95rem;
    font-weight: 700;
    padding-top: 4px;
  }
  .balance-sheet-table .balance-sheet-spacer-row td { padding: 10px 0; }

  .retained-earnings-section { margin: 0 0 20px; }
  .retained-earnings-table { table-layout: fixed; }
  .retained-earnings-table .money { width: 190px; }
  .retained-earnings-table .retained-earnings-detail-row td {
    font-size: 1.85rem;
    font-weight: 400;
    padding-top: 1px;
    padding-bottom: 1px;
  }
  .retained-earnings-table .retained-earnings-final-row th {
    font-size: 1.95rem;
    font-weight: 700;
    padding-top: 2px;
  }
</style>
</head>
<body>
${htmlFragment}
</body>
</html>`;
}

async function createReportJpegDataUri({ title, htmlFragment }) {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = '900px';
  wrapper.style.background = '#fff';
  wrapper.innerHTML = buildPrintableReportDocument({ title, htmlFragment });
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 1,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    return canvas.toDataURL('image/jpeg', 0.75);
  } finally {
    document.body.removeChild(wrapper);
  }
}

async function createReportPdfBlob({ title, htmlFragment }) {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = '900px';
  wrapper.style.background = '#fff';
  wrapper.innerHTML = buildPrintableReportDocument({ title, htmlFragment });
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 1,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.75);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(wrapper);
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function getReportPdfBlob({ title, htmlFragment }) {
  return createReportPdfBlob({ title, htmlFragment });
}

export async function downloadPdfReport({ title, htmlFragment, filenameBase }) {
  const blob = await createReportPdfBlob({ title, htmlFragment });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function getReportPdfBase64({ title, htmlFragment }) {
  const blob = await createReportPdfBlob({ title, htmlFragment });
  return blobToBase64(blob);
}

export async function getReportJpegBase64({ title, htmlFragment }) {
  const dataUri = await createReportJpegDataUri({ title, htmlFragment });
  const base64 = String(dataUri).includes(',') ? String(dataUri).split(',')[1] : '';
  return base64;
}
