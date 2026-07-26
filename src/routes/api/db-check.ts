/**
 * Database Diagnostic Endpoint — GET /api/db-check
 *
 * Tests the database connection using BOTH the `postgres` package (TCP, used by
 * the cron scheduler) and `@neondatabase/serverless` (HTTP, serverless-native).
 * Reports table existence, row counts, sample pending posts, and timezone info.
 */
import { createFileRoute } from "@tanstack/react-router";
import postgres from "postgres";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;

export const Route = createFileRoute("/api/db-check")({
  server: {
    handlers: {
      GET: async () => {
        const report: Record<string, unknown> = {
          has_db_url: !!url,
          timestamp: new Date().toISOString(),
        };

        // ── Test 1: @neondatabase/serverless (HTTP) ──
        try {
          if (!url) throw new Error("DATABASE_URL not set");
          const n = neon(url);

          // Check if scheduled_posts exists
          const tableCheck = await n`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = 'scheduled_posts'
            ) as exists;
          `;
          report.neon = { connected: true, table_exists: tableCheck[0]?.exists };

          if (tableCheck[0]?.exists) {
            const count = await n`SELECT COUNT(*) as cnt FROM scheduled_posts`;
            report.neon.total_rows = Number(count[0]?.cnt);

            const pending = await n`
              SELECT COUNT(*) as cnt FROM scheduled_posts WHERE status = 'pending'
            `;
            report.neon.pending_rows = Number(pending[0]?.cnt);

            const duePending = await n`
              SELECT COUNT(*) as cnt FROM scheduled_posts 
              WHERE status = 'pending' AND due_at <= NOW()
            `;
            report.neon.due_pending_rows = Number(duePending[0]?.cnt);

            // Sample 5 pending posts
            const samples = await n`
              SELECT id, status, due_at, 
                NOW() as server_time,
                NOW() AT TIME ZONE 'UTC' as server_time_utc,
                due_at <= NOW() as is_due,
                platform,
                LEFT(content, 80) as content_preview
              FROM scheduled_posts 
              WHERE status = 'pending'
              ORDER BY due_at ASC
              LIMIT 5
            `;
            report.neon.sample_pending = samples.map((r: any) => ({
              ...r,
              due_at: String(r.due_at),
              server_time: String(r.server_time),
              server_time_utc: String(r.server_time_utc),
            }));

            // Timezone diagnostic
            const tz = await n`SELECT NOW() as now, NOW() AT TIME ZONE 'UTC' as utc, CURRENT_SETTING('timezone') as tz`;
            report.neon.timezone = tz[0];
          }
        } catch (err: any) {
          report.neon = { connected: false, error: err.message };
        }

        // ── Test 2: postgres package (TCP — same as cron) ──
        try {
          if (!url) throw new Error("DATABASE_URL not set");
          const pg = postgres(url, {
            max: 1,
            idle_timeout: 5,
            connect_timeout: 10,
            ssl: "require",
          });

          const tableCheck = await pg`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = 'scheduled_posts'
            ) as exists;
          `;
          report.postgres = { connected: true, table_exists: tableCheck[0]?.exists };

          if (tableCheck[0]?.exists) {
            const count = await pg`SELECT COUNT(*) as cnt FROM scheduled_posts`;
            report.postgres.total_rows = Number(count[0]?.cnt);

            const duePending = await pg`
              SELECT COUNT(*) as cnt FROM scheduled_posts 
              WHERE status = 'pending' AND due_at <= NOW()
            `;
            report.postgres.due_pending_rows = Number(duePending[0]?.cnt);

            const samples = await pg`
              SELECT id, status, due_at, 
                NOW() as server_time,
                due_at <= NOW() as is_due,
                platform,
                LEFT(content, 80) as content_preview
              FROM scheduled_posts 
              WHERE status = 'pending'
              ORDER BY due_at ASC
              LIMIT 5
            `;
            report.postgres.sample_pending = samples.map((r: any) => ({
              ...r,
              due_at: String(r.due_at),
              server_time: String(r.server_time),
            }));
          }

          await pg.end();
        } catch (err: any) {
          report.postgres = { connected: false, error: err.message };
        }

        return new Response(JSON.stringify(report, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
