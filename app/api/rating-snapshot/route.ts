import { NextResponse } from 'next/server';
import { SparkAPIClient } from '@/lib/spark-client';
import {
  PROJECT_ID,
  RATING_MAP,
  ContactSnapshot,
  Snapshot,
  RatingChange,
  SnapshotSummary,
} from '@/lib/rating-types';
import {
  saveSnapshot,
  loadLatestSnapshot,
  appendRatingChanges,
  pruneSnapshots,
} from '@/lib/snapshot-storage';

const BATCH_SIZE = 20;

/**
 * Extract the project-specific rating from a contact's ratings array.
 * The ratings array contains objects like: { id, rating_id, project_id, ... }
 * We need the one matching our project.
 */
function extractProjectRating(contact: any): { id: number | null; name: string | null } {
  const ratings = contact.ratings || contact.contact_ratings || [];
  const projectRating = ratings.find((r: any) => r.project_id === PROJECT_ID);

  if (!projectRating) {
    return { id: null, name: null };
  }

  // The rating object's `id` IS the rating definition ID (e.g., 58248 = Hot)
  // and `value` is the human-readable name. Use RATING_MAP as fallback.
  const ratingId = projectRating.id;
  const ratingName = projectRating.value || RATING_MAP[ratingId] || `Unknown (${ratingId})`;
  return { id: ratingId, name: ratingName };
}

/**
 * Extract registration source name from a contact
 */
function extractRegistrationSource(contact: any): string | null {
  const sources = contact.registration_sources || [];
  if (sources.length === 0) return null;
  return sources[0].name || `Source ${sources[0].id}`;
}

/**
 * Extract UTM fields from custom_field_values using a field map
 */
function extractUTMFields(
  contact: any,
  customFieldMap: Map<number, string>
): { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null } {
  const cfValues = contact.custom_field_values || [];
  const fieldMap = new Map<string, any>();

  cfValues.forEach((cfv: any) => {
    const fieldName = customFieldMap.get(cfv.custom_field_id);
    if (fieldName) {
      fieldMap.set(fieldName, cfv.value);
    }
  });

  return {
    utm_source: fieldMap.get('utm_source') || null,
    utm_medium: fieldMap.get('utm_medium') || null,
    utm_campaign: fieldMap.get('utm_campaign') || null,
  };
}

/**
 * POST /api/rating-snapshot
 *
 * Takes a new rating snapshot:
 * 1. Fetches all contacts for project 2855 (by registration source, then individually)
 * 2. Records each contact's current rating
 * 3. Compares against previous snapshot
 * 4. Logs detected rating changes
 * 5. Returns summary
 */
