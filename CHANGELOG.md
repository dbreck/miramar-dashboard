# Changelog

All notable changes to the Mira Mar Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2025-12-04

### Added
- **Comprehensive Data Filtering System**
  - New Filter button in dashboard header with active filter count badge
  - Slide-out FilterPanel with rich multi-select UI
  - **Registration Source Exclusion**: Exclude any source (e.g., "Agent Import", "No Value")
  - **Quick Filters**: One-click buttons for common exclusions (Agent Imports, No Value, Test Data)
  - **Agent Filtering**: Toggle to exclude contacts marked as agents
  - **No Source Filtering**: Toggle to exclude contacts without registration source
  - **Filter Presets**: Save and load filter configurations for quick switching
  - **localStorage Persistence**: Filters persist across browser sessions
  - **Active Filters Banner**: Shows when filters are active with quick access to manage

- **Filter Context System**
  - Global React Context for filter state management (`lib/filter-context.tsx`)
  - Centralized filter state shared across all tabs
  - Stable dependency handling to prevent infinite re-render loops

- **Server-Side Filtering**
  - API accepts `excludeSources`, `excludeAgents`, `excludeNoSource` query parameters
  - Filters applied server-side before data aggregation for efficiency
  - Cache key includes filter params for proper caching per filter combination
  - Returns `availableSources` list for filter panel population
  - Returns `activeFilters` metadata showing filter status and count

- **Filter UI Indicators**
  - Total Leads card shows "(filtered)" label and hidden count when filters active
  - Marketing tab shows filtered contact count badge
  - Filter button turns blue with red badge showing active filter count

### Security
- **CVE-2025-55182 & CVE-2025-66478 Patch**
  - Updated Next.js from 15.5.5 to **15.5.7** (patched)
  - Updated React from 19.2.0 to **19.2.1** (patched)
  - Updated React-DOM from 19.2.0 to **19.2.1** (patched)
  - Critical React Server Components vulnerability fixed
  - All npm audit vulnerabilities resolved (0 vulnerabilities)

### Fixed
- **Infinite Re-render Loop Prevention**
  - Fixed useEffect dependency issue where array references caused infinite loops
  - Used `JSON.stringify(excludedSources)` for stable dependency comparison
  - Prevents endless API calls when `setAvailableSources` updates context

### Technical Details
- **New Files:**
  - `lib/filter-context.tsx` - Global filter state management with React Context
  - `components/FilterPanel.tsx` - Rich slide-out filter panel component

- **Modified Files:**
  - `app/page.tsx` - Wrapped with FilterProvider
  - `app/api/dashboard/route.ts` - Added filter parameter parsing and server-side filtering
  - `components/DashboardLayout.tsx` - Added Filter button, banner, and FilterPanel integration
  - `components/tabs/OverviewTab.tsx` - Integrated filter context, stable dependencies
  - `components/tabs/MarketingTab.tsx` - Integrated filter context, stable dependencies
  - `package.json` - Version bump and dependency updates

- **Filter Processing Flow:**
  1. Client sends filter params to `/api/dashboard`
  2. Server parses `excludeSources` (comma-separated names), `excludeAgents`, `excludeNoSource`
  3. Contacts filtered after date range filtering, before aggregation
  4. Response includes `availableSources` for filter panel and `activeFilters` metadata
  5. Cache key includes filter combination for proper caching

### Why This Matters
- **Data Quality**: Easily exclude 6,000+ imported agent records that skew lead metrics
- **Flexible Analysis**: Create custom views by excluding irrelevant sources
- **Saved Workflows**: Filter presets enable quick switching between analysis modes
- **Accurate Reporting**: See true lead generation numbers without bulk imports

## [1.4.0] - 2025-11-18

### Added
- **Agent Distribution Chart**
  - New chart on Overview tab showing breakdown of All Leads, Agents, and Non-Agents
  - Filters by `created_at` date to match dashboard date range
  - Uses `agent` boolean field from Spark API
  - Vertical bar chart with clean visualization

- **Leads by ZIP Code Chart**
  - New location chart alongside Area Code chart on Overview tab
  - Extracts ZIP codes from `postcode` field
  - Shows "ZIP City" format when city data is available (e.g., "34236 Sarasota")
  - Displays top 15 ZIP codes sorted by lead volume
  - Handles missing data gracefully (shows "Unknown" for contacts without ZIP codes)

### Changed
- **Dashboard Layout Reorganization**
  - Row 1: Lead Sources (left) + Agent Distribution (right) - both horizontal charts
  - Row 2: Lead Growth Over Time - full width
  - Row 3: Leads by Location (Area Code) + Leads by ZIP Code - side by side

