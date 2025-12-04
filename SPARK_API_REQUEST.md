# Spark API Feature Requests & Limitations

## Known API Limitations

### 1. `id_in` Parameter Returns Limited Fields

**Tested:** December 4, 2025

The `id_in` bulk fetch parameter returns **list-level data only** (38 fields), NOT individual-level data (56 fields).

| Endpoint | Fields | Has `projects`? | Has `custom_field_values`? |
|----------|--------|-----------------|---------------------------|
| List (`/contacts?per_page=X`) | 38 | ❌ No | ❌ No |
| Individual (`/contacts/{id}`) | 56 | ✅ Yes | ✅ Yes |
| `id_in` (`/contacts?id_in=X,Y,Z`) | 38 | ❌ No | ❌ No |

**Impact:** Cannot use `id_in` to optimize N+1 queries when you need:
- `projects` array (for project membership filtering)
- `custom_field_values` (for UTM tracking/custom fields)

**Workaround:** Must fetch contacts individually via `/contacts/{id}` to get full data.

---

### 2. `project_id_eq` Filter Not Supported on `/contacts`

The `/contacts` list endpoint doesn't support `project_id_eq` filtering. Returns empty or incomplete results.

**Example that doesn't work:**
```
GET /v2/contacts?project_id_eq=2855&registration_source_id_eq=17599
```

**Workaround:**
1. Fetch contacts by `registration_source_id_eq`
2. Fetch each contact individually via `/contacts/{id}`
3. Filter by checking `contact.projects` array for `project_id`

---

## Feature Requests

### Request 1: Add `projects` and `custom_field_values` to List Endpoints

Enable bulk contact queries that return full contact data:

```
GET /v2/contacts?id_in=123,456,789&include=projects,custom_field_values
```

Or add an `expand` parameter:

```
GET /v2/contacts?per_page=100&expand=all
```

**Current Impact:** Dashboard must make 2,000+ individual API calls to fetch detailed contact data for 6-month reports.

### Request 2: Support `project_id_eq` on `/contacts` Endpoint

Enable filtering contacts by project membership:

```
GET /v2/contacts?project_id_eq=2855&created_at_gteq=2025-09-18
```

**Current Impact:** Cannot efficiently query "all contacts in project X" without fetching ALL contacts and filtering client-side.

---

## What Currently Works

- `GET /v2/contacts/:id` - Individual contact fetch (56 fields, full data)
- `GET /v2/contacts?id_in=123,456,789` - Batch fetch by IDs (38 fields, list data only)
- `GET /v2/contacts?registration_source_id_eq=X` - Filter by source
- `GET /v2/contacts?registration_source_id_null=true` - Filter contacts with no source
- Date filters: `created_at_gteq`, `created_at_lteq`
- Pagination: `per_page`, `page`

---

*Last updated: December 4, 2025*
