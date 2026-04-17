import React from 'react';
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
import '../global.css';

const PERIODS = ["Q1 '24", "Q2 '24", "Q3 '24", "Q4 '24", "Q1 '25"];

function series(values) {
  return PERIODS.map((period, i) => ({ period, value: values[i] }));
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

function formatCurrency(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return '';
  return `$${v.toFixed(2)}`;
}

function RatioLineCard({ title, formula, description, data, valueFormatter, valueLabel = 'Ratio' }) {
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
      <h3 style={{ fontSize: '1.05rem', marginBottom: 8, color: 'var(--bff-dark-text)' }}>{title}</h3>
      <p style={{ fontSize: '0.9rem', fontFamily: 'ui-monospace, monospace', color: 'var(--bff-primary)', marginBottom: 8 }}>
        {formula}
      </p>
      <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 14, lineHeight: 1.5 }}>{description}</p>
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

  const dashboardPath =
    user?.role === 'administrator'
      ? '/admin-dashboard'
      : user?.role === 'manager'
        ? '/manager-dashboard'
        : user?.role === 'accountant'
          ? '/accountant-dashboard'
          : '/dashboard';

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

      <p style={{ marginTop: 14, maxWidth: 900, color: '#475569' }}>
        Summary based on Thompson &amp; Strickland (1996), <em>Strategic Management</em>: how each ratio is calculated,
        what it indicates, and illustrative trend charts using sample quarterly figures (not live ledger data).
      </p>

      <Section title="Profitability ratios">
        <RatioLineCard
          title="Gross profit margin"
          formula="(Sales − Cost of goods sold) ÷ Sales"
          description="Shows the margin available to cover operating expenses and profit after direct costs."
          data={series([0.38, 0.4, 0.39, 0.41, 0.42])}
          valueFormatter={formatPercent}
          valueLabel="Margin"
        />
        <RatioLineCard
          title="Operating profit margin (return on sales)"
          formula="Profits before taxes and interest ÷ Sales"
          description="Profitability from current operations before interest; reflects operating performance."
          data={series([0.14, 0.15, 0.145, 0.16, 0.155])}
          valueFormatter={formatPercent}
          valueLabel="Margin"
        />
        <RatioLineCard
          title="Net profit margin (net return on sales)"
          formula="Profits after taxes ÷ Sales"
          description="After-tax profit per dollar of sales; low values may mean weak pricing, high costs, or both."
          data={series([0.09, 0.095, 0.088, 0.1, 0.097])}
          valueFormatter={formatPercent}
          valueLabel="Margin"
        />
        <RatioLineCard
          title="Return on total assets"
          formula="Profits after taxes ÷ Total assets (or PAT + interest ÷ Total assets)"
          description="Return on total investment; adding interest to the numerator reflects returns to both creditors and owners."
          data={series([0.065, 0.068, 0.062, 0.071, 0.069])}
          valueFormatter={formatPercent}
          valueLabel="ROA"
        />
        <RatioLineCard
          title="Return on stockholders' equity"
          formula="Profits after taxes ÷ Total stockholders' equity"
          description="Rate of return on owners' investment in the enterprise."
          data={series([0.14, 0.15, 0.138, 0.155, 0.152])}
          valueFormatter={formatPercent}
          valueLabel="ROE"
        />
        <RatioLineCard
          title="Return on common equity"
          formula="(Profits after taxes − Preferred dividends) ÷ (Total equity − Preferred at par)"
          description="Return on common shareholders' investment; often called ROE."
          data={series([0.16, 0.168, 0.159, 0.175, 0.171])}
          valueFormatter={formatPercent}
          valueLabel="ROCE"
        />
        <RatioLineCard
          title="Earnings per share"
          formula="(Profits after taxes − Preferred dividends) ÷ Shares of common stock outstanding"
          description="Earnings available to each common share."
          data={series([1.12, 1.2, 1.15, 1.28, 1.24])}
          valueFormatter={formatCurrency}
          valueLabel="EPS"
        />
      </Section>

      <Section title="Liquidity ratios">
        <RatioLineCard
          title="Current ratio"
          formula="Current assets ÷ Current liabilities"
          description="Extent to which short-term claims are covered by assets expected to turn to cash in a similar horizon."
          data={series([2.1, 2.05, 2.2, 2.15, 2.22])}
          valueFormatter={formatTimes}
          valueLabel="Ratio"
        />
        <RatioLineCard
          title="Quick (acid-test) ratio"
          formula="(Current assets − Inventory) ÷ Current liabilities"
          description="Ability to meet short-term obligations without relying on inventory liquidation."
          data={series([1.35, 1.32, 1.4, 1.38, 1.41])}
          valueFormatter={formatTimes}
          valueLabel="Ratio"
        />
        <RatioLineCard
          title="Inventory to net working capital"
          formula="Inventory ÷ (Current assets − Current liabilities)"
          description="How much working capital is tied up in inventory."
          data={series([0.55, 0.58, 0.52, 0.54, 0.53])}
          valueFormatter={formatTimes}
          valueLabel="Ratio"
        />
      </Section>

      <Section title="Leverage ratios">
        <RatioLineCard
          title="Debt-to-assets"
          formula="Total debt ÷ Total assets"
          description="Share of assets financed with borrowed funds."
          data={series([0.42, 0.41, 0.43, 0.4, 0.39])}
          valueFormatter={formatPercent}
          valueLabel="Debt / assets"
        />
        <RatioLineCard
          title="Debt-to-equity"
          formula="Total debt ÷ Total stockholders' equity"
          description="Creditor-provided funds versus owner-provided funds."
          data={series([0.88, 0.85, 0.9, 0.82, 0.8])}
          valueFormatter={formatTimes}
          valueLabel="D/E"
        />
        <RatioLineCard
          title="Long-term debt-to-equity"
          formula="Long-term debt ÷ Total shareholders' equity"
          description="Balance of long-term debt versus equity in the capital structure."
          data={series([0.45, 0.44, 0.46, 0.42, 0.41])}
          valueFormatter={formatTimes}
          valueLabel="LT D/E"
        />
        <RatioLineCard
          title="Times interest earned"
          formula="Profits before interest and taxes ÷ Total interest charges"
          description="How far earnings could fall before the firm struggles to cover annual interest."
          data={series([6.2, 6.5, 5.9, 7.1, 6.8])}
          valueFormatter={formatTimes}
          valueLabel="Coverage"
        />
        <RatioLineCard
          title="Fixed-charge coverage"
          formula="(PBT + Interest + Leases) ÷ (Interest + Leases)"
          description="Broader ability to cover fixed charges including leases."
          data={series([4.1, 4.2, 3.95, 4.35, 4.25])}
          valueFormatter={formatTimes}
          valueLabel="Coverage"
        />
      </Section>

      <Section title="Activity ratios">
        <RatioLineCard
          title="Inventory turnover"
          formula="Sales ÷ Inventory of finished goods"
          description="Versus industry norms, signals excess or thin finished-goods inventory."
          data={series([5.2, 5.4, 5.1, 5.6, 5.45])}
          valueFormatter={formatTimes}
          valueLabel="Turns"
        />
        <RatioLineCard
          title="Fixed assets turnover"
          formula="Sales ÷ Fixed assets"
          description="Sales productivity and utilization of plant and equipment."
          data={series([2.4, 2.45, 2.38, 2.52, 2.48])}
          valueFormatter={formatTimes}
          valueLabel="Turns"
        />
        <RatioLineCard
          title="Total assets turnover"
          formula="Sales ÷ Total assets"
          description="Overall asset utilization; below peers may mean insufficient volume for the asset base."
          data={series([0.95, 0.98, 0.93, 1.02, 1.0])}
          valueFormatter={formatTimes}
          valueLabel="Turns"
        />
        <RatioLineCard
          title="Accounts receivable turnover"
          formula="Annual credit sales ÷ Accounts receivable"
          description="How quickly the firm collects credit sales on average."
          data={series([8.5, 8.7, 8.3, 9.0, 8.85])}
          valueFormatter={formatTimes}
          valueLabel="Turns"
        />
        <RatioLineCard
          title="Average collection period"
          formula="Accounts receivable ÷ (Total sales ÷ 365)"
          description="Average wait from sale to cash; ties to working capital and customer quality."
          data={series([43, 42, 44, 40, 41])}
          valueFormatter={formatDays}
          valueLabel="Days"
        />
      </Section>

      <Section title="Other ratios">
        <RatioLineCard
          title="Dividend yield (common)"
          formula="Annual dividends per share ÷ Current market price per share"
          description="Return to owners in the form of dividends."
          data={series([0.028, 0.03, 0.027, 0.031, 0.029])}
          valueFormatter={formatPercent}
          valueLabel="Yield"
        />
        <RatioLineCard
          title="Price-earnings ratio"
          formula="Market price per share ÷ After-tax earnings per share"
          description="Higher multiples often go with faster growth or lower perceived risk."
          data={series([18.5, 19.2, 17.8, 20.1, 19.5])}
          valueFormatter={formatTimes}
          valueLabel="P/E"
        />
        <RatioLineCard
          title="Dividend payout"
          formula="Annual dividends per share ÷ After-tax earnings per share"
          description="Share of earnings paid out as dividends."
          data={series([0.42, 0.44, 0.4, 0.45, 0.43])}
          valueFormatter={formatPercent}
          valueLabel="Payout"
        />
        <RatioLineCard
          title="Cash flow per share"
          formula="(After-tax profits + Depreciation) ÷ Common shares outstanding"
          description="Discretionary funds per share after expenses, before financing choices."
          data={series([2.1, 2.25, 2.05, 2.35, 2.28])}
          valueFormatter={formatCurrency}
          valueLabel="CFPS"
        />
      </Section>
    </div>
  );
}
