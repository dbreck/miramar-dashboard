# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Mira Mar Dashboard is a Next.js 15.5.7 real estate CRM analytics dashboard powered by the Spark.re API. It displays sales metrics, lead sources, team performance, and pipeline data for a single real estate project.

**Current Version**: 1.6.0

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
- **Next.js 15.5.7** - App Router (not Pages Router)
- **React 19.2.1** - Client and Server Components
- **TypeScript 5.9.3** - Strict mode
- **Recharts 3.2.1** - Chart visualizations
- **Tailwind CSS 4.1.14** - Styling
- **Lucide React** - Icons

### Dashboard Structure

**7 Main Tabs** (all use same `/api/dashboard` endpoint):
1. **Overview** - Key metrics, recent activity, team performance, lead sources
2. **Marketing** - UTM tracking (source, medium, campaign), traffic sources, top campaigns
3. **Ratings** - Contact rating distribution, sales pipeline funnel, ratings by lead source
4. **Pipeline** - Deal stages, stage velocity, stage conversion rates (hidden)
5. **Contacts** - Contact growth, activity timeline (hidden)
6. **Engagement** - Interaction type details, team performance (hidden)
7. **Team** - Individual team member performance (hidden)

**Data Flow**:
```
Client Component → /api/dashboard?start=...&end=...&excludeSources=...&excludeAgents=... → SparkAPIClient → Spark.re API
                ↓
         5-minute in-memory cache (keyed by date range + filters)
                ↓
         Filtered & Aggregated JSON response
```

### Filtering System (v1.5.0)

The dashboard includes a comprehensive filtering system to exclude unwanted data (e.g., 6,000+ agent imports).

**Filter Types:**
- **Registration Source Exclusion** - Multi-select to exclude sources like "Agent Import", "No Value"
- **Agent Filtering** - Toggle to exclude contacts marked as agents
- **No Source Filtering** - Toggle to exclude contacts without registration source
- **Filter Presets** - Save/load filter configurations

**Architecture:**
```
FilterProvider (app/page.tsx)
    ↓
FilterContext (lib/filter-context.tsx) - Global state with localStorage persistence
    ↓
DashboardLayout - Filter button + FilterPanel component
    ↓
Tabs (OverviewTab, MarketingTab, RatingsTab) - Send filter params to API, update availableSources
    ↓
API Route - Server-side filtering before aggregation
```

**API Filter Parameters:**
- `excludeSources` - Comma-separated source names to exclude
- `excludeAgents` - "true" to exclude contacts where `agent === true`
- `excludeNoSource` - "true" to exclude contacts with no registration source

**Important:** Use `JSON.stringify(excludedSources)` in useEffect dependencies to prevent infinite loops (array references change on context updates).

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

5. **No Rating Change History**: The Spark UI shows "Rating changed from Hot to Warm" in the contact activity log, but **this data is NOT accessible via the API**. Tested endpoints: `/activities`, `/audit-logs`, `/contact-histories`, `/rating-changes`, `/contact-events`, `/contact-logs`, plus all contact sub-resources — all return 404. The `/contacts/{id}` response only includes the **current** rating. Workaround: snapshot-based tracking (see Rating Snapshot System below).

6. **Actual Project ID**: The Spark project for Mira Mar is **2855** (not 1661 as referenced elsewhere in the dashboard code). The dashboard route uses 1661 which may be a project-contact join ID. The `/contact-ratings` and contact detail endpoints use `project_id: 2855`.

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

## Rating Snapshot System (v1.6.0-dev)

Tracks contact rating changes over time by periodically snapshotting all contacts and diffing.

**Endpoints:**
- `POST /api/rating-snapshot` — Takes a new snapshot, compares against previous, logs changes
- `GET /api/rating-snapshot` — Returns latest snapshot info (rating distribution)
- `GET /api/rating-changes` — Returns accumulated change history with filters: `start`, `end`, `rating`, `from_rating`, `source`, `limit`, `offset`

**Key Files:**
- `lib/rating-types.ts` — Type definitions, rating ID-to-name map for project 2855
- `lib/snapshot-storage.ts` — Filesystem storage in `/data/snapshots/` and `/data/rating-changes.json`
- `app/api/rating-snapshot/route.ts` — Snapshot capture endpoint
- `app/api/rating-changes/route.ts` — Change history query endpoint

