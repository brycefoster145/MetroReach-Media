/**
 * Watchdog Status Endpoint — GET /api/watchdog/status
 *
 * Returns a comprehensive JSON health report of the posting infrastructure.
 *
 * Accepts query params:
 * - ?mode=light   — lightweight, no Meta API calls (cron health + post success only)
 * - ?mode=window  — pre-window check (Meta token + IG post readiness)
 * - ?mode=full    — [default] all checks including Meta API validation
 */

import { createFileRoute } from "@tanstack/react-router";
import {
  runWatchdogChecks,
  runPreWindowCheck,
  checkCronHealth,
  checkPostSuccess,
  checkMissedSlots,
} from "~/lib/watchdog";

export const Route = createFileRoute("/api/watchdog/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("mode") ?? "full";

        try {
          // ── Light mode: no Meta API calls ──
          if (mode === "light") {
            const [cronHealth, postSuccess, missedSlots] = await Promise.all([
              checkCronHealth(),
              checkPostSuccess(),
              checkMissedSlots(),
            ]);

            const report = {
              status: cronHealth.ok && postSuccess.ok && missedSlots.ok ? "ok" : "degraded",
              server_time_utc: new Date().toISOString(),
              cron_health: cronHealth,
              post_success_24h: postSuccess,
              missed_slots: missedSlots,
            };

            return new Response(JSON.stringify(report, null, 2), {
              status: report.status === "ok" ? 200 : 500,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store",
              },
            });
          }

          // ── Pre-window mode: Meta token + IG readiness ──
          if (mode === "window") {
            const result = await runPreWindowCheck();
            return new Response(JSON.stringify(result, null, 2), {
              status: result.alerts.some((a) => a.severity === "critical") ? 500 : 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store",
              },
            });
          }

          // ── Full mode: all checks ──
          const report = await runWatchdogChecks();

          const statusCode =
            report.status === "critical" ? 500 : 200;

          return new Response(JSON.stringify(report, null, 2), {
            status: statusCode,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-store",
            },
          });
        } catch (err: any) {
          console.error("[watchdog/status] Error:", err.message);
          return new Response(
            JSON.stringify({
              status: "error",
              error: err.message,
              server_time_utc: new Date().toISOString(),
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }
      },
    },
  },
});
