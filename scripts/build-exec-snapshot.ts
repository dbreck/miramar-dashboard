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

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SparkAPIClient } from '../lib/spark-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const OUT_PATH = join(ROOT, 'public', 'exec-summary-snapshot.json');
const HISTORY_PATH = join(ROOT, 'public', 'rating-history.json');

const PROJECT_ID = 2855;

const RATING_NAMES_BY_ID: Record<number, string> = {
  58245: 'New', 58246: 'Agent', 58247: 'Legal', 58248: 'Hot', 58249: 'Warm',
  58250: 'Cold', 58251: 'Not Interested', 58627: 'Team', 58755: 'Reservation Holder',
  58756: 'Contract Holder', 58866: 'Influencer', 59334: 'CB Global Luxury Agent',
  59364: 'Not A Buyer', 59733: 'Referral',
};

const AGENT_RATING_ID = 58246;

// A raw Spark contact counts as an agent when EITHER signal is present: the
// boolean `agent` flag or the "Agent" rating. Bulk realtor imports don't
// reliably set both — the 2026-07-03 list set the flag only, the 2026-07-24
// list (Premier Sotheby's / Smith & Associates) set the rating only.
function isAgentContact(c: any): boolean {
  return (
    c.agent === true ||
    (c.ratings || []).some((r: any) => r?.id === AGENT_RATING_ID)
  );
}

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

  // Shared throttling helpers. Spark's per-second rate limit is undocumented
  // but empirically trips around ~10 concurrent requests; the contacts phase
  // used to burn the entire window in 50-wide bursts and 429 the very next
  // call (reservations). Lower concurrency + a small inter-batch sleep keeps
  // the budget topped up for downstream stages.
  const CONTACT_BATCH = 20;
  const CONTACT_BATCH_SLEEP_MS = 500;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Contacts whose detail fetch failed even after the client's 429 retries.
  // These used to be swallowed with `.catch(() => null)`, which quietly shrank
  // the snapshot; now they abort the run instead. Keyed by id so a contact
  // retried in a later stage overwrites its own earlier failure.
  const failedContactIds = new Map<number, string>();
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

  // The registration source we auto-relabel sourceless agent imports to.
  // Bulk realtor lists periodically get imported with no source (e.g.
  // 2026-07-03) and land in the "No Source" bucket; the guard in the no-source
  // stage below moves them here so both Spark and the dashboard categorize them
  // correctly instead of counting them as sourceless leads.
  const agentImportSourceId =
    [...sourceMap.entries()].find(([, name]) =>
      name.toLowerCase().includes('agent import'),
    )?.[0] ?? null;

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

    const contactsForSource = await client.listAllContacts(
      { registration_source_id_eq: sourceId },
      { throwOnError: true },
    );
    if (contactsForSource.length === 0) continue;

    for (let i = 0; i < contactsForSource.length; i += CONTACT_BATCH) {
      const batch = contactsForSource.slice(i, i + CONTACT_BATCH);
      const detailed = await Promise.all(
        batch.map((c: any) =>
          client.getContact(c.id).catch((err: any) => {
            failedContactIds.set(c.id, err?.message || String(err));
            return null;
          }),
        ),
      );
      detailed.forEach((c: any) => {
        if (!c) return;
        const projects = c.projects || [];
        if (projects.some((p: any) => p.project_id === PROJECT_ID)) {
          allContactsForProject.push(c);
        }
      });
      log('details', `  ${Math.min(i + CONTACT_BATCH, contactsForSource.length)}/${contactsForSource.length}`);
      if (i + CONTACT_BATCH < contactsForSource.length) await sleep(CONTACT_BATCH_SLEEP_MS);
    }
  }

  // No-source bucket
  log('no-source', 'Fetching contacts with no registration source…');
  const noSourceContacts = await client.listAllContacts(
    { registration_source_id_null: true },
    { throwOnError: true },
  );
  // Sourceless AGENT contacts are almost always a bulk realtor import that
  // arrived without a source. Collect them separately: real (non-agent)
  // no-source contacts are legitimate walk-ins / direct traffic and stay in
  // the snapshot as "No Source", but sourceless agents get relabeled to
  // "Agent Import" (below) and dropped from this run — treated exactly like
  // every other Agent Import contact, which the by-source loop already skips.
  const sourcelessAgents: any[] = [];
  if (noSourceContacts.length > 0) {
    for (let i = 0; i < noSourceContacts.length; i += CONTACT_BATCH) {
      const batch = noSourceContacts.slice(i, i + CONTACT_BATCH);
      const detailed = await Promise.all(
        batch.map((c: any) =>
          client.getContact(c.id).catch((err: any) => {
            failedContactIds.set(c.id, err?.message || String(err));
            return null;
          }),
        ),
      );
      detailed.forEach((c: any) => {
        if (!c) return;
        const projects = c.projects || [];
        if (!projects.some((p: any) => p.project_id === PROJECT_ID)) return;
        if (isAgentContact(c) && agentImportSourceId) {
          sourcelessAgents.push(c);
        } else {
          allContactsForProject.push(c);
        }
      });
      log('details', `  no-source ${Math.min(i + CONTACT_BATCH, noSourceContacts.length)}/${noSourceContacts.length}`);
      if (i + CONTACT_BATCH < noSourceContacts.length) await sleep(CONTACT_BATCH_SLEEP_MS);
    }
  }

  // Auto-heal: assign the "Agent Import" source to sourceless agents so future
  // runs (and Spark's own reports) categorize them correctly. Best effort — a
  // failed write just means we retry on the next run; it is never fatal to the
  // snapshot. These contacts are intentionally excluded from this run's payload
  // above regardless of write outcome (they're agents, not leads).
  if (sourcelessAgents.length > 0 && agentImportSourceId) {
    log('agent-heal', `Relabeling ${sourcelessAgents.length} sourceless agent(s) → "Agent Import"…`);
    let healed = 0;
    for (let i = 0; i < sourcelessAgents.length; i += CONTACT_BATCH) {
      const batch = sourcelessAgents.slice(i, i + CONTACT_BATCH);
      const outcomes = await Promise.all(
        batch.map((c: any) =>
          fetchWithRetry(
            () =>
              client.updateContact(c.id, {
                registration_source_id: agentImportSourceId,
                // Normalize the boolean too — rating-only imports (2026-07-24)
                // otherwise keep slipping past `agent`-flag checks in Spark.
                agent: true,
              }),
            `updateContact(${c.id})`,
          ),
        ),
      );
      healed += outcomes.filter((o) => o !== null).length;
      if (i + CONTACT_BATCH < sourcelessAgents.length) await sleep(CONTACT_BATCH_SLEEP_MS);
    }
    log('agent-heal', `Relabeled ${healed}/${sourcelessAgents.length}`);
  }

  // Dedupe
  const contactById = new Map<number, any>();
  for (const c of allContactsForProject) {
    if (!contactById.has(c.id)) contactById.set(c.id, c);
  }
  const dedupedContacts = Array.from(contactById.values());
  log('contacts', `Deduped to ${dedupedContacts.length} unique contacts`);

  // Guard 1: every contact we listed must have been fetched. A partial contact
  // set still produces a structurally valid snapshot, so without this the run
  // goes green and publishes under-counted leads.
  if (failedContactIds.size > 0) {
    const sample = Array.from(failedContactIds.entries()).slice(0, 5);
    console.error(
      `Aborting snapshot build — ${failedContactIds.size} contact detail fetch(es) failed after retries.`,
    );
    sample.forEach(([id, msg]) => console.error(`  contact ${id}: ${msg}`));
    if (failedContactIds.size > sample.length) {
      console.error(`  …and ${failedContactIds.size - sample.length} more.`);
    }
    process.exit(1);
  }

  // Guard 2: a sudden drop in contact count almost always means we lost data to
  // rate limiting rather than that leads actually vanished. Compare against the
  // currently committed snapshot and refuse to shrink it by more than 10%.
  // Set ALLOW_SNAPSHOT_SHRINK=1 to override for a genuine bulk deletion.
  if (existsSync(OUT_PATH) && !process.env.ALLOW_SNAPSHOT_SHRINK) {
    try {
      const previous = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
      const previousCount = Array.isArray(previous?.contacts) ? previous.contacts.length : 0;
      const floor = Math.floor(previousCount * 0.9);
      if (previousCount > 0 && dedupedContacts.length < floor) {
        console.error(
          `Aborting snapshot build — contact count dropped from ${previousCount} to ${dedupedContacts.length} ` +
            `(below the ${floor} floor). This is usually silent rate-limit truncation. ` +
            `Re-run, or set ALLOW_SNAPSHOT_SHRINK=1 if the drop is real.`,
        );
        process.exit(1);
      }
      log('contacts', `Count check OK (previous snapshot: ${previousCount})`);
    } catch (err: any) {
      // A malformed/missing previous snapshot shouldn't block a good build.
      console.warn(`  Could not read previous snapshot for count check: ${err?.message || err}`);
    }
  }

  // Stage 4: reservations + contracts
  // Give Spark's rate-limit window a chance to refill before the next API
  // call — the contacts phase tends to push us right up against the limit.
  await sleep(3000);
  log('reservations', 'Fetching reservations…');
  // 429 retries now live in SparkAPIClient.request(), so this only needs to
  // turn a genuine failure into an abort rather than an empty-reservation write.
  let reservations: any[] = [];
  try {
    reservations = await client.listAllReservations(
      { project_id_eq: PROJECT_ID },
      { throwOnError: true },
    );
  } catch (err: any) {
    console.error('Failed to fetch reservations after retries:', err?.message || String(err));
    console.error('Aborting snapshot build — refusing to write a snapshot with empty reservations.');
    process.exit(1);
  }
  log('reservations', `Found ${reservations.length} reservations`);

  // Build contract_id → buyer-contact map from the contacts we already fetched.
  // Spark's primary_purchaser embed on /contracts/{id} doesn't expose contact_id,
  // but each contact's response carries a contracts[] array, so we can invert
  // that to look up the buyer for a given contract.
  const contractToContact = new Map<number, any>();
  for (const c of dedupedContacts) {
    if (isAgentContact(c)) continue; // skip agents — they're not buyers
    const contracts = c.contracts || [];
    for (const ct of contracts) {
      if (ct?.id) contractToContact.set(ct.id, c);
    }
  }

  const reservationDetails: any[] = [];
  const RES_BATCH = 5;
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
      agent: isAgentContact(contact),
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

  // ---------- Rating history (append-only time series) ----------
  // Compute today's rating distribution from the same contacts that were
  // just baked into the exec-summary snapshot. Cron runs twice daily (10:00
  // and 22:00 UTC), so each day produces an `am` and a `pm` entry; the
  // dedup key is `${date}-${slot}` so the second run doesn't overwrite the
  // first.
  const todayISO = responseData.meta.snapshotAt;
  const todayDate = todayISO.split('T')[0]; // YYYY-MM-DD
  const utcHour = new Date(todayISO).getUTCHours();
  const slot: 'am' | 'pm' = utcHour < 16 ? 'am' : 'pm';

  const ratingCounts: Record<string, number> = {};
  for (const c of validContacts) {
    const key = c.rating || 'Unrated';
    ratingCounts[key] = (ratingCounts[key] || 0) + 1;
  }

  const todayEntry = {
    date: todayDate,
    slot,
    snapshotAt: todayISO,
    totalContacts: validContacts.length,
    ratings: ratingCounts,
  };

  type HistoryEntry = typeof todayEntry;
  type HistoryFile = {
    version: number;
    lastUpdated: string;
    snapshots: HistoryEntry[];
  };

  let history: HistoryFile = {
    version: 1,
    lastUpdated: todayISO,
    snapshots: [],
  };
  if (existsSync(HISTORY_PATH)) {
    try {
      const raw = readFileSync(HISTORY_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.snapshots)) {
        history = parsed as HistoryFile;
      }
    } catch (e) {
      console.warn('rating-history.json was unparseable; starting fresh.');
    }
  }

  // Replace this slot's entry if the build runs more than once on the same
  // day in the same slot (e.g. manual rerun).
  const existingIdx = history.snapshots.findIndex(
    (s) => s.date === todayDate && (s.slot ?? 'am') === slot,
  );
  if (existingIdx >= 0) {
    history.snapshots[existingIdx] = todayEntry;
  } else {
    history.snapshots.push(todayEntry);
  }
  history.snapshots.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.slot ?? 'am').localeCompare(b.slot ?? 'am');
  });
  history.lastUpdated = todayISO;

  writeFileSync(HISTORY_PATH, JSON.stringify(history));
  log(
    'history',
    `Wrote ${HISTORY_PATH} — ${history.snapshots.length} entr${history.snapshots.length === 1 ? 'y' : 'ies'}`,
  );

  console.log('');
  console.log('Next:');
  console.log('  git add public/exec-summary-snapshot.json public/rating-history.json');
  console.log('  git commit -m "data: refresh executive summary snapshot"');
  console.log('  git push');
}

main().catch((err) => {
  console.error('Snapshot build failed:', err);
  process.exit(1);
});