**Rating Definitions (project 2855):**
| ID | Value |
|----|-------|
| 58248 | Hot |
| 58249 | Warm |
| 58755 | Reservation Holder |
| 58250 | Cold |
| 58251 | Not Interested |
| 58245 | New |
| 58246 | Agent |
| 58247 | Legal |
| 58627 | Team |
| 58866 | Influencer |
| 58756 | Contract Holder |
| 59334 | CB Global Luxury Agent |
| 59364 | Not A Buyer |
| 59733 | Referral |

**Important:** The `ratings` array on a contact uses `id` as the rating definition ID (not `rating_id`). The `value` field contains the human-readable name.

**Status:** Backend complete, NOT yet deployed. No first snapshot taken. No cron job configured. No UI tab built yet.

## Ratings Tab (v1.6.0)

The Ratings tab shows contact rating distribution and sales pipeline metrics. It extracts rating data from contacts already being fetched (no additional API calls).

**3 new fields in the dashboard API response:**
- `ratingDistribution` - `{ rating, count, color, percentage }[]` sorted by count desc
- `salesPipeline` - `{ stage, count, color }[]` in funnel order: New → Warm → Hot → Reservation Holder → Contract Holder
- `ratingsBySource` - `Record<sourceName, { rating, count, color }[]>` mapping each source to its rating breakdown

**How ratings are extracted:**
- Each contact from `getContact()` has a `ratings` array
- Items have `id` (rating definition ID) and `value` (human-readable name)
- The code checks against all 14 known rating IDs for project 2855
- Contacts with no matching rating are categorized as "Unrated"

**Key file:** `components/tabs/RatingsTab.tsx`

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

## Authentication & User Management (v1.7.0)

**Multi-user auth** with HMAC-signed session cookies:
- Login: `app/login/page.tsx` - Email + password, or password-only (backward compat)
- Session: `lib/auth.ts` - HMAC-SHA256 signed cookies encoding userId, email, name, role, permissions
- Middleware: `middleware.ts` - Decodes session with `atob` (Edge Runtime, no HMAC verify). API routes verify full signature in Node.js runtime.
- User storage: `lib/users.ts` - **Vercel Blob** (`@vercel/blob`) for persistent storage across cold starts

**User Model:**
```typescript
interface User {
  id: string; email: string; name: string;
  role: 'admin' | 'viewer';
  permissions: { reconcile: boolean };
  passwordHash: string; salt: string; createdAt: string;
}
```

**Key Files:**
- `lib/users.ts` — Async CRUD with Vercel Blob storage, default admin seeding
- `lib/auth.ts` — Session encode/decode with HMAC signing (SessionData includes permissions)
- `middleware.ts` — Edge Runtime compatible (uses `atob`, NOT `crypto.createHmac`)
- `app/admin/users/page.tsx` — Admin-only user management UI
- `app/api/admin/users/route.ts` — User CRUD API (admin-only)
- `app/api/auth/me/route.ts` — Returns current user info + permissions
- `app/api/auth/login/route.ts` — Email+password or password-only login

**Roles & Permissions:**
- **Admin** — Full access including `/admin/users`, always has reconcile + LLR access
- **Viewer** — Dashboard only, no admin routes, reconcile access via checkbox, LLR access via checkbox

**Supabase `profiles` table permissions columns:**
- `can_reconcile` — boolean, controls access to `/reconciliation`
- `can_view_llr` — boolean (added 2026-04-13), controls access to Lost Leads Report (`/api/lost-leads-alltime`). Admins always have access. LLR link in reports dropdown hidden if no permission.

**Critical Vercel Gotchas:**
1. Middleware runs in **Edge Runtime** — `crypto.createHmac` is NOT available. Use `atob`/`btoa` only.
2. Vercel filesystem is **read-only** except `/tmp/` (ephemeral). User data uses Vercel Blob.
3. Default admin re-seeds from `DASHBOARD_PASSWORD` env var on every cold start.
4. Password-only login (no email) bypasses Blob storage entirely — checks `DASHBOARD_PASSWORD` directly.

