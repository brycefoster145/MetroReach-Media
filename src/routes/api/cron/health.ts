/**
 * Cron Health Check Endpoint — GET /api/cron/health
 *
 * Reports real-time state of the posting scheduler:
 * - When the cron last ran (timestamp from cron_runs table)
 * - How many posts were processed on the last run
 * - Current pending/due counts
 * - Server time (UTC)
 * - Whether the cron is considered "stale" (> 90 seconds since last run)
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/cron/health")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date();
        const report: Record<string, unknown> = {
          status: "ok",
          server_time_utc: now.toISOString(),
          server_timestamp_ms: now.getTime(),
        };

        try {
          // Query cron_runs for last execution
          const lastRunRows = await sql`
            SELECT run_at, posts_found, posts_processed, posts_succeeded, posts_failed, error
            FROM cron_runs
            ORDER BY run_at DESC
            LIMIT 1
          `;

          if (lastRunRows.length > 0) {
            const last = lastRunRows[0];
            const lastRunAt = last.run_at as Date;
            const msSinceLastRun = now.getTime() - lastRunAt.getTime();
            report.last_run = {
              run_at: lastRunAt.toISOString(),
              seconds_ago: Math.round(msSinceLastRun / 1000),
              posts_found: Number(last.posts_found ?? 0),
              posts_processed: Number(last.posts_processed ?? 0),
              posts_succeeded: Number(last.posts_succeeded ?? 0),
              posts_failed: Number(last.posts_failed ?? 0),
              error: last.error ?? null,
            };
            report.cron_stale = msSinceLastRun > 90_000;
          } else {
            report.last_run = null;
            report.cron_stale = true;
            report.warning = "Cron has never run — no records in cron_runs table";
          }

          // Query current pending state
          const pendingRows = await sql`
            SELECT COUNT(*) as cnt FROM scheduled_posts WHERE status = 'pending'
          `;
          report.pending_count = Number(pendingRows[0]?.cnt ?? 0);

          const dueRows = await sql`
            SELECT COUNT(*) as cnt FROM scheduled_posts 
            WHERE status = 'pending' AND due_at <= NOW()
          `;
          report.due_now_count = Number(dueRows[0]?.cnt ?? 0);

          // Recent cron runs (last 10)
          const recentRuns = await sql`
            SELECT run_at, posts_found, posts_processed, posts_succeeded, posts_failed
            FROM cron_runs
            ORDER BY run_at DESC
            LIMIT 10
          `;
          report.recent_runs = recentRuns.map((r: any) => ({
            run_at: String(r.run_at),
            posts_found: Number(r.posts_found ?? 0),
            posts_processed: Number(r.posts_processed ?? 0),
            posts_succeeded: Number(r.posts_succeeded ?? 0),
            posts_failed: Number(r.posts_failed ?? 0),
          }));

          // Sample due posts
          const duePosts = await sql`
            SELECT id, platform, due_at, 
              LEFT(content, 100) as content_preview,
              due_at <= NOW() as is_due
            FROM scheduled_posts
            WHERE status = 'pending' AND due_at <= NOW()
            ORDER BY due_at ASC
            LIMIT 10
          `;
          report.due_posts = duePosts.map((r: any) => ({
            id: r.id,
            platform: r.platform,
            due_at: String(r.due_at),
            content_preview: r.content_preview,
            is_due: r.is_due,
          }));

        } catch (err: any) {
          report.status = "error";
          report.error = err.message;
          console.error("[cron/health] Error:", err.message);
        }

        const statusCode = report.status === "error" ? 500 : 200;
        return new Response(JSON.stringify(report, null, 2), {
          status: statusCode,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
