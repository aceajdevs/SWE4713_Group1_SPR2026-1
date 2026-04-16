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
