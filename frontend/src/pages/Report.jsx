import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpTooltip } from '../components/HelpTooltip';
import {
  REPORT_TYPES,
  generateReportHtml,
  downloadPdfReport,
  getReportJpegBase64,
  reportFilenameBase,
} from '../services/Report';
import { sendReportEmail } from '../services/emailService';
import '../global.css';
import './ReportTables.css';

function Report() {
  const navigate = useNavigate();
  const [generatedAt, setGeneratedAt] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [reportHtml, setReportHtml] = useState('');
  const [activeType, setActiveType] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');
  const [asOfDate, setAsOfDate] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');

  const generateReport = useCallback(async (typeKey) => {
    setGenerating(true);
    try {
      const isDurationReport =
        typeKey === REPORT_TYPES.INCOME_STATEMENT || typeKey === REPORT_TYPES.RETAINED_EARNINGS;
      const options = isDurationReport
        ? { startDate: periodStartDate, endDate: periodEndDate }
        : { asOfDate: asOfDate || periodEndDate };
      const { title, html } = await generateReportHtml(typeKey, options);
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
  }, [asOfDate, periodEndDate, periodStartDate]);

  const navigateToLedgerAccount = useCallback(
    (rawNumber) => {
      const n = rawNumber != null ? String(rawNumber).trim() : '';
      if (!n) return;
      navigate(`/admin/ledger/${encodeURIComponent(n)}`);
    },
    [navigate],
  );

  const handleReportPreviewClick = useCallback(
    (e) => {
      const el = e.target.closest('[data-ledger-account]');
      if (!el) return;
      const num = el.getAttribute('data-ledger-account');
      e.preventDefault();
      navigateToLedgerAccount(num);
    },
    [navigateToLedgerAccount],
  );

  const handleReportPreviewKeyDown = useCallback(
    (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = e.target.closest('[data-ledger-account]');
      if (!el || e.target !== el) return;
      e.preventDefault();
      navigateToLedgerAccount(el.getAttribute('data-ledger-account'));
    },
    [navigateToLedgerAccount],
  );

  const handleDownload = useCallback(async () => {
    if (!reportHtml.trim()) return;
    await downloadPdfReport({
      title: reportTitle || 'Report',
      htmlFragment: reportHtml,
      filenameBase: reportFilenameBase(activeType),
    });
  }, [reportHtml, reportTitle, activeType]);

  const handleSendEmail = useCallback(async () => {
    if (!reportHtml.trim()) return;

    const trimmedEmail = recipientEmail.trim();
    if (!trimmedEmail) {
      setEmailStatus('Please enter a recipient email address.');
      return;
    }

    setSendingEmail(true);
    setEmailStatus('');
    try {
      const jpegFilename = `${reportFilenameBase(activeType)}.jpg`;
      const jpegBase64 = await getReportJpegBase64({
        title: reportTitle || 'Report',
        htmlFragment: reportHtml,
      });
      const result = await sendReportEmail({
        recipientEmail: trimmedEmail,
        recipientName: recipientName.trim(),
        subject: `${reportTitle || 'Report'} - Report Image`,
        filename: jpegFilename,
        contentType: 'image/jpeg',
        attachmentBase64: jpegBase64,
      });
      if (result?.attachmentIncluded) {
        setEmailStatus(`Report emailed successfully to ${trimmedEmail} with JPEG attachment.`);
      } else {
        setEmailStatus(
          `Report emailed to ${trimmedEmail}, but the provider did not attach the JPEG.`
        );
      }
    } catch (error) {
      console.error('Failed to send report email:', error);
      setEmailStatus('Unable to send report email right now. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  }, [activeType, generatedAt, recipientEmail, recipientName, reportHtml, reportTitle]);

  const hasReport = Boolean(reportHtml.trim());
  const reportContentMaxWidth = '840px';

  return (
    <div className="container">
      <div className="header-row" style={{ alignItems: 'center' }}>
        <h1>Reports</h1>
      </div>

      <div>
        
        <div className="input-group" style={{ maxWidth: reportContentMaxWidth, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: '15vw' }}>
              <label style={{ marginBottom: '6px' }}>Period Start Date:</label>
              <input
                type="date"
                className="input"
                value={periodStartDate}
                onChange={(event) => setPeriodStartDate(event.target.value)}
                title="Start date (duration reports)"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', width: '15vw' }}>
              <label style={{ marginBottom: '6px' }}>Period End Date:</label>
              <input
                type="date"
                className="input"
                value={periodEndDate}
                onChange={(event) => setPeriodEndDate(event.target.value)}
                title="End date (duration reports)"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', width: '15vw' }}>
              <label style={{ marginBottom: '6px' }}>As of Date:</label>
              <input
                type="date"
                className="input"
                value={asOfDate}
                onChange={(event) => setAsOfDate(event.target.value)}
                title="As of date (point-in-time reports)"
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', maxWidth: reportContentMaxWidth, margin: '0 auto' }}>
          <HelpTooltip text="Generate a Trial Balance report from current data.">
            <button
              type="button"
              className="button-primary"
              onClick={() => generateReport(REPORT_TYPES.TRIAL_BALANCE)}
              disabled={generating}
            >
              Trial Balance
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate an Income Statement report from current data.">
            <button
              type="button"
              className="button-primary"
              onClick={() => generateReport(REPORT_TYPES.INCOME_STATEMENT)}
              disabled={generating}
            >
              Income Statement
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate a Balance Sheet report from current data.">
            <button
              type="button"
              className="button-primary"
              onClick={() => generateReport(REPORT_TYPES.BALANCE_SHEET)}
              disabled={generating}
            >
              Balance Sheet
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate a Retained Earnings Statement report from current data.">
            <button
              type="button"
              className="button-primary"
              onClick={() => generateReport(REPORT_TYPES.RETAINED_EARNINGS)}
              disabled={generating}
            >
              Retained Earnings
            </button>
          </HelpTooltip>
        </div>
        <div className="report-output"
          style={{
            margin: '18px auto 0',
            border: '2px dashed var(--bff-primary)',
            borderRadius: '8px',
            padding: '0 14px 14px',
            background: 'var(--bff-light-text)',
            width: '100%',
            maxWidth: reportContentMaxWidth,
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
              onClick={handleReportPreviewClick}
              onKeyDown={handleReportPreviewKeyDown}
              role="presentation"
              dangerouslySetInnerHTML={{ __html: reportHtml }}
            />
          ) : null}
        </div>
      </div>
      
      <div style={{ margin: '14px auto 0', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', maxWidth: reportContentMaxWidth }} role="group">
        <input
          type="email"
          className="input"
          placeholder="Recipient email"
          value={recipientEmail}
          onChange={(event) => setRecipientEmail(event.target.value)}
          style={{ width: '20vw' }}
        />
        <input
          type="text"
          className="input"
          placeholder="Recipient name (optional)"
          value={recipientName}
          onChange={(event) => setRecipientName(event.target.value)}
          style={{ width: '20vw' }}
        />
        <HelpTooltip text="Send the currently displayed report to the recipient by email.">
          <button
            type="button"
            className="button-secondary"
            onClick={handleSendEmail}
            disabled={!hasReport || generating || sendingEmail}
          >
            {sendingEmail ? 'Sending Email...' : 'Email Report'}
          </button>
        </HelpTooltip>
      </div>
      {emailStatus ? (
        <p style={{ margin: '8px auto 0', color: 'var(--bff-dark-text)', maxWidth: reportContentMaxWidth, textAlign: 'center' }}>{emailStatus}</p>
      ) : null}

      <div style={{ maxWidth: reportContentMaxWidth, margin: '1vh auto 10vh', display: 'flex', justifyContent: 'center' }}>
        <HelpTooltip text="Download the current report as a PDF file.">
          <button
            type="button"
            className="button-secondary"
            onClick={handleDownload}
            disabled={!hasReport || generating}
          >
            Download PDF
          </button>
        </HelpTooltip>
      </div>
      
    </div>
  );
}

export default Report;