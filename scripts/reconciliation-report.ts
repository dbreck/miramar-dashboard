/**
 * CallRail / Spark.re Reconciliation Report
 *
 * Cross-references CallRail form submissions against Spark.re CRM contacts
 * to identify:
 * 1. Leads in CallRail that never made it to Spark
 * 2. Contacts in Spark with missing UTM data despite paid ad attribution in CallRail
 *
 * Usage: npx tsx scripts/reconciliation-report.ts
 * Output: data/reconciliation-report.md
 */

import { writeFileSync } from "fs";
import { join } from "path";

// --- Configuration ---

const CALLRAIL_API_TOKEN = "19ce09425dd99d71c557ef9172b94157";
const CALLRAIL_ACCOUNT_ID = "ACC2fd0a83431e1451cba08cdc21d851925";
const CALLRAIL_COMPANY_ID = "COM01985c132b03722996a8a09a1343b248";

const SPARK_API_KEY = "71S9PQFYJEGWFBS84WSRYQUS-SHJIS-6JR_HNH6X";
const SPARK_PROJECT_ID = 2855;

const UTM_FIELD_IDS = {
  utm_source: 22408,
  utm_medium: 22409,
  utm_campaign: 22410,
};

const EMPTY_UTM_VALUES = new Set([
  "",
  "(direct)",
  "(none)",
  "(not set)",
  "null",
]);

const TEST_EMAIL_PATTERNS = [
  "@clearph.com",
  "@dbreck.com",
  "@example.com",
  "testrelay",
  "apitest",
];

// --- Types ---

interface CallRailSubmission {
  customer_email: string;
  customer_name: string;
  formatted_customer_name: string;
  formatted_customer_phone_number: string;
  submitted_at: string;
  form_url: string;
  landing_page_url: string;
  referrer: string;
  source: string;
  medium: string;
  campaign: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  first_form: boolean;
}

interface SparkContact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  custom_field_values: Array<{
    custom_field_id: number;
    value: string;
  }>;
  ratings: Array<{ id: number; value: string }>;
  projects: Array<{ id: number }>;
}

interface ReconRecord {
  email: string;
  name: string;
  phone: string;
  callrailSource: string;
  callrailMedium: string;
  callrailCampaign: string;
  callrailUtmSource: string | null;
  callrailUtmMedium: string | null;
  callrailUtmCampaign: string | null;
  submittedAt: string;
  formUrl: string;
  landingPageUrl: string;
  referrer: string;
  submissionCount: number;
  inSpark: boolean;
  sparkContactId: number | null;
  sparkUtmSource: string;
  sparkUtmMedium: string;
  sparkUtmCampaign: string;
  sparkRating: string;
  likelyCause: string;
  hasPaidSource: boolean;
  hasUtmGap: boolean;
}

// --- API Helpers ---

