-- 004_publish_safety_guard.sql
-- ============================================================================
-- PUBLISH SAFETY GUARD — watchdog-era DB cleanup + approval gate schema.
-- Date: 2026-08-01
--
-- Context: /api/cron/publish (PR #115) was disabled (PR #118) after it mass-
-- published posts to Facebook. This migration is the safety preparation for
-- re-enabling it: it purges the stale watchdog-era rows that caused the
-- incident and adds an approval gate so the cron can never claim a post that
-- was not explicitly approved.
--
-- CONTRACT (MUST be honored when re-enabling the publish cron):
--   The publish cron claim query MUST filter for approved_at IS NOT NULL:
--     WHERE status = 'pending'
--       AND approved_at IS NOT NULL
--       AND due_at <= NOW()
--   Any row without approved_at is legacy/unapproved and MUST NOT be
--   auto-published. (See COMMENT ON TABLE below — it documents the same rule
--   in the database itself.)
--
-- Idempotent: rerunning this file never double-deletes or errors.
-- ============================================================================

-- ── 1. Purge watchdog-era test posts (one-time cleanup; idempotent) ──
-- Stuck 'publishing' rows never finished (cron disabled since PR #118).
-- The publish cron is the only writer of 'publishing', and it is off, so
-- every 'publishing' row today is a stranded artifact of the mass-posting
-- incident — safe to delete.
DELETE FROM scheduled_posts WHERE status = 'publishing';

-- Stopgap watchdog test client — every row under this client is a test post,
-- never publishable. Deleting pending rows removes the accident risk entirely.
DELETE FROM scheduled_posts
WHERE status = 'pending' AND client_id = 'client-8f5c81359030e96f';

-- ── 2. Approval columns (nullable — legacy rows keep NULL until approved) ──
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- ── 3. CHECK constraint — an approval must name its approver ──
-- Enforces the invariant "approved_at set ⇒ approved_by set". Prevents rows
-- from being marked approved without a traceable approver (client email or
-- 'system'). Safe on existing rows: every legacy row has both columns NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scheduled_posts_approval_consistency'
  ) THEN
    ALTER TABLE scheduled_posts
      ADD CONSTRAINT scheduled_posts_approval_consistency
      CHECK (approved_at IS NULL OR approved_by IS NOT NULL);
  END IF;
END $$;

-- ── 4. Documentation — the DB itself states the cron contract ──
COMMENT ON TABLE scheduled_posts IS
  'Scheduled social posts. PUBLISH SAFETY GUARD: the publish cron MUST only '
  'claim rows WHERE status = ''pending'' AND approved_at IS NOT NULL AND '
  'due_at <= NOW(). Rows without approved_at are legacy/unapproved and must '
  'never be auto-published.';

COMMENT ON COLUMN scheduled_posts.approved_at IS
  'When the post was explicitly approved for publishing (client via portal, '
  'or ''system'' for internal brand posts). NULL = never approved — the '
  'publish cron MUST filter for approved_at IS NOT NULL before claiming.';

COMMENT ON COLUMN scheduled_posts.approved_by IS
  'Who approved the post: client email (portal approval) or ''system'' '
  '(internal operations). Required whenever approved_at is set.';
