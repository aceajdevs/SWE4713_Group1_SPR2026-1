import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { useAuth } from '../AuthContext';
import { HelpTooltip } from '../components/HelpTooltip';
import { calendarQuarterLabels, fetchRatioPagePeriodContext } from '../services/ratioPeriodsService';
import { fetchRatioSeriesFromLedger } from '../services/ratioLedgerService';
import '../global.css';

function seriesFromValues(values, periods) {
  if (!periods?.length) return [];
  const vals = values || [];
  return periods.map((period, i) => ({
    period,
    value:
      vals[i] !== undefined && vals[i] !== null && Number.isFinite(vals[i]) ? vals[i] : null,
  }));
}

const LINE_STROKE = '#0342B2';

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

function RatioLineCard({ title, data, valueFormatter, valueLabel = 'Ratio' }) {
  return (
    <article
      style={{
        background: '#fff',
        borderRadius: 10,
        border: '1px solid var(--bff-secondary)',
        padding: '16px 18px',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
      }}
    >
      <h3 style={{ fontSize: '1.05rem', marginBottom: 12, color: 'var(--bff-dark-text)' }}>{title}</h3>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={valueFormatter} width={56} />
            <Tooltip formatter={(val) => valueFormatter(val)} labelStyle={{ color: '#0F172A' }} />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              name={valueLabel}
              stroke={LINE_STROKE}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2
        style={{
          fontSize: '1.25rem',
          marginBottom: 16,
          paddingBottom: 8,
          borderBottom: '2px solid var(--bff-light-secondary)',
          color: 'var(--bff-dark-primary)',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 20,
        }}
      >
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
    <div className="container" style={{ paddingBottom: 48 }}>
      <div className="header-row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1>Key financial ratios</h1>
        <HelpTooltip text="Return to your dashboard.">
          <button type="button" onClick={() => navigate(dashboardPath)} className="button-primary">
            Back to Dashboard
          </button>
        </HelpTooltip>
      </div>

      <p style={{ marginTop: 14, maxWidth: 900, color: '#64748b', fontSize: '0.9rem' }}>
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

      <Section title="Profitability ratios">
        <RatioLineCard
          title="Gross profit margin"
          data={seriesFromValues(s.grossMargin, periods)}
          valueFormatter={formatPercent}
          valueLabel="Margin"
        />
        <RatioLineCard
          title="Operating profit margin (return on sales)"
          data={seriesFromValues(s.operatingMargin, periods)}
          valueFormatter={formatPercent}
          valueLabel="Margin"
        />
        <RatioLineCard
          title="Net profit margin (net return on sales)"
          data={seriesFromValues(s.netMargin, periods)}
          valueFormatter={formatPercent}
          valueLabel="Margin"
        />
        <RatioLineCard
          title="Return on total assets"
          data={seriesFromValues(s.roa, periods)}
          valueFormatter={formatPercent}
          valueLabel="ROA"
        />
        <RatioLineCard
          title="Return on stockholders' equity"
          data={seriesFromValues(s.roe, periods)}
          valueFormatter={formatPercent}
          valueLabel="ROE"
        />
        <RatioLineCard
          title="Return on common equity"
          data={seriesFromValues(s.roce, periods)}
          valueFormatter={formatPercent}
          valueLabel="ROCE"
        />
      </Section>

      <Section title="Liquidity ratios">
        <RatioLineCard
          title="Current ratio"
          data={seriesFromValues(s.currentRatio, periods)}
          valueFormatter={formatTimes}
          valueLabel="Ratio"
        />
        <RatioLineCard
          title="Quick (acid-test) ratio"
          data={seriesFromValues(s.quickRatio, periods)}
          valueFormatter={formatTimes}
          valueLabel="Ratio"
        />
        <RatioLineCard
          title="Inventory to net working capital"
          data={seriesFromValues(s.invToNwc, periods)}
          valueFormatter={formatTimes}
          valueLabel="Ratio"
        />
      </Section>

      <Section title="Leverage ratios">
        <RatioLineCard
          title="Debt-to-assets"
          data={seriesFromValues(s.debtToAssets, periods)}
          valueFormatter={formatPercent}
          valueLabel="Debt / assets"
        />
        <RatioLineCard
          title="Debt-to-equity"
          data={seriesFromValues(s.debtToEquity, periods)}
          valueFormatter={formatTimes}
          valueLabel="D/E"
        />
        <RatioLineCard
          title="Long-term debt-to-equity"
          data={seriesFromValues(s.ltDebtToEquity, periods)}
          valueFormatter={formatTimes}
          valueLabel="LT D/E"
        />
        <RatioLineCard
          title="Times interest earned"
          data={seriesFromValues(s.tie, periods)}
          valueFormatter={formatTimes}
          valueLabel="Coverage"
        />
        <RatioLineCard
          title="Fixed-charge coverage"
          data={seriesFromValues(s.fixedCharge, periods)}
          valueFormatter={formatTimes}
          valueLabel="Coverage"
        />
      </Section>

      <Section title="Activity ratios">
        <RatioLineCard
          title="Inventory turnover"
          data={seriesFromValues(s.invTurnover, periods)}
          valueFormatter={formatTimes}
          valueLabel="Turns"
        />
        <RatioLineCard
          title="Fixed assets turnover"
          data={seriesFromValues(s.faturn, periods)}
          valueFormatter={formatTimes}
          valueLabel="Turns"
        />
        <RatioLineCard
          title="Total assets turnover"
          data={seriesFromValues(s.taturn, periods)}
          valueFormatter={formatTimes}
          valueLabel="Turns"
        />
        <RatioLineCard
          title="Accounts receivable turnover"
          data={seriesFromValues(s.arTurnover, periods)}
          valueFormatter={formatTimes}
          valueLabel="Turns"
        />
        <RatioLineCard
          title="Average collection period"
          data={seriesFromValues(s.collectionDays, periods)}
          valueFormatter={formatDays}
          valueLabel="Days"
        />
      </Section>
    </div>
  );
}
