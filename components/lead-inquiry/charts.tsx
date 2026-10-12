'use client';

import type { ReactNode } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from 'recharts';
import { useChartTheme } from './chart-theme';
import { NumbersTable } from './Card';
import {
  MONTHLY_CONTACTS,
  SPEND_LEADS_PER_DAY,
  GOOGLE_BY_MONTH,
  CONVERSION_RATES,
  type ShareRow,
} from '@/lib/lead-inquiry-data';

const PARTIAL_OPACITY = 0.5;

type TipPayload = ReadonlyArray<{ payload?: unknown }>;
interface TipProps {
  active?: boolean;
  payload?: TipPayload;
}

function TipBox({ children }: { children: ReactNode }) {
  const t = useChartTheme();
  return (
    <div style={t.tooltip} className="px-3 py-2 shadow-lg">
      {children}
    </div>
  );
}

function firstRow<T>(payload?: TipPayload): T | null {
  const p = payload?.[0]?.payload;
  return p ? (p as T) : null;
}

function LegendSwatch({
  color,
  label,
  dashed,
  faded,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  faded?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
      <span
        aria-hidden="true"
        className="inline-block w-3 h-3 rounded-sm"
        style={
          dashed
            ? { border: `1.5px dashed ${color}` }
            : { backgroundColor: color, opacity: faded ? PARTIAL_OPACITY : 1 }
        }
      />
      {label}
    </span>
  );
}


/**
 * Value label drawn inside the top of a bar. Full bars get white text; faded
 * partial-month bars get the regular label ink so the number stays readable.
 */
function insideTopLabel(partialIndexes: Set<number>, ink: string) {
  function InsideTopLabel(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    value?: unknown;
    index?: number;
  }) {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const w = Number(props.width ?? 0);
    if (typeof props.value !== 'number') return null;
    const partial = partialIndexes.has(props.index ?? -1);
    return (
      <text
        x={x + w / 2}
        y={y + 16}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill={partial ? ink : '#ffffff'}
      >
        {props.value}
      </text>
    );
  }
  return InsideTopLabel;
}

// ---------------------------------------------------------------------------
// Claim 1a: monthly buyer contacts
// ---------------------------------------------------------------------------

export function MonthlyContactsChart() {
  const t = useChartTheme();
  const data = MONTHLY_CONTACTS.map((d) => ({
    ...d,
    paceGap: d.pace ? d.pace - d.contacts : 0,
  }));
  type Row = (typeof data)[number];
  const partialIdx = new Set(data.flatMap((d, i) => (d.partial ? [i] : [])));

  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
        <LegendSwatch color={t.blue} label="Buyer contacts" />
        <LegendSwatch color={t.blue} label="Oct 1–12 (partial month)" faded />
        <LegendSwatch color={t.blue} label="October 30-day pace" dashed />
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
          <XAxis dataKey="month" stroke={t.axis} tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis stroke={t.axis} tick={{ fontSize: 11 }} allowDecimals={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: t.grid, opacity: 0.4 }}
            content={({ active, payload }: TipProps) => {
              const r = active ? firstRow<Row>(payload) : null;
              if (!r) return null;
              return (
                <TipBox>
                  <div className="font-semibold">{r.month}</div>
                  <div>{r.contacts} buyer contacts</div>
                  {r.pace && <div>30-day pace: {r.pace}</div>}
                </TipBox>
              );
            }}
          />
          <Bar dataKey="contacts" stackId="a" fill={t.blue} maxBarSize={56}>
            {data.map((d) => (
              <Cell key={d.month} fillOpacity={d.partial ? PARTIAL_OPACITY : 1} />
            ))}
            <LabelList dataKey="contacts" content={insideTopLabel(partialIdx, t.label)} />
          </Bar>
          <Bar
            dataKey="paceGap"
            stackId="a"
            fill="transparent"
            stroke={t.blue}
            strokeDasharray="4 3"
            strokeWidth={1.5}
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="pace"
              position="top"
              fill={t.label}
              fontSize={11}
              formatter={(v: unknown) => (typeof v === 'number' ? `pace ${v}` : '')}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <NumbersTable
        headers={['Month', 'Buyer contacts', 'Note']}
        rows={MONTHLY_CONTACTS.map((d) => [
          d.month,
          d.contacts,
          d.pace ? `Partial month. 30-day pace: ${d.pace}` : '',
        ])}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Claim 1b: spend per day and leads per day (two small charts, never dual-axis)
