/**
 * Force Migration Endpoint — GET /api/force-migrate
 *
 * Runs the scheduled_posts table creation (and any other critical tables)
 * on demand in production. Idempotent — uses CREATE TABLE IF NOT EXISTS.
 * Uses @neondatabase/serverless (HTTP-based, serverless-safe).
 */
import { createFileRoute } from "@tanstack/react-router";
import { neon } from "@neondatabase/serverless";

export const Route = createFileRoute("/api/force-migrate")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.DATABASE_URL;
        if (!url) {
          return new Response(
            JSON.stringify({ error: "DATABASE_URL not set" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const results: string[] = [];
        const n = neon(url);

        try {
          // ── scheduled_posts table ──
          await n`
            CREATE TABLE IF NOT EXISTS scheduled_posts (
              id TEXT PRIMARY KEY,
              client_id TEXT NOT NULL DEFAULT 'metroreach',
              platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'linkedin', 'tiktok', 'x', 'google')),
              page_id TEXT NOT NULL,
              ig_user_id TEXT,
              content TEXT NOT NULL,
              media_urls JSONB DEFAULT '[]',
              hashtags TEXT DEFAULT '#MetroReachMedia',
              due_at TIMESTAMPTZ NOT NULL,
              status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed', 'skipped_no_media', 'missed')),
              meta_post_id TEXT,
              utm_link TEXT,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              posted_at TIMESTAMPTZ
            )
          `;
          results.push("✓ scheduled_posts table ready");

          await n`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due ON scheduled_posts(status, due_at)`;
          results.push("✓ idx_scheduled_posts_due index ready");

          await n`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_client ON scheduled_posts(client_id, status)`;
          results.push("✓ idx_scheduled_posts_client index ready");

          // ── Add utm_link column (for click tracking) ──
          try {
            await n`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS utm_link TEXT`;
            results.push("✓ utm_link column ready");
          } catch (fixErr: any) {
            results.push(`ℹ utm_link migration: ${fixErr.message}`);
          }

          // ── Fix due_at column type (TEXT → TIMESTAMPTZ) ──
          try {
            await n`
              ALTER TABLE scheduled_posts 
              ALTER COLUMN due_at TYPE TIMESTAMPTZ USING due_at::TIMESTAMPTZ
            `;
            results.push("✓ due_at column type fixed to TIMESTAMPTZ");
          } catch (fixErr: any) {
            // If it's already TIMESTAMPTZ, swallow the error
            results.push(`ℹ due_at migration skipped: ${fixErr.message}`);
          }

          // ── Fix status check constraint to include 'publishing' and 'skipped_no_media' ──
          try {
            await n`
              ALTER TABLE scheduled_posts 
              DROP CONSTRAINT IF EXISTS scheduled_posts_status_check
            `;
            await n`
              ALTER TABLE scheduled_posts 
              ADD CONSTRAINT scheduled_posts_status_check 
              CHECK (status IN ('pending', 'publishing', 'posted', 'failed', 'skipped_no_media', 'missed'))
            `;
            results.push("✓ status check constraint updated (includes publishing, skipped_no_media)");
          } catch (fixErr: any) {
            results.push(`ℹ status constraint migration: ${fixErr.message}`);
          }

          // ── Add locked_at column (for atomic claim scheduler) ──
          try {
            await n`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`;
            results.push("✓ locked_at column ready");
          } catch (fixErr: any) {
            results.push(`ℹ locked_at migration: ${fixErr.message}`);
          }

          // ── Add retry_count column (for post retry logic) ──
          try {
            await n`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0`;
            results.push("✓ retry_count column ready");
          } catch (fixErr: any) {
            results.push(`ℹ retry_count migration: ${fixErr.message}`);
          }

          // ── pipeline_jobs table (async content-generation queue) ──
          await n`
            CREATE TABLE IF NOT EXISTS pipeline_jobs (
              id TEXT PRIMARY KEY,
              client_id TEXT NOT NULL,
              service_slug TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
              payload JSONB NOT NULL DEFAULT '{}'::jsonb,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              error TEXT
            )
          `;
          results.push("✓ pipeline_jobs table ready");
          await n`CREATE INDEX IF NOT EXISTS pipeline_jobs_pending_idx ON pipeline_jobs (status, created_at)`;
          await n`CREATE INDEX IF NOT EXISTS pipeline_jobs_client_idx ON pipeline_jobs (client_id, created_at DESC)`;
          results.push("✓ pipeline_jobs indexes ready");
          // Verify
          const count = await n`SELECT COUNT(*) as cnt FROM scheduled_posts`;
          results.push(`Table has ${count[0]?.cnt} rows`);

          // Check pending due posts
          const dueCount = await n`
            SELECT COUNT(*) as cnt FROM scheduled_posts 
            WHERE status = 'pending' AND due_at <= NOW()
          `;
          results.push(`Pending+due posts: ${dueCount[0]?.cnt}`);

          // ── cron_runs table ──
          await n`
            CREATE TABLE IF NOT EXISTS cron_runs (
              id SERIAL PRIMARY KEY,
              run_at TIMESTAMPTZ DEFAULT NOW(),
              posts_found INTEGER DEFAULT 0,
              posts_processed INTEGER DEFAULT 0,
              posts_succeeded INTEGER DEFAULT 0,
              posts_failed INTEGER DEFAULT 0,
              elapsed_ms INTEGER DEFAULT 0,
              error TEXT
            )
          `;
          results.push("✓ cron_runs table ready");

          // ── watchdog_alerts table ──
          await n`
            CREATE TABLE IF NOT EXISTS watchdog_alerts (
              id SERIAL PRIMARY KEY,
              alert_type TEXT NOT NULL,
              severity TEXT NOT NULL DEFAULT 'warning',
              message TEXT NOT NULL,
              checks_data JSONB DEFAULT '{}',
              created_at TIMESTAMPTZ DEFAULT NOW()
            )
          `;
          await n`CREATE INDEX IF NOT EXISTS idx_watchdog_alerts_created ON watchdog_alerts(created_at DESC)`;
          await n`CREATE INDEX IF NOT EXISTS idx_watchdog_alerts_severity ON watchdog_alerts(severity)`;
          results.push("✓ watchdog_alerts table ready");

          // ── Fix page_id for MetroReach Facebook posts ──
          // Posts were created with wrong or null page_id. Set to correct FB page.
          await n`
            UPDATE scheduled_posts
            SET page_id = '623055204204992'
            WHERE page_id = '106170049067568' AND platform = 'facebook'
          `;
          results.push("✓ FB posts with wrong page_id (106170049067568 → 623055204204992) fixed");

          // Also fix Facebook posts with NULL page_id
          await n`
            UPDATE scheduled_posts
            SET page_id = '623055204204992'
            WHERE page_id IS NULL AND platform = 'facebook'
          `;
          results.push("✓ FB posts with NULL page_id fixed");

          // Fix Instagram posts with NULL ig_user_id
          await n`
            UPDATE scheduled_posts
            SET ig_user_id = '17841472858895937'
            WHERE ig_user_id IS NULL AND platform = 'instagram'
          `;
          results.push("✓ IG posts with NULL ig_user_id fixed");

          // ── PUBLISH SAFETY GUARD (004) — watchdog-era cleanup + approval gate ──
          // Purge: stuck 'publishing' rows (cron disabled since PR #118 — the only
          // 'publishing' writer — so every such row is a stranded artifact).
          const purgedPublishing = await n`DELETE FROM scheduled_posts WHERE status = 'publishing' RETURNING id`;
          results.push(`✓ purged ${purgedPublishing.length} stuck 'publishing' posts`);
          // Purge: watchdog stopgap test client — every row is a test post.
          const purgedWatchdog = await n`
            DELETE FROM scheduled_posts
            WHERE status = 'pending' AND client_id = 'client-8f5c81359030e96f'
            RETURNING id
          `;
          results.push(`✓ purged ${purgedWatchdog.length} watchdog test posts (client-8f5c81359030e96f)`);
          // Approval columns (nullable — legacy rows stay NULL until approved).
          await n`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`;
          await n`ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS approved_by TEXT`;
          results.push("✓ approved_at / approved_by columns ready");
          // CHECK constraint — approved_at requires approved_by (idempotent).
          try {
            await n`
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
            `;
            results.push("✓ scheduled_posts_approval_consistency CHECK constraint ready");
          } catch (fixErr: any) {
            results.push(`ℹ approval CHECK constraint: ${fixErr.message}`);
          }
          // DB-level documentation of the cron contract.
          try {
            await n`COMMENT ON TABLE scheduled_posts IS
              'Scheduled social posts. PUBLISH SAFETY GUARD: the publish cron MUST only claim rows WHERE status = ''pending'' AND approved_at IS NOT NULL AND due_at <= NOW(). Rows without approved_at are legacy/unapproved and must never be auto-published.'`;
            await n`COMMENT ON COLUMN scheduled_posts.approved_at IS
              'When the post was explicitly approved for publishing (client via portal, or ''system'' for internal brand posts). NULL = never approved — the publish cron MUST filter for approved_at IS NOT NULL before claiming.'`;
            await n`COMMENT ON COLUMN scheduled_posts.approved_by IS
              'Who approved the post: client email (portal approval) or ''system'' (internal operations). Required whenever approved_at is set.'`;
            results.push("✓ publish safety comments applied");
          } catch (fixErr: any) {
            results.push(`ℹ publish safety comments: ${fixErr.message}`);
          }

          return new Response(
            JSON.stringify({ success: true, results }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          results.push(`ERROR: ${err.message}`);
          return new Response(
            JSON.stringify({ success: false, results, error: err.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