- **Lead Sources Chart UX Improvements**
  - Converted from vertical to horizontal bar chart
  - Full registration source names now visible (no truncation)
  - Y-axis width increased to 200px for better label visibility
  - Custom tooltip formatter shows "Source Name: Count" instead of "Leads: Count"
  - Consistent styling with other horizontal charts

### Technical Details
- **Files Modified:**
  - `app/api/dashboard/route.ts` (lines 450-462, 639-690, 865) - Agent distribution and ZIP code calculations
  - `components/tabs/OverviewTab.tsx` (lines 31-32, 157-323) - New charts and layout
  - `package.json` - Version bump to 1.4.0

- **Agent Distribution Logic:**
  - Counts contacts where `agent === true`
  - Counts contacts where `agent === false/null/undefined` as non-agents
  - Uses same date filtering as rest of dashboard (`created_at` field)

- **ZIP Code Processing:**
  - Normalizes ZIP codes to first 5 digits
  - Maps ZIP codes to city names from `contact.city` field
  - Combines as "ZIP City" when city data exists
  - Falls back to ZIP-only display when city data missing

### Why These Changes Matter
- **Agent tracking**: Enables filtering and understanding agent vs client acquisition
- **ZIP code visibility**: Provides granular geographic insights beyond area codes
- **Better UX**: Horizontal charts prevent label truncation, custom tooltips improve clarity
- **Flexible layout**: Dashboard now has logical groupings with room for future expansion

## [1.3.0] - 2025-11-17

### Fixed
- **Marketing Tab UTM Tracking Now Works**
  - Fixed critical bug where custom fields were not being extracted from API responses
  - Spark API returns `custom_field_values` array, not `custom_fields` object
  - Marketing tab charts now display UTM source, medium, and campaign data correctly

### Changed
- Updated Spark API client to fetch and map custom field definitions
  - Added `listCustomFields()` method to SparkAPIClient
  - Builds lookup map: `custom_field_id` → `field_name`
- Completely rewrote UTM extraction logic to parse array structure:
  - Converts `[{ custom_field_id: 123, value: "google" }]` → `{ utm_source: "google" }`
  - Properly maps field IDs to human-readable names
  - Extracts utm_source, utm_medium, utm_campaign values

### Added
- Custom field definitions fetch in dashboard API route
- Enhanced debug logging to show custom_field_values structure and mappings
- Field name mapping throughout debug output

### Technical Details
- **Files Modified:**
  - `lib/spark-client.ts` - Added `listCustomFields()` method (lines 392-398)
  - `app/api/dashboard/route.ts` - Custom fields fetch (lines 311-329), updated UTM extraction (lines 705-720), enhanced debug logging (lines 367-388, 634-703)

- **API Structure Discovery:**
  - Spark API uses `custom_field_values: Array<{ custom_field_id: number, value: any }>`
  - NOT `custom_fields: Record<string, any>` as initially assumed
  - Field names stored separately in `/custom-fields` endpoint definitions
  - Must map IDs to names to extract values by field name

- **What This Fixes:**
  - ✅ Marketing > Traffic Sources chart (now shows UTM source breakdown)
  - ✅ Marketing > Top Campaigns table (now shows campaign/source/medium data)
  - ✅ Debug logs now correctly identify contacts with UTM data

### Why This Was Important
The Marketing tab was showing "No UTM tracking data available" even though contacts had UTM parameters populated in Spark. The code was looking for a `custom_fields` object that doesn't exist in the API response. Now it correctly parses the `custom_field_values` array structure, enabling proper UTM tracking and attribution reporting.

## [1.2.0] - 2025-10-23

### Fixed
- **Critical: All Interaction Counts Now Accurate Across Entire Dashboard**
  - Previously fetched only 100 interactions (single page), causing severely underreported numbers
  - Example: Interaction Type Distribution showed 29 phone calls instead of actual ~135
  - Now fetches ALL interactions with automatic pagination (653 total)
  - Affects ALL charts on ALL tabs: Overview, Contacts, Engagement, Team, Pipeline

### Changed
- Implemented `listAllInteractions()` method with automatic pagination in Spark API client
  - Fetches 100 interactions per page until no more results
  - Logs progress: "Page 1: Fetched 100 interactions (total: 100)" etc.
  - Safety limit: 50 pages max (5,000 interactions)
- Updated dashboard API route to use `listAllInteractions()` instead of single-page `listInteractions()`
- Removed incorrect contact date filtering that excluded old contacts with recent interactions
- Removed v1.6.1 info banner from Lead Sources chart (cleanup)

