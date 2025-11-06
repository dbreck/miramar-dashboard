# Spark API Feature Request: Bulk Contact Filtering

## Issue
The `GET /v2/contacts` endpoint with query parameters returns empty results due to permission restrictions, preventing efficient bulk contact retrieval with filters.

## What We Need
Enable bulk contact queries with standard Ransack filters:

```
GET /v2/contacts?project_id_eq=2855&created_at_gteq=2025-09-18&created_at_lteq=2025-10-18&registration_source_id_eq=123
```

## Current Workaround
We must:
1. Fetch all interactions to get contact IDs
2. Batch fetch contacts using `id_in` parameter
3. Filter by `created_at` client-side

This limits us to only contacts with interactions, making our analytics numbers inconsistent with Spark's native filters.

## Impact
Without this, dashboards cannot show accurate contact counts matching Spark's UI filters (e.g., "all Website leads created in last 30 days" regardless of interaction status).

## Already Works
- `GET /v2/contacts/:id` (individual contact fetch)
- `GET /v2/contacts?id_in=123,456,789` (batch fetch by known IDs)

## Expected Behavior
Bulk endpoint should support the same filters available in Spark's UI contact search/filtering.
