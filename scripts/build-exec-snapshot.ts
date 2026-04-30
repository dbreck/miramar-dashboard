/**
 * Executive Summary Snapshot Builder
 *
 * Runs the same aggregation as /api/executive-summary/stream but locally,
 * writing the result to public/exec-summary-snapshot.json so the dashboard
 * can serve it as a static asset on Vercel Hobby (where 60s function limits
 * make the SSE endpoint impractical for a cold pull).
 *
 * Usage: npm run snapshot
 * Then: git add, commit, push — Vercel ships the JSON with the deploy.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SparkAPIClient } from '../lib/spark-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const OUT_PATH = join(ROOT, 'public', 'exec-summary-snapshot.json');

const PROJECT_ID = 2855;

const RATING_NAMES_BY_ID: Record<number, string> = {
  58245: 'New', 58246: 'Agent', 58247: 'Legal', 58248: 'Hot', 58249: 'Warm',
  58250: 'Cold', 58251: 'Not Interested', 58627: 'Team', 58755: 'Reservation Holder',
  58756: 'Contract Holder', 58866: 'Influencer', 59334: 'CB Global Luxury Agent',
  59364: 'Not A Buyer', 59733: 'Referral',
};

function isWebsiteSourceName(name: string): boolean {
  return name.toLowerCase().startsWith('website');
}

// Internal test buyers that should never appear in the executive summary.
// Matched on email exact (lowercased) or full name (lowercased, whitespace-collapsed).
const INTERNAL_TEST_EMAILS = new Set<string>([
  'alison.sung@spark.re',
  'hlvanworkum8@gmail.com',
]);
const INTERNAL_TEST_NAMES = new Set<string>([
  'ali spark',
  'heather van workum',
]);

function isInternalTestContact(contact: any): boolean {
  if (!contact) return false;
  const email = (contact.email || '').toString().trim().toLowerCase();
  if (email && INTERNAL_TEST_EMAILS.has(email)) return true;
  if (email.endsWith('@spark.re')) return true;
  const name = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (name && INTERNAL_TEST_NAMES.has(name)) return true;
  return false;
}

function extractAreaCode(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) return null;
  const cleaned = phoneNumber.replace(/\D/g, '');
  if (cleaned.length === 10) return cleaned.substring(0, 3);
  if (cleaned.length === 11 && cleaned[0] === '1') return cleaned.substring(1, 4);
  return null;
}

function log(stage: string, message: string) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] ${stage.padEnd(12)} ${message}`);
}

async function main() {
  const apiKey = process.env.SPARK_API_KEY;
  if (!apiKey) {
    console.error('SPARK_API_KEY not set. Run with: npm run snapshot (uses .env.local)');
    process.exit(1);
  }

  const startedAt = Date.now();
  const client = new SparkAPIClient(apiKey);

  // Stage 1: registration sources
  log('sources', 'Fetching registration sources…');
  const registrationSources = await client.listRegistrationSources({
    project_id_eq: PROJECT_ID,
    per_page: 100,
  });
  const registrationSourcesList = Array.isArray(registrationSources)
    ? registrationSources
    : registrationSources.data || [];

  const sourceMap = new Map<number, string>();
  registrationSourcesList.forEach((s: any) => {
    if (s.id && s.name) sourceMap.set(s.id, s.name);
  });
  log('sources', `Found ${sourceMap.size} sources`);

  // Skip "Agent Import"
  const excludedSourceIds = new Set<number>();
  for (const [id, name] of sourceMap.entries()) {
    if (name.toLowerCase().includes('agent import')) excludedSourceIds.add(id);
  }

  // Stage 2: custom field defs
  log('fields', 'Fetching custom field definitions…');
  const customFields = await client.listCustomFields({
    project_id_eq: PROJECT_ID,
    per_page: 100,
  });
  const customFieldsList = Array.isArray(customFields)
    ? customFields
    : customFields.data || [];
  const customFieldMap = new Map<number, string>();
  customFieldsList.forEach((f: any) => {
    if (f.id && f.name) customFieldMap.set(f.id, f.name);
  });

  // Stage 3: contacts by source
  const allContactsForProject: any[] = [];
  const sourcesToFetch = registrationSourcesList.filter(
    (s: any) => !excludedSourceIds.has(s.id),
  );
  log('contacts', `Loading from ${sourcesToFetch.length} sources…`);

  for (let s = 0; s < sourcesToFetch.length; s++) {
    const source = sourcesToFetch[s];
    const sourceId = source.id;
    const sourceName = source.name;
    log('contacts', `[${s + 1}/${sourcesToFetch.length}] "${sourceName}"`);

    const contactsForSource = await client.listAllContacts({
      registration_source_id_eq: sourceId,
    });
    if (contactsForSource.length === 0) continue;

    const BATCH = 50;
    for (let i = 0; i < contactsForSource.length; i += BATCH) {
      const batch = contactsForSource.slice(i, i + BATCH);
      const detailed = await Promise.all(
        batch.map((c: any) => client.getContact(c.id).catch(() => null)),
      );
      detailed.forEach((c: any) => {
        if (!c) return;
        const projects = c.projects || [];
        if (projects.some((p: any) => p.project_id === PROJECT_ID)) {
          allContactsForProject.push(c);
        }
      });
      log('details', `  ${Math.min(i + BATCH, contactsForSource.length)}/${contactsForSource.length}`);
    }
  }

  // No-source bucket
  log('no-source', 'Fetching contacts with no registration source…');
  const noSourceContacts = await client.listAllContacts({
    registration_source_id_null: true,
  });
  if (noSourceContacts.length > 0) {
    const BATCH = 50;
    for (let i = 0; i < noSourceContacts.length; i += BATCH) {
      const batch = noSourceContacts.slice(i, i + BATCH);
      const detailed = await Promise.all(
        batch.map((c: any) => client.getContact(c.id).catch(() => null)),
      );
      detailed.forEach((c: any) => {
        if (!c) return;
        const projects = c.projects || [];
        if (projects.some((p: any) => p.project_id === PROJECT_ID)) {
          allContactsForProject.push(c);
        }
      });
      log('details', `  no-source ${Math.min(i + BATCH, noSourceContacts.length)}/${noSourceContacts.length}`);
    }
  }

  // Dedupe
  const contactById = new Map<number, any>();
  for (const c of allContactsForProject) {
    if (!contactById.has(c.id)) contactById.set(c.id, c);
  }
  const dedupedContacts = Array.from(contactById.values());
  log('contacts', `Deduped to ${dedupedContacts.length} unique contacts`);

  // Stage 4: reservations + contracts
  log('reservations', 'Fetching reservations…');
  const reservations = await client.listAllReservations({
    project_id_eq: PROJECT_ID,
  });
  log('reservations', `Found ${reservations.length} reservations`);

  // Build contract_id → buyer-contact map from the contacts we already fetched.
  // Spark's primary_purchaser embed on /contracts/{id} doesn't expose contact_id,
  // but each contact's response carries a contracts[] array, so we can invert
  // that to look up the buyer for a given contract.
  const contractToContact = new Map<number, any>();
  for (const c of dedupedContacts) {
    if (c.agent === true) continue; // skip agents — they're not buyers
    const contracts = c.contracts || [];
    for (const ct of contracts) {
      if (ct?.id) contractToContact.set(ct.id, c);
    }
  }

  const reservationDetails: any[] = [];
  const RES_BATCH = 5;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const fetchWithRetry = async (fn: () => Promise<any>, label: string) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes('Rate limit') && attempt < 2) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        console.error(`  ${label} failed:`, msg);
        return null;
      }
    }
    return null;
  };
  for (let i = 0; i < reservations.length; i += RES_BATCH) {
    const batch = reservations.slice(i, i + RES_BATCH);
    log('contracts', `  ${Math.min(i + RES_BATCH, reservations.length)}/${reservations.length}`);
    const contracts = await Promise.all(
      batch.map((r: any) =>
        r.contract_id
          ? fetchWithRetry(() => client.getContract(r.contract_id), `getContract(${r.contract_id})`)
          : Promise.resolve(null),
      ),
    );
    if (i + RES_BATCH < reservations.length) await sleep(500);
    const fullReservations = await Promise.all(
      batch.map((r: any) =>
        fetchWithRetry(() => client.getReservation(r.id), `getReservation(${r.id})`),
      ),
    );
    if (i + RES_BATCH < reservations.length) await sleep(500);
    for (let j = 0; j < batch.length; j++) {
      const r = batch[j];
      const contract = contracts[j];
      const fullRes = fullReservations[j];
      // Resolve buyer via the contact-side index built above
      const buyerContact = r.contract_id ? contractToContact.get(r.contract_id) : null;
      // Skip internal test reservations entirely (invisible filter)
      if (isInternalTestContact(buyerContact)) continue;
      const contactId = buyerContact?.id ?? null;

      // Pull UTM custom-field values from the buyer contact
      let utmSource = 'Direct';
      let utmMedium = 'None';
      let utmCampaign = 'No Campaign';
      if (buyerContact) {
        const buyerCfMap = new Map<string, any>();
        (buyerContact.custom_field_values || []).forEach((cfv: any) => {
          const fieldName = customFieldMap.get(cfv.custom_field_id);
          if (fieldName) buyerCfMap.set(fieldName, cfv.value);
        });
        utmSource = (buyerCfMap.get('utm_source') || '').toString().trim() || 'Direct';
        utmMedium = (buyerCfMap.get('utm_medium') || '').toString().trim() || 'None';
        utmCampaign =
          (buyerCfMap.get('utm_campaign') || '').toString().trim() || 'No Campaign';
      }

      const statusId = fullRes?.status?.id ?? r.status_id ?? null;
      const statusValue = fullRes?.status?.value ?? null;

      const deposits = contract?.deposits || [];
      const depositsOwed = deposits.reduce(
        (s: number, d: any) => s + (d.owed_amount || 0),
        0,
      );
      const depositsPaid = deposits.reduce(
        (s: number, d: any) => s + (d.paid_amount || 0),
        0,
      );

      let sourceName = 'Unknown';
      if (buyerContact) {
        const sources = buyerContact.registration_sources || [];
        sourceName =
          sources.length > 0
            ? sourceMap.get(sources[0].id) || `Source ${sources[0].id}`
            : 'No Source';
      }

      const reservedAt = r.reserved_at || r.created_at || null;
      const leadDate = buyerContact?.created_at || null;
      let daysFromLead: number | null = null;
      if (reservedAt && leadDate) {
        daysFromLead = Math.max(
          0,
          Math.round(
            (new Date(reservedAt).getTime() - new Date(leadDate).getTime()) /
              86400000,
          ),
        );
      }

      const buyerName = buyerContact
        ? [buyerContact.first_name, buyerContact.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() || null
        : null;

      reservationDetails.push({
        id: r.id,
        reservedAt,
        createdAt: r.created_at || null,
        executedAt: r.executed_at || null,
        convertedAt: r.converted_at || null,
        statusId,
        statusValue,
        cancelled: statusValue ? statusValue.toLowerCase() === 'cancelled' : false,
        priceCents: r.reservation_list_price || contract?.purchase_price || 0,
        depositsOwedCents: depositsOwed,
        depositsPaidCents: depositsPaid,
        contactId,
        buyerName,
        sourceName,
        isWebsiteSource: isWebsiteSourceName(sourceName),
        leadDate,
        daysFromLead,
        utmSource,
        utmMedium,
        utmCampaign,
      });
    }
  }

  // Stage 5: build compact records
  log('aggregate', 'Building report payload…');

  const reservationContactIds = new Set(
    reservationDetails.map((r: any) => r.contactId).filter(Boolean),
  );

  const compactContacts = dedupedContacts.map((contact: any) => {
    const cfValues = contact.custom_field_values || [];
    const fieldMap = new Map<string, any>();
    cfValues.forEach((cfv: any) => {
      const fieldName = customFieldMap.get(cfv.custom_field_id);
      if (fieldName) fieldMap.set(fieldName, cfv.value);
    });

    const sources = contact.registration_sources || [];
    const sourceName =
      sources.length > 0
        ? sourceMap.get(sources[0].id) || `Source ${sources[0].id}`
        : 'No Source';

    const ratings = contact.ratings || [];
    const projectRating = ratings.find((r: any) =>
      Object.prototype.hasOwnProperty.call(RATING_NAMES_BY_ID, r.id),
    );
    const ratingName = projectRating
      ? projectRating.value || RATING_NAMES_BY_ID[projectRating.id] || 'Unrated'
      : 'Unrated';

    const city = (contact.city || '').toString().trim() || null;
    const state =
      (contact.province || contact.state || '').toString().trim() || null;
    const country =
      (contact.country_iso || contact.country || '').toString().trim() ||
      null;
    const rawPostcode = (contact.postcode || '').toString().trim();
    const postcode = rawPostcode ? rawPostcode.substring(0, 5) : null;
    const phone = contact.mobile_phone || contact.phone || contact.work_phone || null;
    const areaCode = extractAreaCode(phone);

    return {
      id: contact.id,
      createdAt: contact.created_at || null,
      sourceName,
      isWebsiteSource: isWebsiteSourceName(sourceName),
      city,
      state,
      country,
      postcode,
      areaCode,
      utmSource: (fieldMap.get('utm_source') || '').toString().trim() || 'Direct',
      utmMedium: (fieldMap.get('utm_medium') || '').toString().trim() || 'None',
      utmCampaign:
        (fieldMap.get('utm_campaign') || '').toString().trim() || 'No Campaign',
      rating: ratingName,
      agent: contact.agent === true,
      hasReservation: reservationContactIds.has(contact.id),
    };
  });

  const validContacts = compactContacts.filter((c) => !!c.createdAt);

  const dates = validContacts
    .map((c) => c.createdAt as string)
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t));
  const minDate = dates.length ? new Date(Math.min(...dates)).toISOString() : null;
  const maxDate = dates.length ? new Date(Math.max(...dates)).toISOString() : null;

  const sourceCounts = new Map<string, number>();
  validContacts.forEach((c) => {
    sourceCounts.set(c.sourceName, (sourceCounts.get(c.sourceName) || 0) + 1);
  });
  const sources = Array.from(sourceCounts.entries())
    .map(([name, total]) => ({
      name,
      isWebsite: isWebsiteSourceName(name),
      total,
    }))
    .sort((a, b) => b.total - a.total);

  const responseData = {
    meta: {
      projectId: PROJECT_ID,
      snapshotAt: new Date().toISOString(),
      dataMinDate: minDate,
      dataMaxDate: maxDate,
      totalContacts: validContacts.length,
      totalReservations: reservationDetails.length,
      ratingPalette: {
        New: '#C0D7B1', Agent: '#D3C9EC', Legal: '#FFDD90',
        Hot: '#C33A32', Warm: '#FFBBAA', Cold: '#C0E1F4',
        'Not Interested': '#DBDBDB', Team: '#e4a02c',
        'Reservation Holder': '#2380c4', 'Contract Holder': '#a038cc',
        Influencer: '#000000', 'CB Global Luxury Agent': '#f5e8e8',
        'Not A Buyer': '#055707', Referral: '#e759a0',
        Unrated: '#999999',
      },
    },
    contacts: validContacts,
    reservations: reservationDetails,
    sources,
  };

  // Write file
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(responseData));
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const size = (JSON.stringify(responseData).length / 1024).toFixed(1);
  log('done', `Wrote ${OUT_PATH} (${size} KB) in ${elapsed}s`);
  console.log('');
  console.log('Next:');
  console.log('  git add public/exec-summary-snapshot.json');
  console.log('  git commit -m "data: refresh executive summary snapshot"');
  console.log('  git push');
}

main().catch((err) => {
  console.error('Snapshot build failed:', err);
  process.exit(1);
});