## Dashboard Data Loading (v1.7.0)

**No auto-fetch on page load.** Dashboard shows cached data from localStorage and waits for user to click "Refresh Data" button.

**Data Flow:**
```
Page Load → localStorage cache check → Show cached data (or empty state)
                                          ↓ (user clicks Refresh Data)
                                    SSE to /api/dashboard/stream
                                          ↓
                                    Spark API (10-60s)
                                          ↓
                                    Update UI + save to localStorage
```

**Key Files:**
- `lib/dashboard-cache.ts` — localStorage wrapper with 7-day TTL, version-prefixed keys
- `lib/use-dashboard-stream.ts` — Hook with `refreshTrigger` prop; only fetches when trigger > 0
- `app/page.tsx` — Manages `refreshTrigger` state, passes to layout + tabs

**How it works:**
- `useDashboardStream` starts with `loading: false` (no auto-fetch)
- Hydrates from localStorage on mount using `optionsKey` (date range + filters)
- SSE fetch only fires when `refreshTrigger` increments (button click)
- After successful fetch, data saved to localStorage for next visit
- Each tab reports `isCached`/`lastFetchedAt`/`loading` to parent for the freshness banner

## Deployment

Hosted on Vercel. Push to `main` branch triggers auto-deployment.

**Environment Variables** (set in Vercel dashboard):
- `SPARK_API_KEY` - Spark.re API token
- `DASHBOARD_PASSWORD` - Login password (also used for default admin)
- `SESSION_SECRET` - 32+ random characters for cookie signing
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token (auto-set when Blob store connected)
- `UTM_COOKIE_LOG_SECRET` - Bearer token for WP utm-cookie-log endpoint (`miramar-utm-log-2026-x9k4m`)
- `SPARK_RELAY_LOG_SECRET` - Bearer token for WP spark-relay-log endpoint (`miramar-relay-log-2026-r7m3k`)
- `ADMIN_EMAIL` - (optional) Override default admin email (default: `admin@miramar.com`)
- `ADMIN_NAME` - (optional) Override default admin display name (default: `Admin`)

## CallRail Integration (2026-03-23)

### The Problem: Missing Leads

Cross-referencing CallRail (all-time, 71 Mira Mar form submissions) against Spark found **32% of leads never reach Spark**:
- Facebook/Instagram Ads: **82% drop rate** (9 of 11 missing)
- Google Ads: 44% drop rate (4 of 9)
- Direct: 8% drop rate (3 of 36)

**Root cause (revised 2026-04-10):** The custom form JS (`spark-contact-form.js`) had bugs that caused silent failures in certain browsers. Originally blamed on cross-origin POST issues with Meta in-app browsers, but after switching back to Spark's vanilla form embed, submissions are NOT being dropped — even from Meta in-app browsers. The custom JS was the problem, not the browser environment.

**Current status (2026-04-10):** Custom form and relay RETIRED. Now using Spark's native/vanilla form embed. No drops observed since the switch.

### CallRail Setup

- **Account:** `ACC2fd0a83431e1451cba08cdc21d851925` (Clear ph Design)
- **API (v3):** Key stored in `~/mcp-servers/callrail-mcp/start.sh`
- **MCP Server:** `~/mcp-servers/callrail-mcp/` (cloned from Blue-Interactive-Dev/CallRail-MCP)
  - HTTP transport on port 3001, connected via `mcp-remote` in `~/.claude.json`
  - Start: `~/mcp-servers/callrail-mcp/start.sh`
  - 68 tools: calls, form submissions, trackers, companies, SMS, tags, etc.
- **WordPress plugin** installed on Mira Mar site (DNI/number swapping only — form tracking configured separately in CallRail dashboard)
- **CallRail gets Meta/Google ad data** via direct platform integrations, NOT via the website — this is why it captures leads the website form misses

### Key Files (Mira Mar WordPress site)

- `salient-child/partials/spark-contact-form.php` — Form that POSTs to Spark.re with UTM hidden fields (IDs 22408/22409/22410)
- `salient-child/js/utm-tracker.js` — Captures UTMs from URL/referrer, stores in cookie, first-touch attribution
- `salient-child/js/spark-contact-form.js` — Populates UTM hidden fields from cookie on form load, handles validation + Clarity tracking

