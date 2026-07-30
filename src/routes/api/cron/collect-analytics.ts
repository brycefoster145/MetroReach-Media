/**
 * Analytics Collection Cron Endpoint — POST /api/cron/collect-analytics
 *
 * Vercel cron endpoint that triggers the analytics data collection pipeline.
 * Pulls post-level insights from Meta Graph API and computes daily KPI snapshots.
 *
 * Protected by CRON_SECRET header check.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { collectAnalytics } from "~/lib/analytics-collector";

export const Route = createFileRoute("/api/cron/collect-analytics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Auth check ──
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
          const authHeader = request.headers.get("authorization") ?? "";
          const expected = `Bearer ${cronSecret}`;
          if (authHeader !== expected) {
            return new Response(
              JSON.stringify({ error: "Unauthorized — invalid or missing CRON_SECRET" }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }
        }

        // ── Optionally accept a client_id to scope the run ──
        let clientId: string | undefined;
        try {
          const body = await request.json().catch(() => null);
          if (body && typeof body.client_id === "string") {
            clientId = body.client_id;
          }
        } catch {
          // No body or invalid JSON — collect for all clients
        }

        // ── Run collection ──
        try {
          const result = await collectAnalytics(clientId);

          const statusCode = result.errors.length > 0 ? 207 : 200;

          return new Response(
            JSON.stringify({
              clients_processed: result.clients_processed,
              posts_checked: result.posts_checked,
              posts_updated: result.posts_updated,
              posts_skipped: result.posts_skipped,
              snapshots_created: result.snapshots_created,
              errors: result.errors,
            }),
            { status: statusCode, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("Analytics collection failed:", err.message);
          return new Response(
            JSON.stringify({
              error: "Analytics collection failed",
              detail: err.message,
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },

      // GET for health check / manual browser testing
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: "ok",
            endpoint: "/api/cron/collect-analytics",
            method: "POST",
            description: "Triggers analytics collection from Meta Graph API",
            protected: !!process.env.CRON_SECRET,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
