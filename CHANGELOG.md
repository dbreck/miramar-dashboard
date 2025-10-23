# Changelog

All notable changes to the Mira Mar Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-10-22

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