### Data Notes

- CallRail API form submissions endpoint returns only 96 records all-time (vs 171 in CSV export — CSV likely includes call tracking data)
- CallRail tracks 3 sites: miramarsarasota.com (71), residences400central.com (24), reflectionstpete.com (1)
- All-time analysis CSV saved to `data/callrail-all-time-forms.csv`

### Form Relay Fix (2026-03-24) — RETIRED 2026-04-10

The server-side relay has been **retired** in favor of Spark's vanilla form embed. Forms are no longer dropping. The relay code remains on the server but is no longer active. Historical reference below:
- **File:** `~/Sites/miramarsarasota/.../salient-child/includes/spark-form-relay.php`
- All 3 forms now POST same-origin to `admin-post.php`, which relays server-side to Spark via `wp_remote_post()`
- UTM cookie fallback: server reads `miramar_utm_data` cookie when JS fails to populate UTM fields
- **Status:** DEPLOYED and tested in production. Contact form + popup form + workshop form all confirmed working.

**Bugs found and fixed during deployment:**
1. **reCAPTCHA required** — Spark rejects submissions without valid reCAPTCHA tokens. Relay forwards browser-generated tokens.
2. **Double-submit** — Form fires twice (inline reCAPTCHA script + external JS). Fixed with transient-based dedup guard (10-second window).
3. **Popup reCAPTCHA** — Duplicate form IDs (`#spark-contact-form`) caused popup's reCAPTCHA token to be set on the wrong form. Fixed inline script to use `document.currentScript.previousElementSibling` instead of `getElementById`.
4. **Array encoding** — PHP's `http_build_query()` converts `[value][]` to `[value][0]`, which Spark receives as an object instead of array → 500 error on workshop form. Fixed with regex replacement in encoded body.
5. **User-Agent** — Spark returns "Form not found" for WordPress UA. Fixed by sending Chrome browser UA in relay.
6. **Log file locking** — `LOCK_EX` on debug log caused cascading delays from concurrent requests. Removed.
7. **Success detection** — Relay initially treated all 302s as success. Fixed to check Location header against success/error redirect URLs.

**Debug log:** `/www/wp-content/themes/salient-child/spark-relay-debug.log` on Flywheel production. TODO: Remove debug logging once stable.

**Files deployed to production (via SSH pipe, not git):**
- `includes/spark-form-relay.php` — the relay handler
- `functions.php` — added require_once
- `partials/spark-contact-form.php` — changed action + hidden fields + fixed inline script
- `partials/community-workshop-form.php` — changed action + hidden fields
- `partials/spark-form.php` — changed action + hidden fields
- `js/spark-contact-form.js` — multi-form support (querySelectorAll + MutationObserver)

**reCAPTCHA keys (from Spark settings):**
- Site key: `6LfqnOErAAAAALcWX6q1VKVJ4zvvS5XxsCNPzuWu`
- Secret key: `6LfqnOErAAAALL5m2aKobtGkichuOKqkfLDoSYq`

### Reconciliation Report (2026-03-24)

Script at `scripts/reconciliation-report.ts` cross-references CallRail form submissions against Spark contacts.
- Run: `npm run reconcile`
- Output: `data/reconciliation-report.html` and `data/reconciliation-report.md`
- Served at `/api/reconciliation` on the dashboard (behind auth)
- **Results:** 57 unique contacts, 40 in Spark (70%), 17 missing (30%), 6 with UTM gaps

### Live Reconciliation Dashboard (2026-03-24)

Real-time CallRail vs Spark cross-reference at `/reconciliation`. Accessible via "Reconcile" button in dashboard header.

