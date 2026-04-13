import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { HelpTooltip } from '../components/HelpTooltip';
import '../global.css';

function Report() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const dashboardPath =
    user?.role === 'administrator'
      ? '/admin-dashboard'
      : user?.role === 'manager'
        ? '/manager-dashboard'
        : user?.role === 'accountant'
          ? '/accountant-dashboard'
          : '/dashboard';

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
          <HelpTooltip text="Generate a Trial Balance report (placeholder).">
            <button type="button" className="button-primary" disabled>
              Generate Trial Balance
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate an Income Statement report (placeholder).">
            <button type="button" className="button-primary" disabled>
              Generate Income Statement
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate a Balance Sheet report (placeholder).">
            <button type="button" className="button-primary" disabled>
              Generate Balance Sheet
            </button>
          </HelpTooltip>
          <HelpTooltip text="Generate a Retained Earnings Statement report (placeholder).">
            <button type="button" className="button-primary" disabled>
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
          <p style={{ margin: '8px 0 0', color: 'var(--bff-dark-text)' }}>
            Generated report content will display here.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Report;