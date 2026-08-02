/**
 * GET/POST /api/cron/vip-queue-monitor — VIP Daily queue health check.
 *
 * Checks every planned/active VIP cycle's client Buffer channels and alerts
 * (Telegram) when the furthest scheduled post is ≤7 days out — or when nothing
 * is scheduled at all. Per-cycle dedupe (queue_alerted_at) prevents alert spam.
 *
 * Pipeline rule this enforces: never let a content queue drop to one week or
 * less without creating the next batch.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */
import { createFileRoute } from "@tanstack/react-router";
import { checkVipQueueHealth } from "~/lib/vip-daily";

export const Route = createFileRoute("/api/cron/vip-queue-monitor")({
  server: {
    handlers: {
      GET: async () => runMonitor(),
      POST: async () => runMonitor(),
    },
  },
});

async function runMonitor() {
  try {
    const result = await checkVipQueueHealth();
    return new Response(
      JSON.stringify({
        ok: result.ok,
        checked_cycles: result.checked,
        alerts: result.alerts,
        checked_at: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    // Cron endpoints return 200 with an error field so monitors don't
    // false-alert on transient failures (see engineering convention).
    return new Response(
      JSON.stringify({ ok: false, error: String(err?.message ?? err), checked_at: new Date().toISOString() }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
}
