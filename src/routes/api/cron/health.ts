/**
 * Cron Health Check — GET /api/cron/health
 *
 * Lightweight JSON endpoint for monitoring. Returns last cron run
 * timestamp, seconds since last run, queue depth, and status.
 * Used by external monitors and the /api/cron/status dashboard.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */
import { createFileRoute } from "@tanstack/react-router";
import postgres from "postgres";

const url = process.env.DATABASE_URL;

export const Route = createFileRoute("/api/cron/health")({
  server: {
    handlers: {
      GET: async () => {
        if (!url) {
          return new Response(
            JSON.stringify({ status: "error", error: "DATABASE_URL not set" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const pg = postgres(url, {
          max: 1,
          idle_timeout: 5,
          connect_timeout: 10,
          ssl: "require",
        });

        try {
          const now = new Date();

          // Last cron run
          const lastRunRows = await pg`
            SELECT id, posts_found, posts_processed, posts_succeeded, posts_failed, error, created_at
            FROM cron_runs
            ORDER BY created_at DESC
            LIMIT 1
          `;
          const lastRun = lastRunRows[0] ?? null;

          // Queue depth
          const queueRows = await pg`
            SELECT COUNT(*)::int as cnt FROM scheduled_posts WHERE status = 'pending'
          `;

          const dueRows = await pg`
            SELECT COUNT(*)::int as cnt FROM scheduled_posts
            WHERE status = 'pending' AND due_at <= NOW()
          `;

          let secondsSinceLastRun: number | null = null;
          let status: "healthy" | "degraded" | "critical" | "unknown" = "unknown";
          let lastRunTime: string | null = null;

          if (lastRun) {
            const runTime = new Date(lastRun.created_at as string);
            secondsSinceLastRun = Math.floor(
              (now.getTime() - runTime.getTime()) / 1000,
            );
            lastRunTime = runTime.toISOString();

            if (secondsSinceLastRun < 90) status = "healthy";
            else if (secondsSinceLastRun < 300) status = "degraded";
            else status = "critical";
          }

          return new Response(
            JSON.stringify({
              status,
              seconds_since_last_run: secondsSinceLastRun,
              last_run_time: lastRunTime,
              last_run: lastRun
                ? {
                    id: lastRun.id,
                    posts_found: lastRun.posts_found,
                    posts_processed: lastRun.posts_processed,
                    posts_succeeded: lastRun.posts_succeeded,
                    posts_failed: lastRun.posts_failed,
                    error: lastRun.error ?? null,
                  }
                : null,
              queue: {
                pending: queueRows[0]?.cnt ?? 0,
                due_now: dueRows[0]?.cnt ?? 0,
              },
              timestamp: now.toISOString(),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({
              status: "error",
              error: err.message,
              timestamp: new Date().toISOString(),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        } finally {
          await pg.end();
        }
      },
    },
  },
});
