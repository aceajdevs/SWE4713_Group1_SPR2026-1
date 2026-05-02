import { useEffect, useMemo, useState } from 'react';
import '../global.css';
import { useNavigate } from 'react-router-dom';
import { HelpTooltip } from '../components/HelpTooltip';
import UserReport from '../components/admin/UserReport';
import SuspendUser from '../components/admin/SuspendUser';
import ExpiredPasswords from '../components/admin/ExpiredPasswords';
import PasswordExpiryNotifyPanel from '../components/admin/PasswordExpiryNotifyPanel';
import { fetchRatioPagePeriodContext } from '../services/ratioPeriodsService';
import { fetchRatioSeriesFromLedger } from '../services/ratioLedgerService';
import './admin-dashboard.css';

function latestValue(series) {
  if (!Array.isArray(series)) return null;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(series[i])) return series[i];
  }
  return null;
}

function classifyRatioStatus(key, value) {
  if (!Number.isFinite(value)) return { status: 'unknown', note: 'No data yet' };

  const ranges = {
    currentRatio: {
      good: (v) => v >= 1.5,
      warning: (v) => v >= 1.0,
      notes: ['Healthy liquidity', 'Borderline liquidity', 'Liquidity risk'],
    },
    quickRatio: {
      good: (v) => v >= 1.0,
      warning: (v) => v >= 0.8,
      notes: ['Strong quick coverage', 'Moderate quick coverage', 'Low quick coverage'],
    },
    debtToAssets: {
      good: (v) => v <= 0.5,
      warning: (v) => v <= 0.65,
      notes: ['Conservative leverage', 'Moderate leverage', 'High leverage'],
    },
    netMargin: {
      good: (v) => v >= 0.1,
      warning: (v) => v >= 0.05,
      notes: ['Strong profitability', 'Thin profitability', 'Weak profitability'],
    },
    roa: {
      good: (v) => v >= 0.05,
      warning: (v) => v >= 0.02,
      notes: ['Good asset return', 'Average asset return', 'Low asset return'],
    },
  };

  const cfg = ranges[key];
  if (!cfg) return { status: 'unknown', note: 'Unrated' };
  if (cfg.good(value)) return { status: 'good', note: cfg.notes[0] };
  if (cfg.warning(value)) return { status: 'warning', note: cfg.notes[1] };
  return { status: 'risk', note: cfg.notes[2] };
}

function formatRatioValue(kind, value) {
  if (!Number.isFinite(value)) return '--';
  if (kind === 'percent') return `${(value * 100).toFixed(1)}%`;
  if (kind === 'days') return `${Math.round(value)} d`;
  return `${value.toFixed(2)}x`;
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [ratioSeries, setRatioSeries] = useState({});
  const [ratioError, setRatioError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setRatioError('');
        const { periods } = await fetchRatioPagePeriodContext();
        if (cancelled || !periods?.length) return;
        const { error, series } = await fetchRatioSeriesFromLedger(periods);
        if (cancelled) return;
        if (error) {
          setRatioError(error.message || 'Ratio snapshot unavailable.');
        }
        setRatioSeries(series || {});
      } catch (err) {
        if (!cancelled) {
          setRatioError(err?.message || 'Ratio snapshot unavailable.');
          setRatioSeries({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const ratioCards = useMemo(() => {
    const defs = [
      { key: 'currentRatio', label: 'Current Ratio', kind: 'times' },
      { key: 'quickRatio', label: 'Quick Ratio', kind: 'times' },
      { key: 'debtToAssets', label: 'Debt-to-Assets', kind: 'percent' },
      { key: 'netMargin', label: 'Net Margin', kind: 'percent' },
      { key: 'roa', label: 'ROA', kind: 'percent' },
      { key: 'collectionDays', label: 'Average Collection Period', kind: 'days' },
    ];

    return defs.map((d) => {
      const value = latestValue(ratioSeries[d.key]);
      const status = classifyRatioStatus(d.key, value);
      return {
        ...d,
        value,
        valueText: formatRatioValue(d.kind, value),
        status,
      };
    });
  }, [ratioSeries]);


  return (
    <div className="admin-dashboard">
      <h1>Administrator Dashboard</h1>

      <div className="dashboard-content">
        <section className="dashboard-panel panel-users">
          <div className="user-header-row">
            <h2>All Users</h2>
            <div className="user-header-actions">
              <HelpTooltip text="Open the form to add a new user account (administrator).">
                <button type="button" className="button-primary" onClick={() => navigate('/admin/create-user')} style={{ marginRight: '8px' }}>
                  Create User
                </button>
              </HelpTooltip>
              <HelpTooltip text="Open user search and editing for existing users.">
                <button type="button" className="button-primary" onClick={() => navigate('/admin/edit-user')} style={{ marginRight: '8px' }}>
                  Edit User
                </button>
              </HelpTooltip>
            </div>
          </div>
          <div className="panel-scroll" style={{ marginTop: '10px' }}>
            <UserReport hideHeader />
          </div>
        </section>

        <section className="dashboard-panel panel-ratios">
          <div className="panel-head-row">
            <h2>Financial Ratios</h2>
            <HelpTooltip text="Open the full Financial Ratios page.">
              <button type="button" className="button-primary" onClick={() => navigate('/ratio')}>
                Open Ratios
              </button>
            </HelpTooltip>
          </div>
          <div className="panel-scroll">
            <div className="admin-ratio-grid">
              {ratioCards.map((card) => (
                <article key={card.key} className={`admin-ratio-card status-${card.status.status}`}>
                  <h3>{card.label}</h3>
                  <strong>{card.valueText}</strong>
                  <span>{card.status.note}</span>
                </article>
              ))}
            </div>
            {ratioError ? <p className="error-messages">{ratioError}</p> : null}
          </div>
        </section>

        <section className="dashboard-panel panel-actions">
          <div className="panel-head-row">
            <h2>User Related Actions</h2>
          </div>
          <div className="panel-scroll">
            <div className="admin-actions-stack">
              <div className="admin-action-block action-suspend">
                <SuspendUser />
              </div>
              <div className="admin-action-block action-expired">
                <ExpiredPasswords />
              </div>
              <div className="admin-action-block action-notify">
                <PasswordExpiryNotifyPanel />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminDashboard