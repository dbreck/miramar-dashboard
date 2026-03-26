import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const WP_ENDPOINT = 'https://miramarsarasota.com/wp-json/miramar/v1/spark-relay-log';
const CACHE_FILE = path.join('/tmp', 'spark-relay-log.json');

interface RelayLogEntry {
  timestamp: string;
  form_type: string;
  outcome: string;       // success | failed | rejected | wp_error | invalid_form | honeypot | dedup
  status_code: number | null;
  email: string;
  name: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_fallback: boolean;
  has_recaptcha: boolean;
  error_detail: string;
}

interface CachedData {
  syncedAt: string;
  entries: RelayLogEntry[];
}

async function fetchFromWordPress(start?: string, end?: string): Promise<RelayLogEntry[]> {
  const secret = process.env.SPARK_RELAY_LOG_SECRET;
  if (!secret) {
    throw new Error('SPARK_RELAY_LOG_SECRET env var not set');
  }

  const url = new URL(WP_ENDPOINT);
  if (start) url.searchParams.set('start', start);
  if (end) url.searchParams.set('end', end);

  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${secret}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WordPress endpoint returned ${res.status}: ${text}`);
  }

  return await res.json();
}

async function loadCache(): Promise<CachedData | null> {
  try {
    const raw = await readFile(CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveCache(data: CachedData): Promise<void> {
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sync = searchParams.get('sync') === 'true';
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';

  let entries: RelayLogEntry[] = [];
  let syncedAt = '';
  let syncError = '';

  if (sync) {
    try {
      entries = await fetchFromWordPress();
      syncedAt = new Date().toISOString();
      await saveCache({ syncedAt, entries });
    } catch (err: any) {
      syncError = err.message || 'Failed to sync';
      const cached = await loadCache();
      if (cached) {
        entries = cached.entries;
        syncedAt = cached.syncedAt;
      }
    }
  } else {
    const cached = await loadCache();
    if (cached) {
      entries = cached.entries;
      syncedAt = cached.syncedAt;
    }
  }

  // Apply date range filter on cached data
  let data = [...entries];

  if (start) {
    const startTs = new Date(start).getTime();
    data = data.filter(e => e.timestamp && new Date(e.timestamp).getTime() >= startTs);
  }
  if (end) {
    const endTs = new Date(end + 'T23:59:59').getTime();
    data = data.filter(e => e.timestamp && new Date(e.timestamp).getTime() <= endTs);
  }

  // Compute stats
  const byOutcome: Record<string, number> = {};
  const byFormType: Record<string, number> = {};
  let successCount = 0;
  let failCount = 0;
  let utmFallbackCount = 0;
  const failures: RelayLogEntry[] = [];

  for (const e of data) {
    byOutcome[e.outcome] = (byOutcome[e.outcome] || 0) + 1;
    byFormType[e.form_type || 'unknown'] = (byFormType[e.form_type || 'unknown'] || 0) + 1;

    if (e.outcome === 'success') {
      successCount++;
    } else {
      failCount++;
      failures.push(e);
    }

    if (e.utm_fallback) {
      utmFallbackCount++;
    }
  }

  const total = data.length;
  const successRate = total > 0 ? Math.round(successCount / total * 100) : 0;
  const utmFallbackRate = total > 0 ? Math.round(utmFallbackCount / total * 100) : 0;

  const html = buildHTML({
    total,
    successCount,
    successRate,
    failCount,
    utmFallbackCount,
    utmFallbackRate,
    byOutcome,
    byFormType,
    failures,
    entries: data,
    syncedAt,
    syncError,
    filterStart: start,
    filterEnd: end,
  });

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function buildHTML(stats: {
  total: number;
  successCount: number;
  successRate: number;
  failCount: number;
  utmFallbackCount: number;
  utmFallbackRate: number;
  byOutcome: Record<string, number>;
  byFormType: Record<string, number>;
  failures: RelayLogEntry[];
  entries: RelayLogEntry[];
  syncedAt: string;
  syncError: string;
  filterStart: string;
  filterEnd: string;
}) {
  const {
    total, successCount, successRate, failCount, utmFallbackCount, utmFallbackRate,
    byOutcome, byFormType, failures, entries, syncedAt, syncError, filterStart, filterEnd,
  } = stats;

  function fmtDate(iso: string) {
    if (!iso) return '\u2014';
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
  }

  function fmtSyncDate(iso: string) {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'America/New_York' });
  }

  function sorted(obj: Record<string, number>) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1]);
  }

  function esc(s: string | number | null | undefined) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function barChart(items: [string, number][], total: number, color: string) {
    if (items.length === 0) return '<div style="font:400 13px/1.6 var(--sans);color:var(--muted);">No data</div>';
    return items.map(([label, count]) => {
      const pct = total > 0 ? Math.round(count / total * 100) : 0;
      return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="width:140px;font:500 12px/1.3 var(--sans);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(label)}</div>
        <div style="flex:1;height:20px;background:#f5f3ee;border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;min-width:${count > 0 ? '2px' : '0'};transition:width 0.3s;"></div>
        </div>
        <div style="width:80px;font:500 12px/1 var(--mono);text-align:right;">${count} <span style="color:var(--muted);">(${pct}%)</span></div>
      </div>`;
    }).join('');
  }

  const outcomeColors: Record<string, { bg: string; text: string }> = {
    success:      { bg: 'var(--green-light)', text: 'var(--green)' },
    failed:       { bg: 'var(--accent-light)', text: 'var(--accent)' },
    rejected:     { bg: 'var(--accent-light)', text: 'var(--accent)' },
    wp_error:     { bg: 'var(--accent-light)', text: 'var(--accent)' },
    invalid_form: { bg: 'var(--amber-light)', text: 'var(--amber)' },
    honeypot:     { bg: 'var(--amber-light)', text: 'var(--amber)' },
    dedup:        { bg: 'var(--blue-light)', text: 'var(--blue)' },
  };

  function outcomeBadge(outcome: string) {
    const c = outcomeColors[outcome] || { bg: '#f3f4f6', text: 'var(--muted)' };
    return `<span style="display:inline-block;background:${c.bg};color:${c.text};padding:2px 10px;border-radius:100px;font:600 11px/1.6 var(--mono);letter-spacing:0.02em;white-space:nowrap;">${esc(outcome)}</span>`;
  }

  // Recent entries table (last 50)
  const recent = entries.slice(-50).reverse();
  const recentRows = recent.map(e => {
    return `<tr>
      <td>${fmtDate(e.timestamp)}</td>
      <td>${outcomeBadge(e.outcome)}</td>
      <td>${esc(e.form_type)}</td>
      <td>${esc(e.name)}</td>
      <td style="font-family:var(--mono);font-size:11px;">${esc(e.email)}</td>
      <td>${esc(e.utm_source || '\u2014')}</td>
      <td>${esc(e.utm_medium || '\u2014')}</td>
      <td>${esc(e.utm_campaign || '\u2014')}</td>
      <td style="text-align:center;">${e.utm_fallback ? '<span style="color:var(--amber);" title="UTM values read from cookie fallback">cookie</span>' : '\u2014'}</td>
      <td style="text-align:center;">${e.has_recaptcha ? '<span style="color:var(--green);">yes</span>' : '<span style="color:var(--accent);">no</span>'}</td>
    </tr>`;
  }).join('');

  // Failures table
  const failureRows = failures.slice().reverse().map(e => {
    return `<tr>
      <td>${fmtDate(e.timestamp)}</td>
      <td>${outcomeBadge(e.outcome)}</td>
      <td>${esc(e.form_type)}</td>
      <td>${esc(e.status_code ?? '\u2014')}</td>
      <td>${esc(e.name)}</td>
      <td style="font-family:var(--mono);font-size:11px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(e.error_detail)}">${esc(e.error_detail || '\u2014')}</td>
    </tr>`;
  }).join('');

  const startVal = filterStart ? filterStart.slice(0, 10) : '';
  const endVal = filterEnd ? filterEnd.slice(0, 10) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Spark Form Relay Health — Mira Mar</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root {
  --ink: #0f1419;
  --paper: #fafaf7;
  --warm: #f5f0e8;
  --rule: #e0dbd0;
  --muted: #8a8578;
  --accent: #c44b2b;
  --accent-light: #fef0ec;
  --green: #1a7a4c;
  --green-light: #ecf7f0;
  --blue: #2563eb;
  --blue-light: #eff6ff;
  --amber: #b45309;
  --amber-light: #fffbeb;
  --serif: 'DM Serif Display', Georgia, serif;
  --sans: 'DM Sans', -apple-system, sans-serif;
  --mono: 'JetBrains Mono', monospace;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: var(--sans); color: var(--ink); background: var(--paper); line-height: 1.6; -webkit-font-smoothing: antialiased; }