export async function POST() {
  const startTime = Date.now();

  try {
    const apiKey = process.env.SPARK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SPARK_API_KEY not configured' },
        { status: 500 }
      );
    }

    const client = new SparkAPIClient(apiKey);
    const now = new Date().toISOString();

    console.log(`\n=== RATING SNAPSHOT ===`);
    console.log(`Timestamp: ${now}`);
    console.log(`Project: ${PROJECT_ID}`);

    // ========================================
    // STEP 1: Fetch registration sources
    // ========================================
    const registrationSources = await client.listRegistrationSources({
      project_id_eq: PROJECT_ID,
      per_page: 100,
    });

    const sourcesList = Array.isArray(registrationSources)
      ? registrationSources
      : registrationSources.data || [];

    console.log(`Found ${sourcesList.length} registration sources`);

    // ========================================
    // STEP 2: Fetch custom field definitions (for UTM)
    // ========================================
    const customFields = await client.listCustomFields({
      project_id_eq: PROJECT_ID,
      per_page: 100,
    });

    const customFieldsList = Array.isArray(customFields)
      ? customFields
      : customFields.data || [];

    const customFieldMap = new Map<number, string>();
    customFieldsList.forEach((field: any) => {
      if (field.id && field.name) {
        customFieldMap.set(field.id, field.name);
      }
    });

    // ========================================
    // STEP 3: Fetch ALL contacts by registration source
    // (Same pattern as dashboard route - API doesn't support project_id_eq on /contacts)
    // ========================================
    console.log('\nFetching contacts by registration source...');

    const allProjectContacts: any[] = [];
    const seenContactIds = new Set<number>();

    for (const source of sourcesList) {
      const sourceId = source.id;
      const sourceName = source.name;

      // Skip Agent Import (6,000+ records)
      if (sourceName?.toLowerCase().includes('agent import')) {
        console.log(`  Skipping "Agent Import" source (ID: ${sourceId})`);
        continue;
      }

      console.log(`  Fetching contacts for source: ${sourceName}...`);

      const contactsForSource = await client.listAllContacts({
        registration_source_id_eq: sourceId,
      });

      if (contactsForSource.length === 0) continue;

      console.log(`    Found ${contactsForSource.length} contacts, batch-fetching details...`);

      for (let i = 0; i < contactsForSource.length; i += BATCH_SIZE) {
        const batch = contactsForSource.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map((c: any) =>
          client.getContact(c.id).catch((err: any) => {
            console.error(`    Failed to fetch contact ${c.id}:`, err);
            return null;
          })
        );

        const detailedContacts = await Promise.all(batchPromises);

        detailedContacts.forEach((contact: any) => {
          if (!contact) return;
          if (seenContactIds.has(contact.id)) return; // Deduplicate

          const projects = contact.projects || [];
          const inProject = projects.some((p: any) => p.project_id === PROJECT_ID);
          if (inProject) {
            seenContactIds.add(contact.id);
            allProjectContacts.push(contact);
          }
        });
      }

      console.log(`    Total project contacts so far: ${allProjectContacts.length}`);
    }

    // ========================================
    // STEP 4: Fetch contacts with no registration source
    // ========================================
    console.log('\nFetching contacts with no registration source...');

    const noSourceContacts = await client.listAllContacts({
      registration_source_id_null: true,
    });

    console.log(`  Found ${noSourceContacts.length} contacts with no source, filtering by project...`);

    for (let i = 0; i < noSourceContacts.length; i += BATCH_SIZE) {
      const batch = noSourceContacts.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map((c: any) =>
        client.getContact(c.id).catch((err: any) => {
          console.error(`    Failed to fetch contact ${c.id}:`, err);
          return null;
        })
      );

      const detailedContacts = await Promise.all(batchPromises);

      detailedContacts.forEach((contact: any) => {
        if (!contact) return;
        if (seenContactIds.has(contact.id)) return;

        const projects = contact.projects || [];
        const inProject = projects.some((p: any) => p.project_id === PROJECT_ID);
        if (inProject) {
          seenContactIds.add(contact.id);
          allProjectContacts.push(contact);
        }
      });
    }

    console.log(`\nTotal contacts in project: ${allProjectContacts.length}`);

    // ========================================
    // STEP 5: Build snapshot
    // ========================================
    const contacts: ContactSnapshot[] = allProjectContacts.map((contact: any) => {
      const rating = extractProjectRating(contact);
      const utm = extractUTMFields(contact, customFieldMap);

      return {
        contact_id: contact.id,
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        rating_id: rating.id,
        rating_name: rating.name,
        registration_source: extractRegistrationSource(contact),
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
      };
    });

    const snapshot: Snapshot = {
      timestamp: now,
      project_id: PROJECT_ID,
      total_contacts: contacts.length,
      contacts,
    };

    // ========================================
    // STEP 6: Compare with previous snapshot
    // ========================================
    const previousSnapshot = await loadLatestSnapshot();
    const changes: RatingChange[] = [];
    let newContactCount = 0;
    let removedContactCount = 0;

    if (previousSnapshot) {
      console.log(`\nComparing against previous snapshot (${previousSnapshot.timestamp})...`);

      // Build lookup from previous snapshot
      const prevMap = new Map<number, ContactSnapshot>();
      previousSnapshot.contacts.forEach(c => prevMap.set(c.contact_id, c));

      // Build lookup from current snapshot
      const currentMap = new Map<number, ContactSnapshot>();
      contacts.forEach(c => currentMap.set(c.contact_id, c));

      // Check for rating changes and new contacts
      for (const current of contacts) {
        const prev = prevMap.get(current.contact_id);

        if (!prev) {
          newContactCount++;
          // New contact - log if they have a non-null rating (they entered with a rating)
          if (current.rating_id !== null) {
            changes.push({
              contact_id: current.contact_id,
              contact_name: `${current.first_name} ${current.last_name}`.trim(),
              previous_rating_id: null,
              previous_rating: null,
              new_rating_id: current.rating_id,
              new_rating: current.rating_name,
              changed_at: now,
              registration_source: current.registration_source,
              utm_source: current.utm_source,
              utm_medium: current.utm_medium,
              utm_campaign: current.utm_campaign,
            });
          }
          continue;
        }

        // Existing contact - check for rating change
        if (current.rating_id !== prev.rating_id) {
          changes.push({
            contact_id: current.contact_id,
            contact_name: `${current.first_name} ${current.last_name}`.trim(),
            previous_rating_id: prev.rating_id,
            previous_rating: prev.rating_name,
            new_rating_id: current.rating_id,
            new_rating: current.rating_name,
            changed_at: now,
            registration_source: current.registration_source,
            utm_source: current.utm_source,
            utm_medium: current.utm_medium,
            utm_campaign: current.utm_campaign,
          });
        }
      }

      // Check for removed contacts
      for (const prev of previousSnapshot.contacts) {
        if (!currentMap.has(prev.contact_id)) {
          removedContactCount++;
        }
      }

      console.log(`  New contacts: ${newContactCount}`);
      console.log(`  Removed contacts: ${removedContactCount}`);
      console.log(`  Rating changes: ${changes.length}`);
    } else {
      console.log('\nNo previous snapshot found - this is the first snapshot.');
      newContactCount = contacts.length;
    }

    // ========================================
    // STEP 7: Save snapshot and changes
    // ========================================
    const snapshotPath = await saveSnapshot(snapshot);
    console.log(`Snapshot saved: ${snapshotPath}`);

    if (changes.length > 0) {
      await appendRatingChanges(changes);
      console.log(`Appended ${changes.length} rating changes`);
    }

    // Prune old snapshots (keep last 30)
    const pruned = await pruneSnapshots(30);
    if (pruned > 0) {
      console.log(`Pruned ${pruned} old snapshots`);
    }

    const duration = Date.now() - startTime;
    console.log(`\nSnapshot complete in ${duration}ms`);
    console.log('========================\n');

    const summary: SnapshotSummary = {
      timestamp: now,
      total_contacts: contacts.length,
      new_contacts: newContactCount,
      removed_contacts: removedContactCount,
      rating_changes: changes.length,
      changes,
      is_first_snapshot: !previousSnapshot,
      duration_ms: duration,
    };

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('Rating snapshot error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to take rating snapshot',
        details: error,
      },
      { status: error.status || 500 }
    );
  }
}

/**
 * GET /api/rating-snapshot
 *
 * Returns info about the latest snapshot without taking a new one.
 */
export async function GET() {
  try {
    const latest = await loadLatestSnapshot();

    if (!latest) {
      return NextResponse.json({
        message: 'No snapshots exist yet. POST to this endpoint to take the first snapshot.',
        has_snapshots: false,
      });
    }

    // Build rating distribution summary
    const ratingDistribution: Record<string, number> = {};
    latest.contacts.forEach(c => {
      const key = c.rating_name || 'No Rating';
      ratingDistribution[key] = (ratingDistribution[key] || 0) + 1;
    });

    return NextResponse.json({
      has_snapshots: true,
      latest_snapshot: {
        timestamp: latest.timestamp,
        project_id: latest.project_id,
        total_contacts: latest.total_contacts,
        rating_distribution: ratingDistribution,
      },
    });
  } catch (error: any) {
    console.error('Rating snapshot GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to read snapshot data' },
      { status: 500 }
    );
  }
}
