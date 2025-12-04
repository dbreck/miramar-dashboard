import { SparkAPIClient } from '@/lib/spark-client';

const PROJECT_ID = 2855; // Mira Mar project ID

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Area code to city/region mapping (abbreviated - full list in main route.ts)
const areaCodeToLocation: Record<string, string> = {
  // Florida
  '239': 'Fort Myers, FL', '305': 'Miami, FL', '321': 'Orlando, FL', '352': 'Gainesville, FL',
  '386': 'Daytona Beach, FL', '407': 'Orlando, FL', '561': 'West Palm Beach, FL', '727': 'St. Petersburg, FL',
  '754': 'Fort Lauderdale, FL', '772': 'Port St. Lucie, FL', '786': 'Miami, FL', '813': 'Tampa, FL',
  '850': 'Tallahassee, FL', '863': 'Lakeland, FL', '904': 'Jacksonville, FL', '941': 'Sarasota, FL',
  '954': 'Fort Lauderdale, FL',
  // Major US cities - common ones
  '212': 'Manhattan, NY', '213': 'Los Angeles, CA', '310': 'West LA, CA', '312': 'Chicago, IL',
  '404': 'Atlanta, GA', '415': 'San Francisco, CA', '512': 'Austin, TX', '617': 'Boston, MA',
  '702': 'Las Vegas, NV', '713': 'Houston, TX', '214': 'Dallas, TX', '602': 'Phoenix, AZ',
  '206': 'Seattle, WA', '303': 'Denver, CO', '215': 'Philadelphia, PA',
};

function extractAreaCode(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) return null;
  const cleaned = phoneNumber.replace(/\D/g, '');
  if (cleaned.length === 10) return cleaned.substring(0, 3);
  if (cleaned.length === 11 && cleaned[0] === '1') return cleaned.substring(1, 4);
  return null;
}

