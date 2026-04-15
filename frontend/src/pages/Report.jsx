import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { HelpTooltip } from '../components/HelpTooltip';
import '../global.css';

function Report() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeReportKey, setActiveReportKey] = useState(null);
  const [generatedAt, setGeneratedAt] = useState('');

  const dashboardPath =
    user?.role === 'administrator'
      ? '/admin-dashboard'
      : user?.role === 'manager'
        ? '/manager-dashboard'
        : user?.role === 'accountant'
          ? '/accountant-dashboard'
          : '/dashboard';

  const reportDefinitions = useMemo(
    () => ({
      trialBalance: {
        title: 'Trial Balance',
        rows: [
          { label: 'Cash', debit: 15850.0, credit: 0 },
          { label: 'Accounts Receivable', debit: 8250.0, credit: 0 },
          { label: 'Equipment', debit: 30000.0, credit: 0 },
          { label: 'Accounts Payable', debit: 0, credit: 9650.0 },
          { label: 'Owner Equity', debit: 0, credit: 36000.0 },
          { label: 'Service Revenue', debit: 0, credit: 8450.0 },
        ],
      },
      incomeStatement: {
        title: 'Income Statement',
        rows: [
          { label: 'Service Revenue', amount: 8450.0 },
          { label: 'Operating Expenses', amount: -3250.0 },
          { label: 'Rent Expense', amount: -1200.0 },
          { label: 'Utilities Expense', amount: -350.0 },
        ],
      },
      balanceSheet: {
        title: 'Balance Sheet',
        assets: [
          { label: 'Cash', amount: 15850.0 },
          { label: 'Accounts Receivable', amount: 8250.0 },
          { label: 'Equipment', amount: 30000.0 },
        ],
        liabilities: [{ label: 'Accounts Payable', amount: 9650.0 }],
        equity: [{ label: 'Owner Equity', amount: 36000.0 }],
      },
      retainedEarnings: {
        title: 'Retained Earnings Statement',
        beginningBalance: 22000.0,
        netIncome: 3650.0,
        ownerDraws: 1200.0,
      },
    }),
    [],
  );

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }),
    [],
  );

  const formatCurrency = (value) => currencyFormatter.format(value);

  const handleGenerateReport = (reportKey) => {
    setActiveReportKey(reportKey);
    setGeneratedAt(new Date().toLocaleString());
  };

  const activeReport = activeReportKey ? reportDefinitions[activeReportKey] : null;

  return (
    <div className="container">
      <div className="header-row" style={{ alignItems: 'center' }}>
        <h1>Reports</h1>
        <HelpTooltip text="Return to your dashboard.">
          <button
            type="button"
            onClick={() => navigate(dashboardPath)}
            className="button-primary"
            style={{ marginLeft: '16px' }}
          >
            Back to Dashboard
          </button>
        </HelpTooltip>
      </div>

      <div style={{ marginTop: '16px', maxWidth: '820px' }}>
        <p style={{ marginBottom: '12px' }}>
          This is a placeholder page for generating financial reports. Add report controls and output here.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <HelpTooltip text="Generate a Trial Balance report.">
            <button type="button" className="button-primary" onClick={() => handleGenerateReport('trialBalance')}>
              Generate Trial Balance
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate an Income Statement report.">
            <button type="button" className="button-primary" onClick={() => handleGenerateReport('incomeStatement')}>
              Generate Income Statement
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate a Balance Sheet report.">
            <button type="button" className="button-primary" onClick={() => handleGenerateReport('balanceSheet')}>
              Generate Balance Sheet
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate a Retained Earnings Statement report.">
            <button type="button" className="button-primary" onClick={() => handleGenerateReport('retainedEarnings')}>
              Generate Retained Earnings
            </button>
          </HelpTooltip>
        </div>

        <div
          style={{
            marginTop: '18px',
            border: '2px dashed var(--bff-primary)',
            borderRadius: '8px',
            padding: '14px',
            background: 'var(--bff-light-text)',
          }}
        >
          <strong>Report output</strong>
          {!activeReport ? (
            <p style={{ margin: '8px 0 0', color: 'var(--bff-dark-text)' }}>
              Generated report content will display here.
            </p>
          ) : (
            <div style={{ marginTop: '10px', color: 'var(--bff-dark-text)' }}>
              <h3 style={{ margin: '0 0 8px' }}>{activeReport.title}</h3>
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>
                Generated on: {generatedAt}
              </p>

              {activeReportKey === 'trialBalance' && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingBottom: '6px' }}>Account</th>
                      <th style={{ textAlign: 'right', paddingBottom: '6px' }}>Debit</th>
                      <th style={{ textAlign: 'right', paddingBottom: '6px' }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReport.rows.map((row) => (
                      <tr key={row.label}>
                        <td style={{ padding: '4px 0' }}>{row.label}</td>
                        <td style={{ textAlign: 'right', padding: '4px 0' }}>{formatCurrency(row.debit)}</td>
                        <td style={{ textAlign: 'right', padding: '4px 0' }}>{formatCurrency(row.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeReportKey === 'incomeStatement' && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingBottom: '6px' }}>Category</th>
                      <th style={{ textAlign: 'right', paddingBottom: '6px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReport.rows.map((row) => (
                      <tr key={row.label}>
                        <td style={{ padding: '4px 0' }}>{row.label}</td>
                        <td style={{ textAlign: 'right', padding: '4px 0' }}>{formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ fontWeight: 700, paddingTop: '8px' }}>Net Income</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, paddingTop: '8px' }}>
                        {formatCurrency(activeReport.rows.reduce((sum, row) => sum + row.amount, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              {activeReportKey === 'balanceSheet' && (
                <>
                  <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Assets</p>
                  {activeReport.assets.map((item) => (
                    <p key={item.label} style={{ margin: '2px 0' }}>
                      {item.label}: {formatCurrency(item.amount)}
                    </p>
                  ))}

                  <p style={{ margin: '10px 0 6px', fontWeight: 700 }}>Liabilities</p>
                  {activeReport.liabilities.map((item) => (
                    <p key={item.label} style={{ margin: '2px 0' }}>
                      {item.label}: {formatCurrency(item.amount)}
                    </p>
                  ))}

                  <p style={{ margin: '10px 0 6px', fontWeight: 700 }}>Equity</p>
                  {activeReport.equity.map((item) => (
                    <p key={item.label} style={{ margin: '2px 0' }}>
                      {item.label}: {formatCurrency(item.amount)}
                    </p>
                  ))}
                </>
              )}

              {activeReportKey === 'retainedEarnings' && (
                <>
                  <p style={{ margin: '2px 0' }}>
                    Beginning Retained Earnings: {formatCurrency(activeReport.beginningBalance)}
                  </p>
                  <p style={{ margin: '2px 0' }}>Plus Net Income: {formatCurrency(activeReport.netIncome)}</p>
                  <p style={{ margin: '2px 0' }}>Less Owner Draws: {formatCurrency(activeReport.ownerDraws)}</p>
                  <p style={{ margin: '10px 0 0', fontWeight: 700 }}>
                    Ending Retained Earnings:{' '}
                    {formatCurrency(activeReport.beginningBalance + activeReport.netIncome - activeReport.ownerDraws)}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Report;