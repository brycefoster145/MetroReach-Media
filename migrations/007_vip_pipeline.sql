-- VIP Daily content pipeline (007)
--
-- Cycle/task metadata for the $8,500/mo VIP Daily package:
--   180 posts per 30-day service cycle (90 IG + 90 FB; 3 IG + 3 FB per day),
--   5 production batches of 18 IG + 18 FB each, per-client IANA timezone.
--
-- Idempotent — safe to run on every deploy / via /api/force-migrate.

-- ── pipeline_tasks: VIP metadata columns ──
ALTER TABLE pipeline_tasks ADD COLUMN IF NOT EXISTS task_kind TEXT;
ALTER TABLE pipeline_tasks ADD COLUMN IF NOT EXISTS cycle_id TEXT;
ALTER TABLE pipeline_tasks ADD COLUMN IF NOT EXISTS batch_number INTEGER;
ALTER TABLE pipeline_tasks ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE pipeline_tasks ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Idempotency: re-running VIP task generation must not duplicate tasks.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_tasks_idempotency
  ON pipeline_tasks (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Cycle-aware lookups (monitor, dashboard, scheduling reconciliation).
CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_cycle
  ON pipeline_tasks (cycle_id, task_kind, batch_number);

-- ── vip_cycles: one row per committed 30-day service cycle ──
CREATE TABLE IF NOT EXISTS vip_cycles (
  id TEXT PRIMARY KEY DEFAULT ('cycle-' || gen_random_uuid()::text),
  client_id TEXT NOT NULL,
  cycle_start DATE NOT NULL,
  cycle_end DATE NOT NULL,
  timezone TEXT NOT NULL,
  committed_ig_posts INTEGER NOT NULL DEFAULT 90,
  committed_fb_posts INTEGER NOT NULL DEFAULT 90,
  committed_total INTEGER NOT NULL DEFAULT 180,
  status TEXT NOT NULL DEFAULT 'planned',
  queue_alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vip_cycles_total_check CHECK (committed_total = committed_ig_posts + committed_fb_posts)
);
-- One cycle per client per cycle_start (upsert target for runVipTaskGeneration).
CREATE UNIQUE INDEX IF NOT EXISTS idx_vip_cycles_client_cycle
  ON vip_cycles (client_id, cycle_start);

-- ── vip_assets: per-cycle IG asset registry (unique-asset enforcement) ──
-- Every IG post in a cycle must reference a distinct asset_id. The UNIQUE
-- constraint on (client_id, cycle_id, asset_id) makes a duplicate insert fail
-- so the scheduling task can never schedule the same creative twice in one
-- cycle. Facebook may reuse an IG asset (separate platform) — tracked in the
-- manifest, not here.
CREATE TABLE IF NOT EXISTS vip_assets (
  id TEXT PRIMARY KEY DEFAULT ('asset-' || gen_random_uuid()::text),
  client_id TEXT NOT NULL,
  cycle_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  ig_slot INTEGER NOT NULL,
  asset_id TEXT NOT NULL,
  concept TEXT,
  png_path TEXT,
  webp_path TEXT,
  cdn_url TEXT,
  reviewer TEXT,
  review_timestamp TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'briefed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, cycle_id, asset_id)
);
CREATE INDEX IF NOT EXISTS idx_vip_assets_cycle ON vip_assets (client_id, cycle_id, status);
