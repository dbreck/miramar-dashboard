# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Mira Mar Dashboard is a Next.js 15.5.5 real estate CRM analytics dashboard powered by the Spark.re API. It displays sales metrics, lead sources, team performance, and pipeline data for a single real estate project.

**Current Version**: 1.4.0

## Common Commands

```bash
# Development
npm run dev              # Start development server on http://localhost:3000

# Production
npm run build            # Build for production (Vercel deployment)
npm start                # Start production server

# Environment
# Required: SPARK_API_KEY in .env.local
# Required: DASHBOARD_PASSWORD in .env.local
# Required: SESSION_SECRET in .env.local (32+ random chars)
```

## Architecture Overview

### Tech Stack
- **Next.js 15.5.5** - App Router (not Pages Router)
- **React 19** - Client and Server Components
- **TypeScript 5.9.3** - Strict mode
- **Recharts 3.2.1** - Chart visualizations
- **Tailwind CSS 4.1.14** - Styling
- **Lucide React** - Icons

### Dashboard Structure

**6 Main Tabs** (all use same `/api/dashboard` endpoint):
1. **Overview** - Key metrics, recent activity, team performance, lead sources
2. **Pipeline** - Deal stages, stage velocity, stage conversion rates
3. **Contacts** - Contact growth, activity timeline
4. **Engagement** - Interaction type details, team performance
5. **Marketing** - UTM tracking (source, medium, campaign), traffic sources, top campaigns
6. **Team** - Individual team member performance

**Data Flow**:
```
Client Component → /api/dashboard?start=...&end=... → SparkAPIClient → Spark.re API
                ↓
         5-minute in-memory cache (dashboardCache)
                ↓
         Aggregated JSON response
```

## CRITICAL: Spark.re API Patterns

### 🚨 Automatic Pagination Required for Dashboards

**THE #1 BUG TO AVOID**: The Spark.re API returns a maximum of 100 records per page (default: 25). Without pagination, dashboards will severely underreport numbers.

**Example Bug**: Dashboard showed 29 phone calls instead of actual 135 because only the first 100 interactions were fetched (out of 653 total).

**ALWAYS use automatic pagination for dashboards:**

```typescript
// ✅ CORRECT: Fetch ALL interactions (lib/spark-client.ts:282-320)
const interactions = await client.listAllInteractions({
  project_id_eq: PROJECT_ID,
  order: 'created_at DESC'
});

// ❌ WRONG: Only fetches first 100 interactions
const interactions = await client.listInteractions({
  project_id_eq: PROJECT_ID,
  per_page: 100  // This is NOT enough!
});
```

**The `listAllInteractions()` Method**:
```typescript
/**
 * List ALL interactions with automatic pagination
 * Located in: lib/spark-client.ts:282-320
 */
async listAllInteractions(params: Record<string, any> = {}): Promise<any[]> {
  const allInteractions: any[] = [];
  let page = 1;
  let hasMore = true;
  const maxPages = 50; // Safety limit: 5,000 interactions

  while (hasMore && page <= maxPages) {
    const pageParams = { ...params, page, per_page: 100 };
    const response = await this.get<any>(`/interactions${queryString}`);
    const interactions = Array.isArray(response) ? response : response.data || [];

    if (interactions.length === 0) break;

    allInteractions.push(...interactions);
    hasMore = interactions.length === 100;  // More pages if we got exactly 100
    page++;
  }

  return allInteractions;
}
```

**Performance Impact**:
- First load: +2 seconds (fetches all 653 interactions vs 100)
- Subsequent requests: instant (5-minute cache)
- Acceptable trade-off for accurate data

### Lead Source Fetching Pattern (v1.1.0 Fix)

**CRITICAL**: To get ALL leads per source (matching Spark UI), you must:

1. Fetch contacts by `registration_source_id` (NOT from interactions)
2. Individually fetch each contact to check `projects` array membership
3. Use batching (20 concurrent requests) for performance

**Why**: The `/contacts` endpoint doesn't support `project_id_eq` filtering directly. You must fetch by source, then filter client-side.

**Reference Implementation**: `app/api/dashboard/route.ts:207-353`

```typescript
// Step 1: Get contact IDs by source
const contactIds = await client.listContacts({
  registration_source_id_eq: sourceId,
  per_page: 100
});

// Step 2: Batch-fetch individual contacts to check project membership
const BATCH_SIZE = 20;
for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
  const batch = contactIds.slice(i, i + BATCH_SIZE);
  const contacts = await Promise.all(
    batch.map(id => client.getContact(id))
  );

  // Step 3: Filter by project
  const projectContacts = contacts.filter(c =>
    c.projects?.some(p => p.id === PROJECT_ID)
  );

  allContacts.push(...projectContacts);
}
```

