import { NextResponse } from 'next/server';
import { SparkAPIClient } from '@/lib/spark-client';
import {
  calculateQualityScore,
  calculateEngagementScore,
  calculateEmailCoverage,
  calculateAgentPercentage,
  estimateLeadSourceDistribution,
  calculateMedianResponseTime,
} from '@/lib/metrics';

const PROJECT_ID = 2855; // Mira Mar project ID

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

// Helper function to calculate trends
function calculateTrend(current: number, previous: number): { value: number; direction: 'up' | 'down' | 'neutral' } {
  if (previous === 0) return { value: 0, direction: 'neutral' };
  const percentChange = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(Math.round(percentChange)),
    direction: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'neutral'
  };
}

// Helper function to filter interactions by date range
function filterInteractionsByDateRange(interactions: any[], startDate: Date, endDate: Date): any[] {
  return interactions.filter((interaction: any) => {
    const date = interaction.date || interaction.created_at;
    if (!date) return false;
    const interactionDate = new Date(date);
    return interactionDate >= startDate && interactionDate <= endDate;
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    // Parse date range (default to last 30 days)
    const endDate = endParam ? new Date(endParam) : new Date();
    const startDate = startParam ? new Date(startParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Check cache first
    const cacheKey = `dashboard-${startDate.toISOString()}-${endDate.toISOString()}`;
    const cached = getCached(cacheKey);
    if (cached) {
      console.log('Returning cached dashboard data');
      return NextResponse.json(cached);
    }

    const apiKey = process.env.SPARK_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'SPARK_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Calculate previous period dates
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const prevEndDate = new Date(startDate);
    const prevStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

    const client = new SparkAPIClient(apiKey);

    // Fetch all data in parallel
    // NOTE: Contacts endpoint returns unauthorized, so we'll derive contact data from interactions
    const [
      projects,
      interactions,
      interactionTypes,
      teamMembers,
      registrationSources,
    ] = await Promise.all([
      client.listProjects(), // Get project data including contacts_count
      client.listInteractions({ project_id_eq: PROJECT_ID, per_page: 100, order: 'created_at DESC' }),
      client.listInteractionTypes(),
      client.listTeamMembers(),
      client.listRegistrationSources({ project_id_eq: PROJECT_ID, per_page: 100 }),
    ]);

    // Log summary
    console.log('=== DASHBOARD API ===');
    console.log('Interactions count:', Array.isArray(interactions) ? interactions.length : 'not array');
    console.log('InteractionTypes count:', Array.isArray(interactionTypes) ? interactionTypes.length : 'not array');
    console.log('TeamMembers count:', Array.isArray(teamMembers) ? teamMembers.length : 'not array');

    // Get project data
    const projectsList = Array.isArray(projects) ? projects : projects.data || [];
    const currentProject = projectsList.find((p: any) => p.id === PROJECT_ID);
    const totalContacts = currentProject?.contacts_count || 0;

    console.log('Total contacts from project:', totalContacts);
    console.log('====================');

    // Process interactions data
    const interactionsList = Array.isArray(interactions) ? interactions : interactions.data || [];

    // Filter interactions for current and previous periods
    const currentInteractions = filterInteractionsByDateRange(interactionsList, startDate, endDate);
    const previousInteractions = filterInteractionsByDateRange(interactionsList, prevStartDate, prevEndDate);

    const totalInteractions = currentInteractions.length;
    const totalInteractionsPrev = previousInteractions.length;

    // Count unique contacts with interactions
    const uniqueContactsWithInteractions = new Set(
      currentInteractions.map((i: any) => i.contact_id)
    ).size;
    const activeContacts = uniqueContactsWithInteractions;

    const uniqueContactsWithInteractionsPrev = new Set(
      previousInteractions.map((i: any) => i.contact_id)
    ).size;
    const activeContactsPrev = uniqueContactsWithInteractionsPrev;

    // Average interactions per contact
    const avgInteractionsPerContact = totalContacts > 0
      ? Math.round((totalInteractions / totalContacts) * 10) / 10
      : 0;
    const avgInteractionsPerContactPrev = totalContacts > 0
      ? Math.round((totalInteractionsPrev / totalContacts) * 10) / 10
      : 0;

    // Process interaction types
    const interactionTypesList = Array.isArray(interactionTypes)
      ? interactionTypes
      : interactionTypes.data || [];

    const typeMap = new Map<number, string>();
    interactionTypesList.forEach((type: any) => {
      if (type.id && (type.value || type.name)) {
        typeMap.set(type.id, type.value || type.name);
      }
    });

    // Count interactions by type (current period only)
    const typeCounts = new Map<number, number>();
    currentInteractions.forEach((interaction: any) => {
      const typeId = interaction.interaction_type_id || interaction.interaction_type?.id;
      if (typeId) {
        typeCounts.set(typeId, (typeCounts.get(typeId) || 0) + 1);
      }
    });

    const interactionTypeBreakdown = Array.from(typeCounts.entries())
      .map(([id, count]) => ({
        id,
        name: typeMap.get(id) || `Type ${id}`,
        value: count,
      }))
      .sort((a, b) => b.value - a.value);

    // Process team members
    const teamMembersList = Array.isArray(teamMembers)
      ? teamMembers
      : teamMembers.data || [];

    const memberMap = new Map<number, string>();
    teamMembersList.forEach((member: any) => {
      if (member.id) {
        const name = `${member.first_name || ''} ${member.last_name || ''}`.trim();
        memberMap.set(member.id, name || `Team Member ${member.id}`);
      }
    });

    // Count interactions by team member (current period only)
    const memberCounts = new Map<number, number>();
    currentInteractions.forEach((interaction: any) => {
      const memberId = interaction.team_member_id;
      if (memberId) {
        memberCounts.set(memberId, (memberCounts.get(memberId) || 0) + 1);
      }
    });

    const teamPerformance = Array.from(memberCounts.entries())
      .map(([id, count]) => ({
        id,
        name: memberMap.get(id) || `Team Member ${id}`,
        interactions: count,
        percentage: totalInteractions > 0 ? Math.round((count / totalInteractions) * 100) : 0,
      }))
      .sort((a, b) => b.interactions - a.interactions);

    // Process lead sources (registration sources)
    console.log(`Lead Sources: Fetching ALL contacts per source (matching Spark UI) - Fixed v1.6.1 approach`);

    // Calculate email coverage from actual interaction data
    const calculatedEmailCoverage = calculateEmailCoverage(currentInteractions, typeMap);

    // Build registration source ID to name mapping
    const registrationSourcesList = Array.isArray(registrationSources)
      ? registrationSources
      : registrationSources.data || [];

    const sourceMap = new Map<number, string>();
    registrationSourcesList.forEach((source: any) => {
      if (source.id && source.name) {
        sourceMap.set(source.id, source.name);
      }
    });

    // NEW APPROACH (v1.6.1): Fetch ALL contacts by registration_source_id
    // Then filter by project using projects array (not project_id_eq)
    // This matches the working spark-mcp implementation

    const sourceContactCounts = new Map<number, Set<number>>();
    const allContactsWithSources: any[] = [];

    for (const source of registrationSourcesList) {
      const sourceId = source.id;
      const sourceName = source.name;

      console.log(`Fetching ALL contacts for source: ${sourceName} (ID: ${sourceId})`);

      // Step 1: Fetch ALL contacts with this registration_source_id (paginated)
      let allContactsForSource: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 10) { // Safety limit: max 10 pages per source
        try {
          const response = await client.listContacts({
            registration_source_id_eq: sourceId,
            per_page: 100,
            page: page
          });

          const contacts = Array.isArray(response) ? response : response.data || [];

          if (contacts.length === 0) break;

          allContactsForSource.push(...contacts);

          // Check if there are more pages (simple check - if we got 100, there might be more)
          hasMore = contacts.length === 100;
          page++;
        } catch (error) {
          console.error(`Failed to fetch contacts for source ${sourceName}, page ${page}:`, error);
          break;
        }
      }

      console.log(`Found ${allContactsForSource.length} total contacts for ${sourceName}`);

      // Step 2: Filter by project using projects array
      // Must fetch individual contacts to access projects array
      let projectContacts: any[] = [];

      // Batch fetch individual contacts (20 at a time for performance)
      const batchSize = 20;
      for (let i = 0; i < allContactsForSource.length; i += batchSize) {
        const batch = allContactsForSource.slice(i, i + batchSize);
        const batchPromises = batch.map((c: any) =>
          client.getContact(c.id).catch((err: any) => {
            console.error(`Failed to fetch contact ${c.id}:`, err);
            return null;
          })
        );

        const detailedContacts = await Promise.all(batchPromises);

        // Filter to contacts in project 2855
        detailedContacts.forEach((contact: any) => {
          if (!contact) return;

          const projects = contact.projects || [];
          const inProject = projects.some((p: any) => p.project_id === PROJECT_ID);

          if (inProject) {
            projectContacts.push(contact);
          }
        });
      }

      console.log(`Filtered to ${projectContacts.length} contacts in project ${PROJECT_ID} for ${sourceName}`);

      // Optional: Filter by date range if needed
      if (startDate && endDate) {
        projectContacts = projectContacts.filter((contact: any) => {
          if (!contact.created_at) return false;
          const contactDate = new Date(contact.created_at);
          return contactDate >= startDate && contactDate <= endDate;
        });
        console.log(`After date filter: ${projectContacts.length} contacts for ${sourceName}`);
      }

      // Store contacts for this source
      if (projectContacts.length > 0) {
        if (!sourceContactCounts.has(sourceId)) {
          sourceContactCounts.set(sourceId, new Set());
        }
        projectContacts.forEach((contact: any) => {
          sourceContactCounts.get(sourceId)!.add(contact.id);
          allContactsWithSources.push(contact);
        });
      }
    }

    console.log(`Total contacts across all sources: ${allContactsWithSources.length}`);

    // Build lead sources array with REAL data (total counts + engagement)
    const leadSources = Array.from(sourceContactCounts.entries())
      .map(([sourceId, contactIds]) => {
        const sourceName = sourceMap.get(sourceId) || `Source ${sourceId}`;
        const totalContacts = contactIds.size;

        // Get contacts with interactions (engaged contacts)
        const contactsForSource = allContactsWithSources.filter((c: any) => contactIds.has(c.id));
        const engagedCount = contactsForSource.filter((c: any) => c.last_interaction_date).length;
        const engagementRate = totalContacts > 0 ? Math.round((engagedCount / totalContacts) * 100) : 0;

        // Get interactions for contacts from this source
        const sourceInteractions = currentInteractions.filter((i: any) =>
          contactIds.has(i.contact_id)
        );

        return {
          name: sourceName,
          contacts: totalContacts, // TOTAL leads (not just engaged)
          engaged: engagedCount,   // Subset that have been contacted
          engagementRate,          // Percentage engaged
          quality: calculateQualityScore(sourceInteractions),
          engagement: calculateEngagementScore(sourceInteractions),
          email: calculatedEmailCoverage,
        };
      })
      .filter((source) => source.contacts > 0)
      .sort((a, b) => b.contacts - a.contacts); // Sort by contact count descending

    console.log('Lead sources with engagement data:', leadSources);

    // Get activity timeline for current period
    const activityByDate = new Map<string, { fullDate: Date; interactions: number; emails: number; calls: number }>();
    currentInteractions.forEach((interaction: any) => {
      const date = interaction.date || interaction.created_at;
      if (date) {
        const fullDate = new Date(date);
        const dateKey = fullDate.toISOString().split('T')[0]; // Use YYYY-MM-DD as key for grouping
        const dateStr = fullDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const current = activityByDate.get(dateKey) || { fullDate, interactions: 0, emails: 0, calls: 0 };
        current.interactions++;

        const typeName = typeMap.get(interaction.interaction_type_id || interaction.interaction_type?.id);
        if (typeName?.toLowerCase().includes('email')) {
          current.emails++;
        } else if (typeName?.toLowerCase().includes('call') || typeName?.toLowerCase().includes('phone')) {
          current.calls++;
        }

        activityByDate.set(dateKey, current);
      }
    });

    const activityTimeline = Array.from(activityByDate.entries())
      .map(([dateKey, stats]) => ({
        date: stats.fullDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        interactions: stats.interactions,
        emails: stats.emails,
        calls: stats.calls,
        sortDate: stats.fullDate.getTime() // Add sort key
      }))
      .sort((a, b) => a.sortDate - b.sortDate) // Sort chronologically
      .slice(-8) // Take last 8 days
      .map(({ date, interactions, emails, calls }) => ({ date, interactions, emails, calls })); // Remove sort key

    // Get top contacts by interaction count (current period only)
    const contactInteractionCounts = new Map<number, number>();
    currentInteractions.forEach((interaction: any) => {
      const contactId = interaction.contact_id;
      if (contactId) {
        contactInteractionCounts.set(contactId, (contactInteractionCounts.get(contactId) || 0) + 1);
      }
    });

    // Get top 8 contact IDs first
    const topContactEntries = Array.from(contactInteractionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const topContactIds = topContactEntries.map(([id]) => id);

    // Fetch contact details in ONE batch API call
    let contactDetailsMap = new Map<number, string>();
    if (topContactIds.length > 0) {
      try {
        // Use id_in filter to fetch multiple contacts at once
        const contactsResponse = await client.listContacts({
          id_in: topContactIds.join(','),
          per_page: 8
        });

        const contactsList = Array.isArray(contactsResponse)
          ? contactsResponse
          : contactsResponse.data || [];

        // Check if the API returned all requested contacts (Spark API id_in filter is unreliable)
        const returnedSet = new Set(contactsList.map((c: any) => c.id));
        const missingIds = topContactIds.filter(id => !returnedSet.has(id));

        // Fetch any missing contacts individually as fallback
        if (missingIds.length > 0) {
          const individualFetches = missingIds.map(async (contactId: number) => {
            try {
              const contact = await client.getContact(contactId);
              if (contact && contact.id) {
                contactsList.push(contact);
              }
            } catch (error) {
              console.error(`Failed to fetch contact ${contactId}:`, error);
            }
          });
          await Promise.all(individualFetches);
        }

        contactsList.forEach((contact: any) => {
          if (contact.id) {
            // Try various possible field names in order
            const name = contact.name
              || contact.full_name
              || contact.display_name
              || (contact.first_name && contact.last_name
                  ? `${contact.first_name} ${contact.last_name}`.trim()
                  : null)
              || (contact.first_name || contact.last_name
                  ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                  : null)
              || contact.contact?.name
              || `Contact ${contact.id}`;

            contactDetailsMap.set(contact.id, name);
          }
        });
      } catch (error) {
        console.error('Failed to fetch contact details:', error);
        // Graceful fallback - contactDetailsMap stays empty
      }
    }

    const topContacts = topContactEntries.map(([contactId, count]) => {
      const name = contactDetailsMap.get(contactId) || `Contact ${contactId}`;
      return {
        id: contactId,
        name,
        interactions: count,
      };
    });

    // Calculate trends
    const trends = {
      activeContacts: calculateTrend(activeContacts, activeContactsPrev),
      totalInteractions: calculateTrend(totalInteractions, totalInteractionsPrev),
      avgInteractionsPerContact: calculateTrend(avgInteractionsPerContact, avgInteractionsPerContactPrev),
    };

    // Calculate agent percentage from actual data
    const calculatedAgentPercentage = calculateAgentPercentage(interactionsList, totalContacts);

    // ========================================
    // PIPELINE DATA - FETCH REAL RATINGS DATA
    // ========================================
    console.log('Fetching real rating and source data for Pipeline tab...');

    // We already have allContactsWithSources from the lead sources calculation above
    // These already have full contact details including ratings (fetched individually)
    // NOTE: Ratings are ONLY available from individual contact endpoint

    // Use the contacts we already fetched (they have ratings)
    const contactsWithRatings = allContactsWithSources;

    console.log(`Using ${contactsWithRatings.length} contacts with rating data (already fetched)`);

    // Count contacts by rating
    const ratingCounts = new Map<string, number>();
    const ratingColors = new Map<string, string>([
      ['Agent', '#D3C9EC'],
      ['Warm', '#FFBBAA'],
      ['Hot', '#C33A32'],
      ['New', '#C0D7B1'],
      ['Not Interested', '#DBDBDB'],
      ['Team', '#e4a02c'],
      ['Cold', '#C0E1F4'],
      ['Reservation', '#2380c4'],
    ]);

    contactsWithRatings.forEach((contact: any) => {
      if (contact.ratings && contact.ratings.length > 0) {
        const ratingName = contact.ratings[0].value || contact.ratings[0].name; // Use 'value' field
        if (ratingName) {
          ratingCounts.set(ratingName, (ratingCounts.get(ratingName) || 0) + 1);
        }
      }
    });

    // Build rating distribution with real data
    const totalContactsWithRatings = contactsWithRatings.length;
    const ratingDistribution = Array.from(ratingCounts.entries())
      .map(([name, count]) => ({
        name,
        value: count,
        color: ratingColors.get(name) || '#94a3b8',
        percentage: parseFloat(((count / totalContactsWithRatings) * 100).toFixed(1))
      }))
      .sort((a, b) => b.value - a.value);

    console.log('Rating distribution:', ratingDistribution);

    // Build sales funnel data (excluding agents/team/not interested)
    const funnelData = [
      { name: 'New Leads', value: ratingCounts.get('New') || 0, color: '#C0D7B1' },
      { name: 'Hot Leads', value: ratingCounts.get('Hot') || 0, color: '#C33A32' },
      { name: 'Warm Prospects', value: ratingCounts.get('Warm') || 0, color: '#FFBBAA' },
      { name: 'Cold/Follow-up', value: ratingCounts.get('Cold') || 0, color: '#C0E1F4' },
      { name: 'Reservations', value: ratingCounts.get('Reservation') || 0, color: '#2380c4' }
    ];

    // Calculate real pipeline metrics
    const reservations = ratingCounts.get('Reservation') || 0;
    const activePipeline = (ratingCounts.get('New') || 0) +
                           (ratingCounts.get('Hot') || 0) +
                           (ratingCounts.get('Warm') || 0) +
                           (ratingCounts.get('Cold') || 0) +
                           reservations;

    const engagedContacts = totalContactsWithRatings - (ratingCounts.get('Not Interested') || 0);
    const engagementRate = totalContactsWithRatings > 0
      ? parseFloat(((engagedContacts / totalContactsWithRatings) * 100).toFixed(1))
      : 0;

    // Build pipelineLeadSources with REAL data (source + ratings breakdown)
    const sourceRatingBreakdown = new Map<number, { hot: number; warm: number; cold: number; new: number; reservations: number }>();

    contactsWithRatings.forEach((contact: any) => {
      const sourceId = contact.registration_source_id;
      if (!sourceId) return;

      if (!sourceRatingBreakdown.has(sourceId)) {
        sourceRatingBreakdown.set(sourceId, { hot: 0, warm: 0, cold: 0, new: 0, reservations: 0 });
      }

      const breakdown = sourceRatingBreakdown.get(sourceId)!;
      if (contact.ratings && contact.ratings.length > 0) {
        const ratingName = contact.ratings[0].value || contact.ratings[0].name; // Use 'value' field
        if (ratingName === 'Hot') breakdown.hot++;
        else if (ratingName === 'Warm') breakdown.warm++;
        else if (ratingName === 'Cold') breakdown.cold++;
        else if (ratingName === 'New') breakdown.new++;
        else if (ratingName === 'Reservation') breakdown.reservations++;
      }
    });

    // Calculate quality score for each source
    const sourceQualityMap = new Map<number, number>();
    sourceContactCounts.forEach((contactIds, sourceId) => {
      const sourceInteractions = currentInteractions.filter((i: any) =>
        contactIds.has(i.contact_id)
      );
      sourceQualityMap.set(sourceId, calculateQualityScore(sourceInteractions));
    });

    // Source colors
    const sourceColorMap = new Map<string, string>([
      ['Website', '#3b82f6'],
      ['Realtor Referral', '#8b5cf6'],
      ['Friend/Family', '#10b981'],
      ['Facebook', '#f59e0b'],
      ['Walk-in', '#ec4899'],
      ['Phone Call', '#ef4444'],
      ['Unknown', '#94a3b8'],
    ]);

    // Build pipeline lead sources array
    const pipelineLeadSources = Array.from(sourceContactCounts.entries())
      .map(([sourceId, contactIds]) => {
        const sourceName = sourceMap.get(sourceId) || `Source ${sourceId}`;
        const breakdown = sourceRatingBreakdown.get(sourceId) || { hot: 0, warm: 0, cold: 0, new: 0, reservations: 0 };
        const quality = sourceQualityMap.get(sourceId) || 0;

        return {
          name: sourceName,
          contacts: contactIds.size,
          hot: breakdown.hot,
          warm: breakdown.warm,
          reservations: breakdown.reservations,
          quality,
          color: sourceColorMap.get(sourceName) || '#94a3b8'
        };
      })
      .sort((a, b) => b.contacts - a.contacts);

    console.log('Pipeline lead sources:', pipelineLeadSources);

    // Source performance comparison
    const sourcePerformance = pipelineLeadSources.map(source => ({
      source: source.name,
      contacts: source.contacts,
      conversionRate: source.contacts > 0 ? parseFloat(((source.reservations / source.contacts) * 100).toFixed(1)) : 0,
      quality: source.quality,
      hotWarmCount: source.hot + source.warm
    }));

    // Website data
    const websiteLeadsSource = pipelineLeadSources.find(s => s.name === 'Website');
    const websiteLeadsData = websiteLeadsSource ? {
      contacts: websiteLeadsSource.contacts,
      quality: websiteLeadsSource.quality,
      conversionRate: websiteLeadsSource.contacts > 0
        ? parseFloat(((websiteLeadsSource.reservations / websiteLeadsSource.contacts) * 100).toFixed(1))
        : 0
    } : {
      contacts: 0,
      quality: 0,
      conversionRate: 0
    };

    const pipelineData = {
      totalContacts,
      engagedContacts,
      activePipeline,
      reservations,
      engagementRate,
      leadSources: pipelineLeadSources,
      funnelData,
      ratingDistribution,
      sourcePerformance,
      websiteLeads: websiteLeadsData
    };

    const responseData = {
      keyMetrics: {
        totalContacts,
        activeContacts,
        totalInteractions,
        avgInteractionsPerContact,
        agentPercentage: calculatedAgentPercentage,
        emailCoverage: calculatedEmailCoverage,
        responsiveness: calculateMedianResponseTime(currentInteractions),
      },
      trends,
      interactionTypeBreakdown,
      teamPerformance,
      leadSources,
      activityTimeline,
      topContacts,
      pipelineData,
    };

    // Cache the response
    setCache(cacheKey, responseData);

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch dashboard data',
        details: error
      },
      { status: error.status || 500 }
    );
  }
}
