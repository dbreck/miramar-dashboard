# Spark API Lead Count Fix - Implementation Guide

**Date:** October 22, 2025
**Issue:** Lead source counts didn't match Spark UI
**Solution:** Fixed in spark-mcp v1.6.1
**Your Task:** Apply the same fix to Mira Mar dashboard

---

## The Problem We Solved

### What Was Wrong:
- **Dashboard showed:** 43 Website leads
- **Spark UI showed:** 81 Website leads
- **Discrepancy:** 38 leads (47% of total)

### Root Cause:
The original implementation only counted "engaged" contacts (those with interactions), not ALL contacts with a given registration source.

```typescript
// ❌ OLD APPROACH (WRONG)
// Only got contacts that had interactions
const interactions = await getInteractions(project_id);
const contactIds = [...new Set(interactions.map(i => i.contact_id))];
const contacts = await getContactsByIds(contactIds);
// Result: 43 contacts (only those contacted by sales team)
```

### Why This Matters for Marketing:
- You're the **marketers** tracking lead generation
- Need to see **ALL leads** that came in, even if sales hasn't contacted them yet
- If 100 leads come in overnight before anyone calls them, you need to know they exist
- Marketing ROI = total leads generated, not just engaged leads

---

## The Solution (Applied in spark-mcp v1.6.1)

### New Approach:
Fetch ALL contacts by registration source, then filter by project properly.

```typescript
// ✅ NEW APPROACH (CORRECT)
// Step 1: Get ALL registration sources for the project
const sources = await api.get('/registration-sources?project_id_eq=2855');

// Step 2: For each source, get ALL contacts with that source
for (const source of sources) {
  // Fetch all contacts with this registration_source_id
  const allContacts = await api.get(
    `/contacts?registration_source_id_eq=${source.id}&per_page=100`
  );

  // Step 3: Filter by project using projects array
  // (Can't use project_id_eq because it doesn't work reliably)
  const projectContacts = [];

  for (const contact of allContacts) {
    const fullContact = await api.get(`/contacts/${contact.id}`);
    const inProject = fullContact.projects.some(p => p.project_id === 2855);
    if (inProject) {
      projectContacts.push(fullContact);
    }
  }

  // Result: 81 contacts (ALL Website leads)
}
```

### Key Technical Details:

1. **Don't use `project_id_eq` on /contacts endpoint**
   - It doesn't work reliably (returns empty or incomplete results)
   - Contacts belong to multiple projects (many-to-many relationship)

2. **Filter by checking the projects array instead**
   - Fetch individual contact: `GET /contacts/{id}`
   - Check `contact.projects` array for `project_id === 2855`

3. **Batch for performance**
   - Fetch 20 contacts concurrently: `Promise.all(batch.map(...))`
   - Prevents overwhelming the API
   - Keeps response time reasonable (~4-5 seconds per source)

4. **Still show engagement metrics**
   - Total: 81 contacts
   - Engaged: 43 contacts (53% engagement rate)
   - Shows both for context

---

## Code Changes Required in Mira Mar Dashboard

### Files to Update:

**Location:** `/Users/dannybreckenridge/miramar-dashboard`

You'll need to update wherever you're fetching lead source data. Look for:
- API calls to `/contacts` with `registration_source_id`
- Lead source chart/widget data fetching
- Marketing analytics calculations

### Implementation Pattern:

