import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { HelpTooltip } from '../components/HelpTooltip';
import {
  REPORT_TYPES,
  getSampleReportHtml,
  downloadHtmlReport,
  reportFilenameBase,
} from '../services/Report';
import '../global.css';

function Report() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reportTitle, setReportTitle] = useState('');
  const [reportHtml, setReportHtml] = useState('');
  const [activeType, setActiveType] = useState(null);

  const dashboardPath =
    user?.role === 'administrator'
      ? '/admin-dashboard'
      : user?.role === 'manager'
        ? '/manager-dashboard'
        : user?.role === 'accountant'
          ? '/accountant-dashboard'
          : '/dashboard';

  const generateReport = useCallback((typeKey) => {
    const { title, html } = getSampleReportHtml(typeKey);
    setReportTitle(title);
    setReportHtml(html);
    setActiveType(typeKey);
  }, []);

  const handleDownload = useCallback(() => {
    if (!reportHtml.trim()) return;
    downloadHtmlReport({
      title: reportTitle || 'Report',
      htmlFragment: reportHtml,
      filenameBase: reportFilenameBase(activeType),
    });
  }, [reportHtml, reportTitle, activeType]);

  const hasReport = Boolean(reportHtml.trim());

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
          Generate a financial report (sample HTML below). When the API is connected, replace the sample
          data with live figures for a selected date or range.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <HelpTooltip text="Generate a Trial Balance report (sample HTML until API is wired).">
            <button
              type="button"
              className="button-primary"
              onClick={() => generateReport(REPORT_TYPES.TRIAL_BALANCE)}
            >
              Generate Trial Balance
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate an Income Statement report (sample HTML until API is wired).">
            <button
              type="button"
              className="button-primary"
              onClick={() => generateReport(REPORT_TYPES.INCOME_STATEMENT)}
            >
              Generate Income Statement
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate a Balance Sheet report (sample HTML until API is wired).">
            <button
              type="button"
              className="button-primary"
              onClick={() => generateReport(REPORT_TYPES.BALANCE_SHEET)}
            >
              Generate Balance Sheet
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate a Retained Earnings Statement report (sample HTML until API is wired).">
            <button
              type="button"
              className="button-primary"
              onClick={() => generateReport(REPORT_TYPES.RETAINED_EARNINGS)}
            >
              Generate Retained Earnings
            </button>
          </HelpTooltip>

          <HelpTooltip text="Download the current report as an HTML file (open in a browser or print).">
            <button
              type="button"
              className="button-secondary"
              onClick={handleDownload}
              disabled={!hasReport}
            >
              Download Report
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
          {hasReport ? (
            <div
              className="report-html-output"
              style={{ marginTop: '12px' }}
              dangerouslySetInnerHTML={{ __html: reportHtml }}
            />
          ) : (
            <p style={{ margin: '8px 0 0', color: 'var(--bff-dark-text)' }}>
              Generated report content will display here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Report;