**Documented in**: `SPARK_API_FIX.md` and `~/.claude/skills/spark-api/skill.md`

### Custom Fields Pattern (v1.3.0 Fix)

**CRITICAL**: Spark API returns custom fields as an **array of objects**, NOT a simple key-value object.

**Structure**:
```typescript
// ❌ WRONG ASSUMPTION
contact.custom_fields = {
  utm_source: "google",
  utm_medium: "cpc"
}

// ✅ ACTUAL API RESPONSE
contact.custom_field_values = [
  { custom_field_id: 123, value: "google" },
  { custom_field_id: 456, value: "cpc" }
]
```

**Implementation Pattern**:

```typescript
// Step 1: Fetch custom field definitions to map IDs to names
const customFields = await client.listCustomFields({
  project_id_eq: PROJECT_ID,
  per_page: 100
});

// Build map: custom_field_id → field_name
const customFieldMap = new Map<number, string>();
customFields.forEach((field: any) => {
  if (field.id && field.name) {
    customFieldMap.set(field.id, field.name);
  }
});

// Step 2: Extract values from each contact
allContacts.forEach((contact: any) => {
  const cfValues = contact.custom_field_values || [];

  // Build field map for this contact
  const fieldMap = new Map<string, any>();
  cfValues.forEach((cfv: any) => {
    const fieldName = customFieldMap.get(cfv.custom_field_id);
    if (fieldName) {
      fieldMap.set(fieldName, cfv.value);
    }
  });

  // Now extract by field name
  const utmSource = fieldMap.get('utm_source') || 'Direct';
  const utmMedium = fieldMap.get('utm_medium') || 'None';
  const utmCampaign = fieldMap.get('utm_campaign') || 'No Campaign';
});
```

**Reference Implementation**: `app/api/dashboard/route.ts:311-329, 705-720`

**Why This Matters**: Without this pattern, custom fields appear empty even when populated in Spark. The Marketing tab's UTM tracking depends on correctly parsing `custom_field_values`.

### Known API Limitations

1. **No Link Header Pagination**: Spark API doesn't return pagination metadata in headers. Must manually loop pages until response length < 100.

2. **Permission Issues**: Some endpoints (interactions metadata, team members metadata) return 403 errors. Use workarounds:
   - Interaction types: Fetch all interactions, extract unique `interaction_type_id`, then lookup types
   - Team names: Fetch interactions, extract unique `team_member_id`, use as display name

3. **Contact Filtering**: `/contacts` endpoint doesn't support `project_id_eq`. Must fetch individually and filter client-side.

4. **Date Filtering**: Only filter interactions by date, NOT contacts. A contact created 6 months ago may have interactions today.

## Data Aggregation Architecture

**Server-Side Aggregation** (`app/api/dashboard/route.ts`):
```typescript
// Single parallel fetch of all base data
const [projects, interactions, interactionTypes, teamMembers, registrationSources] =
  await Promise.all([
    client.listProjects(),
    client.listAllInteractions({ project_id_eq: PROJECT_ID }), // ✅ Automatic pagination
    client.listInteractionTypes(),
    client.listTeamMembers(),
    client.listRegistrationSources({ project_id_eq: PROJECT_ID }),
  ]);

// Then aggregate into dashboard sections
const response = {
  summary: { totalContacts, totalInteractions, totalLeads, totalDeals },
  recentActivity: [...],
  teamPerformance: [...],
  leadSources: [...],
  pipelineStats: [...],
  // ... etc
};
```

**Client-Side Rendering** (`components/tabs/*.tsx`):
```typescript
// Each tab fetches once, reuses cached data
useEffect(() => {
  const params = new URLSearchParams({
    start: dateRange.start.toISOString(),
    end: dateRange.end.toISOString(),
  });
  fetch(`/api/dashboard?${params}`)
    .then(res => res.json())
    .then(data => setData(data));
}, [dateRange]);
```

**Caching Strategy** (`app/api/dashboard/route.ts:65-86`):
```typescript
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const dashboardCache = new Map<string, { data: any; timestamp: number }>();

// Cache key includes date range for proper invalidation
const cacheKey = `${start.getTime()}-${end.getTime()}`;
```

## Key Files and Their Roles