### Added
- Console logging for pagination progress during interaction fetching
- Cache cleared on server startup message for development

### Technical Details
- **Files Modified:**
  - `lib/spark-client.ts` - Added `listAllInteractions()` method (lines 282-320)
  - `app/api/dashboard/route.ts` - Changed to use `listAllInteractions()` (line 98), removed contact date filter (lines 300-304)
  - `components/tabs/OverviewTab.tsx` - Removed v1.6.1 banner (lines 249-253)

- **Performance Impact:**
  - First load: +2 seconds (fetches all 653 interactions vs 100)
  - Total time: ~6-8 seconds for full dashboard
  - Still uses 5-minute cache for subsequent requests
  - Acceptable tradeoff for accurate data

- **What This Fixes:**
  - ✅ Overview > Interaction Type Distribution (reported issue)
  - ✅ Overview > Recent Activity timeline
  - ✅ Overview > Team Performance stats
  - ✅ Engagement > Interaction Type Details
  - ✅ Team > Team Performance chart
  - ✅ Pipeline > All charts (based on complete interaction data)

### Why This Was Critical
Without pagination, the dashboard was only analyzing the **most recent 100 interactions** (per API's default page size). This caused:
- Massive undercount of interaction types (29 vs 135 phone calls)
- Incorrect team performance metrics
- Incomplete activity timeline
- Inaccurate engagement statistics
- Numbers that didn't match Spark UI filters

Now all 653 interactions are fetched and analyzed, ensuring dashboard accuracy matches Spark.re reporting.

## [1.1.0] - 2025-10-23

### Fixed
- **Lead Source Counts Now Match Spark.re UI** - Major fix implementing spark-mcp v1.6.1 pattern
  - Previously showed 43 Website leads (only engaged contacts)
  - Now shows 81 Website leads (ALL contacts, matching Spark UI exactly)
  - Fixed discrepancy of 38 missing leads (47% of total)

### Changed
- Lead source fetching logic completely rewritten:
  - Fetches ALL contacts by `registration_source_id` (not from interactions)
  - Filters by project using `projects` array (individual contact fetch)
  - Batches individual contact fetches (20 at a time) for performance
  - Shows both total leads AND engagement rate (% contacted)
- Updated lead source chart tooltip to show engagement metrics
- Added v1.6.1 fix notice to Overview tab
- Improved pipeline data efficiency by reusing already-fetched contacts

### Added
- Engagement rate calculation for each lead source
- Total vs engaged contact breakdown
- Better logging for lead source data fetching process
- TypeScript interface updates for new engagement fields

### Technical Details
- **Files Modified:**
  - `app/api/dashboard/route.ts` - Core lead source logic (lines 207-353, 487-494)
  - `components/tabs/OverviewTab.tsx` - UI updates for engagement display
  - `lib/types.ts` - Added `engaged` and `engagementRate` fields

- **Performance:**
  - All-time query: ~4-5 seconds (fetches all contacts with full data)
  - 30-day query: ~5-6 seconds
  - Uses 5-minute cache for subsequent requests
  - Batch size: 20 concurrent contact fetches (optimized from 10)

- **API Pattern:**
  - Based on working spark-mcp v1.6.1 implementation
  - Reference: `/Users/dannybreckenridge/spark-mcp/src/index.ts:1606-1846`
  - Documented in: `SPARK_API_FIX.md`

### Why This Matters
This fix is critical for marketing ROI tracking. The dashboard now shows:
- **ALL leads generated** by each source (e.g., 81 Website leads)
- **Engagement rate** showing how many have been contacted (e.g., 53%)
- Leads that haven't been contacted yet (previously invisible)

Example:
```
Before: Website: 43 leads
After:  Website: 81 total leads (53% engagement)
        - 43 contacts contacted
        - 38 contacts never contacted ← These were MISSING before!
```

## [1.0.0] - 2025-10-21

### Added
- Initial release of Mira Mar Dashboard
- Password-protected authentication system
- 5 dashboard views: Overview, Pipeline, Contacts, Engagement, About
- Real-time data from Spark.re CRM API
- Dark mode with localStorage persistence
- Responsive design for mobile and desktop
- Beautiful charts with Recharts integration
- Key metrics: contacts, interactions, lead sources, team performance
- Date range filtering
- Caching system (5-minute TTL)

### Features
- HTTP-only cookie sessions for security
- Middleware-based route protection
- Custom Spark.re API client
- TypeScript throughout
- Tailwind CSS styling
- Next.js 15.5.5 App Router