```typescript
// Example: Fetching Website leads for dashboard

async function getLeadSourceData(projectId: number) {
  // Step 1: Get all registration sources
  const sourcesRes = await fetch(
    `https://api.spark.re/v2/registration-sources?project_id_eq=${projectId}`,
    { headers: { 'Authorization': `Token token="${API_KEY}"` } }
  );
  const sources = await sourcesRes.json();

  const sourceData = [];

  // Step 2: For each source, get total contact count
  for (const source of sources) {
    // Fetch ALL contacts with this source
    let allContactsForSource = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) { // Max 10 pages per source
      const res = await fetch(
        `https://api.spark.re/v2/contacts?registration_source_id_eq=${source.id}&per_page=100&page=${page}`,
        { headers: { 'Authorization': `Token token="${API_KEY}"` } }
      );
      const contacts = await res.json();

      if (!contacts || contacts.length === 0) break;

      allContactsForSource.push(...contacts);

      // Check Link header for pagination
      const linkHeader = res.headers.get('link');
      hasMore = linkHeader && linkHeader.includes('rel="next"');
      page++;
    }

    // Step 3: Filter by project (batch fetch for performance)
    const projectContacts = [];
    const batchSize = 20;

    for (let i = 0; i < allContactsForSource.length; i += batchSize) {
      const batch = allContactsForSource.slice(i, i + batchSize);

      const batchPromises = batch.map(c =>
        fetch(`https://api.spark.re/v2/contacts/${c.id}`, {
          headers: { 'Authorization': `Token token="${API_KEY}"` }
        })
        .then(r => r.json())
        .catch(() => null)
      );

      const detailedContacts = await Promise.all(batchPromises);

      detailedContacts.forEach(contact => {
        if (!contact) return;

        const projects = contact.projects || [];
        const inProject = projects.some(p => p.project_id === projectId);

        if (inProject) {
          projectContacts.push(contact);
        }
      });
    }

    // Calculate engagement rate
    const engaged = projectContacts.filter(c => c.last_interaction_date).length;
    const engagementRate = Math.round((engaged / projectContacts.length) * 100);

    sourceData.push({
      name: source.name,
      total: projectContacts.length,  // ✅ This will now be 81 for Website
      engaged: engaged,               // This will be 43 for Website
      engagementRate: engagementRate, // This will be 53% for Website
      sourceId: source.id
    });
  }

  return sourceData;
}
```

---

## Expected Results After Fix

### Before (Current Dashboard):
```
Lead Source Performance:
- Website: 43 total leads
```

### After (Fixed Dashboard):
```
Lead Source Performance:
- Website: 81 total leads (53% engagement)
  - 43 contacts contacted
  - 38 contacts never contacted
```

### Chart Data Format:
```javascript
{
  labels: ['Website', 'Agent Referral', 'Walk-In', 'Social Media', 'Phone Call'],
  datasets: [
    {
      label: 'Total Leads',
      data: [81, 67, 45, 23, 1],  // ✅ NEW: Higher numbers
      backgroundColor: '#3B82F6'
    },
    {
      label: 'Engaged',
      data: [43, 64, 40, 15, 1],  // Subset of total
      backgroundColor: '#10B981'
    }
  ]
}
```

---

## Testing the Fix

### Test Cases:

1. **Website Leads Count:**
   - **Expected:** 81 total leads
   - **Test:** Query Spark UI for "Website" source in Project 2855
   - **Verify:** Dashboard matches Spark UI exactly

2. **Engagement Rate:**
   - **Expected:** 53% (43 of 81)
   - **Test:** Check how many Website contacts have `last_interaction_date`
   - **Verify:** Percentage is accurate

3. **Other Sources:**
   - **Expected:** All sources now show higher total counts
   - **Test:** Compare each source to Spark UI
   - **Verify:** All match exactly

### Manual Testing Commands:

```bash
# Test API directly
curl -s --location 'https://api.spark.re/v2/contacts?registration_source_id_eq=17599&per_page=100' \
  --header 'Authorization: Token token="YOUR_KEY"' | \
  python3 -c "import sys, json; data = json.load(sys.stdin); print(f'Total: {len(data)}')"

# Expected output: Total: 81
```

---

## Performance Considerations

### Current Implementation (Fixed):
- **Time per source:** ~4-5 seconds
- **Batching:** 20 concurrent requests
- **Total time (5 sources):** ~20-25 seconds
- **Caching:** Recommended for dashboard (5-minute cache)

### Optimization Tips:

1. **Implement caching:**
```typescript
// Cache for 5 minutes
const CACHE_TTL = 5 * 60 * 1000;
let cachedData = null;
let cacheTime = 0;