### `lib/spark-client.ts`
Custom HTTP client for Spark.re API. Handles:
- Bearer token authentication (`SPARK_API_KEY`)
- Query string building with filters (`project_id_eq`, `page`, `per_page`)
- Generic GET/POST/PUT/DELETE methods
- **CRITICAL**: `listAllInteractions()` method with automatic pagination (lines 282-320)

### `app/api/dashboard/route.ts`
Main server-side API route. Handles:
- Data fetching from Spark API (uses `listAllInteractions()` on line 98)
- 5-minute caching with date range keys
- Date filtering on interactions (NOT contacts - see lines 300-304 comments)
- Aggregation into dashboard sections
- Error handling and cache management

### `middleware.ts`
Route protection. Redirects unauthenticated users to `/login`.

### `components/tabs/*.tsx`
Client components for each dashboard tab. All fetch from `/api/dashboard` endpoint with date range params.

### `lib/types.ts`
TypeScript interfaces for dashboard data structures.

## Known Limitations & Gotchas

### 1. Single Project Dashboard
Hardcoded to PROJECT_ID = 1661 (Mira Mar). Not multi-project.

### 2. Team Performance Limited to 60 Days
Uses hardcoded 60-day lookback (not respecting date range filter) - see `TeamTab.tsx:58`.

### 3. In-Memory Cache
Cache is per-process. Vercel serverless functions may have different cache instances.

### 4. No Offline Mode
Requires active Spark API connection. No local database.

### 5. Date Filtering Applies to Interactions Only
From `CHANGELOG.md` v1.2.0:
> Removed incorrect contact date filtering that excluded old contacts with recent interactions

**Rule**: Filter interactions by date, then include ALL related contacts/deals regardless of creation date.

## Recent Critical Fixes

### v1.3.0 (2025-11-17): Custom Fields & UTM Tracking
- **Impact**: Marketing tab showed no UTM data despite contacts having UTM parameters in Spark
- **Fix**: Implemented proper `custom_field_values` array parsing with field ID mapping
- **Result**: UTM tracking charts now display traffic sources and campaign data correctly
- **Discovery**: Spark API returns `custom_field_values` array, not `custom_fields` object

### v1.2.0 (2025-10-23): Pagination Fix
- **Impact**: ALL dashboard charts were severely underreporting numbers
- **Fix**: Implemented `listAllInteractions()` with automatic pagination
- **Result**: Now fetches all 653 interactions instead of just 100
- **Performance**: +2 seconds first load, cached thereafter

### v1.1.0 (2025-10-23): Lead Source Accuracy
- **Impact**: Missing 47% of leads (43 shown vs 81 actual)
- **Fix**: Fetch by `registration_source_id`, then filter by project individually
- **Result**: Dashboard now matches Spark UI exactly

## Development Workflow

### Making Changes
1. Edit files in your IDE
2. `npm run dev` - Changes hot-reload automatically
3. Test locally at `http://localhost:3000`
4. `npm run build` - Verify TypeScript compilation before commit
5. Git commit and push - Vercel auto-deploys from main branch

### Adding New Charts
1. Update `/api/dashboard` route to include new aggregated data
2. Add TypeScript interface to `lib/types.ts`
3. Create/update tab component in `components/tabs/`
4. Use Recharts for visualizations (see existing charts for patterns)

### Common Pitfall: TypeScript Strict Mode
All API responses should be typed. Avoid `any` where possible. The build will fail on type errors.

## Authentication

Session-based auth with HTTP-only cookies (not JWT/OAuth):
- Login: `app/login/page.tsx` - Compares against `DASHBOARD_PASSWORD`
- Session: `app/api/auth/login/route.ts` - Sets HTTP-only cookie
- Protection: `middleware.ts` - Checks cookie on protected routes

## Deployment

Hosted on Vercel. Push to `main` branch triggers auto-deployment.

**Environment Variables** (set in Vercel dashboard):
- `SPARK_API_KEY` - Spark.re API token
- `DASHBOARD_PASSWORD` - Login password
- `SESSION_SECRET` - 32+ random characters for cookie signing

## References

- **Spark API Documentation**: Reference the `spark-api` Claude Code skill
- **Bug Fix Documentation**: See `SPARK_API_FIX.md` and `SPARK_API_REQUEST.md`
- **Changelog**: `CHANGELOG.md` has detailed version history with code locations
- **Package Versions**: `package.json` - Keep Next.js and React in sync

---

**Last Updated**: 2025-11-18 (v1.4.0)
