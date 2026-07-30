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
              created_at TIMESTAMPTZ DEFAULT NOW(),
              posted_at TIMESTAMPTZ
            )
          `;
          results.push("✓ scheduled_posts table ready");

          await n`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due ON scheduled_posts(status, due_at)`;
          results.push("✓ idx_scheduled_posts_due index ready");

          await n`CREATE INDEX IF NOT EXISTS idx_scheduled_posts_client ON scheduled_posts(client_id, status)`;
          results.push("✓ idx_scheduled_posts_client index ready");

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
