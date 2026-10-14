-- Recipients of the missing-lead alert digest. Managed from /admin.
-- Service-role only (RLS on, no policies). Falls back to LEAD_ALERT_TO env when empty.
-- Applied to production 2026-10-14 via the Supabase MCP.
CREATE TABLE IF NOT EXISTS alert_recipients (
  email      text PRIMARY KEY,
  added_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE alert_recipients ENABLE ROW LEVEL SECURITY;
INSERT INTO alert_recipients (email) VALUES ('danny@clearph.com') ON CONFLICT DO NOTHING;
