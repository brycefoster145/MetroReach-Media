/**
 * POST /api/admin/repair-client — repair a client's service mapping and rerun delivery.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { randomBytes } from "node:crypto";
import { getMappingBySlug } from "~/lib/stripe-product-map";

export const Route = createFileRoute("/api/admin/repair-client")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as {
            client_id?: unknown;
            service_slug?: unknown;
          };
          const clientId = typeof body.client_id === "string" ? body.client_id.trim() : "";
          const serviceSlug = typeof body.service_slug === "string" ? body.service_slug.trim() : "";
          if (!clientId || !serviceSlug) {
            return new Response(JSON.stringify({ error: "client_id and service_slug are required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          const mapping = getMappingBySlug(serviceSlug);
          if (!mapping) {
            return new Response(JSON.stringify({ error: "Unknown service_slug" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const rows = await sql`
            UPDATE clients
            SET service_slug = ${serviceSlug}, service = ${mapping.name}, updated_at = NOW()
            WHERE id = ${clientId}
            RETURNING id, email, name, company, service, service_slug, status,
              stripe_customer_id, stripe_subscription_id, pipeline_status, portal_token,
              onboarding_data
          `;
          if (rows.length === 0) {
            return new Response(JSON.stringify({ error: "Client not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          const client = rows[0] as any;
          const jobId = `pipeline-${randomBytes(12).toString("hex")}`;
          await sql`INSERT INTO pipeline_jobs (id, client_id, service_slug, status, payload) VALUES (${jobId}, ${clientId}, ${serviceSlug}, 'pending', ${JSON.stringify({ client_id: clientId })}::jsonb)`;
          return new Response(JSON.stringify({ success: true, client, pipeline_triggered: true, job_id: jobId }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("Admin client repair failed:", err.message);
          return new Response(JSON.stringify({ error: "Failed to repair client", detail: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
