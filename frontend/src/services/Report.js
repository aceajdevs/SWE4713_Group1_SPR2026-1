import { supabase } from '../supabaseClient';

export const REPORT_TYPES = {
  TRIAL_BALANCE: "trial-balance",
  INCOME_STATEMENT: "income-statement",
  BALANCE_SHEET: "balance-sheet",
  RETAINED_EARNINGS: "retained-earnings",
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
        account: `${a.accountNumber} - ${a.accountName}`,
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
          <td>${escapeHtml(row.account)}</td>
          <td class="money">${row.debit === 0 ? '' : formatMoney(row.debit)}</td>
          <td class="money">${row.credit === 0 ? '' : formatMoney(row.credit)}</td>
        </tr>`,
    )
    .join('');

  return {
    title: 'Trial Balance',
    html: `<h1>Trial Balance</h1>
      <table>
        <thead>
          <tr><th>Account</th><th class="money">Debit</th><th class="money">Credit</th></tr>
        </thead>
        <tbody>${bodyRows}</tbody>
        <tfoot>
          <tr><th>Total</th><th class="money">${formatMoney(totalDebit)}</th><th class="money">${formatMoney(totalCredit)}</th></tr>
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
        return `<tr><td>${escapeHtml(`${a.accountNumber} - ${a.accountName}`)}</td><td class="money">${val === 0 ? '' : formatMoney(val)}</td></tr>`;
      },
    )
    .join('');
  const expenseRows = expenses
    .map(
      (a) => {
        const val = signedBalance(a);
        return `<tr><td>${escapeHtml(`${a.accountNumber} - ${a.accountName}`)}</td><td class="money">${val === 0 ? '' : formatMoney(val)}</td></tr>`;
      },
    )
    .join('');

  return {
    title: 'Income Statement',
    html: `<h1>Income Statement</h1>
      <h2>Revenue</h2>
      <table><tbody>${revenueRows}<tr><th>Total Revenue</th><th class="money">${formatMoney(revenueTotal)}</th></tr></tbody></table>
      <h2>Expenses</h2>
      <table><tbody>${expenseRows}<tr><th>Total Expenses</th><th class="money">${formatMoney(expenseTotal)}</th></tr></tbody></table>
      <table><tbody><tr><th>Net Income</th><th class="money">${formatMoney(netIncome)}</th></tr></tbody></table>`,
  };
}

function buildBalanceSheet(accounts) {
  const assets = accounts.filter((a) => String(a.type || '').toLowerCase() === 'assets');
  const liabilities = accounts.filter((a) => {
    const type = String(a.type || '').toLowerCase();
    const subType = String(a.subType || '').toLowerCase();
    const name = String(a.accountName || '').toLowerCase();
    const isCurrentLiability = type === 'liabilities' && subType === 'current liabilities';
    const isUnearnedRevenue = name.includes('unearned revenue');
    return isCurrentLiability || isUnearnedRevenue;
  });
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

  const renderRows = (list, amountGetter = signedBalance) =>
    list
      .map(
        (a) => {
          const val = amountGetter(a);
          return `<tr><td>${escapeHtml(`${a.accountNumber ? `${a.accountNumber} - ` : ''}${a.accountName}`)}</td><td class="money">${val === 0 ? '' : formatMoney(val)}</td></tr>`;
        },
      )
      .join('');

  const totalAssets = assets.reduce((sum, a) => sum + signedBalance(a), 0);
  const liabilityAmount = (a) => Math.abs(signedBalance(a));
  const totalLiabilities = liabilities.reduce((sum, a) => sum + liabilityAmount(a), 0);
  const totalEquity = equityForDisplay.reduce((sum, a) => sum + signedBalance(a), 0);

  return {
    title: 'Balance Sheet',
    html: `<h1>Balance Sheet</h1>
      <h2>Assets</h2>
      <table><tbody>${renderRows(assets)}<tr><th>Total Assets</th><th class="money">${formatMoney(totalAssets)}</th></tr></tbody></table>
      <h2>Liabilities</h2>
      <table><tbody>${renderRows(liabilities, liabilityAmount)}<tr><th>Total Liabilities</th><th class="money">${formatMoney(totalLiabilities)}</th></tr></tbody></table>
      <h2>Equity</h2>
      <table><tbody>${renderRows(equityForDisplay)}<tr><th>Total Equity</th><th class="money">${formatMoney(totalEquity)}</th></tr></tbody></table>
      <table><tbody><tr><th>Total Liabilities + Equity</th><th class="money">${formatMoney(totalLiabilities + totalEquity)}</th></tr></tbody></table>`,
  };
}

function buildRetainedEarnings(accounts) {
  const revenues = accounts.filter((a) => String(a.type || '').toLowerCase() === 'revenue');
  const expenses = accounts.filter((a) => String(a.type || '').toLowerCase() === 'expenses');
  const retained = accounts.filter((a) => String(a.subType || '').toLowerCase() === 'retained earnings');

  const beginningRetained = retained.reduce((sum, a) => sum + (Number(a.initBalance) || 0), 0);
  const revenueTotal = revenues.reduce((sum, a) => sum + signedBalance(a), 0);
  const expenseTotal = expenses.reduce((sum, a) => sum + signedBalance(a), 0);
  const netIncome = revenueTotal - expenseTotal;
  const endingRetained = beginningRetained + netIncome;

  return {
    title: 'Statement of Retained Earnings',
    html: `<h1>Statement of Retained Earnings</h1>
      <table>
        <tbody>
          <tr><td>Beginning Retained Earnings</td><td class="money">${formatMoney(beginningRetained)}</td></tr>
          <tr><td>Plus: Net Income</td><td class="money">${formatMoney(netIncome)}</td></tr>
          <tr><th>Ending Retained Earnings</th><th class="money">${formatMoney(endingRetained)}</th></tr>
        </tbody>
      </table>`,
  };
}

export async function generateReportHtml(typeKey) {
  const accounts = await fetchReportAccounts();
  if (typeKey === REPORT_TYPES.TRIAL_BALANCE) return buildTrialBalance(accounts);
  if (typeKey === REPORT_TYPES.INCOME_STATEMENT) return buildIncomeStatement(accounts);
  if (typeKey === REPORT_TYPES.BALANCE_SHEET) return buildBalanceSheet(accounts);
  if (typeKey === REPORT_TYPES.RETAINED_EARNINGS) return buildRetainedEarnings(accounts);
  return { title: 'Report', html: '<p>No report type selected.</p>' };
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
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; }
  td.money, th.money { text-align: right; }
  h1 { font-size: 1.35rem; margin: 0 0 16px; }
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