**Features:**
- Date range presets (7d/14d/30d/60d/90d/All) + custom range
- Summary cards: total, in Spark, missing, UTM gaps
- Drop rate by source visualization
- Contact list with filter tabs (All/Missing/Matched/Meta Gaps/Dismissed)
- Expandable rows showing side-by-side CallRail data vs Spark status
- **Smart matching (3-tier):** email → phone number → first+last name
- **Email typo detection:** `.com.com`, `.ne`→`.net`, `.co`→`.com`, double `@`
- **Push to Spark (2026-04-13):** POSTs form-encoded data to Spark registration form URL (not API), triggering auto-assignment, ratings, and auto-reply emails. Includes reCAPTCHA token generated in admin's browser.
- **Full form data (2026-04-13):** Displays zip, "how did you hear about us", comments, broker/resident type, and brokerage from CallRail form_data
- **Agent detection (2026-04-13):** Extracts broker/agent flag from CallRail. Shows "Push as Agent/Broker" checkbox (pre-checked if CallRail says agent). Sends `agent=true` in form POST.
- **Dismiss/Restore (2026-04-13):** Select missing contacts → Dismiss to hide from Missing tab. Persisted in localStorage. Dismissed tab appears with Restore option.
- Warning flags on contacts with typo emails or non-email matches

**Key files:**
- `app/reconciliation/page.tsx` — UI
- `app/api/reconciliation/live/route.ts` — Smart matching API
- `app/api/reconciliation/push/route.ts` — Push contacts via Spark form URL POST (maxDuration=60s)
- `app/api/reconciliation/push-utm/route.ts` — Push UTM fields to existing contacts (maxDuration=60s)
- `lib/push-logger.ts` — Audit logging for all push actions → `data/push-log.jsonl`

**Push via Form URL (2026-04-13):**
- Push route now POSTs form-encoded data to `https://spark.re/mira-mar-acquisitions-company-llc/mira-mar/register/inquire-form`
- This triggers Spark's form-level automations: auto-assignment (round-robin), default rating, auto-reply email
- **reCAPTCHA passthrough:** Admin's browser generates a reCAPTCHA v3 token via `grecaptcha.execute()`, sent through push API and included as `g-recaptcha-response` in the form POST
- **reCAPTCHA domain setup:** Site key `6LfqnOErAAAAALcWX6q1VKVJ4zvvS5XxsCNPzuWu` must have both `miramarsarasota.com` AND the dashboard domain(s) in Google reCAPTCHA admin console
- **Success detection:** `fetch()` with `redirect: 'manual'`, check Location header for `thank-you` (success) vs `form-error` (failure)
- **Agent flag:** Sends `agent=true/false` and `contact[brokerage_name]` for broker detection
- **Form fields sent:** first_name, last_name, email, phone, postcode, comments, answers[24470][answers] (how heard), agent, brokerage_name, source, UTM custom_fields_attributes (22408/22409/22410), redirect_success/error
- **Important:** Spark's reCAPTCHA must stay ON (form setting) — it's the only thing blocking spam bots. Our push works because the admin's browser generates a valid token.
- **Why not API?** `POST /v2/contacts` doesn't trigger auto-assignment or other form-level automations. Round-robin state is internal to Spark.

**Push UTM Feature (2026-03-26, updated 2026-04-09):**
- UTM Gaps tab shows contacts in Spark with missing UTM data that CallRail has
- Select all / individual checkboxes (amber-colored) to push UTM fields
- Uses PUT to `https://api.spark.re/v2/contacts/{id}` with `custom_field_values` AND `marketing_source`
- Both push endpoints have `maxDuration = 60` to avoid Vercel timeouts on large batches
- **marketing_source push (2026-04-09):** Now sends CallRail source (e.g. "Facebook Organic") as `marketing_source` alongside UTM custom fields. Previously failed with "No UTM values to push" when contact had a source but no UTM params. Frontend also updated to pass `callrailSource` to the endpoint.

**Push Audit Logging (2026-03-26):**
- All push actions (create + UTM update) logged to `data/push-log.jsonl`
- JSONL format with timestamp, contacts, success/failure, UTM values

**Performance:** ~60-80s for 30-day range (156 contacts × 2-3 Spark API calls each). Faster with shorter date ranges.

**Vercel Timeout Gotcha:** Default Vercel function timeout is 10s. Batch push operations (50+ contacts) need `maxDuration = 60`. On hobby plan the max is 10s — would need frontend chunking instead.

### Remaining Work

