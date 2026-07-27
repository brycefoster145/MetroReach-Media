/**
 * Buffer Watchdog Cron — GET|POST /api/cron/buffer-watchdog
 *
 * Runs every hour at :05 via Vercel cron.
 * Checks how many days of pending posts remain per platform.
 * Alerts via Telegram when buffer drops below thresholds.
 *
 * MetroReach Media
 */
import { createFileRoute } from "@tanstack/react-router";
import { runBufferWatchdog } from "~/lib/buffer-watchdog";

export const Route = createFileRoute("/api/cron/buffer-watchdog")({
  server: {
    handlers: {
      GET: async () => {
        console.log("[buffer-watchdog] ⏰ Cron triggered (GET)");
        return handleWatchdog();
      },
      POST: async () => {
        console.log("[buffer-watchdog] ⏰ Cron triggered (POST)");
        return handleWatchdog();
      },
    },
  },
});

async function handleWatchdog(): Promise<Response> {
  try {
    const report = await runBufferWatchdog();

    const warningCount = report.platforms.filter((p) => p.level === "warning").length;
    const urgentCount = report.platforms.filter((p) => p.level === "urgent").length;

    console.log(
      `[buffer-watchdog] Checked ${report.platforms.length} platforms: ` +
      `${urgentCount} urgent, ${warningCount} warning, ${report.alerts_sent} alerts sent`,
    );

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[buffer-watchdog] ❌ Error: ${err.message}`);
    return new Response(
      JSON.stringify({ error: err.message, server_time_utc: new Date().toISOString() }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
