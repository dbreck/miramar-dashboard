-- Missing-lead alert ledger. One row per CallRail email that was alerted on
-- because it had no Spark match. Written only by the cron route via the
-- service-role client; RLS on with no policies means no client access.
-- Applied to production 2026-10-14 via the Supabase MCP.
CREATE TABLE IF NOT EXISTS lead_alerts (
  email            text PRIMARY KEY,
  name             text,
  phone            text,
  source           text,
  form_type        text,
  form_url         text,
  submitted_at     timestamptz,
  capture_gaps     text[] NOT NULL DEFAULT '{}',
  likely_cause     text,
  payload          jsonb,
  first_alerted_at timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz,
  spark_contact_id bigint
);
CREATE INDEX IF NOT EXISTS lead_alerts_unresolved_idx ON lead_alerts (first_alerted_at DESC) WHERE resolved_at IS NULL;
ALTER TABLE lead_alerts ENABLE ROW LEVEL SECURITY;