function getCached(key: string): any | null {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return cached.data;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
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
        const startParam = searchParams.get('start');
        const endParam = searchParams.get('end');

        // Parse filter parameters
        const excludeSourcesParam = searchParams.get('excludeSources');
        const excludeAgentsParam = searchParams.get('excludeAgents');
        const excludeNoSourceParam = searchParams.get('excludeNoSource');

        const excludedSourceNames = excludeSourcesParam
          ? excludeSourcesParam.split(',').map(s => s.trim()).filter(Boolean)
          : [];
        const excludeAgents = excludeAgentsParam === 'true';
        const excludeNoSource = excludeNoSourceParam === 'true';

        // Parse date range
        const endDate = endParam ? new Date(endParam) : (() => {
          const end = new Date();
          end.setUTCHours(23, 59, 59, 999);
          return end;
        })();
        const startDate = startParam ? new Date(startParam) : (() => {
          const start = new Date();
          start.setUTCHours(0, 0, 0, 0);
          start.setUTCDate(start.getUTCDate() - 30);
          return start;
        })();

        // Check cache first
        const filterKey = `${excludedSourceNames.sort().join('|')}-${excludeAgents}-${excludeNoSource}`;
        const cacheKey = `dashboard-${startDate.toISOString()}-${endDate.toISOString()}-${filterKey}`;
        const cached = getCached(cacheKey);

        if (cached) {
          sendEvent({ stage: 'complete', message: 'Loaded from cache', data: cached });
          controller.close();
          return;
        }

        const apiKey = process.env.SPARK_API_KEY;
        if (!apiKey) {
          sendEvent({ stage: 'error', message: 'SPARK_API_KEY not configured' });
          controller.close();
          return;
        }

        const client = new SparkAPIClient(apiKey);

        // Stage 1: Fetch registration sources
        sendEvent({ stage: 'sources', message: 'Fetching registration sources...' });

        const registrationSources = await client.listRegistrationSources({
          project_id_eq: PROJECT_ID,
          per_page: 100
        });

        const registrationSourcesList = Array.isArray(registrationSources)
          ? registrationSources
          : registrationSources.data || [];

        const sourceMap = new Map<number, string>();
        registrationSourcesList.forEach((source: any) => {
          if (source.id && source.name) {
            sourceMap.set(source.id, source.name);
          }
        });

        sendEvent({ stage: 'sources', message: `Found ${sourceMap.size} registration sources` });

        // Build excluded source IDs
        const excludedSourceIds = new Set<number>();
        excludedSourceNames.forEach((name: string) => {
          for (const [id, sourceName] of sourceMap.entries()) {
            if (sourceName === name) {
              excludedSourceIds.add(id);
              break;
            }
          }
        });

        // Always exclude "Agent Import"
        for (const [id, sourceName] of sourceMap.entries()) {
          if (sourceName.toLowerCase().includes('agent import')) {
            excludedSourceIds.add(id);
          }
        }

        // Fetch custom field definitions
        sendEvent({ stage: 'fields', message: 'Fetching custom field definitions...' });

        const customFields = await client.listCustomFields({
          project_id_eq: PROJECT_ID,
          per_page: 100
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

        // Stage 2: Fetch contacts by source
        const allContactsForProject: any[] = [];
        const sourcesToFetch = registrationSourcesList.filter(
          (s: any) => !excludedSourceIds.has(s.id)
        );

        sendEvent({
          stage: 'contacts',
          message: `Loading contacts from ${sourcesToFetch.length} sources...`,
          progress: { current: 0, total: sourcesToFetch.length }
        });

        let sourceIndex = 0;
        for (const source of sourcesToFetch) {
          sourceIndex++;
          const sourceId = source.id;
          const sourceName = source.name;

          sendEvent({
            stage: 'contacts',
            message: `Loading "${sourceName}"...`,
            progress: { current: sourceIndex, total: sourcesToFetch.length }
          });

          // Fetch contacts for this source
          const contactsForSource = await client.listAllContacts({
            registration_source_id_eq: sourceId,
          });

          if (contactsForSource.length === 0) continue;

          sendEvent({
            stage: 'contacts',
            message: `"${sourceName}": ${contactsForSource.length} contacts found, fetching details...`,
            progress: { current: sourceIndex, total: sourcesToFetch.length }
          });

          // Batch fetch individual contacts
          const BATCH_SIZE = 50;
          for (let i = 0; i < contactsForSource.length; i += BATCH_SIZE) {
            const batch = contactsForSource.slice(i, i + BATCH_SIZE);
            const batchEnd = Math.min(i + BATCH_SIZE, contactsForSource.length);

            sendEvent({
              stage: 'details',
              message: `"${sourceName}": Fetching details ${i + 1}-${batchEnd} of ${contactsForSource.length}...`,
              progress: { current: batchEnd, total: contactsForSource.length, source: sourceName }
            });

            const batchPromises = batch.map((c: any) =>
              client.getContact(c.id).catch(() => null)
            );

            const detailedContacts = await Promise.all(batchPromises);

            // Filter to contacts in this project
            detailedContacts.forEach((contact: any) => {
              if (!contact) return;
              const projects = contact.projects || [];
              const inProject = projects.some((p: any) => p.project_id === PROJECT_ID);
              if (inProject) {
                allContactsForProject.push(contact);
              }
            });
          }

          sendEvent({
            stage: 'contacts',
            message: `"${sourceName}": Complete (${allContactsForProject.length} total contacts)`,
            progress: { current: sourceIndex, total: sourcesToFetch.length }
          });
        }

        // Fetch contacts with no source (if not excluded)
        if (!excludeNoSource) {
          sendEvent({ stage: 'no-source', message: 'Fetching contacts with no registration source...' });

          const contactsWithNoSource = await client.listAllContacts({
            registration_source_id_null: true,
          });

          if (contactsWithNoSource.length > 0) {
            sendEvent({
              stage: 'no-source',
              message: `Found ${contactsWithNoSource.length} contacts with no source, fetching details...`
            });

            const BATCH_SIZE = 50;
            for (let i = 0; i < contactsWithNoSource.length; i += BATCH_SIZE) {
              const batch = contactsWithNoSource.slice(i, i + BATCH_SIZE);
              const batchEnd = Math.min(i + BATCH_SIZE, contactsWithNoSource.length);

              sendEvent({
                stage: 'details',
                message: `No source: Fetching details ${i + 1}-${batchEnd} of ${contactsWithNoSource.length}...`,
                progress: { current: batchEnd, total: contactsWithNoSource.length, source: 'No Source' }
              });

              const batchPromises = batch.map((c: any) =>
                client.getContact(c.id).catch(() => null)
              );

              const detailedContacts = await Promise.all(batchPromises);

              detailedContacts.forEach((contact: any) => {
                if (!contact) return;
                const projects = contact.projects || [];
                const inProject = projects.some((p: any) => p.project_id === PROJECT_ID);
                if (inProject) {
                  allContactsForProject.push(contact);
                }
              });
            }
          }
        }

        // Stage 3: Aggregation
        sendEvent({
          stage: 'aggregate',
          message: `Aggregating data for ${allContactsForProject.length} contacts...`
        });

        // Filter by date range
        const dateFilteredContacts = allContactsForProject.filter((contact: any) => {
          if (!contact.created_at) return false;
          const createdDate = new Date(contact.created_at);
          return createdDate >= startDate && createdDate <= endDate;
        });

        sendEvent({
          stage: 'aggregate',
          message: `${dateFilteredContacts.length} contacts in date range`
        });

        // Apply user filters
        const allContacts = dateFilteredContacts.filter((contact: any) => {
          if (excludeAgents && contact.agent === true) return false;
          const sources = contact.registration_sources || [];
          if (excludeNoSource && sources.length === 0) return false;
          if (excludedSourceIds.size > 0) {
            const hasExcludedSource = sources.some((source: any) =>
              source && excludedSourceIds.has(source.id)
            );
            if (hasExcludedSource) return false;
          }
          return true;
        });

        // Calculate all metrics (abbreviated for streaming endpoint)
        sendEvent({ stage: 'aggregate', message: 'Calculating lead sources...' });

        // Agent distribution
        const agentCount = allContacts.filter((c: any) => c.agent === true).length;
        const nonAgentCount = allContacts.length - agentCount;
        const agentDistribution = [
          { category: 'All Leads', count: allContacts.length },
          { category: 'Agents', count: agentCount },
          { category: 'Non-Agents', count: nonAgentCount }
        ];

        // Lead sources
        const sourceContactCounts = new Map<number, number>();
        let noSourceCount = 0;

        allContacts.forEach((contact: any) => {
          const sources = contact.registration_sources || [];
          if (sources.length > 0) {
            const uniqueSourceIds = new Set<number>();
            sources.forEach((source: any) => {
              if (source && source.id) uniqueSourceIds.add(source.id);
            });
            uniqueSourceIds.forEach((sourceId: number) => {
              sourceContactCounts.set(sourceId, (sourceContactCounts.get(sourceId) || 0) + 1);
            });
          } else {
            noSourceCount++;
          }
        });

        const leadSources = Array.from(sourceContactCounts.entries())
          .map(([sourceId, count]) => ({
            name: sourceMap.get(sourceId) || `Source ${sourceId}`,
            contacts: count,
          }))
          .sort((a, b) => b.contacts - a.contacts);

        if (noSourceCount > 0) {
          leadSources.push({ name: 'No Source', contacts: noSourceCount });
          leadSources.sort((a, b) => b.contacts - a.contacts);
        }

        sendEvent({ stage: 'aggregate', message: 'Calculating lead growth...' });

        // Lead growth over time
        const leadsByDate = new Map<string, number>();
        const leadsByDateAndSource = new Map<string, Map<string, number>>();

        allContacts.forEach((contact: any) => {
          if (contact.created_at) {
            const date = new Date(contact.created_at);
            const dateKey = date.toISOString().split('T')[0];
            leadsByDate.set(dateKey, (leadsByDate.get(dateKey) || 0) + 1);

            if (!leadsByDateAndSource.has(dateKey)) {
              leadsByDateAndSource.set(dateKey, new Map());
            }
            const sourcesForDate = leadsByDateAndSource.get(dateKey)!;
            const sources = contact.registration_sources || [];
            const sourceName = sources.length > 0
              ? (sourceMap.get(sources[0].id) || `Source ${sources[0].id}`)
              : 'No Source';
            sourcesForDate.set(sourceName, (sourcesForDate.get(sourceName) || 0) + 1);
          }
        });

        const leadGrowth = Array.from(leadsByDate.entries())
          .map(([dateKey, count]) => {
            const date = new Date(dateKey);
            return {
              date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              leads: count,
              sortDate: date.getTime()
            };
          })
          .sort((a, b) => a.sortDate - b.sortDate)
          .map(({ date, leads }) => ({ date, leads }));

        const leadGrowthBySource: Record<string, Array<{ date: string; leads: number }>> = {};
        for (const [dateKey, sourcesMap] of leadsByDateAndSource.entries()) {
          const date = new Date(dateKey);
          const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const sortDate = date.getTime();

          for (const [sourceName, count] of sourcesMap.entries()) {
            if (!leadGrowthBySource[sourceName]) leadGrowthBySource[sourceName] = [];
            leadGrowthBySource[sourceName].push({ date: formattedDate, leads: count, sortDate } as any);
          }
        }

        for (const sourceName in leadGrowthBySource) {
          leadGrowthBySource[sourceName] = leadGrowthBySource[sourceName]
            .sort((a: any, b: any) => a.sortDate - b.sortDate)
            .map(({ date, leads }: any) => ({ date, leads }));
        }

        sendEvent({ stage: 'aggregate', message: 'Calculating location data...' });

        // Location data
        const locationCounts = new Map<string, number>();
        let noLocationCount = 0;

        allContacts.forEach((contact: any) => {
          const phoneNumber = contact.mobile_phone || contact.phone || contact.work_phone;
          const areaCode = extractAreaCode(phoneNumber);
          if (areaCode && areaCodeToLocation[areaCode]) {
            const location = areaCodeToLocation[areaCode];
            locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
          } else {
            noLocationCount++;
          }
        });

        const leadsByLocation = Array.from(locationCounts.entries())
          .map(([location, count]) => ({ location, leads: count }))
          .sort((a, b) => b.leads - a.leads);

        if (noLocationCount > 0) {
          leadsByLocation.push({ location: 'Unknown', leads: noLocationCount });
          leadsByLocation.sort((a, b) => b.leads - a.leads);
        }

        // ZIP code data
        const zipCodeData = new Map<string, { count: number; city: string }>();
        let noZipCodeCount = 0;

        allContacts.forEach((contact: any) => {
          const zipCode = contact.postcode;
          const city = contact.city;
          if (zipCode && zipCode.trim() !== '') {
            const normalizedZip = String(zipCode).trim().substring(0, 5);
            const existing = zipCodeData.get(normalizedZip);
            if (existing) {
              zipCodeData.set(normalizedZip, {
                count: existing.count + 1,
                city: existing.city || city || ''
              });
            } else {
              zipCodeData.set(normalizedZip, { count: 1, city: city || '' });
            }
          } else {
            noZipCodeCount++;
          }
        });

        const leadsByZipCode = Array.from(zipCodeData.entries())
          .map(([zipCode, data]) => ({
            zipCode: data.city ? `${zipCode} ${data.city}` : zipCode,
            leads: data.count,
          }))
          .sort((a, b) => b.leads - a.leads);

        if (noZipCodeCount > 0) {
          leadsByZipCode.push({ zipCode: 'Unknown', leads: noZipCodeCount });
          leadsByZipCode.sort((a, b) => b.leads - a.leads);
        }

        sendEvent({ stage: 'aggregate', message: 'Calculating UTM tracking...' });

        // UTM tracking
        const utmSourceCounts = new Map<string, number>();
        const campaignKeys = new Map<string, { campaign: string; source: string; medium: string; count: number }>();

        allContacts.forEach((contact: any) => {
          const cfValues = contact.custom_field_values || [];
          const fieldMap = new Map<string, any>();

          cfValues.forEach((cfv: any) => {
            const fieldName = customFieldMap.get(cfv.custom_field_id);
            if (fieldName) fieldMap.set(fieldName, cfv.value);
          });

          const utmSource = fieldMap.get('utm_source') || 'Direct';
          const utmMedium = fieldMap.get('utm_medium') || 'None';
          const utmCampaign = fieldMap.get('utm_campaign') || 'No Campaign';

          utmSourceCounts.set(utmSource, (utmSourceCounts.get(utmSource) || 0) + 1);

          const campaignKey = `${utmCampaign}|${utmSource}|${utmMedium}`;
          if (campaignKeys.has(campaignKey)) {
            campaignKeys.get(campaignKey)!.count++;
          } else {
            campaignKeys.set(campaignKey, { campaign: utmCampaign, source: utmSource, medium: utmMedium, count: 1 });
          }
        });

        const trafficSources = Array.from(utmSourceCounts.entries())
          .map(([source, count]) => ({ source, leads: count }))
          .sort((a, b) => b.leads - a.leads);

        const topCampaigns = Array.from(campaignKeys.values())
          .map(({ campaign, source, medium, count }) => ({ campaign, source, medium, leads: count }))
          .sort((a, b) => b.leads - a.leads)
          .slice(0, 20);

        sendEvent({ stage: 'aggregate', message: 'Calculating trends...' });

        // Trend calculation
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const prevEndDate = new Date(startDate);
        const prevStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

        const previousContacts = allContactsForProject.filter((contact: any) => {
          if (!contact.created_at) return false;
          const createdDate = new Date(contact.created_at);
          return createdDate >= prevStartDate && createdDate < prevEndDate;
        });

        const currentTotal = allContacts.length;
        const previousTotal = previousContacts.length;
        const trend = previousTotal === 0 ? 0 : Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
        const trendDirection = currentTotal > previousTotal ? 'up' : currentTotal < previousTotal ? 'down' : 'neutral';

        // Build available sources (excluding Agent Import)
        const availableSources = Array.from(sourceMap.values())
          .filter(name => !name.toLowerCase().includes('agent import'))
          .sort((a, b) => a.localeCompare(b));

        const hasNoSourceContacts = dateFilteredContacts.some((c: any) =>
          !c.registration_sources || c.registration_sources.length === 0
        );
        if (hasNoSourceContacts && !availableSources.includes('No Source')) {
          availableSources.push('No Source');
        }

        // Final response
        const responseData = {
          keyMetrics: {
            totalLeads: currentTotal,
            trend: { value: Math.abs(trend), direction: trendDirection },
            unfilteredTotal: dateFilteredContacts.length,
          },
          leadSources,
          leadGrowth,
          leadGrowthBySource,
          leadsByLocation,
          leadsByZipCode,
          agentDistribution,
          trafficSources,
          topCampaigns,
          availableSources,
          activeFilters: {
            excludedSources: excludedSourceNames,
            excludeAgents,
            excludeNoSource,
            filteredOutCount: dateFilteredContacts.length - allContacts.length,
          },
        };

        // Cache the response
        setCache(cacheKey, responseData);

        sendEvent({ stage: 'complete', message: 'Dashboard ready!', data: responseData });
        controller.close();

      } catch (error: any) {
        sendEvent({ stage: 'error', message: error.message || 'Failed to fetch dashboard data' });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
