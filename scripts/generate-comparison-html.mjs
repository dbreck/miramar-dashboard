#!/usr/bin/env node
/**
 * Generate the styled HTML contact comparison report from CSV data
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Parse CSV
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

const csvText = fs.readFileSync(path.join(ROOT, 'data/client-contact-comparison.csv'), 'utf8');
const lines = csvText.split('\n').filter(l => l.trim());
const headers = parseCSVLine(lines[0]);
const rows = lines.slice(1).map(l => {
  const vals = parseCSVLine(l);
  const obj = {};
  headers.forEach((h, i) => obj[h.trim()] = (vals[i] || '').trim());
  return obj;
});

// Format date
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'America/New_York' });
  const day = d.toLocaleString('en-US', { day: 'numeric', timeZone: 'America/New_York' });
  const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
  return `${month} ${day}, ${time}`;
}

// Compute lag in days
function lagDays(crDate, sparkDate) {
  if (!crDate || !sparkDate) return null;
  const cr = new Date(crDate);
  const sp = new Date(sparkDate);
  const diff = Math.round((sp - cr) / (1000 * 60 * 60 * 24));
  return diff;
}

// Count statuses
const counts = { Both: 0, 'Spark Only': 0, 'CallRail Only': 0, Neither: 0 };
rows.forEach(r => { counts[r.Match_Status] = (counts[r.Match_Status] || 0) + 1; });

function e(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function empty(s) { return `<span class="empty">\u2014</span>`; }
function cell(val, cls) {
  const v = val ? e(val) : empty();
  return `<td class="${cls || ''}">${v}</td>`;
}

// Build table rows
let tableRows = '';
rows.forEach((r, i) => {
  const status = r.Match_Status;
  const rowClass = status === 'Both' ? 'row-both' : status === 'Spark Only' ? 'row-spark' : status === 'CallRail Only' ? 'row-cr' : 'row-neither';
  const crDate = fmtDate(r.CR_submitted_at);
  const sparkDate = fmtDate(r.Spark_registered_at);
  const lag = lagDays(r.CR_submitted_at, r.Spark_registered_at);

  let lagCell;
  if (status === 'CallRail Only') {
    lagCell = `<td><span class="badge badge-missing">MISSING</span></td>`;
  } else if (lag !== null) {
    lagCell = `<td><span class="lag-value">${lag} day${lag !== 1 ? 's' : ''}</span></td>`;
  } else {
    lagCell = `<td>${empty()}</td>`;
  }

  let badgeClass = status === 'Both' ? 'badge-both' : status === 'Spark Only' ? 'badge-spark' : status === 'CallRail Only' ? 'badge-cr' : 'badge-neither';
  let badgeLabel = status === 'CallRail Only' ? 'CR Only' : status;

  tableRows += `
  <tr class="${rowClass}">
    <td>${i + 1}</td>
    <td><strong>${e(r.Name)}</strong></td>
    ${cell(crDate, 'col-cr')}
    ${cell(sparkDate, 'col-spark')}
    ${lagCell}
    ${cell(r.CR_source, 'col-cr')}
    ${cell(r.CR_campaign, 'col-cr')}
    ${cell(r.CR_medium, 'col-cr')}
    ${cell(r.Spark_marketing_source, 'col-spark')}
    ${cell(r.Spark_utm_source, 'col-spark')}
    ${cell(r.Spark_utm_medium, 'col-spark')}
    ${cell(r.Spark_utm_campaign, 'col-spark')}
    ${cell(r.Spark_rating, 'col-spark')}
    <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
  </tr>`;
});

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mira Mar — CallRail vs Spark Contact Comparison</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f6f8;
    color: #1a1a2e;
    padding: 32px;
    line-height: 1.5;
  }
  .header { max-width: 1400px; margin: 0 auto 24px; }
  .header h1 { font-size: 24px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
  .header .subtitle { font-size: 14px; color: #6b7280; }
  .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; max-width: 1400px; margin: 0 auto 24px; }
  .card { background: #fff; border-radius: 10px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .card .label { font-size: 13px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
  .card .value { font-size: 32px; font-weight: 700; margin-top: 4px; }
  .card.both .value { color: #059669; }
  .card.spark .value { color: #2563eb; }
  .card.cr .value { color: #d97706; }
  .card.neither .value { color: #9ca3af; }
  .legend { max-width: 1400px; margin: 0 auto 16px; display: flex; gap: 24px; font-size: 13px; color: #6b7280; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-dot { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
  .dot-both { background: #d1fae5; border: 1px solid #6ee7b7; }
  .dot-spark { background: #dbeafe; border: 1px solid #93c5fd; }
  .dot-cr { background: #fef3c7; border: 1px solid #fcd34d; }
  .dot-neither { background: #f3f4f6; border: 1px solid #d1d5db; }
  .table-wrap { max-width: 1400px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { position: sticky; top: 0; z-index: 10; padding: 12px 14px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
  th.col-name { background: #fff; min-width: 160px; }
  th.col-cr { background: #fffbeb; color: #92400e; }
  th.col-spark { background: #eff6ff; color: #1e40af; }
  th.col-status { background: #fff; }
  th.col-lag { background: #fff; }
  td { padding: 10px 14px; border-bottom: 1px solid #f3f4f6; vertical-align: top; white-space: nowrap; }
  tr:hover td { background: #fafbfc; }
  tr.row-both td:first-child { border-left: 4px solid #34d399; }
  tr.row-spark td:first-child { border-left: 4px solid #60a5fa; }
  tr.row-cr td:first-child { border-left: 4px solid #fbbf24; }
  tr.row-neither td:first-child { border-left: 4px solid #d1d5db; }
  td.col-cr { background: #fffdf7; }
  tr:hover td.col-cr { background: #fefcf0; }
  td.col-spark { background: #f8fbff; }
  tr:hover td.col-spark { background: #f0f6ff; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; white-space: nowrap; }
  .badge-both { background: #d1fae5; color: #065f46; }
  .badge-spark { background: #dbeafe; color: #1e40af; }
  .badge-cr { background: #fef3c7; color: #92400e; }
  .badge-neither { background: #f3f4f6; color: #6b7280; }
  .badge-missing { background: #fee2e2; color: #991b1b; font-weight: 700; }
  .lag-value { font-weight: 600; color: #6b7280; }
  .empty { color: #d1d5db; }
  .note-box { max-width: 1400px; margin: 24px auto; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 20px 24px; font-size: 14px; color: #78350f; line-height: 1.7; }
  .note-box strong { color: #92400e; }
  .note-box ul { margin: 8px 0 0 20px; }
  .field-key { max-width: 1400px; margin: 24px auto; background: #fff; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); padding: 20px 24px; }
  .field-key h3 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #374151; }
  .field-key table { font-size: 13px; }
  .field-key td, .field-key th { padding: 6px 16px 6px 0; border: none; white-space: normal; }
  .field-key th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; color: #6b7280; background: transparent; }
  .field-key tr:hover td { background: transparent; }
  @media print { body { padding: 16px; background: #fff; } .table-wrap { box-shadow: none; border: 1px solid #e5e7eb; } thead th { position: static; } }
</style>
</head>
<body>

<div class="header">
  <h1>Mira Mar — Contact Comparison</h1>
  <div class="subtitle">CallRail form submissions vs. Spark CRM registrations &bull; Generated March 26, 2026</div>
</div>

<div class="summary-cards">
  <div class="card both"><div class="label">In Both Systems</div><div class="value">${counts.Both}</div></div>
  <div class="card spark"><div class="label">Spark Only</div><div class="value">${counts['Spark Only']}</div></div>
  <div class="card cr"><div class="label">CallRail Only</div><div class="value">${counts['CallRail Only']}</div></div>
  <div class="card neither"><div class="label">Not Found</div><div class="value">${counts.Neither}</div></div>
</div>

<div class="legend">
  <div class="legend-item"><div class="legend-dot dot-both"></div> In both CallRail &amp; Spark</div>
  <div class="legend-item"><div class="legend-dot dot-spark"></div> Spark only (no CallRail record)</div>
  <div class="legend-item"><div class="legend-dot dot-cr"></div> CallRail only (missing from Spark)</div>
  <div class="legend-item"><div class="legend-dot dot-neither"></div> Not found in either system</div>
  <div class="legend-item" style="margin-left:auto;"><div class="legend-dot" style="width:24px;background:#fef3c7;border:1px solid #fcd34d;border-radius:3px;"></div> CallRail columns</div>
  <div class="legend-item"><div class="legend-dot" style="width:24px;background:#dbeafe;border:1px solid #93c5fd;border-radius:3px;"></div> Spark columns</div>
</div>

<div class="table-wrap">
<table>
<thead>
  <tr>
    <th class="col-name">#</th>
    <th class="col-name">Name</th>
    <th class="col-cr">CallRail Date</th>
    <th class="col-spark">Spark Date</th>
    <th class="col-lag">Lag</th>
    <th class="col-cr">CR Source</th>
    <th class="col-cr">CR Campaign</th>
    <th class="col-cr">CR Medium</th>
    <th class="col-spark">Spark Mktg Source</th>
    <th class="col-spark">UTM Source</th>
    <th class="col-spark">UTM Medium</th>
    <th class="col-spark">UTM Campaign</th>
    <th class="col-spark">Rating</th>
    <th class="col-status">Status</th>
  </tr>
</thead>
<tbody>${tableRows}
</tbody>
</table>
</div>

<div class="note-box">
  <strong>Why do all the Spark dates say March 24?</strong>
  <ul>
    <li>The <strong>CallRail Date</strong> is when the person actually submitted the form (their real registration date, ranging from Mar 16\u201322).</li>
    <li>The <strong>Spark Date</strong> shows Mar 24 for everyone because that\u2019s when these contacts were pushed into Spark via the API. <strong>Spark does not allow backdating</strong> \u2014 all API-created contacts get the current timestamp.</li>
    <li>The <strong>Lag</strong> column shows how many days passed between the real form submission and when the contact appeared in Spark.</li>
    <li><strong>\u201CSpark Only\u201D</strong> contacts were entered into Spark directly (not through CallRail form tracking) \u2014 they may have come through the website form, been manually added, or registered through a channel CallRail doesn\u2019t track.</li>
  </ul>
</div>

<div class="field-key">
  <h3>Field Name Differences Between Systems</h3>
  <table>
    <thead><tr><th>What It Means</th><th>CallRail Calls It</th><th>Spark Calls It</th></tr></thead>
    <tbody>
      <tr><td>Ad platform</td><td>\u201CFacebook Ads\u201D / \u201CInstagram Ads\u201D / \u201CGoogle Ads\u201D</td><td>Marketing Source: \u201CFacebook\u201D / \u201CInstagram\u201D / \u201CGoogle\u201D</td></tr>
      <tr><td>Traffic source</td><td>(embedded in landing page URL)</td><td>UTM Source: \u201Cmeta\u201D / \u201Cgoogle\u201D</td></tr>
      <tr><td>Ad type</td><td>Medium: \u201Ccpc\u201D</td><td>UTM Medium: \u201Ccpc\u201D / \u201Csocial\u201D</td></tr>
      <tr><td>Campaign</td><td>Campaign: \u201Csarasota\u201D / \u201Cfeeder\u201D / etc.</td><td>UTM Campaign: same values</td></tr>
      <tr><td>Organic / direct visit</td><td>\u201CGoogle Organic\u201D / \u201CDirect\u201D</td><td>Marketing Source: \u201CGoogle\u201D / \u201CWebsite\u201D</td></tr>
    </tbody>
  </table>
</div>

</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'data/client-contact-comparison.html'), html, 'utf8');
console.log('HTML report written to data/client-contact-comparison.html');
console.log(`Counts: Both=${counts.Both}, Spark Only=${counts['Spark Only']}, CR Only=${counts['CallRail Only']}, Neither=${counts.Neither}`);