1. ~~**Recover missing leads**~~ **DONE (2026-03-24)** — All 55 missing contacts pushed to Spark. Marketing source + UTM custom fields populated.
2. **Monitor vanilla form** — Switched from custom form + relay to Spark's native embed ~2026-04-10. Use reconciliation dashboard to confirm zero drops continue.
4. ~~**Monitor relay effectiveness**~~ **N/A** — Relay retired, vanilla form in use.
5. **Clean up relay artifacts on production** — `spark-relay-debug.log`, `spark-relay-log.jsonl` on Flywheel. Relay PHP files can stay (inactive).
6. **Clean up 3 test contacts** in Spark (test-import-delete-me@, test-utm-delete-me@, test-fullutm-delete-me@example.com)
7. **Client call with Spark** — Summary doc at `drafts/lost-leads-summary.md`. Frames issue as custom JS failure, all 55 leads recovered, now using vanilla Spark form.
8. **Spark API writes WORK** — Direct HTTP POST to `https://api.spark.re/v2/contacts` works with our key (Bearer token). The Spark MCP tool (`mcp__spark-re__create_update_contact`) fails due to MCP tool limitations, NOT the API key. Always use direct `curl`/`fetch` for writes. Supports `marketing_source`, `custom_field_values` (UTM fields: 22408=utm_source, 22409=utm_medium, 22410=utm_campaign), and all standard fields. See `/sparkre-crm-api` skill for full POST body reference.
9. **Spark API does NOT support backdating** — `created_at` cannot be set on POST/PUT. Contacts pushed via API always get current timestamp.
10. **Verify Vercel plan supports maxDuration=60** — If on hobby plan (10s max), push-utm will still fail for large batches. Would need frontend-side chunking.

### UTM Cookie Diagnostics (2026-03-26) — DEPLOYED TO PRODUCTION

Lightweight logging to diagnose whether paid ad visitors lose UTM cookies before form submission.

**WordPress files deployed:**
- `js/utm-tracker.js` — Added cookie verification + Clarity custom tags + sendBeacon logging
- `includes/utm-cookie-logger.php` — WordPress AJAX endpoint receiving beacons, writes to JSONL
- `functions.php` — Added require_once for logger

**Clarity Custom Tags (tagged on every page load):**
- `utm_cookie` — `cookie_set` | `cookie_failed` | `cookie_exists` | `no_utms`
- `utm_browser` — `facebook` | `instagram` | `chrome` | `safari` | `chrome-ios` | etc.
- `utm_src` — the utm_source value when present

**WordPress Log:** `salient-child/utm-cookie-log.jsonl` — JSONL, auto-rotates at 1MB (keeps last 500 entries)

**How to analyze:**
1. Filter Clarity sessions by `utm_cookie = cookie_failed` to watch replays where UTMs were lost
2. SSH to Flywheel, read `utm-cookie-log.jsonl` to aggregate failure rates by browser type
3. Cross-reference with "Direct" form submissions to confirm hypothesis

**Dashboard access:** `/api/utm-cookie-log` — fetches from WP REST endpoint, caches in `/tmp/`, has Sync Now button + date range

### Reconciliation Page Reports (2026-03-26)

The reconciliation page header has 4 reports in an **admin-only dropdown** (FileBarChart icon, visible only to `isAdmin` users via `useAuth()`). Lost Leads Report requires separate `can_view_llr` permission (admin-only by default):

| Report | Route | Description |
|--------|-------|-------------|
| **Lost Leads Report** | `/api/lost-leads-alltime` | 55 leads lost over 3 months (Dec 26 2025 - Mar 26 2026) |
| **Contact Comparison** | `/api/contact-comparison` | Side-by-side CallRail vs Spark for 33 contacts with dates, UTMs, lag |
| **UTM Cookies** | `/api/utm-cookie-log` | Live UTM cookie diagnostics from WordPress (sync from WP REST) |
| **Relay Health** | `/api/spark-relay-log` | Form relay success/failure monitoring (sync from WP REST) |

**Default date range**: 7 days (changed from 30d on 2026-04-09)

### Relay Health Monitoring (2026-03-26) — DEPLOYED TO PRODUCTION

Server-side form relay now logs every submission outcome for ongoing monitoring.

