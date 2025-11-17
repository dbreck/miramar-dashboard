import { NextResponse } from 'next/server';
import { SparkAPIClient } from '@/lib/spark-client';

const PROJECT_ID = 2855; // Mira Mar project ID

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clear cache on server restart (helps with development)
console.log('[Dashboard API] Cache cleared on startup');

// Area code to city/region mapping (US/Canada major area codes)
const areaCodeToLocation: Record<string, string> = {
  // California
  '209': 'Stockton, CA', '213': 'Los Angeles, CA', '310': 'West LA, CA', '323': 'Los Angeles, CA',
  '408': 'San Jose, CA', '415': 'San Francisco, CA', '510': 'Oakland, CA', '562': 'Long Beach, CA',
  '619': 'San Diego, CA', '626': 'Pasadena, CA', '650': 'San Mateo, CA', '657': 'Anaheim, CA',
  '661': 'Bakersfield, CA', '669': 'San Jose, CA', '707': 'Santa Rosa, CA', '714': 'Orange County, CA',
  '747': 'Los Angeles, CA', '760': 'Carlsbad, CA', '805': 'Santa Barbara, CA', '818': 'San Fernando Valley, CA',
  '831': 'Salinas, CA', '858': 'San Diego, CA', '909': 'San Bernardino, CA', '916': 'Sacramento, CA',
  '925': 'Concord, CA', '949': 'Irvine, CA', '951': 'Riverside, CA',

  // Florida
  '239': 'Fort Myers, FL', '305': 'Miami, FL', '321': 'Orlando, FL', '352': 'Gainesville, FL',
  '386': 'Daytona Beach, FL', '407': 'Orlando, FL', '561': 'West Palm Beach, FL', '727': 'St. Petersburg, FL',
  '754': 'Fort Lauderdale, FL', '772': 'Port St. Lucie, FL', '786': 'Miami, FL', '813': 'Tampa, FL',
  '850': 'Tallahassee, FL', '863': 'Lakeland, FL', '904': 'Jacksonville, FL', '941': 'Sarasota, FL',
  '954': 'Fort Lauderdale, FL',

  // Texas
  '210': 'San Antonio, TX', '214': 'Dallas, TX', '254': 'Waco, TX', '281': 'Houston, TX',
  '325': 'Abilene, TX', '361': 'Corpus Christi, TX', '409': 'Beaumont, TX', '430': 'Tyler, TX',
  '432': 'Midland, TX', '469': 'Dallas, TX', '512': 'Austin, TX', '682': 'Fort Worth, TX',
  '713': 'Houston, TX', '737': 'Austin, TX', '806': 'Lubbock, TX', '817': 'Fort Worth, TX',
  '830': 'New Braunfels, TX', '832': 'Houston, TX', '903': 'Tyler, TX', '915': 'El Paso, TX',
  '936': 'Conroe, TX', '940': 'Wichita Falls, TX', '956': 'Laredo, TX', '972': 'Dallas, TX',
  '979': 'Bryan, TX',

  // New York
  '212': 'Manhattan, NY', '315': 'Syracuse, NY', '347': 'Brooklyn, NY', '516': 'Long Island, NY',
  '518': 'Albany, NY', '585': 'Rochester, NY', '607': 'Binghamton, NY', '631': 'Long Island, NY',
  '646': 'Manhattan, NY', '716': 'Buffalo, NY', '718': 'Brooklyn, NY', '845': 'Poughkeepsie, NY',
  '914': 'Westchester, NY', '917': 'Manhattan, NY', '929': 'Queens, NY',

  // Pennsylvania
  '215': 'Philadelphia, PA', '267': 'Philadelphia, PA', '272': 'Scranton, PA', '412': 'Pittsburgh, PA',
  '484': 'Allentown, PA', '570': 'Scranton, PA', '610': 'Allentown, PA', '717': 'Harrisburg, PA',
  '724': 'Pittsburgh, PA', '814': 'Erie, PA', '878': 'Pittsburgh, PA',

  // Illinois
  '217': 'Springfield, IL', '224': 'Chicago, IL', '309': 'Peoria, IL', '312': 'Chicago, IL',
  '331': 'Chicago, IL', '618': 'Belleville, IL', '630': 'Chicago, IL', '708': 'Chicago, IL',
  '773': 'Chicago, IL', '815': 'Rockford, IL', '847': 'Chicago, IL', '872': 'Chicago, IL',

  // Ohio
  '216': 'Cleveland, OH', '220': 'Newark, OH', '234': 'Akron, OH', '330': 'Akron, OH',
  '380': 'Columbus, OH', '419': 'Toledo, OH', '440': 'Cleveland, OH', '513': 'Cincinnati, OH',
  '567': 'Toledo, OH', '614': 'Columbus, OH', '740': 'Newark, OH', '937': 'Dayton, OH',

  // Georgia
  '229': 'Albany, GA', '404': 'Atlanta, GA', '470': 'Atlanta, GA', '478': 'Macon, GA',
  '678': 'Atlanta, GA', '706': 'Augusta, GA', '762': 'Augusta, GA', '770': 'Atlanta, GA',
  '912': 'Savannah, GA',

  // North Carolina
  '252': 'Greenville, NC', '336': 'Greensboro, NC', '704': 'Charlotte, NC', '743': 'Greensboro, NC',
  '828': 'Asheville, NC', '910': 'Fayetteville, NC', '919': 'Raleigh, NC', '980': 'Charlotte, NC',

  // Michigan
  '231': 'Muskegon, MI', '248': 'Detroit, MI', '269': 'Kalamazoo, MI', '313': 'Detroit, MI',
  '517': 'Lansing, MI', '586': 'Detroit, MI', '616': 'Grand Rapids, MI', '734': 'Ann Arbor, MI',
  '810': 'Flint, MI', '906': 'Marquette, MI', '947': 'Troy, MI', '989': 'Saginaw, MI',

  // New Jersey
  '201': 'Jersey City, NJ', '551': 'Jersey City, NJ', '609': 'Atlantic City, NJ', '732': 'New Brunswick, NJ',
  '848': 'Toms River, NJ', '856': 'Camden, NJ', '862': 'Newark, NJ', '908': 'Elizabeth, NJ',
  '973': 'Newark, NJ',

  // Virginia
  '276': 'Bristol, VA', '434': 'Lynchburg, VA', '540': 'Roanoke, VA', '571': 'Arlington, VA',
  '703': 'Arlington, VA', '757': 'Virginia Beach, VA', '804': 'Richmond, VA',

  // Washington
  '206': 'Seattle, WA', '253': 'Tacoma, WA', '360': 'Olympia, WA', '425': 'Bellevue, WA',
  '509': 'Spokane, WA', '564': 'Seattle, WA',

  // Massachusetts
  '339': 'Boston, MA', '351': 'Lowell, MA', '413': 'Springfield, MA', '508': 'Worcester, MA',
  '617': 'Boston, MA', '774': 'Worcester, MA', '781': 'Boston, MA', '857': 'Boston, MA',
  '978': 'Lowell, MA',

  // Arizona
  '480': 'Scottsdale, AZ', '520': 'Tucson, AZ', '602': 'Phoenix, AZ', '623': 'Phoenix, AZ',
  '928': 'Flagstaff, AZ',

  // Tennessee
  '423': 'Chattanooga, TN', '615': 'Nashville, TN', '629': 'Nashville, TN', '731': 'Jackson, TN',
  '865': 'Knoxville, TN', '901': 'Memphis, TN', '931': 'Clarksville, TN',

  // Indiana
  '219': 'Gary, IN', '260': 'Fort Wayne, IN', '317': 'Indianapolis, IN', '463': 'Indianapolis, IN',
  '574': 'South Bend, IN', '765': 'Muncie, IN', '812': 'Evansville, IN', '930': 'Bloomington, IN',

  // Missouri
  '314': 'St. Louis, MO', '417': 'Springfield, MO', '573': 'Columbia, MO', '636': 'St. Louis, MO',
  '660': 'Sedalia, MO', '816': 'Kansas City, MO',

  // Maryland
  '240': 'Frederick, MD', '301': 'Bethesda, MD', '410': 'Baltimore, MD', '443': 'Baltimore, MD',
  '667': 'Baltimore, MD',

  // Wisconsin
  '262': 'Kenosha, WI', '414': 'Milwaukee, WI', '534': 'Eau Claire, WI', '608': 'Madison, WI',
  '715': 'Eau Claire, WI', '920': 'Green Bay, WI',

  // Colorado
  '303': 'Denver, CO', '719': 'Colorado Springs, CO', '720': 'Denver, CO', '970': 'Fort Collins, CO',

  // Minnesota
  '218': 'Duluth, MN', '320': 'St. Cloud, MN', '507': 'Rochester, MN', '612': 'Minneapolis, MN',
  '651': 'St. Paul, MN', '763': 'Minneapolis, MN', '952': 'Minneapolis, MN',

  // South Carolina
  '803': 'Columbia, SC', '843': 'Charleston, SC', '854': 'Charleston, SC', '864': 'Greenville, SC',

  // Alabama
  '205': 'Birmingham, AL', '251': 'Mobile, AL', '256': 'Huntsville, AL', '334': 'Montgomery, AL',
  '659': 'Birmingham, AL', '938': 'Huntsville, AL',

  // Louisiana
  '225': 'Baton Rouge, LA', '318': 'Shreveport, LA', '337': 'Lafayette, LA', '504': 'New Orleans, LA',
  '985': 'New Orleans, LA',

  // Kentucky
  '270': 'Bowling Green, KY', '364': 'Bowling Green, KY', '502': 'Louisville, KY', '606': 'Ashland, KY',
  '859': 'Lexington, KY',

  // Oregon
  '458': 'Eugene, OR', '503': 'Portland, OR', '541': 'Eugene, OR', '971': 'Portland, OR',

  // Oklahoma
  '405': 'Oklahoma City, OK', '539': 'Tulsa, OK', '580': 'Lawton, OK', '918': 'Tulsa, OK',

  // Connecticut
  '203': 'New Haven, CT', '475': 'Bridgeport, CT', '860': 'Hartford, CT', '959': 'Hartford, CT',

  // Iowa
  '319': 'Cedar Rapids, IA', '515': 'Des Moines, IA', '563': 'Davenport, IA', '641': 'Mason City, IA', '712': 'Sioux City, IA',

  // Mississippi
  '228': 'Gulfport, MS', '601': 'Jackson, MS', '662': 'Tupelo, MS', '769': 'Jackson, MS',

  // Arkansas
  '479': 'Fort Smith, AR', '501': 'Little Rock, AR', '870': 'Jonesboro, AR',

  // Kansas
  '316': 'Wichita, KS', '620': 'Dodge City, KS', '785': 'Topeka, KS', '913': 'Kansas City, KS',

  // Utah
  '385': 'Salt Lake City, UT', '435': 'St. George, UT', '801': 'Salt Lake City, UT',

  // Nevada
  '702': 'Las Vegas, NV', '725': 'Las Vegas, NV', '775': 'Reno, NV',

  // New Mexico
  '505': 'Albuquerque, NM', '575': 'Las Cruces, NM',

  // Nebraska
  '308': 'Grand Island, NE', '402': 'Omaha, NE', '531': 'Omaha, NE',

  // West Virginia
  '304': 'Charleston, WV', '681': 'Huntington, WV',

  // Idaho
  '208': 'Boise, ID', '986': 'Boise, ID',

  // Hawaii
  '808': 'Honolulu, HI',

  // Maine
  '207': 'Portland, ME',

  // New Hampshire
  '603': 'Manchester, NH',

  // Rhode Island
  '401': 'Providence, RI',

  // Montana
  '406': 'Billings, MT',

  // Delaware
  '302': 'Wilmington, DE',

  // South Dakota
  '605': 'Sioux Falls, SD',

  // North Dakota
  '701': 'Fargo, ND',

  // Alaska
  '907': 'Anchorage, AK',

  // Vermont
  '802': 'Burlington, VT',

  // Wyoming
  '307': 'Cheyenne, WY',

  // District of Columbia
  '202': 'Washington, DC',
};

