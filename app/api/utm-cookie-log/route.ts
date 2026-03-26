import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const WP_ENDPOINT = 'https://miramarsarasota.com/wp-json/miramar/v1/utm-cookie-log';
const CACHE_FILE = path.join(process.cwd(), 'data', 'utm-cookie-log.json');

interface LogEntry {
  status: string;
  browser: string;
  source: string;
  medium: string;
  campaign: string;
  url: string;
  referrer: string;
  timestamp: string;
  ip: string;
}

interface CachedData {
  syncedAt: string;
  entries: LogEntry[];
}

async function fetchFromWordPress(start?: string, end?: string): Promise<LogEntry[]> {
  const secret = process.env.UTM_COOKIE_LOG_SECRET;
  if (!secret) {
    throw new Error('UTM_COOKIE_LOG_SECRET env var not set');
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

  let entries: LogEntry[] = [];
  let syncedAt = '';
  let syncError = '';

  if (sync) {
    // Fetch fresh data from WordPress (no date filter on sync — get everything)
    try {
      entries = await fetchFromWordPress();
      syncedAt = new Date().toISOString();
      await saveCache({ syncedAt, entries });
    } catch (err: any) {
      syncError = err.message || 'Failed to sync';
      // Fall back to cache
      const cached = await loadCache();
      if (cached) {
        entries = cached.entries;
        syncedAt = cached.syncedAt;
      }
    }
  } else {
    // Use cached data
    const cached = await loadCache();
    if (cached) {
      entries = cached.entries;
      syncedAt = cached.syncedAt;
    }
  }

  // Apply date range filter client-side on cached data
  let data = entries.filter(e => e.status !== 'test');

  if (start) {
    const startTs = new Date(start).getTime();
    data = data.filter(e => e.timestamp && new Date(e.timestamp).getTime() >= startTs);
  }
  if (end) {
    const endTs = new Date(end).getTime();
    data = data.filter(e => e.timestamp && new Date(e.timestamp).getTime() <= endTs);
  }

  // Compute stats
  const byStatus: Record<string, number> = {};
  const byBrowser: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const noUtmBrowser: Record<string, number> = {};
  const metaByStatus: Record<string, number> = {};
  let metaTotal = 0;

  for (const e of data) {
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    byBrowser[e.browser || 'unknown'] = (byBrowser[e.browser || 'unknown'] || 0) + 1;

    if (e.status === 'cookie_set' || e.status === 'cookie_exists') {
      bySource[e.source || 'none'] = (bySource[e.source || 'none'] || 0) + 1;
    }

    if (e.status === 'no_utms') {
      noUtmBrowser[e.browser || 'unknown'] = (noUtmBrowser[e.browser || 'unknown'] || 0) + 1;
    }

    if (e.browser === 'facebook' || e.browser === 'instagram') {
      metaTotal++;
      metaByStatus[e.status] = (metaByStatus[e.status] || 0) + 1;
    }
  }

  const uniqueIPs = new Set(data.map(e => e.ip)).size;
  const dateRange = {
    start: data[0]?.timestamp || '',
    end: data[data.length - 1]?.timestamp || '',
  };

  const html = buildHTML({
    total: data.length,
    uniqueIPs,
    dateRange,
    byStatus,
    byBrowser,
    bySource,
    noUtmBrowser,
    metaTotal,
    metaByStatus,
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
  uniqueIPs: number;
  dateRange: { start: string; end: string };
  byStatus: Record<string, number>;
  byBrowser: Record<string, number>;
  bySource: Record<string, number>;
  noUtmBrowser: Record<string, number>;
  metaTotal: number;
  metaByStatus: Record<string, number>;
  entries: LogEntry[];
  syncedAt: string;
  syncError: string;
  filterStart: string;
  filterEnd: string;
}) {
  const { total, uniqueIPs, dateRange, byStatus, byBrowser, bySource, metaTotal, metaByStatus, entries, syncedAt, syncError, filterStart, filterEnd } = stats;

  const cookieSuccess = (byStatus['cookie_set'] || 0) + (byStatus['cookie_exists'] || 0);
  const successRate = total > 0 ? Math.round(cookieSuccess / total * 100) : 0;
  const failCount = byStatus['cookie_failed'] || 0;

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

  function barChart(items: [string, number][], total: number, color: string) {
    return items.map(([label, count]) => {
      const pct = total > 0 ? Math.round(count / total * 100) : 0;
      return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <div style="width:120px;font-size:13px;font-weight:500;text-align:right;">${esc(label)}</div>
        <div style="flex:1;height:24px;background:#f3f4f6;border-radius:6px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:6px;min-width:${count > 0 ? '2px' : '0'};"></div>
        </div>
        <div style="width:70px;font-size:13px;color:#6b7280;">${count} (${pct}%)</div>
      </div>`;
    }).join('');
  }

  function esc(s: string) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  const statusLabels: Record<string, string> = {
    cookie_set: 'Cookie Set (new)',
    cookie_exists: 'Cookie Exists',
    no_utms: 'No UTMs (organic/direct)',
    cookie_failed: 'Cookie Failed',
  };

  // Recent entries table (last 50)
  const recent = entries.slice(-50).reverse();
  const recentRows = recent.map(e => {
    const statusColor = e.status === 'cookie_set' ? '#d1fae5' :
      e.status === 'cookie_exists' ? '#dbeafe' :
      e.status === 'cookie_failed' ? '#fee2e2' : '#f3f4f6';
    const statusText = e.status === 'cookie_set' ? '#065f46' :
      e.status === 'cookie_exists' ? '#1e40af' :
      e.status === 'cookie_failed' ? '#991b1b' : '#6b7280';
    const page = (e.url || '').replace('https://miramarsarasota.com', '').replace(/\?.*/, '') || '/';
    return `<tr>
      <td style="white-space:nowrap;">${fmtDate(e.timestamp)}</td>
      <td><span style="background:${statusColor};color:${statusText};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${esc(e.status)}</span></td>
      <td>${esc(e.browser || '\u2014')}</td>
      <td>${esc(e.source || '\u2014')}</td>
      <td>${esc(e.medium || '\u2014')}</td>
      <td>${esc(e.campaign || '\u2014')}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="${esc(e.url)}">${esc(page)}</td>
    </tr>`;
  }).join('');

  // Format date inputs
  const startVal = filterStart ? filterStart.slice(0, 10) : '';
  const endVal = filterEnd ? filterEnd.slice(0, 10) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>UTM Cookie Diagnostics — Mira Mar</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f6f8; color: #1a1a2e; padding: 32px; line-height: 1.5; }
  .container { max-width: 1200px; margin: 0 auto; }
  h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
  .subtitle { font-size: 14px; color: #6b7280; margin-bottom: 24px; }
  .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .toolbar label { font-size: 13px; font-weight: 500; color: #374151; }
  .toolbar input[type="date"] { padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
  .btn-primary { background: #2563eb; color: #fff; }
  .btn-primary:hover { background: #1d4ed8; }
  .btn-secondary { background: #e5e7eb; color: #374151; }
  .btn-secondary:hover { background: #d1d5db; }
  .btn-sync { background: #059669; color: #fff; }
  .btn-sync:hover { background: #047857; }
  .sync-info { font-size: 12px; color: #6b7280; }
  .sync-error { font-size: 12px; color: #dc2626; font-weight: 500; }
  .no-data { text-align: center; padding: 80px 20px; color: #6b7280; }
  .no-data h2 { font-size: 20px; margin-bottom: 8px; color: #374151; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .card { background: #fff; border-radius: 10px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .card .label { font-size: 12px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
  .card .val { font-size: 32px; font-weight: 700; margin-top: 4px; }
  .card .sub { font-size: 12px; color: #9ca3af; margin-top: 2px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .panel { background: #fff; border-radius: 10px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .panel h3 { font-size: 14px; font-weight: 600; margin-bottom: 16px; color: #374151; }
  .meta-box { background: #fff; border-radius: 10px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 24px; }
  .meta-box h3 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
  .meta-verdict { font-size: 18px; font-weight: 700; }
  .table-wrap { background: #fff; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow-x: auto; margin-bottom: 24px; }
  .table-wrap h3 { font-size: 14px; font-weight: 600; padding: 16px 20px 0; color: #374151; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; background: #fafbfc; }
  td { padding: 8px 14px; border-bottom: 1px solid #f3f4f6; white-space: nowrap; }
  tr:hover td { background: #fafbfc; }
  @media (max-width: 768px) { .cards, .grid2 { grid-template-columns: 1fr 1fr; } .toolbar { flex-direction: column; align-items: flex-start; } }
</style>
</head>
<body>
<div class="container">

<h1>UTM Cookie Diagnostics</h1>
<div class="subtitle">Tracking whether paid ad visitors keep their UTM cookies through to form submission</div>

<div class="toolbar">
  <form method="GET" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
    <label>From <input type="date" name="start" value="${startVal}"></label>
    <label>To <input type="date" name="end" value="${endVal}"></label>
    <button type="submit" class="btn btn-secondary">Filter</button>
    ${startVal || endVal ? '<a href="/api/utm-cookie-log" class="btn btn-secondary" style="text-decoration:none;">Clear</a>' : ''}
  </form>
  <div style="flex:1;"></div>
  <a href="/api/utm-cookie-log?sync=true${startVal ? '&start=' + esc(startVal) : ''}${endVal ? '&end=' + esc(endVal) : ''}" class="btn btn-sync">Sync Now</a>
  <div>
    ${syncError ? `<div class="sync-error">Sync failed: ${esc(syncError)}</div>` : ''}
    <div class="sync-info">Last synced: ${fmtSyncDate(syncedAt)}</div>
  </div>
</div>

${total === 0 && !syncedAt ? `
<div class="no-data">
  <h2>No data yet</h2>
  <p>Click "Sync Now" to fetch UTM cookie logs from the WordPress site.</p>
</div>
` : total === 0 ? `
<div class="no-data">
  <h2>No entries in this date range</h2>
  <p>Try widening the date range or clearing filters.</p>
</div>
` : `

<div class="subtitle" style="margin-top:-16px;">${fmtDate(dateRange.start)} \u2014 ${fmtDate(dateRange.end)}</div>

<div class="cards">
  <div class="card">
    <div class="label">Total Page Loads</div>
    <div class="val">${total}</div>
    <div class="sub">${uniqueIPs} unique visitors</div>
  </div>
  <div class="card">
    <div class="label">Cookie Success Rate</div>
    <div class="val" style="color:${successRate >= 80 ? '#059669' : successRate >= 50 ? '#d97706' : '#dc2626'}">${successRate}%</div>
    <div class="sub">${cookieSuccess} of ${total} page loads</div>
  </div>
  <div class="card">
    <div class="label">Cookie Failures</div>
    <div class="val" style="color:${failCount === 0 ? '#059669' : '#dc2626'}">${failCount}</div>
    <div class="sub">${failCount === 0 ? 'No failures detected' : 'Needs investigation'}</div>
  </div>
  <div class="card">
    <div class="label">Meta In-App Visits</div>
    <div class="val" style="color:#2563eb">${metaTotal}</div>
    <div class="sub">Facebook + Instagram browsers</div>
  </div>
</div>

<div class="meta-box">
  <h3>Meta In-App Browser Report (Facebook + Instagram)</h3>
  <p style="font-size:14px;color:#6b7280;margin-bottom:12px;">This was the main concern \u2014 82% of Meta ad leads were being lost before the relay fix.</p>
  ${metaTotal > 0 ? `
    <div class="meta-verdict" style="color:${(metaByStatus['cookie_failed'] || 0) === 0 ? '#059669' : '#dc2626'};">
      ${(metaByStatus['cookie_failed'] || 0) === 0 ? 'All clear \u2014 zero cookie failures in Meta browsers' : `${metaByStatus['cookie_failed']} cookie failures detected!`}
    </div>
    <div style="margin-top:12px;">
      ${barChart(sorted(metaByStatus), metaTotal, '#8b5cf6')}
    </div>
  ` : '<p style="color:#9ca3af;">No Meta in-app browser visits recorded yet.</p>'}
</div>

<div class="grid2">
  <div class="panel">
    <h3>Cookie Status Breakdown</h3>
    ${barChart(sorted(byStatus).map(([k, v]) => [statusLabels[k] || k, v]), total, '#3b82f6')}
  </div>
  <div class="panel">
    <h3>Visitors by Browser</h3>
    ${barChart(sorted(byBrowser), total, '#8b5cf6')}
  </div>
</div>

<div class="grid2">
  <div class="panel">
    <h3>UTM Sources (where cookies have data)</h3>
    ${barChart(sorted(bySource), Object.values(bySource).reduce((a, b) => a + b, 0), '#059669')}
  </div>
  <div class="panel">
    <h3>No-UTM Visits by Browser</h3>
    <p style="font-size:13px;color:#6b7280;margin-bottom:12px;">These are organic/direct \u2014 expected to have no UTMs.</p>
    ${barChart(sorted(stats.noUtmBrowser), byStatus['no_utms'] || 0, '#9ca3af')}
  </div>
</div>

<div class="table-wrap">
  <h3>Recent Activity (last 50 entries)</h3>
  <table>
    <thead><tr><th>Time</th><th>Status</th><th>Browser</th><th>Source</th><th>Medium</th><th>Campaign</th><th>Page</th></tr></thead>
    <tbody>${recentRows}</tbody>
  </table>
</div>

`}

</div>
</body>
</html>`;
}
