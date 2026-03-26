#!/usr/bin/env node
/**
 * Cross-reference CallRail form submissions with Spark contacts
 * Outputs a side-by-side comparison CSV
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load env
const envFile = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
const SPARK_API_KEY = envFile.match(/SPARK_API_KEY=(.+)/)?.[1]?.trim();
if (!SPARK_API_KEY) throw new Error('Missing SPARK_API_KEY');

const BASE_URL = 'https://api.spark.re/v2';
const PROJECT_ID = 2855;

// UTM custom field IDs
const UTM_FIELD_IDS = {
  22408: 'utm_source',
  22409: 'utm_medium',
  22410: 'utm_campaign',
};

// Target names to look up
const TARGET_NAMES = [
  'Amanda Parrish', 'Ana Maria Reano', 'Brian Fortin Carter', 'Christina Arvanitis',
  'Darlene Rosselli', 'Diana Bridges', 'Elizabeth Giuliani', 'Gary Beltrani',
  'Geeta Sangani', 'George Mackin', 'Elena Hoyos', 'Gloria Arosmendy',
  'Jeffrey Levoff', 'Julie Kauzlarich', 'Keith Marks', 'Lauren Antonelli',
  'Lila Palinsky', 'Lisa Mannino', 'Marcy Masterson', 'Maria Pizzino',
  'Mary Beth George', 'Melva M', 'Michelle Cenk', 'Quinlan Van Workum',
  'Robert Jones', 'Rowland Rowland', 'Sally Sweeney', 'Shelley Kusman',
  'Silvia Young', 'Tom Lutz', 'Tracey De Largy', 'Valerie Partee', 'Wendy Jordan',
];

const TEST_NAMES = ['test utm', 'test import', 'test fullutm'];

// --- Spark API helpers ---
async function sparkGet(endpoint) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Token token="${SPARK_API_KEY}"`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spark API ${res.status}: ${text}`);
  }
  return res.json();
}

async function getAllContacts() {
  const all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= 50) {
    const data = await sparkGet(`/contacts?page=${page}&per_page=100`);
    const contacts = Array.isArray(data) ? data : data.data || [];
    if (contacts.length === 0) break;
    all.push(...contacts);
    console.log(`  Contacts page ${page}: ${contacts.length} (total: ${all.length})`);
    hasMore = contacts.length === 100;
    page++;
  }
  return all;
}

async function getContactDetail(id) {
  return sparkGet(`/contacts/${id}`);
}

// --- CSV parsing ---
function parseCSV(text) {
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => row[h.trim()] = (values[idx] || '').trim());
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function escapeCSV(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// --- Main ---
async function main() {
  console.log('Reading CallRail CSV...');
  const csvText = fs.readFileSync(path.join(ROOT, 'data/callrail-all-time-forms.csv'), 'utf8');
  const allRows = parseCSV(csvText);

  // Filter for miramarsarasota.com entries only
  const miramarRows = allRows.filter(r =>
    (r.form_url || '').includes('miramarsarasota.com') ||
    (r.landing_page_url || '').includes('miramarsarasota.com')
  );
  console.log(`  Total rows: ${allRows.length}, Mira Mar: ${miramarRows.length}`);

  // Exclude test contacts
  const filteredRows = miramarRows.filter(r => {
    const name = (r.name || '').toLowerCase();
    return !TEST_NAMES.some(t => name.includes(t));
  });
  console.log(`  After excluding tests: ${filteredRows.length}`);

  // Build a map by normalized name for CallRail data
  const callrailByName = new Map();
  for (const row of filteredRows) {
    const name = (row.name || '').trim();
    if (!name) continue;
    // Use first occurrence (or could merge)
    const key = name.toLowerCase().replace(/\s+/g, ' ');
    if (!callrailByName.has(key)) {
      callrailByName.set(key, row);
    }
  }

  // Fetch all Spark contacts
  console.log('\nFetching Spark contacts...');
  const allContacts = await getAllContacts();
  console.log(`  Total Spark contacts: ${allContacts.length}`);

  // Filter to project 2855 contacts by fetching details
  // First, let's check which contacts belong to our project
  // The list endpoint doesn't show project membership, so we need to check individually
  // But that's slow for all contacts. Let's use a smarter approach:
  // Search by name for each target person

  console.log('\nSearching for target contacts in Spark...');
  const sparkResults = new Map();

  for (const fullName of TARGET_NAMES) {
    const parts = fullName.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    // Search by first_name and last_name
    let searchUrl = `/contacts?first_name_cont=${encodeURIComponent(firstName)}&per_page=100`;
    if (lastName) {
      searchUrl += `&last_name_cont=${encodeURIComponent(lastName)}`;
    }

    try {
      const data = await sparkGet(searchUrl);
      const contacts = Array.isArray(data) ? data : data.data || [];

      if (contacts.length > 0) {
        // Get full details for first match
        const detail = await getContactDetail(contacts[0].id);
        sparkResults.set(fullName.toLowerCase(), detail);
        console.log(`  Found: ${fullName} (ID: ${contacts[0].id})`);
      } else {
        console.log(`  NOT FOUND: ${fullName}`);
        sparkResults.set(fullName.toLowerCase(), null);
      }
    } catch (err) {
      console.error(`  Error searching ${fullName}: ${err.message}`);
      sparkResults.set(fullName.toLowerCase(), null);
    }
  }

  // Also check CallRail names that aren't in TARGET_NAMES
  const targetSet = new Set(TARGET_NAMES.map(n => n.toLowerCase()));
  for (const [key, row] of callrailByName) {
    if (!targetSet.has(key) && !sparkResults.has(key)) {
      // This is a miramar contact not in the target list - skip
    }
  }

  // Get registration sources for name lookup
  console.log('\nFetching registration sources...');
  const regSources = await sparkGet(`/registration-sources?project_id_eq=${PROJECT_ID}&per_page=100`);
  const sourceMap = new Map();
  const sourceList = Array.isArray(regSources) ? regSources : regSources.data || [];
  for (const src of sourceList) {
    sourceMap.set(src.id, src.name || src.value || `Source ${src.id}`);
  }

  // Build output rows
  console.log('\nBuilding comparison CSV...');
  const outputHeaders = [
    'Name', 'First Name', 'Last Name',
    'CR_source', 'CR_email', 'CR_submitted_at', 'CR_campaign', 'CR_medium', 'CR_form_url', 'CR_landing_page_url',
    'Spark_email', 'Spark_marketing_source', 'Spark_registration_source', 'Spark_registered_at',
    'Spark_utm_source', 'Spark_utm_medium', 'Spark_utm_campaign', 'Spark_rating',
    'Match_Status',
  ];

  const outputRows = [];

  for (const fullName of TARGET_NAMES) {
    const nameKey = fullName.toLowerCase();

    // Find CallRail match
    let crRow = null;
    for (const [key, row] of callrailByName) {
      if (key === nameKey || key.includes(nameKey) || nameKey.includes(key)) {
        crRow = row;
        break;
      }
    }
    // Try partial match
    if (!crRow) {
      const parts = fullName.toLowerCase().split(' ');
      for (const [key, row] of callrailByName) {
        if (parts.every(p => key.includes(p))) {
          crRow = row;
          break;
        }
      }
    }

    // Get Spark match
    const sparkContact = sparkResults.get(nameKey) || null;

    // Extract Spark fields
    let sparkEmail = '';
    let sparkMarketingSource = '';
    let sparkRegSource = '';
    let sparkRegisteredAt = '';
    let sparkUtmSource = '';
    let sparkUtmMedium = '';
    let sparkUtmCampaign = '';
    let sparkRating = '';

    if (sparkContact) {
      sparkEmail = sparkContact.email || '';
      sparkMarketingSource = sparkContact.marketing_source || '';

      // Registration source
      if (sparkContact.registration_source_id) {
        sparkRegSource = sourceMap.get(sparkContact.registration_source_id) || `ID:${sparkContact.registration_source_id}`;
      }

      sparkRegisteredAt = sparkContact.created_at || '';

      // Extract UTM from custom_field_values
      const cfValues = sparkContact.custom_field_values || [];
      for (const cfv of cfValues) {
        const fieldName = UTM_FIELD_IDS[cfv.custom_field_id];
        if (fieldName === 'utm_source') sparkUtmSource = cfv.value || '';
        if (fieldName === 'utm_medium') sparkUtmMedium = cfv.value || '';
        if (fieldName === 'utm_campaign') sparkUtmCampaign = cfv.value || '';
      }

      // Rating
      const ratings = sparkContact.ratings || [];
      const projectRating = ratings.find(r => r.project_id === PROJECT_ID);
      if (projectRating) {
        sparkRating = projectRating.value || '';
      }
    }

    // Determine match status
    let matchStatus = '';
    if (crRow && sparkContact) matchStatus = 'Both';
    else if (crRow && !sparkContact) matchStatus = 'CallRail Only';
    else if (!crRow && sparkContact) matchStatus = 'Spark Only';
    else matchStatus = 'Neither';

    const nameParts = fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    outputRows.push([
      fullName,
      firstName,
      lastName,
      crRow?.source || '',
      crRow?.email || '',
      crRow?.submitted_at || '',
      crRow?.campaign || '',
      crRow?.medium || '',
      crRow?.form_url || '',
      crRow?.landing_page_url || '',
      sparkEmail,
      sparkMarketingSource,
      sparkRegSource,
      sparkRegisteredAt,
      sparkUtmSource,
      sparkUtmMedium,
      sparkUtmCampaign,
      sparkRating,
      matchStatus,
    ]);
  }

  // Write CSV
  const csvOutput = [
    outputHeaders.map(escapeCSV).join(','),
    ...outputRows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n');

  const outputPath = path.join(ROOT, 'data/client-contact-comparison.csv');
  fs.writeFileSync(outputPath, csvOutput, 'utf8');
  console.log(`\nCSV written to: ${outputPath}`);
  console.log(`Total rows: ${outputRows.length}`);

  // Summary
  const both = outputRows.filter(r => r[r.length - 1] === 'Both').length;
  const crOnly = outputRows.filter(r => r[r.length - 1] === 'CallRail Only').length;
  const sparkOnly = outputRows.filter(r => r[r.length - 1] === 'Spark Only').length;
  const neither = outputRows.filter(r => r[r.length - 1] === 'Neither').length;
  console.log(`\nMatch Summary:`);
  console.log(`  Both systems: ${both}`);
  console.log(`  CallRail Only: ${crOnly}`);
  console.log(`  Spark Only: ${sparkOnly}`);
  console.log(`  Neither: ${neither}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