.container { max-width: 1200px; margin: 0 auto; padding: 0 32px; }

/* Header */
.header {
  padding: 48px 0 32px;
  border-bottom: 1px solid var(--rule);
  background: linear-gradient(180deg, #fff 0%, var(--paper) 100%);
}
.header-badge {
  display: inline-flex; align-items: center; gap: 8px;
  font: 500 11px/1 var(--mono); letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--green); background: var(--green-light);
  padding: 6px 14px; border-radius: 100px; margin-bottom: 16px;
}
.header-badge::before { content: ''; width: 6px; height: 6px; background: var(--green); border-radius: 50%; }
.header h1 { font: 400 36px/1.1 var(--serif); color: var(--ink); margin-bottom: 8px; }
.header .lead { font: 400 15px/1.6 var(--sans); color: var(--muted); max-width: 600px; }

/* Toolbar */
.toolbar {
  display: flex; align-items: center; gap: 12px; padding: 20px 0;
  border-bottom: 1px solid var(--rule); flex-wrap: wrap;
}
.toolbar label { font: 500 13px/1 var(--sans); color: var(--ink); }
.toolbar input[type="date"] {
  padding: 7px 12px; border: 1px solid var(--rule); border-radius: 8px;
  font: 400 13px/1 var(--sans); background: #fff; color: var(--ink);
}
.toolbar input[type="date"]:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 3px var(--blue-light); }
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border: none; border-radius: 8px;
  font: 600 13px/1 var(--sans); cursor: pointer; transition: all 0.15s;
  text-decoration: none;
}
.btn-filter { background: var(--warm); color: var(--ink); border: 1px solid var(--rule); }
.btn-filter:hover { background: var(--rule); }
.btn-clear { background: transparent; color: var(--muted); border: 1px solid var(--rule); }
.btn-clear:hover { background: var(--warm); }
.btn-sync { background: var(--green); color: #fff; }
.btn-sync:hover { background: #156b40; }
.sync-info { font: 400 12px/1.4 var(--mono); color: var(--muted); }
.sync-error { font: 500 12px/1.4 var(--mono); color: var(--accent); }

/* Cards */
.cards {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
  background: var(--rule); border: 1px solid var(--rule); border-radius: 12px;
  overflow: hidden; margin: 32px 0;
}
.card { background: #fff; padding: 28px 24px; }
.card .num { font: 700 36px/1 var(--sans); margin-bottom: 4px; }
.card .label { font: 400 13px/1.4 var(--sans); color: var(--muted); }
.card.green .num { color: var(--green); }
.card.red .num { color: var(--accent); }
.card.amber .num { color: var(--amber); }
.card.blue .num { color: var(--blue); }

/* Panels */
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
.panel {
  background: #fff; border: 1px solid var(--rule); border-radius: 12px;
  padding: 28px; overflow: hidden;
}
.panel h3 { font: 600 14px/1.4 var(--sans); margin-bottom: 20px; }

/* Tables */
.table-wrap {
  background: #fff; border: 1px solid var(--rule); border-radius: 12px;
  overflow-x: auto; margin-bottom: 32px;
}
.table-wrap h3 {
  font: 600 14px/1.4 var(--sans); padding: 20px 24px 0; color: var(--ink);
}
.table-wrap .table-note {
  font: 400 13px/1.4 var(--sans); color: var(--muted); padding: 4px 24px 0;
}
table { width: 100%; border-collapse: collapse; font: 400 13px/1.6 var(--sans); }
th {
  padding: 12px 16px; text-align: left;
  font: 500 11px/1 var(--mono); letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--muted); border-bottom: 2px solid var(--rule); background: #fdfcfa;
}
td { padding: 10px 16px; border-bottom: 1px solid #f5f3ee; }
tr:hover td { background: #fdfcfa; }

/* No-data state */
.no-data { text-align: center; padding: 80px 20px; }
.no-data h2 { font: 400 24px/1.2 var(--serif); margin-bottom: 8px; color: var(--ink); }
.no-data p { font: 400 14px/1.6 var(--sans); color: var(--muted); }

/* Back link */
.back-link {
  display: inline-flex; align-items: center; gap: 6px;
  font: 500 13px/1 var(--sans); color: var(--muted); text-decoration: none;
  margin-bottom: 16px;
}
.back-link:hover { color: var(--ink); }
.back-link svg { width: 16px; height: 16px; }

@media (max-width: 768px) {
  .cards { grid-template-columns: 1fr 1fr; }
  .grid2 { grid-template-columns: 1fr; }
  .toolbar { flex-direction: column; align-items: flex-start; }
  .header h1 { font-size: 28px; }
}
</style>
</head>
<body>
<div class="container">

<div class="header">
  <a href="/reconciliation" class="back-link">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
    Back to Reconciliation
  </a>
  <div class="header-badge">Relay Monitor</div>
  <h1>Spark Form Relay Health</h1>
  <div class="lead">Server-side relay status for Mira Mar contact forms. Monitors success rates, UTM cookie fallback usage, and submission failures.</div>
</div>

<div class="toolbar">
  <form method="GET" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
    <label>From <input type="date" name="start" value="${startVal}"></label>
    <label>To <input type="date" name="end" value="${endVal}"></label>
    <button type="submit" class="btn btn-filter">Filter</button>
    ${startVal || endVal ? '<a href="/api/spark-relay-log" class="btn btn-clear">Clear</a>' : ''}
  </form>
  <div style="flex:1;"></div>
  <a href="/api/spark-relay-log?sync=true${startVal ? '&start=' + esc(startVal) : ''}${endVal ? '&end=' + esc(endVal) : ''}" class="btn btn-sync">Sync Now</a>
  <div>
    ${syncError ? `<div class="sync-error">Sync failed: ${esc(syncError)}</div>` : ''}
    <div class="sync-info">Last synced: ${fmtSyncDate(syncedAt)}</div>
  </div>
</div>

${total === 0 && !syncedAt ? `
<div class="no-data">
  <h2>No data yet</h2>
  <p>Click "Sync Now" to fetch relay logs from the WordPress site.</p>
</div>
` : total === 0 ? `
<div class="no-data">
  <h2>No entries in this date range</h2>
  <p>Try widening the date range or clearing filters.</p>
</div>
` : `

<div class="cards">
  <div class="card">
    <div class="num">${total}</div>
    <div class="label">Total Submissions</div>
  </div>
  <div class="card ${successRate >= 90 ? 'green' : successRate >= 70 ? 'amber' : 'red'}">
    <div class="num">${successRate}%</div>
    <div class="label">Success Rate (${successCount} of ${total})</div>
  </div>
  <div class="card ${failCount === 0 ? 'green' : 'red'}">
    <div class="num">${failCount}</div>
    <div class="label">${failCount === 0 ? 'No Failures' : 'Failures'}</div>
  </div>
  <div class="card ${utmFallbackRate > 30 ? 'amber' : 'blue'}">
    <div class="num">${utmFallbackRate}%</div>
    <div class="label">UTM Fallback Rate (${utmFallbackCount} used cookie)</div>
  </div>
</div>

<div class="grid2">
  <div class="panel">
    <h3>Outcome Breakdown</h3>
    ${barChart(sorted(byOutcome), total, 'var(--green)')}
  </div>
  <div class="panel">
    <h3>Form Type Breakdown</h3>
    ${barChart(sorted(byFormType), total, 'var(--blue)')}
  </div>
</div>

${failures.length > 0 ? `
<div class="table-wrap">
  <h3>Failures Detail</h3>
  <div class="table-note">${failures.length} non-success ${failures.length === 1 ? 'entry' : 'entries'}</div>
  <table>
    <thead><tr><th>Time</th><th>Outcome</th><th>Form</th><th>Status</th><th>Name</th><th>Error Detail</th></tr></thead>
    <tbody>${failureRows}</tbody>
  </table>
</div>
` : ''}

<div class="table-wrap">
  <h3>Recent Activity</h3>
  <div class="table-note">Last ${recent.length} entries</div>
  <table>
    <thead><tr><th>Time</th><th>Outcome</th><th>Form</th><th>Name</th><th>Email</th><th>Source</th><th>Medium</th><th>Campaign</th><th>UTM Fallback</th><th>reCAPTCHA</th></tr></thead>
    <tbody>${recentRows}</tbody>
  </table>
</div>

`}

</div>
</body>
</html>`;
}
