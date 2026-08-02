/**
 * POST /api/admin/run-vip-tasks — (re)generate VIP Daily tasks for a client.
 *
 * Idempotent: inserts skip rows whose idempotency key already exists, so this
 * endpoint is safe to call after onboarding completes (timezone + client
 * Buffer channels linked) to unblock a previously blocked cycle, or to repair
 * a cycle after a partial failure.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */
import { createFileRoute } from "@tanstack/react-router";
import { requireApiKey } from "~/lib/env";
import { sql } from "~/lib/db";
import { runVipTaskGeneration } from "~/lib/vip-daily";

export const Route = createFileRoute("/api/admin/run-vip-tasks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireApiKey(request);
        if (unauthorized) return unauthorized;
        try {
          const body = (await request.json()) as { client_id?: unknown };
          const clientId = typeof body.client_id === "string" ? body.client_id.trim() : "";
          if (!clientId) {
            return new Response(JSON.stringify({ error: "client_id is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          const rows = await sql`
            SELECT id, email, name, company, service, service_slug, status,
              stripe_customer_id, stripe_subscription_id, pipeline_status,
              portal_token, onboarding_data
            FROM clients WHERE id = ${clientId} LIMIT 1
          `;
          if (!rows.length) {
            return new Response(JSON.stringify({ error: "Client not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          const client = rows[0] as any;
          if (client.service_slug !== "vip-daily") {
            return new Response(
              JSON.stringify({ error: `Client ${clientId} is not a VIP Daily client (service_slug=${client.service_slug})` }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
          const summary = await runVipTaskGeneration(client);
          return new Response(JSON.stringify({ success: true, ...summary }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("Admin VIP task generation failed:", err.message);
          return new Response(JSON.stringify({ error: "Failed to generate VIP tasks", detail: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