**WordPress files deployed:**
- `includes/spark-form-relay.php` — Updated with structured JSONL logging at all exit points
- `includes/spark-relay-endpoint.php` — REST API at `GET /wp-json/miramar/v1/spark-relay-log` (Bearer auth)
- `includes/spark-relay-dashboard-widget.php` — WP admin dashboard widget showing 24h/7d health stats
- `functions.php` — Added require_once for both new files

**Log file:** `salient-child/spark-relay-log.jsonl` — JSONL, auto-rotates at 1MB (keeps last 500 entries)

**Log entry fields:** timestamp, form_type, outcome (success/failed/rejected/wp_error/invalid_form/honeypot/dedup), status_code, email, name, utm_source/medium/campaign, utm_fallback, has_recaptcha, error_detail

**WordPress REST endpoints (both on miramarsarasota.com):**
- `/wp-json/miramar/v1/utm-cookie-log` — Bearer: `miramar-utm-log-2026-x9k4m`
- `/wp-json/miramar/v1/spark-relay-log` — Bearer: `miramar-relay-log-2026-r7m3k`

**Vercel filesystem gotcha:** Cannot write to `data/` on Vercel (read-only). All cache files use `/tmp/` instead.

**Flywheel REST endpoint gotcha:** New routes return 404 on first request due to Varnish cache. Flush with `wp cache flush && wp rewrite flush` via SSH, then hit the endpoint with a cache-buster query param. Subsequent requests work fine.

### All-Time Lost Leads Investigation (2026-03-26)

Full cross-reference of CallRail API (603 all-time Mira Mar submissions, back to Oct 2025) against Spark failed submissions log revealed:
- **56 total lost leads** (55 real + 1 test) over **3 months** (Dec 26 2025 - Mar 26 2026)
- 24 more than the original 32-contact spreadsheet
- Problem existed since at least Dec 2025, not just March 2026
- All 55 real leads now recovered in Spark
- Spark's failed submission log (`/projects/2855/registration-request-logs?display=failed`) is **UI-only** — no API access (all endpoints return 404)

**CallRail API notes:**
- All-time endpoint: `GET /v3/a/{account}/form_submissions.json?start_date=2025-01-01T00:00:00Z&per_page=250&fields=form_data,source,referrer,landing_page_url,form_url`
- 3,913 total submissions across all sites, 603 for Mira Mar
- CallRail MCP server is configured in `~/.claude.json` but was not running this session; used REST API directly
- Contact name/email available at top level: `customer_name`, `customer_email`, `formatted_customer_name`
- Form data is a dict (not array): `form_data.contact.first_name`, etc.

### Data Files (2026-03-26)

| File | Description |
|------|-------------|
| `data/client-contact-comparison.csv` | Side-by-side CallRail vs Spark for 33 contacts |
| `data/client-contact-comparison.html` | Styled HTML version (served at `/api/contact-comparison`) |
| `data/lost-leads-report.html` | Visual investigation report: 32 leads (served at `/api/lost-leads-report`) |
| `data/lost-leads-alltime-report.html` | All-time report: 55 leads (served at `/api/lost-leads-alltime`) |
| `data/Lost Spark.xlsx` | Client spreadsheet with CallRail dates + rejection reasons added |
| `data/Lost Spark (Conclusion).xlsx` | Client's 3-sheet workbook (Lost Sparks, failed submissions, Project Contact) |
| `scripts/contact-comparison.mjs` | Fetches Spark contacts by name, cross-refs with CallRail CSV |
| `scripts/generate-comparison-html.mjs` | Generates styled HTML from comparison CSV |

## References

- **Spark API Documentation**: Reference the `spark-api` Claude Code skill
- **Bug Fix Documentation**: See `SPARK_API_FIX.md` and `SPARK_API_REQUEST.md`
- **Changelog**: `CHANGELOG.md` has detailed version history with code locations
- **Package Versions**: `package.json` - Keep Next.js and React in sync

---

**Last Updated**: 2026-04-13 (Push via form URL with reCAPTCHA passthrough; full form data enrichment; LLR access control; agent detection; dismiss/restore; Meta Gaps rename)
