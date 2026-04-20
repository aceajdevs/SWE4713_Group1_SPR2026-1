import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { HelpTooltip } from '../components/HelpTooltip';
import {
  REPORT_TYPES,
  generateReportHtml,
  downloadHtmlReport,
  reportFilenameBase,
} from '../services/Report';
import '../global.css';

function Report() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [generatedAt, setGeneratedAt] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [reportHtml, setReportHtml] = useState('');
  const [activeType, setActiveType] = useState(null);
  const [generating, setGenerating] = useState(false);

  const dashboardPath =
    user?.role === 'administrator'
      ? '/admin-dashboard'
      : user?.role === 'manager'
        ? '/manager-dashboard'
        : user?.role === 'accountant'
          ? '/accountant-dashboard'
          : '/dashboard';

  const generateReport = useCallback(async (typeKey) => {
    setGenerating(true);
    try {
      const { title, html } = await generateReportHtml(typeKey);
      setReportTitle(title);
      setReportHtml(html);
      setActiveType(typeKey);
      setGeneratedAt(new Date().toLocaleString());
    } catch (error) {
      console.error('Failed to generate report:', error);
      setReportTitle('Report');
      setReportHtml('<p>Unable to generate this report right now.</p>');
      setActiveType(typeKey);
      setGeneratedAt(new Date().toLocaleString());
    } finally {
      setGenerating(false);
    }
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
      </div>

      <div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <HelpTooltip text="Generate a Trial Balance report from current data.">
            <button
              type="button"
              className="button-primary"
              onClick={() => generateReport(REPORT_TYPES.TRIAL_BALANCE)}
              disabled={generating}
            >
              Generate Trial Balance
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate an Income Statement report from current data.">
            <button
              type="button"
              className="button-primary"
              onClick={() => generateReport(REPORT_TYPES.INCOME_STATEMENT)}
              disabled={generating}
            >
              Generate Income Statement
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate a Balance Sheet report from current data.">
            <button
              type="button"
              className="button-primary"
              onClick={() => generateReport(REPORT_TYPES.BALANCE_SHEET)}
              disabled={generating}
            >
              Generate Balance Sheet
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate a Retained Earnings Statement report from current data.">
            <button
              type="button"
              className="button-primary"
              onClick={() => generateReport(REPORT_TYPES.RETAINED_EARNINGS)}
              disabled={generating}
            >
              Generate Retained Earnings
            </button>
          </HelpTooltip>

          <HelpTooltip text="Download the current report as an HTML file (open in a browser or print).">
            <button
              type="button"
              className="button-secondary"
              onClick={handleDownload}
              disabled={!hasReport || generating}
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
            padding: '0 14px 14px',
            background: 'var(--bff-light-text)',
          }}
        >
          {generating ? (
            <p style={{ margin: '8px 0 0', color: 'var(--bff-dark-text)' }}>
              Generating report content...
            </p>
          ) : !hasReport ? (
            <p style={{ margin: '8px 0 0', color: 'var(--bff-dark-text)' }}>
              Generated report content will display here.
            </p>
          ) : (
            <div style={{ marginTop: '10px', color: 'var(--bff-dark-text)' }}>
              <h3 style={{ margin: '0 0 8px' }}>{reportTitle || 'Report'}</h3>
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>
                Generated on: {generatedAt}
              </p>
            </div>
          )}
          {hasReport && !generating ? (
            <div
              className="report-html-output"
              style={{ marginTop: '12px' }}
              dangerouslySetInnerHTML={{ __html: reportHtml }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default Report;