// ---------------------------------------------------------------------------

function SmallMonthBars({
  title,
  dataKey,
  color,
  format,
}: {
  title: string;
  dataKey: 'spendPerDay' | 'leadsPerDay';
  color: string;
  format: (v: number) => string;
}) {
  const t = useChartTheme();
  type Row = (typeof SPEND_LEADS_PER_DAY)[number];
  return (
    <div>
      <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h5>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={SPEND_LEADS_PER_DAY} margin={{ top: 22, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
          <XAxis
            dataKey="month"
            stroke={t.axis}
            tick={{ fontSize: 10 }}
            tickLine={false}
            tickFormatter={(m: string) => (m.startsWith('Oct') ? 'Oct*' : m)}
          />
          <YAxis stroke={t.axis} tick={{ fontSize: 10 }} tickLine={false} />
          <Tooltip
            cursor={{ fill: t.grid, opacity: 0.4 }}
            content={({ active, payload }: TipProps) => {
              const r = active ? firstRow<Row>(payload) : null;
              if (!r) return null;
              return (
                <TipBox>
                  <div className="font-semibold">{r.month}</div>
                  <div>
                    {title}: {format(r[dataKey])}
                  </div>
                </TipBox>
              );
            }}
          />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={44}>
            {SPEND_LEADS_PER_DAY.map((d) => (
              <Cell key={d.month} fillOpacity={d.partial ? PARTIAL_OPACITY : 1} />
            ))}
            <LabelList
              dataKey={dataKey}
              position="top"
              fill={t.label}
              fontSize={10}
              formatter={(v: unknown) => (typeof v === 'number' ? format(v) : '')}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SpendVsLeadsCharts() {
  const t = useChartTheme();
  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2">
        <SmallMonthBars
          title="Ad spend per day"
          dataKey="spendPerDay"
          color={t.orange}
          format={(v) => `$${v.toLocaleString('en-US')}`}
        />
        <SmallMonthBars
          title="Leads per day"
          dataKey="leadsPerDay"
          color={t.blue}
          format={(v) => v.toFixed(2)}
        />
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        *Oct is Oct 1–12. Spend is Google plus Meta. Leads are Google Ads conversions plus Meta
        leads (from Looker).
      </p>
      <NumbersTable
        headers={['Month', 'Spend per day', 'Leads per day']}
        rows={SPEND_LEADS_PER_DAY.map((d) => [
          d.month,
          `$${d.spendPerDay.toLocaleString('en-US')}`,
          d.leadsPerDay.toFixed(2),
        ])}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Claim 2: Google leads by month, two sources
// ---------------------------------------------------------------------------

export function GoogleLeadsChart() {
  const t = useChartTheme();
  const data = GOOGLE_BY_MONTH.map((d) => ({
    ...d,
    sparkPaceGap: d.sparkPace ? d.sparkPace - d.spark : 0,
  }));
  type Row = (typeof data)[number];
  const partialIdx = new Set(data.flatMap((d, i) => (d.partial ? [i] : [])));

  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
        <LegendSwatch color={t.blue} label="Spark contacts from Google ads" />
        <LegendSwatch color={t.aqua} label="Google Ads conversions (Looker)" />
        <LegendSwatch color={t.blue} label="Spark October 30-day pace" dashed />
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 24, right: 8, left: -16, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
          <XAxis dataKey="month" stroke={t.axis} tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis stroke={t.axis} tick={{ fontSize: 11 }} tickLine={false} />
          <Tooltip
            cursor={{ fill: t.grid, opacity: 0.4 }}
            content={({ active, payload }: TipProps) => {
              const r = active ? firstRow<Row>(payload) : null;
              if (!r) return null;
              return (
                <TipBox>
                  <div className="font-semibold">{r.month}</div>
                  <div>Spark contacts from Google ads: {r.spark}</div>
                  {r.sparkPace && <div>Spark 30-day pace: {r.sparkPace}</div>}
                  <div>Google Ads conversions: {r.looker}</div>
                </TipBox>
              );
            }}
          />
          <Bar dataKey="spark" stackId="spark" fill={t.blue} maxBarSize={36}>
            {data.map((d) => (
              <Cell key={d.month} fillOpacity={d.partial ? PARTIAL_OPACITY : 1} />
            ))}
            <LabelList dataKey="spark" content={insideTopLabel(partialIdx, t.label)} />
          </Bar>
          <Bar
            dataKey="sparkPaceGap"
            stackId="spark"
            fill="transparent"
            stroke={t.blue}
            strokeDasharray="4 3"
            strokeWidth={1.5}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="sparkPace"
              position="top"
              fill={t.label}
              fontSize={10}
              formatter={(v: unknown) => (typeof v === 'number' ? `pace ${v}` : '')}
            />
          </Bar>
          <Bar dataKey="looker" stackId="looker" fill={t.aqua} radius={[4, 4, 0, 0]} maxBarSize={36}>
            {data.map((d) => (
              <Cell key={d.month} fillOpacity={d.partial ? PARTIAL_OPACITY : 1} />
            ))}
            <LabelList dataKey="looker" position="top" fill={t.label} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <NumbersTable
        headers={['Month', 'Spark contacts (Google ads)', 'Google Ads conversions (Looker)']}
        rows={GOOGLE_BY_MONTH.map((d) => [
          d.month,
          d.sparkPace ? `${d.spark} (30-day pace ${d.sparkPace})` : d.spark,
          d.looker,
        ])}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Claim 3: share bars (HTML, phone friendly)
// ---------------------------------------------------------------------------

export function ShareBars({
  rows,
  unit,
}: {
  rows: ShareRow[];
  /** e.g. "missing a phone" */
  unit: string;
}) {
  const t = useChartTheme();
  return (
    <ul className="space-y-4">
      {rows.map((r) => {
        const width = r.total > 0 ? (r.count / r.total) * 100 : 0;
        const color = r.emphasis ? t.orange : t.blue;
        return (
          <li key={`${r.label}-${r.detail ?? ''}`}>
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{r.label}</div>
                {r.detail && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">{r.detail}</div>
                )}
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums whitespace-nowrap">
                {r.count} of {r.total}
                {typeof r.pct === 'number' && (
                  <span className="font-normal text-gray-500 dark:text-gray-400"> ({r.pct}%)</span>
                )}
              </div>
            </div>
            <div
              className="mt-1.5 h-3 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"
              role="img"
              aria-label={`${r.label}: ${r.count} of ${r.total} ${unit}`}
              title={`${r.count} of ${r.total} ${unit}`}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${width}%`,
                  minWidth: r.count > 0 ? 6 : 0,
                  backgroundColor: color,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Claim 3d: conversion rate, new page vs original page
// ---------------------------------------------------------------------------

export function ConversionRateChart() {
  const t = useChartTheme();
  type Row = (typeof CONVERSION_RATES)[number];
  const pct = (v: unknown) => (typeof v === 'number' ? `${v.toFixed(2)}%` : '');
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
        <LegendSwatch color={t.blue} label="New page (/reserve/)" />
        <LegendSwatch color={t.orange} label="Original ad page" />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={CONVERSION_RATES}
          layout="vertical"
          margin={{ top: 4, right: 48, left: 0, bottom: 0 }}
          barGap={2}
          barCategoryGap="22%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
          <XAxis
            type="number"
            stroke={t.axis}
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => `${v}%`}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="segment"
            stroke={t.axis}
            width={96}
            tick={{ fontSize: 11 }}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: t.grid, opacity: 0.4 }}
            content={({ active, payload }: TipProps) => {
              const r = active ? firstRow<Row>(payload) : null;
              if (!r) return null;
              return (
                <TipBox>
                  <div className="font-semibold">{r.segment}</div>
                  <div>New page: {pct(r.reserve)} of visits became a lead</div>
                  <div>Original page: {pct(r.original)}</div>
                </TipBox>
              );
            }}
          />
          <Bar dataKey="reserve" fill={t.blue} radius={[0, 4, 4, 0]} maxBarSize={18}>
            <LabelList dataKey="reserve" position="right" fill={t.label} fontSize={11} formatter={pct} />
          </Bar>
          <Bar dataKey="original" fill={t.orange} radius={[0, 4, 4, 0]} maxBarSize={18}>
            <LabelList dataKey="original" position="right" fill={t.label} fontSize={11} formatter={pct} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <NumbersTable
        headers={['Visitors', 'New page (/reserve/)', 'Original ad page']}
        rows={CONVERSION_RATES.map((r) => [r.segment, pct(r.reserve), pct(r.original)])}
      />
    </div>
  );
}
