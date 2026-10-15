-- Auto-push of missing leads into Spark (plan: docs/plans/2026-10-15-auto-push-missing-leads.md).
--
-- status          alerted     emailed as missing, not pushed (alert-only mode, or pre-autopush rows)
--                 pushed      created in Spark by the cron (spark_contact_id set, resolved_at = pushed_at)
--                 push_failed Spark rejected the create; retried until push_attempts hits the cap
--                 skipped     found in Spark by the pre-push email check; nothing written
-- digest_sent_at  null = still owed a digest. The cron writes rows first and emails second, so a
--                 failed Resend send is retried next tick without re-pushing to Spark.
ALTER TABLE lead_alerts
  ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'alerted'
    CHECK (status IN ('alerted', 'pushed', 'push_failed', 'skipped')),
  ADD COLUMN IF NOT EXISTS pushed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS push_error     text,
  ADD COLUMN IF NOT EXISTS push_attempts  int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS digest_sent_at timestamptz;

-- Every row that exists today was emailed when it was inserted.
UPDATE lead_alerts SET digest_sent_at = first_alerted_at WHERE digest_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS lead_alerts_digest_pending_idx ON lead_alerts (first_alerted_at) WHERE digest_sent_at IS NULL;
