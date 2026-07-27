/**
 * Post-Publish Verifier Cron — GET|POST /api/cron/post-verifier
 *
 * Runs every 5 minutes via Vercel cron.
 * Checks that posts due in the last 10 minutes actually published.
 * Verifies Meta posts against the Graph API.
 * Alerts via Telegram for any failures.
 *
 * MetroReach Media
 */
import { createFileRoute } from "@tanstack/react-router";
import { runPostVerifier } from "~/lib/post-verifier";

export const Route = createFileRoute("/api/cron/post-verifier")({
  server: {
    handlers: {
      GET: async () => {
        console.log("[post-verifier] ⏰ Cron triggered (GET)");
        return handleVerifier();
      },
      POST: async () => {
        console.log("[post-verifier] ⏰ Cron triggered (POST)");
        return handleVerifier();
      },
    },
  },
});

async function handleVerifier(): Promise<Response> {
  try {
    const report = await runPostVerifier();

    console.log(
      `[post-verifier] Checked ${report.checked_count} recent posts: ` +
      `${report.failed_count} failures, ${report.alerts_sent} alerts sent`,
    );

    return new Response(JSON.stringify(report), {
      status: report.failed_count > 0 ? 207 : 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[post-verifier] ❌ Error: ${err.message}`);
    return new Response(
      JSON.stringify({ error: err.message, server_time_utc: new Date().toISOString() }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