function extractAreaCode(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) return null;

  // Remove all non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Extract area code (first 3 digits after country code if present)
  if (cleaned.length === 10) {
    // Format: 2345678901 (US/Canada without country code)
    return cleaned.substring(0, 3);
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    // Format: 12345678901 (US/Canada with country code)
    return cleaned.substring(1, 4);
  }

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
  try {
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    // Parse date range (default to last 30 days)
    // IMPORTANT: Spark's "last 30 days" means 31 calendar days (today + 30 days back)
    // Use UTC to avoid timezone issues - Spark API returns timestamps in UTC
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

    console.log(`\n=== LEAD GENERATION DASHBOARD ===`);
    console.log(`Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Check cache first
    const cacheKey = `dashboard-${startDate.toISOString()}-${endDate.toISOString()}`;
    const cached = getCached(cacheKey);
    if (cached) {
      console.log('✓ Returning cached dashboard data');
      return NextResponse.json(cached);
    }

    const apiKey = process.env.SPARK_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'SPARK_API_KEY not configured' },
        { status: 500 }
      );
    }

    const client = new SparkAPIClient(apiKey);

    // Fetch registration sources (lead sources) for names
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

    console.log(`Found ${sourceMap.size} registration sources`);

    // Fetch custom field definitions to map IDs to names
    const customFields = await client.listCustomFields({
      project_id_eq: PROJECT_ID,
      per_page: 100
    });

    const customFieldsList = Array.isArray(customFields)
      ? customFields
      : customFields.data || [];

    // Build map: custom_field_id → field_name
    const customFieldMap = new Map<number, string>();
    customFieldsList.forEach((field: any) => {
      if (field.id && field.name) {
        customFieldMap.set(field.id, field.name);
      }
    });

    console.log(`Found ${customFieldMap.size} custom fields`);

    // ========================================
    // FETCH ALL CONTACTS BY REGISTRATION SOURCE
    // (API doesn't support project_id_eq on /contacts - must fetch by source then filter)
    // ========================================
    console.log('\nFetching contacts by registration source...');

    const allContactsForProject: any[] = [];

    for (const source of registrationSourcesList) {
      const sourceId = source.id;
      const sourceName = source.name;

      console.log(`  Fetching contacts for source: ${sourceName}...`);

      // Fetch ALL contacts with this registration_source_id (with pagination)
      const contactsForSource = await client.listAllContacts({
        registration_source_id_eq: sourceId,
      });

      if (contactsForSource.length === 0) continue;

      console.log(`    Found ${contactsForSource.length} contacts, filtering by project...`);

      // Batch fetch individual contacts to check project membership
      const BATCH_SIZE = 20;
      for (let i = 0; i < contactsForSource.length; i += BATCH_SIZE) {
        const batch = contactsForSource.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map((c: any) =>
          client.getContact(c.id).catch((err: any) => {
            console.error(`      Failed to fetch contact ${c.id}:`, err);
            return null;
          })
        );

        const detailedContacts = await Promise.all(batchPromises);

        // DEBUG: Log first detailed contact to see what fields it has
        if (allContactsForProject.length === 0 && detailedContacts.length > 0 && detailedContacts[0]) {
          console.log('\n🔍 DEBUG: First individual contact fetch result:');
          console.log('Contact ID:', detailedContacts[0].id);
          console.log('Has custom_field_values?:', 'custom_field_values' in detailedContacts[0]);
          if (detailedContacts[0].custom_field_values && detailedContacts[0].custom_field_values.length > 0) {
            console.log('Custom field values count:', detailedContacts[0].custom_field_values.length);
            console.log('Custom field values:', JSON.stringify(detailedContacts[0].custom_field_values, null, 2));

            // Map to readable names
            const mappedFields: any = {};
            detailedContacts[0].custom_field_values.forEach((cfv: any) => {
              const fieldName = customFieldMap.get(cfv.custom_field_id);
              if (fieldName) {
                mappedFields[fieldName] = cfv.value;
              }
            });
            console.log('Mapped custom fields:', JSON.stringify(mappedFields, null, 2));
          }
          console.log('All keys on contact object:', Object.keys(detailedContacts[0]));
          console.log('');
        }

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

      console.log(`    ✓ ${allContactsForProject.length} contacts in project so far`);
    }

    // ========================================
    // FETCH CONTACTS WITH NO REGISTRATION SOURCE
    // ========================================
    console.log('\nFetching contacts with no registration source...');

    const contactsWithNoSource = await client.listAllContacts({
      registration_source_id_null: true,
    });

    console.log(`  Found ${contactsWithNoSource.length} contacts with no source, filtering by project...`);

    // Batch fetch individual contacts to check project membership
    const BATCH_SIZE = 20;
    for (let i = 0; i < contactsWithNoSource.length; i += BATCH_SIZE) {
      const batch = contactsWithNoSource.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map((c: any) =>
        client.getContact(c.id).catch((err: any) => {
          console.error(`      Failed to fetch contact ${c.id}:`, err);
          return null;
        })
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

    console.log(`✓ Total contacts in project (including no source): ${allContactsForProject.length}`);

    // Filter by created_at date client-side
    const allContacts = allContactsForProject.filter((contact: any) => {
      if (!contact.created_at) return false;
      const createdDate = new Date(contact.created_at);
      return createdDate >= startDate && createdDate <= endDate;
    });

    console.log(`✓ Filtered to ${allContacts.length} contacts created in date range`);

    // Debug: Count Website contacts with Website ANYWHERE in sources array
    const websiteContactsAny = allContacts.filter((c: any) => {
      const sources = c.registration_sources || [];
      return sources.some((s: any) => s && s.id === 17599);
    });
    console.log(`DEBUG: Found ${websiteContactsAny.length} contacts with source_id=17599 anywhere in sources array`);

    // Debug: Check for contacts with multiple sources
    const multiSourceContacts = allContacts.filter((c: any) => {
      const sources = c.registration_sources || [];
      return sources.length > 1 && sources.some((s: any) => s && s.id === 17599);
    });
    console.log(`DEBUG: Found ${multiSourceContacts.length} contacts with Website AND other sources`);
    if (multiSourceContacts.length > 0) {
      console.log('DEBUG: Sample multi-source contacts:', multiSourceContacts.slice(0, 3).map((c: any) => ({
        id: c.id,
        sources: c.registration_sources.map((s: any) => s.name)
      })));
    }

    // ========================================
    // CALCULATE LEAD SOURCES
    // ========================================
    const sourceContactCounts = new Map<number, number>();
    let noSourceCount = 0;

    allContacts.forEach((contact: any) => {
      // The field is 'registration_sources' (plural, array)
      const sources = contact.registration_sources || [];
      if (sources.length > 0) {
        // Count UNIQUE sources per contact (deduplicate sources within the same contact)
        const uniqueSourceIds = new Set<number>();
        sources.forEach((source: any) => {
          if (source && source.id) {
            uniqueSourceIds.add(source.id);
          }
        });

        // Increment count for each unique source this contact has
        uniqueSourceIds.forEach((sourceId: number) => {
          sourceContactCounts.set(sourceId, (sourceContactCounts.get(sourceId) || 0) + 1);
        });
      } else {
        // Count contacts with no registration source
        noSourceCount++;
      }
    });

    const leadSources = Array.from(sourceContactCounts.entries())
      .map(([sourceId, count]) => ({
        name: sourceMap.get(sourceId) || `Source ${sourceId}`,
        contacts: count,
      }))
      .sort((a, b) => b.contacts - a.contacts);

    // Add "No Source" if there are any contacts without a source
    if (noSourceCount > 0) {
      leadSources.push({
        name: 'No Source',
        contacts: noSourceCount,
      });
      // Re-sort after adding
      leadSources.sort((a, b) => b.contacts - a.contacts);
    }

    console.log('Lead sources:', leadSources);
    console.log('Contacts with no source:', noSourceCount);

    // ========================================
    // CALCULATE LEAD GROWTH OVER TIME (BY SOURCE)
    // ========================================
    const leadsByDate = new Map<string, number>();
    const leadsByDateAndSource = new Map<string, Map<string, number>>(); // dateKey -> sourceName -> count

    allContacts.forEach((contact: any) => {
      if (contact.created_at) {
        const date = new Date(contact.created_at);
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

        // Total leads by date
        leadsByDate.set(dateKey, (leadsByDate.get(dateKey) || 0) + 1);

        // Leads by date and source
        if (!leadsByDateAndSource.has(dateKey)) {
          leadsByDateAndSource.set(dateKey, new Map());
        }
        const sourcesForDate = leadsByDateAndSource.get(dateKey)!;

        const sources = contact.registration_sources || [];
        const sourceName = sources.length > 0 ? (sourceMap.get(sources[0].id) || `Source ${sources[0].id}`) : 'No Source';
        sourcesForDate.set(sourceName, (sourcesForDate.get(sourceName) || 0) + 1);
      }
    });

    // Build chronological array for all leads
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

    // Build chronological array by source
    const leadGrowthBySource: Record<string, Array<{ date: string; leads: number }>> = {};

    for (const [dateKey, sourcesMap] of leadsByDateAndSource.entries()) {
      const date = new Date(dateKey);
      const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const sortDate = date.getTime();

      for (const [sourceName, count] of sourcesMap.entries()) {
        if (!leadGrowthBySource[sourceName]) {
          leadGrowthBySource[sourceName] = [];
        }
        leadGrowthBySource[sourceName].push({
          date: formattedDate,
          leads: count,
          sortDate
        } as any);
      }
    }

    // Sort each source's data chronologically
    for (const sourceName in leadGrowthBySource) {
      leadGrowthBySource[sourceName] = leadGrowthBySource[sourceName]
        .sort((a: any, b: any) => a.sortDate - b.sortDate)
        .map(({ date, leads }: any) => ({ date, leads }));
    }

    console.log(`Lead growth: ${leadGrowth.length} data points`);

    // ========================================
    // CALCULATE LOCATION DISTRIBUTION FROM PHONE AREA CODES
    // ========================================
    const locationCounts = new Map<string, number>();
    let noLocationCount = 0;

    allContacts.forEach((contact: any) => {
      // Try mobile_phone first, then phone, then work_phone
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
      .map(([location, count]) => ({
        location,
        leads: count,
      }))
      .sort((a, b) => b.leads - a.leads);

    // Add "Unknown" if there are contacts without detectable location
    if (noLocationCount > 0) {
      leadsByLocation.push({
        location: 'Unknown',
        leads: noLocationCount,
      });
      // Re-sort after adding
      leadsByLocation.sort((a, b) => b.leads - a.leads);
    }

    console.log(`Leads by location: ${leadsByLocation.length} locations found`);
    console.log('Top 5 locations:', leadsByLocation.slice(0, 5));

    // ========================================
    // CALCULATE UTM TRACKING DATA
    // ========================================
    const utmSourceCounts = new Map<string, number>();
    const campaignData: Array<{
      campaign: string;
      source: string;
      medium: string;
      leads: number;
    }> = [];

    // Track unique campaign combinations
    const campaignKeys = new Map<string, {
      campaign: string;
      source: string;
      medium: string;
      count: number;
    }>();

    // Debug: Check contact structure and custom field values
    if (allContacts.length > 0) {
      console.log('\n=== UTM DEBUG ===');
      console.log('Total contacts to analyze:', allContacts.length);
      console.log('First contact ID:', allContacts[0].id);
      console.log('First contact has custom_field_values?', 'custom_field_values' in allContacts[0]);

      if (allContacts[0].custom_field_values && allContacts[0].custom_field_values.length > 0) {
        console.log('Custom field values count:', allContacts[0].custom_field_values.length);
        console.log('Full custom field values:', JSON.stringify(allContacts[0].custom_field_values, null, 2));

        // Map to readable names
        const mappedFields: any = {};
        allContacts[0].custom_field_values.forEach((cfv: any) => {
          const fieldName = customFieldMap.get(cfv.custom_field_id);
          if (fieldName) {
            mappedFields[fieldName] = cfv.value;
          }
        });
        console.log('Mapped custom fields:', JSON.stringify(mappedFields, null, 2));
      } else {
        console.log('⚠️  No custom_field_values on first contact');
        console.log('Available keys:', Object.keys(allContacts[0]));
      }

      // Check multiple contacts for ANY custom field data
      let contactsWithCustomFields = 0;
      let contactsWithUTM = 0;
      const sampleSize = Math.min(50, allContacts.length);

      for (let i = 0; i < sampleSize; i++) {
        const cfValues = allContacts[i].custom_field_values || [];
        if (cfValues.length > 0) {
          contactsWithCustomFields++;

          // Build field map for this contact
          const fieldMap = new Map<string, any>();
          cfValues.forEach((cfv: any) => {
            const fieldName = customFieldMap.get(cfv.custom_field_id);
            if (fieldName) {
              fieldMap.set(fieldName, cfv.value);
            }
          });

          // Log first contact with custom fields
          if (contactsWithCustomFields === 1) {
            console.log(`\nFirst contact with custom field values (ID: ${allContacts[i].id}):`);
            console.log('Field names:', Array.from(fieldMap.keys()));
            console.log('Field data:', Object.fromEntries(fieldMap));
          }

          // Check for UTM fields
          const hasUTM = fieldMap.has('utm_source') || fieldMap.has('utm_medium') || fieldMap.has('utm_campaign');

          if (hasUTM) {
            contactsWithUTM++;
            if (contactsWithUTM === 1) {
              console.log(`\n✓ Found UTM data on contact ${i} (ID: ${allContacts[i].id}):`);
              console.log('utm_source:', fieldMap.get('utm_source'));
              console.log('utm_medium:', fieldMap.get('utm_medium'));
              console.log('utm_campaign:', fieldMap.get('utm_campaign'));
            }
          }
        }
      }

      console.log(`\nSummary: ${contactsWithCustomFields}/${sampleSize} contacts have custom_field_values`);
      console.log(`Summary: ${contactsWithUTM}/${sampleSize} contacts have UTM data`);
      console.log('=================\n');
    }

    allContacts.forEach((contact: any) => {
      // Parse custom_field_values array to extract UTM parameters
      const cfValues = contact.custom_field_values || [];
      const fieldMap = new Map<string, any>();

      cfValues.forEach((cfv: any) => {
        const fieldName = customFieldMap.get(cfv.custom_field_id);
        if (fieldName) {
          fieldMap.set(fieldName, cfv.value);
        }
      });

      // Extract UTM parameters from parsed field map
      const utmSource = fieldMap.get('utm_source') || 'Direct';
      const utmMedium = fieldMap.get('utm_medium') || 'None';
      const utmCampaign = fieldMap.get('utm_campaign') || 'No Campaign';

      // Count by source
      utmSourceCounts.set(utmSource, (utmSourceCounts.get(utmSource) || 0) + 1);

      // Track campaign combinations
      const campaignKey = `${utmCampaign}|${utmSource}|${utmMedium}`;
      if (campaignKeys.has(campaignKey)) {
        campaignKeys.get(campaignKey)!.count++;
      } else {
        campaignKeys.set(campaignKey, {
          campaign: utmCampaign,
          source: utmSource,
          medium: utmMedium,
          count: 1
        });
      }
    });

    // Format traffic sources
    const trafficSources = Array.from(utmSourceCounts.entries())
      .map(([source, count]) => ({
        source,
        leads: count
      }))
      .sort((a, b) => b.leads - a.leads);

    // Format top campaigns
    const topCampaigns = Array.from(campaignKeys.values())
      .map(({ campaign, source, medium, count }) => ({
        campaign,
        source,
        medium,
        leads: count
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 20); // Top 20 campaigns

    console.log(`Traffic sources: ${trafficSources.length} unique sources`);
    console.log(`Top campaigns: ${topCampaigns.length} campaigns`);

    // ========================================
    // CALCULATE PREVIOUS PERIOD FOR TRENDS
    // ========================================
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const prevEndDate = new Date(startDate);
    const prevStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

    console.log(`Filtering previous period: ${prevStartDate.toISOString()} to ${prevEndDate.toISOString()}`);

    // Filter all project contacts for previous period (client-side)
    const previousContacts = allContactsForProject.filter((contact: any) => {
      if (!contact.created_at) return false;
      const createdDate = new Date(contact.created_at);
      return createdDate >= prevStartDate && createdDate < prevEndDate;
    });

    console.log(`✓ Filtered to ${previousContacts.length} contacts from previous period`);

    // Calculate trend
    const currentTotal = allContacts.length;
    const previousTotal = previousContacts.length;
    const trend = previousTotal === 0 ? 0 : Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
    const trendDirection = currentTotal > previousTotal ? 'up' : currentTotal < previousTotal ? 'down' : 'neutral';

    console.log(`Trend: ${trendDirection} ${Math.abs(trend)}%`);
    console.log('=================================\n');

    // ========================================
    // BUILD RESPONSE
    // ========================================
    const responseData = {
      keyMetrics: {
        totalLeads: currentTotal,
        trend: {
          value: Math.abs(trend),
          direction: trendDirection
        }
      },
      leadSources,
      leadGrowth,
      leadGrowthBySource,
      leadsByLocation,
      trafficSources,
      topCampaigns,
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
