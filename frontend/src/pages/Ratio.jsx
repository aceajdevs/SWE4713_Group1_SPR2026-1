import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { useAuth } from '../AuthContext';
import { HelpTooltip } from '../components/HelpTooltip';
import { calendarQuarterLabels, fetchRatioPagePeriodContext } from '../services/ratioPeriodsService';
import { fetchRatioSeriesFromLedger } from '../services/ratioLedgerService';
import '../global.css';
import './Ratio.css';

function seriesFromValues(values, periods) {
  if (!periods?.length) return [];
  const vals = values || [];
  return periods.map((period, i) => ({
    period,
    value:
      vals[i] !== undefined && vals[i] !== null && Number.isFinite(vals[i]) ? vals[i] : null,
  }));
}

const GRADIENT_STOPS = ['#DC2626', '#F59E0B', '#16A34A'];
const HEALTH_COLORS = {
  healthy: '#16A34A',
  caution: '#F59E0B',
  risk: '#DC2626',
  unknown: '#64748B',
};

const HEALTH_CONFIG_BY_TITLE = {
  'Gross profit margin': { mode: 'higherBetter', caution: 0.1, healthy: 0.2 },
  'Operating profit margin (return on sales)': { mode: 'higherBetter', caution: 0.07, healthy: 0.15 },
  'Net profit margin (net return on sales)': { mode: 'higherBetter', caution: 0.05, healthy: 0.1 },
  'Return on total assets': { mode: 'higherBetter', caution: 0.04, healthy: 0.08 },
  "Return on stockholders' equity": { mode: 'higherBetter', caution: 0.08, healthy: 0.15 },
  'Return on common equity': { mode: 'higherBetter', caution: 0.08, healthy: 0.15 },
  'Current ratio': { mode: 'targetRange', riskLow: 1, cautionLow: 1.5, healthyLow: 1.5, healthyHigh: 3, cautionHigh: 4, riskHigh: 4 },
  'Quick (acid-test) ratio': { mode: 'targetRange', riskLow: 0.7, cautionLow: 1, healthyLow: 1, healthyHigh: 2, cautionHigh: 2.5, riskHigh: 2.5 },
  'Inventory to net working capital': { mode: 'lowerBetter', healthy: 0.6, caution: 1 },
  'Debt-to-assets': { mode: 'lowerBetter', healthy: 0.5, caution: 0.65 },
  'Debt-to-equity': { mode: 'lowerBetter', healthy: 1, caution: 2 },
  'Long-term debt-to-equity': { mode: 'lowerBetter', healthy: 0.8, caution: 1.5 },
  'Times interest earned': { mode: 'higherBetter', caution: 2, healthy: 3 },
  'Fixed-charge coverage': { mode: 'higherBetter', caution: 1.5, healthy: 2.5 },
  'Inventory turnover': { mode: 'higherBetter', caution: 3, healthy: 5 },
  'Fixed assets turnover': { mode: 'higherBetter', caution: 0.8, healthy: 1.2 },
  'Total assets turnover': { mode: 'higherBetter', caution: 0.6, healthy: 1 },
  'Accounts receivable turnover': { mode: 'higherBetter', caution: 5, healthy: 8 },
  'Average collection period': { mode: 'lowerBetter', healthy: 45, caution: 60 },
};

function formatPercent(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return '';
  return `${(v * 100).toFixed(1)}%`;
}

function formatTimes(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return '';
  return `${v.toFixed(2)}×`;
}