async function getCachedLeadSources() {
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
    return cachedData;
  }

  cachedData = await getLeadSourceData(2855);
  cacheTime = Date.now();
  return cachedData;
}
```

2. **Show loading states:**
```typescript
// Good UX during 20-25 second load
<div>Loading lead sources... (This may take 20-25 seconds)</div>
```

3. **Consider background refresh:**
```typescript
// Update every 5 minutes in background
setInterval(async () => {
  cachedData = await getLeadSourceData(2855);
  cacheTime = Date.now();
}, 5 * 60 * 1000);
```

---

## Spark API Limitations (Important Context)

### Why We Can't Use `project_id_eq`:

**Problem:** This doesn't work reliably on /contacts endpoint:
```typescript
// ❌ Returns empty or incomplete results
await api.get('/contacts?project_id_eq=2855&registration_source_id_eq=17599');
```

**Why:** Contacts belong to multiple projects via many-to-many relationship. The `project_id_eq` filter on the list endpoint doesn't properly traverse this relationship.

**Solution:** Fetch contacts by source, then check `projects` array on individual contacts.

### List vs Individual Endpoints:

**List Endpoint** (`GET /contacts`):
- Returns 38 fields
- Excludes: ratings, projects, notes, team_members
- Use for: Getting contact IDs, basic info

**Individual Endpoint** (`GET /contacts/{id}`):
- Returns 49 fields
- Includes: ratings, projects, notes, team_members
- Use for: Complete contact data, project filtering

---

## Dashboard-Specific Notes

### Where This Matters:

1. **Lead Source Performance Chart**
   - Total count per source
   - Engagement rate visualization
   - Hot/Warm breakdown by source

2. **Marketing ROI Dashboard**
   - Cost per lead calculations
   - Conversion rates by source
   - Time-series lead generation trends

3. **Executive Summary**
   - Total leads generated this month
   - Source comparison (which channels are working)
   - Engagement funnel (total → contacted → qualified → sold)

### Display Recommendations:

**Option 1: Show Both Metrics**
```
Website: 81 leads
├─ 43 contacted (53%)
└─ 38 pending outreach (47%)
```

**Option 2: Primary + Secondary**
```
Website
81 total leads
53% engagement rate
```

**Option 3: Chart with Stacked Bars**
```
[████████████████████] Website: 81 total
[█████████░░░░░░░░░░░] 43 engaged
```

---

## Reference: spark-mcp Implementation

The complete working implementation is in:
- **File:** `/Users/dannybreckenridge/spark-mcp/src/index.ts`
- **Function:** `handleGetLeadSources()` (lines 1606-1846)
- **Version:** 1.6.1
- **Commit:** `22e60a2`

You can reference this code directly for the exact pattern we used.

### Key Files:
- [spark-mcp/src/index.ts:1606-1846](file:///Users/dannybreckenridge/spark-mcp/src/index.ts#L1606-L1846) - Working implementation
- [spark-mcp/CHANGELOG.md:8-26](file:///Users/dannybreckenridge/spark-mcp/CHANGELOG.md#L8-L26) - Detailed explanation
- [spark-mcp/STATUS.md](file:///Users/dannybreckenridge/spark-mcp/STATUS.md) - Complete project status

---

## Summary Checklist

- [ ] Update lead source data fetching logic
- [ ] Remove interaction-based filtering for total counts
- [ ] Implement project filtering via projects array
- [ ] Add batching (20 concurrent requests)
- [ ] Update chart to show total + engaged
- [ ] Add engagement rate display
- [ ] Implement caching (5-minute TTL recommended)
- [ ] Test against Spark UI for accuracy
- [ ] Update any documentation/comments
- [ ] Deploy and verify with client

---

## Questions to Answer:

1. **Where is lead source data currently fetched?**
   - Look for API calls to Spark in your dashboard codebase
   - Find the function/component that builds the lead source chart

2. **What framework are you using?**
   - Next.js, React, Vue, vanilla JS?
   - This affects how you implement caching

3. **Do you have existing Spark API client code?**
   - Can reuse authentication and request patterns
   - Or need to implement from scratch?

4. **What's your API key storage?**
   - Environment variables (.env)?
   - Secrets management?

---

## Support

**spark-mcp repo:** https://github.com/dbreck/spark-mcp
**Issue:** If you hit problems, reference commit `22e60a2` in spark-mcp

**Spark API Docs:** In `/Users/dannybreckenridge/spark-mcp/docs/api/`

**Working Example:** `/Users/dannybreckenridge/spark-mcp/src/index.ts:1606-1846`

---

*Document created: October 22, 2025*
*For: Mira Mar Dashboard Lead Source Fix*
*Based on: spark-mcp v1.6.1*