async function callrailFetch(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<any> {
  const url = new URL(
    `https://api.callrail.com/v3/a/${CALLRAIL_ACCOUNT_ID}/${endpoint}`
  );
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Token token=${CALLRAIL_API_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`CallRail API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function sparkFetch(path: string): Promise<any> {
  const url = `https://api.spark.re/v2${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Token token=${SPARK_API_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Spark API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

// --- Data Fetching ---

async function fetchAllCallRailSubmissions(): Promise<CallRailSubmission[]> {
  const all: CallRailSubmission[] = [];
  let page = 1;
  let totalPages = 1;

  console.log("Fetching CallRail form submissions...");

  while (page <= totalPages) {
    const data = await callrailFetch("form_submissions.json", {
      company_id: CALLRAIL_COMPANY_ID,
      per_page: "250",
      page: String(page),
      fields:
        "utm_source,utm_medium,utm_campaign",
      sort_by: "submitted_at",
      sort_dir: "desc",
    });

    totalPages = data.total_pages || 1;
    const submissions = data.form_submissions || [];
    all.push(...submissions);

    console.log(
      `  Page ${page}/${totalPages}: ${submissions.length} submissions`
    );
    page++;
  }

  console.log(`  Total: ${all.length} submissions`);
  return all;
}

async function searchSparkContact(
  email: string
): Promise<SparkContact | null> {
  const data = await sparkFetch(
    `/contacts?email_eq=${encodeURIComponent(email)}&per_page=10`
  );

  if (!Array.isArray(data) || data.length === 0) return null;

  // Return the first contact (may need to check project membership)
  return data[0];
}

async function getSparkContactDetail(id: number): Promise<SparkContact | null> {
  return sparkFetch(`/contacts/${id}`);
}

function extractSparkUtm(contact: SparkContact): {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
} {
  const result = { utm_source: "", utm_medium: "", utm_campaign: "" };
  const cfValues = contact.custom_field_values || [];

  for (const cfv of cfValues) {
    if (cfv.custom_field_id === UTM_FIELD_IDS.utm_source) {
      result.utm_source = cfv.value || "";
    } else if (cfv.custom_field_id === UTM_FIELD_IDS.utm_medium) {
      result.utm_medium = cfv.value || "";
    } else if (cfv.custom_field_id === UTM_FIELD_IDS.utm_campaign) {
      result.utm_campaign = cfv.value || "";
    }
  }

  return result;
}

function extractSparkRating(contact: SparkContact): string {
  const ratings = contact.ratings || [];
  if (ratings.length === 0) return "Unrated";
  return ratings.map((r) => r.value).join(", ");
}

// --- Analysis ---

function isTestEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return TEST_EMAIL_PATTERNS.some((p) => lower.includes(p));
}

function isPaidSource(source: string): boolean {
  const lower = (source || "").toLowerCase();
  return (
    lower.includes("facebook") ||
    lower.includes("google ads") ||
    lower.includes("instagram") ||
    lower.includes("meta")
  );
}

function hasRealUtm(
  utmSource: string | null,
  utmMedium: string | null,
  utmCampaign: string | null
): boolean {
  return (
    (!!utmSource && !EMPTY_UTM_VALUES.has(utmSource)) ||
    (!!utmMedium && !EMPTY_UTM_VALUES.has(utmMedium)) ||
    (!!utmCampaign && !EMPTY_UTM_VALUES.has(utmCampaign))
  );
}

function isUtmEmpty(value: string): boolean {
  return EMPTY_UTM_VALUES.has(value.toLowerCase().trim());
}

function determineLikelyCause(sub: CallRailSubmission): string {
  const source = (sub.source || "").toLowerCase();
  const referrer = (sub.referrer || "").toLowerCase();
  const referringUrl = (sub.landing_page_url || "").toLowerCase();
  const formUrl = (sub.form_url || "").toLowerCase();
  const email = (sub.customer_email || "").toLowerCase();

  // Check for Meta in-app browser
  if (
    source.includes("facebook") ||
    source.includes("instagram") ||
    referrer.includes("m.facebook.com") ||
    referrer.includes("instagram") ||
    referringUrl.includes("fbclid")
  ) {
    return "Meta in-app browser (cross-origin POST blocked)";
  }

  // Check for email typos
  if (
    email.endsWith(".ne") ||
    email.endsWith(".co") ||
    email.endsWith(".con") ||
    email.includes("@@")
  ) {
    return "Email typo";
  }

  // Check for Google Ads popup submissions
  if (source.includes("google ads")) {
    return "Google Ads (popup reCAPTCHA issue)";
  }

  // Check for workshop endpoint issues
  if (formUrl.includes("community-workshop")) {
    return "Workshop endpoint (Spark 500 error)";
  }

  return "Unknown (likely reCAPTCHA or form submission failure)";
}

function extractUtmFromUrl(url: string): {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
} {
  try {
    const parsed = new URL(url);
    return {
      utm_source: parsed.searchParams.get("utm_source") || "",
      utm_medium: parsed.searchParams.get("utm_medium") || "",
      utm_campaign: parsed.searchParams.get("utm_campaign") || "",
    };
  } catch {
    return { utm_source: "", utm_medium: "", utm_campaign: "" };
  }
}

// --- Batch Processing ---

async function processBatch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize: number = 5,
  delayMs: number = 100
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);

    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

// --- Report Generation ---

function generateReport(records: ReconRecord[]): string {
  const now = new Date().toISOString().split("T")[0];
  const total = records.length;
  const inSpark = records.filter((r) => r.inSpark).length;
  const missing = records.filter((r) => !r.inSpark).length;
  const utmGaps = records.filter((r) => r.hasUtmGap).length;

  // Source breakdown
  const sourceMap = new Map<
    string,
    {
      total: number;
      inSpark: number;
      missing: number;
      utmPresent: number;
      utmMissing: number;
    }
  >();

  for (const r of records) {
    const src = r.callrailSource || "Unknown";
    const entry = sourceMap.get(src) || {
      total: 0,
      inSpark: 0,
      missing: 0,
      utmPresent: 0,
      utmMissing: 0,
    };
    entry.total++;
    if (r.inSpark) entry.inSpark++;
    else entry.missing++;
    if (r.inSpark && r.hasPaidSource) {
      if (!r.hasUtmGap) entry.utmPresent++;
      else entry.utmMissing++;
    }
    sourceMap.set(src, entry);
  }

  const missingRecords = records
    .filter((r) => !r.inSpark)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  const utmGapRecords = records
    .filter((r) => r.hasUtmGap)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  let md = "";

  // Header
  md += `# CallRail / Spark.re Reconciliation Report\n`;
  md += `_Generated: ${now}_\n\n`;

  // Executive Summary
  md += `## Executive Summary\n\n`;
  md += `- **Total CallRail form submissions:** ${total} unique contacts\n`;
  md += `- **Found in Spark:** ${inSpark} (${pct(inSpark, total)})\n`;
  md += `- **Missing from Spark:** ${missing} (${pct(missing, total)})\n`;
  md += `- **Contacts with UTM gaps:** ${utmGaps}\n\n`;

  // Drop Rate by Source
  md += `### Drop Rate by Source\n\n`;
  md += `| Source | Total | In Spark | Missing | Drop Rate |\n`;
  md += `|--------|-------|----------|---------|-----------|\n`;

  const sortedSources = Array.from(sourceMap.entries()).sort(
    (a, b) => b[1].total - a[1].total
  );
  for (const [src, data] of sortedSources) {
    md += `| ${src} | ${data.total} | ${data.inSpark} | ${data.missing} | ${pct(data.missing, data.total)} |\n`;
  }
  md += `\n`;

  // Missing from Spark
  md += `## Missing from Spark (${missingRecords.length} contacts)\n\n`;
  if (missingRecords.length === 0) {
    md += `No missing contacts found.\n\n`;
  } else {
    md += `| # | Name | Email | Phone | Source | utm_source | utm_medium | utm_campaign | Submitted | Form | Likely Cause |\n`;
    md += `|---|------|-------|-------|--------|------------|------------|--------------|-----------|------|--------------|\n`;
    missingRecords.forEach((r, i) => {
      const formType = r.formUrl.includes("community-workshop")
        ? "Workshop"
        : r.formUrl.includes("contact")
          ? "Contact"
          : "Other";
      const date = r.submittedAt.split("T")[0];
      const utmS = r.callrailUtmSource || extractUtmFromUrl(r.landingPageUrl).utm_source || "";
      const utmM = r.callrailUtmMedium || extractUtmFromUrl(r.landingPageUrl).utm_medium || "";
      const utmC = r.callrailUtmCampaign || extractUtmFromUrl(r.landingPageUrl).utm_campaign || "";
      md += `| ${i + 1} | ${r.name} | ${r.email} | ${r.phone} | ${r.callrailSource} | ${utmS || "—"} | ${utmM || "—"} | ${utmC || "—"} | ${date} | ${formType} | ${r.likelyCause} |\n`;
    });
    md += `\n`;
  }

  // UTM Data Gaps
  md += `## UTM Data Gaps (${utmGapRecords.length} contacts)\n\n`;
  md += `These contacts exist in Spark but have empty/default UTM fields despite CallRail showing they came from a paid or tracked source.\n\n`;
  if (utmGapRecords.length === 0) {
    md += `No UTM gaps found.\n\n`;
  } else {
    md += `| # | Name | Email | Spark Rating | CR Source | utm_source | utm_medium | utm_campaign | Spark UTMs |\n`;
    md += `|---|------|-------|-------------|-----------|------------|------------|--------------|------------|\n`;
    utmGapRecords.forEach((r, i) => {
      const urlUtms = extractUtmFromUrl(r.landingPageUrl);
      const utmS = r.callrailUtmSource || urlUtms.utm_source || "";
      const utmM = r.callrailUtmMedium || urlUtms.utm_medium || "";
      const utmC = r.callrailUtmCampaign || urlUtms.utm_campaign || "";
      const sparkUtm =
        [r.sparkUtmSource, r.sparkUtmMedium, r.sparkUtmCampaign]
          .filter((v) => v && !EMPTY_UTM_VALUES.has(v))
          .join(" / ") || "(empty)";
      md += `| ${i + 1} | ${r.name} | ${r.email} | ${r.sparkRating} | ${r.callrailSource} | ${utmS || "—"} | ${utmM || "—"} | ${utmC || "—"} | ${sparkUtm} |\n`;
    });
    md += `\n`;
  }

  // Source Breakdown
  md += `## Source Breakdown\n\n`;
  md += `| Source | Submissions | In Spark | Missing | UTM in Spark | UTM Missing |\n`;
  md += `|--------|------------|----------|---------|-------------|-------------|\n`;
  for (const [src, data] of sortedSources) {
    md += `| ${src} | ${data.total} | ${data.inSpark} | ${data.missing} | ${data.utmPresent} | ${data.utmMissing} |\n`;
  }
  md += `\n`;

  // Footer
  md += `---\n\n`;
  md += `_Report generated by \`scripts/reconciliation-report.ts\`_\n`;
  md += `_Re-run with: \`npm run reconcile\`_\n`;

  return md;
}

function generateHtmlReport(records: ReconRecord[]): string {
  const now = new Date().toISOString().split("T")[0];
  const total = records.length;
  const inSpark = records.filter((r) => r.inSpark).length;
  const missing = records.filter((r) => !r.inSpark).length;
  const utmGaps = records.filter((r) => r.hasUtmGap).length;

  const missingRecords = records
    .filter((r) => !r.inSpark)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  const utmGapRecords = records
    .filter((r) => r.hasUtmGap)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  // Source breakdown
  const sourceMap = new Map<string, { total: number; inSpark: number; missing: number; utmPresent: number; utmMissing: number }>();
  for (const r of records) {
    const src = r.callrailSource || "Unknown";
    const entry = sourceMap.get(src) || { total: 0, inSpark: 0, missing: 0, utmPresent: 0, utmMissing: 0 };
    entry.total++;
    if (r.inSpark) entry.inSpark++;
    else entry.missing++;
    if (r.inSpark && r.hasPaidSource) {
      if (!r.hasUtmGap) entry.utmPresent++;
      else entry.utmMissing++;
    }
    sourceMap.set(src, entry);
  }
  const sortedSources = Array.from(sourceMap.entries()).sort((a, b) => b[1].total - a[1].total);

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CallRail / Spark Reconciliation Report — ${now}</title>
<style>
  :root {
    --plum: #4B0108;
    --plum-light: #A4515E;
    --sand: #F3ECE7;
    --green: #2e7d32;
    --red: #c62828;
    --orange: #e65100;
    --gray: #666;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #333; background: #f5f5f5; padding: 2rem; line-height: 1.5;
  }
  .container { max-width: 1200px; margin: 0 auto; }
  h1 { color: var(--plum); font-size: 1.8rem; margin-bottom: 0.25rem; }
  h1 + p { color: var(--gray); margin-bottom: 2rem; }
  h2 { color: var(--plum); font-size: 1.3rem; margin: 2rem 0 1rem; border-bottom: 2px solid var(--sand); padding-bottom: 0.5rem; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .stat-card {
    background: white; border-radius: 8px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    text-align: center;
  }
  .stat-card .value { font-size: 2rem; font-weight: 700; }
  .stat-card .label { font-size: 0.85rem; color: var(--gray); margin-top: 0.25rem; }
  .stat-card.green .value { color: var(--green); }
  .stat-card.red .value { color: var(--red); }
  .stat-card.orange .value { color: var(--orange); }

  table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; font-size: 0.9rem; }
  th { background: var(--plum); color: white; padding: 0.75rem 1rem; text-align: left; font-weight: 600; white-space: nowrap; }
  td { padding: 0.6rem 1rem; border-bottom: 1px solid #eee; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #faf8f6; }

  .badge {
    display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;
  }
  .badge-red { background: #fce4e4; color: var(--red); }
  .badge-green { background: #e8f5e9; color: var(--green); }
  .badge-orange { background: #fff3e0; color: var(--orange); }
  .badge-gray { background: #eee; color: #555; }

  .drop-bar { display: flex; align-items: center; gap: 0.5rem; }
  .drop-bar-fill { height: 8px; border-radius: 4px; min-width: 4px; }
  .drop-bar-fill.green { background: var(--green); }
  .drop-bar-fill.red { background: var(--red); }

  .tab-container { margin-bottom: 2rem; }
  .tabs { display: flex; gap: 0; border-bottom: 2px solid var(--sand); margin-bottom: 0; }
  .tab {
    padding: 0.6rem 1.25rem; cursor: pointer; border: none; background: none;
    font-size: 0.9rem; font-weight: 600; color: var(--gray); border-bottom: 2px solid transparent; margin-bottom: -2px;
  }
  .tab.active { color: var(--plum); border-bottom-color: var(--plum); }
  .tab:hover { color: var(--plum-light); }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }

  .footer { text-align: center; color: var(--gray); font-size: 0.8rem; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #ddd; }
</style>
</head>
<body>
<div class="container">

<h1>CallRail / Spark.re Reconciliation Report</h1>
<p>Generated ${now} &mdash; Mira Mar Sarasota</p>

<div class="stats">
  <div class="stat-card">
    <div class="value">${total}</div>
    <div class="label">Total Contacts (CallRail)</div>
  </div>
  <div class="stat-card green">
    <div class="value">${inSpark}</div>
    <div class="label">Found in Spark (${pct(inSpark, total)})</div>
  </div>
  <div class="stat-card red">
    <div class="value">${missing}</div>
    <div class="label">Missing from Spark (${pct(missing, total)})</div>
  </div>
  <div class="stat-card orange">
    <div class="value">${utmGaps}</div>
    <div class="label">UTM Data Gaps</div>
  </div>
</div>

<h2>Drop Rate by Source</h2>
<table>
<tr><th>Source</th><th>Total</th><th>In Spark</th><th>Missing</th><th>Drop Rate</th><th></th></tr>
${sortedSources.map(([src, d]) => {
  const dropRate = d.total > 0 ? Math.round((d.missing / d.total) * 100) : 0;
  const sparkPct = d.total > 0 ? Math.round((d.inSpark / d.total) * 100) : 0;
  const badgeClass = dropRate >= 50 ? 'badge-red' : dropRate > 0 ? 'badge-orange' : 'badge-green';
  return `<tr>
    <td><strong>${esc(src)}</strong></td>
    <td>${d.total}</td>
    <td>${d.inSpark}</td>
    <td>${d.missing}</td>
    <td><span class="badge ${badgeClass}">${dropRate}%</span></td>
    <td><div class="drop-bar"><div class="drop-bar-fill green" style="width:${sparkPct}px"></div><div class="drop-bar-fill red" style="width:${dropRate}px"></div></div></td>
  </tr>`;
}).join('\n')}
</table>

<div class="tab-container">
<div class="tabs">
  <button class="tab active" onclick="showTab('missing')">Missing from Spark (${missingRecords.length})</button>
  <button class="tab" onclick="showTab('utm')">UTM Gaps (${utmGapRecords.length})</button>
  <button class="tab" onclick="showTab('all')">All Contacts (${total})</button>
</div>

<div id="tab-missing" class="tab-panel active">
<table>
<tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Source</th><th>utm_source</th><th>utm_medium</th><th>utm_campaign</th><th>Submitted</th><th>Form</th><th>Likely Cause</th></tr>
${missingRecords.map((r, i) => {
  const formType = r.formUrl.includes("community-workshop") ? "Workshop" : r.formUrl.includes("contact") ? "Contact" : "Other";
  const date = r.submittedAt.split("T")[0];
  const urlUtms = extractUtmFromUrl(r.landingPageUrl);
  const utmS = r.callrailUtmSource || urlUtms.utm_source || "";
  const utmM = r.callrailUtmMedium || urlUtms.utm_medium || "";
  const utmC = r.callrailUtmCampaign || urlUtms.utm_campaign || "";
  return `<tr>
    <td>${i + 1}</td>
    <td>${esc(r.name)}</td>
    <td>${esc(r.email)}</td>
    <td>${esc(r.phone)}</td>
    <td>${esc(r.callrailSource)}</td>
    <td>${utmS ? esc(utmS) : '<span style="color:#aaa">—</span>'}</td>
    <td>${utmM ? esc(utmM) : '<span style="color:#aaa">—</span>'}</td>
    <td>${utmC ? esc(utmC) : '<span style="color:#aaa">—</span>'}</td>
    <td>${date}</td>
    <td><span class="badge badge-gray">${formType}</span></td>
    <td>${esc(r.likelyCause)}</td>
  </tr>`;
}).join('\n')}
</table>
</div>

<div id="tab-utm" class="tab-panel">
<p style="margin-bottom:1rem;color:var(--gray);">Contacts in Spark with empty/default UTM fields despite CallRail showing paid or tracked attribution.</p>
<table>
<tr><th>#</th><th>Name</th><th>Email</th><th>Spark Rating</th><th>CR Source</th><th>utm_source</th><th>utm_medium</th><th>utm_campaign</th><th>Spark UTMs</th></tr>
${utmGapRecords.map((r, i) => {
  const urlUtms = extractUtmFromUrl(r.landingPageUrl);
  const utmS = r.callrailUtmSource || urlUtms.utm_source || "";
  const utmM = r.callrailUtmMedium || urlUtms.utm_medium || "";
  const utmC = r.callrailUtmCampaign || urlUtms.utm_campaign || "";
  const sparkUtm = [r.sparkUtmSource, r.sparkUtmMedium, r.sparkUtmCampaign].filter(v => v && !EMPTY_UTM_VALUES.has(v)).join(" / ") || "(empty)";
  return `<tr>
    <td>${i + 1}</td>
    <td>${esc(r.name)}</td>
    <td>${esc(r.email)}</td>
    <td>${esc(r.sparkRating)}</td>
    <td>${esc(r.callrailSource)}</td>
    <td>${utmS ? esc(utmS) : '<span style="color:#aaa">—</span>'}</td>
    <td>${utmM ? esc(utmM) : '<span style="color:#aaa">—</span>'}</td>
    <td>${utmC ? esc(utmC) : '<span style="color:#aaa">—</span>'}</td>
    <td><span class="badge badge-red">${esc(sparkUtm)}</span></td>
  </tr>`;
}).join('\n')}
</table>
</div>

<div id="tab-all" class="tab-panel">
<table>
<tr><th>#</th><th>Name</th><th>Email</th><th>Source</th><th>Submitted</th><th>In Spark</th><th>UTM Gap</th></tr>
${records.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)).map((r, i) => {
  const date = r.submittedAt.split("T")[0];
  const sparkBadge = r.inSpark ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-red">No</span>';
  const utmBadge = r.hasUtmGap ? '<span class="badge badge-orange">Gap</span>' : r.hasPaidSource && r.inSpark ? '<span class="badge badge-green">OK</span>' : '<span class="badge badge-gray">N/A</span>';
  return `<tr>
    <td>${i + 1}</td>
    <td>${esc(r.name)}</td>
    <td>${esc(r.email)}</td>
    <td>${esc(r.callrailSource)}</td>
    <td>${date}</td>
    <td>${sparkBadge}</td>
    <td>${utmBadge}</td>
  </tr>`;
}).join('\n')}
</table>
</div>

</div>

<h2>Source Breakdown</h2>
<table>
<tr><th>Source</th><th>Submissions</th><th>In Spark</th><th>Missing</th><th>UTM in Spark</th><th>UTM Missing</th></tr>
${sortedSources.map(([src, d]) => `<tr>
  <td>${esc(src)}</td><td>${d.total}</td><td>${d.inSpark}</td><td>${d.missing}</td><td>${d.utmPresent}</td><td>${d.utmMissing}</td>
</tr>`).join('\n')}
</table>

<div class="footer">
  Report generated by <code>scripts/reconciliation-report.ts</code><br>
  Re-run with: <code>npm run reconcile</code>
</div>

</div>

<script>
function showTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  event.target.classList.add('active');
}
</script>

</body>
</html>`;
}

function pct(num: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((num / total) * 100)}%`;
}

// --- Main ---

async function main() {
  console.log("=== CallRail / Spark.re Reconciliation Report ===\n");

  // Step 1: Fetch all CallRail submissions
  const submissions = await fetchAllCallRailSubmissions();

  // Step 2: Deduplicate by email (keep earliest, count submissions)
  const emailMap = new Map<string, { sub: CallRailSubmission; count: number }>();

  for (const sub of submissions) {
    const email = (sub.customer_email || "").toLowerCase().trim();
    if (!email) continue;

    const existing = emailMap.get(email);
    if (!existing) {
      emailMap.set(email, { sub, count: 1 });
    } else {
      existing.count++;
      // Keep the earliest submission
      if (sub.submitted_at < existing.sub.submitted_at) {
        existing.sub = sub;
      }
    }
  }

  // Step 3: Filter out test emails
  const contacts = Array.from(emailMap.entries())
    .filter(([email]) => !isTestEmail(email))
    .map(([email, { sub, count }]) => ({ email, sub, count }));

  console.log(
    `\nUnique contacts after dedup and filtering: ${contacts.length}`
  );

  // Step 4: Check each email against Spark
  console.log("\nSearching Spark for each contact...");

  const records: ReconRecord[] = [];
  let processed = 0;

  const results = await processBatch(
    contacts,
    async ({ email, sub, count }) => {
      processed++;
      if (processed % 10 === 0) {
        console.log(`  ${processed}/${contacts.length}...`);
      }

      // Search Spark
      let sparkContact: SparkContact | null = null;
      let sparkUtm = { utm_source: "", utm_medium: "", utm_campaign: "" };
      let sparkRating = "Not in Spark";

      try {
        sparkContact = await searchSparkContact(email);

        if (sparkContact) {
          // Fetch full contact for custom field values
          const full = await getSparkContactDetail(sparkContact.id);
          if (full) {
            sparkContact = full;
            sparkUtm = extractSparkUtm(full);
            sparkRating = extractSparkRating(full);
          }
        }
      } catch (err: any) {
        console.error(`  Error for ${email}: ${err.message}`);
      }

      const inSpark = sparkContact !== null;

      // Determine if this is a paid source
      const hasPaidSource =
        isPaidSource(sub.source || "") ||
        hasRealUtm(sub.utm_source, sub.utm_medium, sub.utm_campaign);

      // Check for UTM gap
      let hasUtmGap = false;
      if (inSpark && hasPaidSource) {
        const sparkEmpty =
          isUtmEmpty(sparkUtm.utm_source) &&
          isUtmEmpty(sparkUtm.utm_medium) &&
          isUtmEmpty(sparkUtm.utm_campaign);
        hasUtmGap = sparkEmpty;
      }

      // Also check landing page URL for UTMs
      const urlUtm = extractUtmFromUrl(sub.landing_page_url || "");
      if (
        inSpark &&
        !hasUtmGap &&
        hasRealUtm(urlUtm.utm_source, urlUtm.utm_medium, urlUtm.utm_campaign)
      ) {
        const sparkEmpty =
          isUtmEmpty(sparkUtm.utm_source) &&
          isUtmEmpty(sparkUtm.utm_medium) &&
          isUtmEmpty(sparkUtm.utm_campaign);
        if (sparkEmpty) hasUtmGap = true;
      }

      const record: ReconRecord = {
        email,
        name: sub.formatted_customer_name || sub.customer_name || "",
        phone: sub.formatted_customer_phone_number || "",
        callrailSource: sub.source || "Unknown",
        callrailMedium: sub.medium || "",
        callrailCampaign: sub.campaign || "",
        callrailUtmSource: sub.utm_source,
        callrailUtmMedium: sub.utm_medium,
        callrailUtmCampaign: sub.utm_campaign,
        submittedAt: sub.submitted_at,
        formUrl: sub.form_url || "",
        landingPageUrl: sub.landing_page_url || "",
        referrer: sub.referrer || "",
        submissionCount: count,
        inSpark,
        sparkContactId: sparkContact?.id || null,
        sparkUtmSource: sparkUtm.utm_source,
        sparkUtmMedium: sparkUtm.utm_medium,
        sparkUtmCampaign: sparkUtm.utm_campaign,
        sparkRating,
        likelyCause: inSpark ? "" : determineLikelyCause(sub),
        hasPaidSource,
        hasUtmGap,
      };

      return record;
    },
    5,
    150
  );

  records.push(...results);

  console.log(`\nProcessed ${records.length} contacts`);
  console.log(
    `  In Spark: ${records.filter((r) => r.inSpark).length}`
  );
  console.log(
    `  Missing: ${records.filter((r) => !r.inSpark).length}`
  );
  console.log(
    `  UTM gaps: ${records.filter((r) => r.hasUtmGap).length}`
  );

  // Step 5: Generate reports
  const report = generateReport(records);
  const outputPath = join(process.cwd(), "data", "reconciliation-report.md");
  writeFileSync(outputPath, report, "utf-8");
  console.log(`\nMarkdown report: ${outputPath}`);

  const html = generateHtmlReport(records);
  const htmlPath = join(process.cwd(), "data", "reconciliation-report.html");
  writeFileSync(htmlPath, html, "utf-8");
  console.log(`HTML report: ${htmlPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