function formatDays(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return '';
  return `${Math.round(v)} d`;
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const int = Number.parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function interpolateColor(startHex, endHex, t) {
  const a = hexToRgb(startHex);
  const b = hexToRgb(endHex);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

function toWheelData(data) {
  const points = (data || []).filter((item) => Number.isFinite(item?.value));
  if (!points.length) return [];

  const minValue = points.reduce((min, item) => Math.min(min, item.value), Infinity);
  const baseOffset = minValue < 0 ? Math.abs(minValue) : 0;
  const epsilon = 0.0001;

  const colorForIndex = (index, total) => {
    if (total <= 1) return GRADIENT_STOPS[1];
    const t = index / (total - 1);
    if (t <= 0.5) {
      return interpolateColor(GRADIENT_STOPS[0], GRADIENT_STOPS[1], t / 0.5);
    }
    return interpolateColor(GRADIENT_STOPS[1], GRADIENT_STOPS[2], (t - 0.5) / 0.5);
  };

  return points.map((item, index) => ({
    ...item,
    magnitude: Math.max(item.value + baseOffset + epsilon, epsilon),
    color: colorForIndex(index, points.length),
  }));
}

function evaluateHealth(title, value) {
  if (!Number.isFinite(value)) {
    return { status: 'unknown', color: HEALTH_COLORS.unknown, score: 0, label: 'No data' };
  }

  const cfg = HEALTH_CONFIG_BY_TITLE[title];
  if (!cfg) {
    return { status: 'unknown', color: HEALTH_COLORS.unknown, score: 0.5, label: 'Unrated' };
  }

  if (cfg.mode === 'higherBetter') {
    if (value >= cfg.healthy) return { status: 'healthy', color: HEALTH_COLORS.healthy, score: 1, label: 'Healthy' };
    if (value >= cfg.caution) return { status: 'caution', color: HEALTH_COLORS.caution, score: 0.55, label: 'Caution' };
    return { status: 'risk', color: HEALTH_COLORS.risk, score: 0.15, label: 'Risk' };
  }

  if (cfg.mode === 'lowerBetter') {
    if (value <= cfg.healthy) return { status: 'healthy', color: HEALTH_COLORS.healthy, score: 1, label: 'Healthy' };
    if (value <= cfg.caution) return { status: 'caution', color: HEALTH_COLORS.caution, score: 0.55, label: 'Caution' };
    return { status: 'risk', color: HEALTH_COLORS.risk, score: 0.15, label: 'Risk' };
  }

  if (cfg.mode === 'targetRange') {
    const inHealthyBand = value >= cfg.healthyLow && value <= cfg.healthyHigh;
    if (inHealthyBand) return { status: 'healthy', color: HEALTH_COLORS.healthy, score: 1, label: 'Healthy' };
    const inCautionBand =
      (value >= cfg.cautionLow && value < cfg.healthyLow) || (value > cfg.healthyHigh && value <= cfg.cautionHigh);
    if (inCautionBand) return { status: 'caution', color: HEALTH_COLORS.caution, score: 0.55, label: 'Caution' };
    return { status: 'risk', color: HEALTH_COLORS.risk, score: 0.15, label: 'Risk' };
  }

  return { status: 'unknown', color: HEALTH_COLORS.unknown, score: 0.5, label: 'Unrated' };
}

function RatioWheelCard({ title, data, valueFormatter, valueLabel = 'Ratio' }) {
  const wheelData = toWheelData(data);
  const latestPoint = [...wheelData].reverse().find((item) => Number.isFinite(item?.value)) || null;
  const health = evaluateHealth(title, latestPoint?.value);

  return (
    <article className="ratio-wheel-card">
      <h3 className="ratio-wheel-title">{title}</h3>
      <div className="ratio-wheel-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(_, __, item) => {
                const actual = item?.payload?.value;
                return [valueFormatter(actual), valueLabel];
              }}
              labelFormatter={(label) => `${label}`}
            />
            <Legend
              formatter={(period, entry) => {
                const actual = entry?.payload?.value;
                return `${period}: ${valueFormatter(actual)}`;
              }}
            />
            <Pie
              data={wheelData}
              dataKey="magnitude"
              nameKey="period"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={82}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {wheelData.map((entry, index) => (
                <Cell key={`${title}-${entry.period}-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {latestPoint && (
          <div className="ratio-wheel-center">
            <span className="ratio-wheel-center-label">Latest</span>
            <strong className="ratio-wheel-center-value">{valueFormatter(latestPoint.value)}</strong>
          </div>
        )}
      </div>
      <p className="ratio-wheel-meta">
        {wheelData.length ? `${valueLabel} distribution across periods` : 'No ratio data available'}
      </p>
      <p className="ratio-wheel-health" style={{ color: health.color }}>
        Health: {health.label}
      </p>
    </article>
  );
}

function Section({ title, children }) {
  return (
    <section className="ratio-section">
      <h2 className="ratio-section-title">{title}</h2>
      <div className="ratio-card-row">
        {children}
      </div>
    </section>
  );
}

export default function Ratio() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [periods, setPeriods] = useState(() => calendarQuarterLabels(new Date(), 5));
  const [periodsInfo, setPeriodsInfo] = useState({
    loading: true,
    error: null,
    ledgerMin: null,
    ledgerMax: null,
  });
  const [ratioSeries, setRatioSeries] = useState({});
  const [ratioLoading, setRatioLoading] = useState(true);
  const [ratioError, setRatioError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPeriodsInfo((s) => ({ ...s, loading: true, error: null }));
      try {
        const { periods: labels, ledgerMin, ledgerMax } = await fetchRatioPagePeriodContext();
        if (cancelled) return;
        if (labels.length) setPeriods(labels);
        setPeriodsInfo({
          loading: false,
          error: null,
          ledgerMin,
          ledgerMax,
        });
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setPeriodsInfo({
            loading: false,
            error: err?.message || 'Could not load ledger dates.',
            ledgerMin: null,
            ledgerMax: null,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!periods.length) {
      setRatioLoading(false);
      return undefined;
    }
    (async () => {
      setRatioLoading(true);
      setRatioError(null);
      try {
        const { error, series } = await fetchRatioSeriesFromLedger(periods);
        if (cancelled) return;
        if (error) setRatioError(error.message);
        setRatioSeries(series || {});
      } catch (err) {
        console.error(err);
        if (!cancelled) setRatioError(err?.message || 'Could not compute ratios from the ledger.');
        setRatioSeries({});
      } finally {
        if (!cancelled) setRatioLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [periods]);

  const dashboardPath =
    user?.role === 'administrator'
      ? '/admin-dashboard'
      : user?.role === 'manager'
        ? '/manager-dashboard'
        : user?.role === 'accountant'
          ? '/accountant-dashboard'
          : '/dashboard';

  const s = ratioSeries;

  return (
    <div className="ratio-page-container" style={{ paddingBottom: 48 }}>
      <div className="header-row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1>Key Financial Ratios</h1>
      </div>

      <p style={{ marginBottom: 10, maxWidth: '90vw', color: '#64748b', fontSize: '0.9rem', textAlign: 'center' }}>
        {periodsInfo.loading && 'Loading chart periods… '}
        {!periodsInfo.loading &&
          !periodsInfo.error &&
          (periodsInfo.ledgerMin && periodsInfo.ledgerMax
            ? `Posting range on the ledger: ${String(periodsInfo.ledgerMin).slice(0, 10)} → ${String(
                periodsInfo.ledgerMax,
              ).slice(0, 10)}. `
            : '')}
        {!periodsInfo.loading && periodsInfo.error && (
          <span style={{ color: 'var(--bff-red)' }}>{periodsInfo.error} </span>
        )}
        {ratioLoading && 'Loading ratios from ledger activity… '}
        {!ratioLoading && ratioError && (
          <span style={{ color: 'var(--bff-red)' }}>{ratioError} </span>
        )}
        {!periodsInfo.loading && <span>Periods: {periods.join(' · ')}.</span>}
      </p>

      <Section title="Profitability Ratios">
        <RatioWheelCard
          title="Gross profit margin"
          data={seriesFromValues(s.grossMargin, periods)}
          valueFormatter={formatPercent}
          valueLabel="Margin"
        />
        <RatioWheelCard
          title="Operating profit margin (return on sales)"
          data={seriesFromValues(s.operatingMargin, periods)}
          valueFormatter={formatPercent}
          valueLabel="Margin"
        />
        <RatioWheelCard
          title="Net profit margin (net return on sales)"
          data={seriesFromValues(s.netMargin, periods)}
          valueFormatter={formatPercent}
          valueLabel="Margin"
        />
        <RatioWheelCard
          title="Return on total assets"
          data={seriesFromValues(s.roa, periods)}
          valueFormatter={formatPercent}
          valueLabel="ROA"
        />
        <RatioWheelCard
          title="Return on stockholders' equity"
          data={seriesFromValues(s.roe, periods)}
          valueFormatter={formatPercent}
          valueLabel="ROE"
        />
        <RatioWheelCard
          title="Return on common equity"
          data={seriesFromValues(s.roce, periods)}
          valueFormatter={formatPercent}
          valueLabel="ROCE"
        />
      </Section>

      <Section title="Liquidity Ratios">
        <RatioWheelCard
          title="Current ratio"
          data={seriesFromValues(s.currentRatio, periods)}
          valueFormatter={formatTimes}
          valueLabel="Ratio"
        />
        <RatioWheelCard
          title="Quick (acid-test) ratio"
          data={seriesFromValues(s.quickRatio, periods)}
          valueFormatter={formatTimes}
          valueLabel="Ratio"
        />
        <RatioWheelCard
          title="Inventory to net working capital"
          data={seriesFromValues(s.invToNwc, periods)}
          valueFormatter={formatTimes}
          valueLabel="Ratio"
        />
      </Section>

      <Section title="Leverage Ratios">
        <RatioWheelCard
          title="Debt-to-assets"
          data={seriesFromValues(s.debtToAssets, periods)}
          valueFormatter={formatPercent}
          valueLabel="Debt / assets"
        />
        <RatioWheelCard
          title="Debt-to-equity"
          data={seriesFromValues(s.debtToEquity, periods)}
          valueFormatter={formatTimes}
          valueLabel="D/E"
        />
        <RatioWheelCard
          title="Long-term debt-to-equity"
          data={seriesFromValues(s.ltDebtToEquity, periods)}
          valueFormatter={formatTimes}
          valueLabel="LT D/E"
        />
        <RatioWheelCard
          title="Times interest earned"
          data={seriesFromValues(s.tie, periods)}
          valueFormatter={formatTimes}
          valueLabel="Coverage"
        />
        <RatioWheelCard
          title="Fixed-charge coverage"
          data={seriesFromValues(s.fixedCharge, periods)}
          valueFormatter={formatTimes}
          valueLabel="Coverage"
        />
      </Section>

      <Section title="Activity Ratios">
        <RatioWheelCard
          title="Inventory turnover"
          data={seriesFromValues(s.invTurnover, periods)}
          valueFormatter={formatTimes}
          valueLabel="Turns"
        />
        <RatioWheelCard
          title="Fixed assets turnover"
          data={seriesFromValues(s.faturn, periods)}
          valueFormatter={formatTimes}
          valueLabel="Turns"
        />
        <RatioWheelCard
          title="Total assets turnover"
          data={seriesFromValues(s.taturn, periods)}
          valueFormatter={formatTimes}
          valueLabel="Turns"
        />
        <RatioWheelCard
          title="Accounts receivable turnover"
          data={seriesFromValues(s.arTurnover, periods)}
          valueFormatter={formatTimes}
          valueLabel="Turns"
        />
        <RatioWheelCard
          title="Average collection period"
          data={seriesFromValues(s.collectionDays, periods)}
          valueFormatter={formatDays}
          valueLabel="Days"
        />
      </Section>
    </div>
  );
}
