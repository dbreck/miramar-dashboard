import { SparkAPIClient } from '@/lib/spark-client';

const PROJECT_ID = 2855;

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour server cache (manual refresh from client otherwise)

export const maxDuration = 300; // Vercel Pro plan

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

const RATING_NAMES_BY_ID: Record<number, string> = {
  58245: 'New', 58246: 'Agent', 58247: 'Legal', 58248: 'Hot', 58249: 'Warm',
  58250: 'Cold', 58251: 'Not Interested', 58627: 'Team', 58755: 'Reservation Holder',
  58756: 'Contract Holder', 58866: 'Influencer', 59334: 'CB Global Luxury Agent',
  59364: 'Not A Buyer', 59733: 'Referral',
};

function isWebsiteSourceName(name: string): boolean {
  return name.toLowerCase().startsWith('website');
}

function extractAreaCode(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) return null;
  const cleaned = phoneNumber.replace(/\D/g, '');
  if (cleaned.length === 10) return cleaned.substring(0, 3);
  if (cleaned.length === 11 && cleaned[0] === '1') return cleaned.substring(1, 4);
  return null;
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const { searchParams } = new URL(request.url);
        const force = searchParams.get('force') === 'true';

        const cacheKey = `exec-summary-${PROJECT_ID}`;
        if (!force) {
          const cached = getCached(cacheKey);
          if (cached) {
            sendEvent({ stage: 'complete', message: 'Loaded from cache', data: cached });
            controller.close();
            return;
          }
        }

        const apiKey = process.env.SPARK_API_KEY;
        if (!apiKey) {
          sendEvent({ stage: 'error', message: 'SPARK_API_KEY not configured' });
          controller.close();
          return;
        }
        const client = new SparkAPIClient(apiKey);

        // Stage 1: Registration sources
        sendEvent({ stage: 'sources', message: 'Fetching registration sources...' });
        const registrationSources = await client.listRegistrationSources({
          project_id_eq: PROJECT_ID,
          per_page: 100,
        });
        const registrationSourcesList = Array.isArray(registrationSources)
          ? registrationSources
          : registrationSources.data || [];

        const sourceMap = new Map<number, string>();
        registrationSourcesList.forEach((source: any) => {
          if (source.id && source.name) sourceMap.set(source.id, source.name);
        });

        // Always exclude "Agent Import"
        const excludedSourceIds = new Set<number>();
        for (const [id, sourceName] of sourceMap.entries()) {
          if (sourceName.toLowerCase().includes('agent import')) {
            excludedSourceIds.add(id);
          }
        }

        // Stage 2: Custom field definitions (for UTM mapping)
        sendEvent({ stage: 'fields', message: 'Fetching custom field definitions...' });
        const customFields = await client.listCustomFields({
          project_id_eq: PROJECT_ID,
          per_page: 100,
        });
        const customFieldsList = Array.isArray(customFields)
          ? customFields
          : customFields.data || [];
        const customFieldMap = new Map<number, string>();
        customFieldsList.forEach((field: any) => {
          if (field.id && field.name) customFieldMap.set(field.id, field.name);
        });

        // Stage 3: Fetch contacts by source (all-time)
        const allContactsForProject: any[] = [];
        const sourcesToFetch = registrationSourcesList.filter(
          (s: any) => !excludedSourceIds.has(s.id),
        );

        sendEvent({
          stage: 'contacts',
          message: `Loading contacts from ${sourcesToFetch.length} sources...`,
          progress: { current: 0, total: sourcesToFetch.length },
        });

        let sourceIndex = 0;
        for (const source of sourcesToFetch) {
          sourceIndex++;
          const sourceId = source.id;
          const sourceName = source.name;

          sendEvent({
            stage: 'contacts',
            message: `Loading "${sourceName}"...`,
            progress: { current: sourceIndex, total: sourcesToFetch.length },
          });

          const contactsForSource = await client.listAllContacts({
            registration_source_id_eq: sourceId,
          });
          if (contactsForSource.length === 0) continue;

          const BATCH_SIZE = 50;
          for (let i = 0; i < contactsForSource.length; i += BATCH_SIZE) {
            const batch = contactsForSource.slice(i, i + BATCH_SIZE);
            const batchEnd = Math.min(i + BATCH_SIZE, contactsForSource.length);

            sendEvent({
              stage: 'details',
              message: `"${sourceName}": ${batchEnd}/${contactsForSource.length}`,
              progress: { current: batchEnd, total: contactsForSource.length, source: sourceName },
            });

            const detailedContacts = await Promise.all(
              batch.map((c: any) => client.getContact(c.id).catch(() => null)),
            );
            detailedContacts.forEach((contact: any) => {
              if (!contact) return;
              const projects = contact.projects || [];
              const inProject = projects.some((p: any) => p.project_id === PROJECT_ID);
              if (inProject) allContactsForProject.push(contact);
            });
          }
        }

        // Also fetch contacts with no registration source
        sendEvent({ stage: 'no-source', message: 'Fetching contacts with no source...' });
        const noSourceContacts = await client.listAllContacts({
          registration_source_id_null: true,
        });
        if (noSourceContacts.length > 0) {
          const BATCH_SIZE = 50;
          for (let i = 0; i < noSourceContacts.length; i += BATCH_SIZE) {
            const batch = noSourceContacts.slice(i, i + BATCH_SIZE);
            const detailedContacts = await Promise.all(
              batch.map((c: any) => client.getContact(c.id).catch(() => null)),
            );
            detailedContacts.forEach((contact: any) => {
              if (!contact) return;
              const projects = contact.projects || [];
              const inProject = projects.some((p: any) => p.project_id === PROJECT_ID);
              if (inProject) allContactsForProject.push(contact);
            });
          }
        }

        // Deduplicate by contact id (a contact may have multiple registration sources)
        const contactById = new Map<number, any>();
        for (const c of allContactsForProject) {
          if (!contactById.has(c.id)) contactById.set(c.id, c);
        }
        const dedupedContacts = Array.from(contactById.values());

        // Stage 4: Reservations + contracts
        sendEvent({ stage: 'aggregate', message: 'Fetching reservations...' });
        const reservations = await client.listAllReservations({
          project_id_eq: PROJECT_ID,
        });

        sendEvent({
          stage: 'aggregate',
          message: `Found ${reservations.length} reservations, fetching contract details...`,
          progress: { current: 0, total: reservations.length },
        });

        // Build contract_id → buyer-contact map from the contacts already fetched.
        // The /contracts/{id} primary_purchaser embed doesn't expose contact_id, but
        // each contact response carries a contracts[] array — invert that here.
        const contractToContact = new Map<number, any>();
        for (const c of dedupedContacts) {
          if (c.agent === true) continue;
          const cs = c.contracts || [];
          for (const ct of cs) {
            if (ct?.id) contractToContact.set(ct.id, c);
          }
        }

        const reservationDetails: any[] = [];
        const RES_BATCH = 10;
        for (let i = 0; i < reservations.length; i += RES_BATCH) {
          const batch = reservations.slice(i, i + RES_BATCH);
          const batchEnd = Math.min(i + RES_BATCH, reservations.length);
          sendEvent({
            stage: 'aggregate',
            message: `Reservation contracts ${batchEnd}/${reservations.length}`,
            progress: { current: batchEnd, total: reservations.length },
          });
          const contracts = await Promise.all(
            batch.map((r: any) =>
              r.contract_id ? client.getContract(r.contract_id).catch(() => null) : null,
            ),
          );
          for (let j = 0; j < batch.length; j++) {
            const r = batch[j];
            const contract = contracts[j];
            const buyerContact = r.contract_id ? contractToContact.get(r.contract_id) : null;
            const contactId = buyerContact?.id ?? null;

            const deposits = contract?.deposits || [];
            const depositsOwed = deposits.reduce((sum: number, d: any) => sum + (d.owed_amount || 0), 0);
            const depositsPaid = deposits.reduce((sum: number, d: any) => sum + (d.paid_amount || 0), 0);

            // Buyer source
            let sourceName = 'Unknown';
            if (buyerContact) {
              const sources = buyerContact.registration_sources || [];
              if (sources.length > 0) {
                sourceName = sourceMap.get(sources[0].id) || `Source ${sources[0].id}`;
              } else {
                sourceName = 'No Source';
              }
            }

            const reservedAt = r.reserved_at || r.created_at || null;
            const leadDate = buyerContact?.created_at || null;
            let daysFromLead: number | null = null;
            if (reservedAt && leadDate) {
              daysFromLead = Math.max(
                0,
                Math.round((new Date(reservedAt).getTime() - new Date(leadDate).getTime()) / 86400000),
              );
            }

            // Buyer name (best-effort, non-PII-safe display only)
            const buyerName = buyerContact
              ? [buyerContact.first_name, buyerContact.last_name].filter(Boolean).join(' ').trim() || null
              : null;

            reservationDetails.push({
              id: r.id,
              reservedAt,
              createdAt: r.created_at || null,
              executedAt: r.executed_at || null,
              convertedAt: r.converted_at || null,
              statusId: r.status_id || null,
              priceCents: r.reservation_list_price || contract?.purchase_price || 0,
              depositsOwedCents: depositsOwed,
              depositsPaidCents: depositsPaid,
              contactId,
              buyerName,
              sourceName,
              isWebsiteSource: isWebsiteSourceName(sourceName),
              leadDate,
              daysFromLead,
            });
          }
        }

        // Stage 5: Build per-contact compact records
        sendEvent({ stage: 'aggregate', message: 'Building report payload...' });

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
          const state = (contact.province || contact.state || '').toString().trim() || null;
          const country = (contact.country_iso || contact.country || '').toString().trim() || null;
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
            utmCampaign: (fieldMap.get('utm_campaign') || '').toString().trim() || 'No Campaign',
            rating: ratingName,
            agent: contact.agent === true,
            hasReservation: reservationContactIds.has(contact.id),
          };
        });

        // Filter out contacts without created_at or matching the agent import source
        const validContacts = compactContacts.filter((c) => !!c.createdAt);

        // Compute snapshot metadata
        const snapshotAt = new Date().toISOString();
        const dates = validContacts
          .map((c) => c.createdAt as string)
          .filter(Boolean)
          .map((d) => new Date(d).getTime())
          .filter((t) => !Number.isNaN(t));
        const minDate = dates.length ? new Date(Math.min(...dates)).toISOString() : null;
        const maxDate = dates.length ? new Date(Math.max(...dates)).toISOString() : null;

        // Source roster
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
            snapshotAt,
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

        setCache(cacheKey, responseData);
        sendEvent({ stage: 'complete', message: 'Executive summary ready!', data: responseData });
        controller.close();
      } catch (error: any) {
        sendEvent({
          stage: 'error',
          message: error?.message || 'Failed to build executive summary',
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
