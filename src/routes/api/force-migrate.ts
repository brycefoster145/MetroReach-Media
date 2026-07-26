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
              status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed')),
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

          // Verify
          const count = await n`SELECT COUNT(*) as cnt FROM scheduled_posts`;
          results.push(`Table has ${count[0]?.cnt} rows`);

          // Check pending due posts
          const dueCount = await n`
            SELECT COUNT(*) as cnt FROM scheduled_posts 
            WHERE status = 'pending' AND due_at <= NOW()
          `;
          results.push(`Pending+due posts: ${dueCount[0]?.cnt}`);

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
