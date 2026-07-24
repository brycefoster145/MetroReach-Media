/**
 * GET /api/client/dashboard — Returns all dashboard data for authenticated client
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/client/dashboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const client = getClientFromRequest(request);
        if (!client) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          // Fetch client profile
          const clientRows = await sql`
            SELECT id, email, name, company, service, service_slug, status,
                   pipeline_status, onboarding_data, stripe_customer_id,
                   stripe_subscription_id, created_at, updated_at
            FROM clients WHERE id = ${client.sub} LIMIT 1
          `;

          if (clientRows.length === 0) {
            return new Response(
              JSON.stringify({ error: "Client not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }

          const profile = clientRows[0];

          // Fetch deliverables
          const deliverables = await sql`
            SELECT id, title, type, status, file_url, notes, created_at
            FROM deliverables
            WHERE client_id = ${client.sub}
            ORDER BY created_at DESC
          `;

          // Fetch messages
          const messages = await sql`
            SELECT id, direction, message, created_at
            FROM client_messages
            WHERE client_id = ${client.sub}
            ORDER BY created_at ASC
            LIMIT 100
          `;

          // Fetch pipeline progress
          const pipelineLog = await sql`
            SELECT step_key, status, deliverables, created_at, updated_at
            FROM pipeline_log
            WHERE client_id = ${client.sub}
            ORDER BY created_at ASC
          `;

          // Serialize dates
          const serialized = {
            profile: {
              ...profile,
              created_at: String(profile.created_at),
              updated_at: String(profile.updated_at),
              onboarding_data: profile.onboarding_data || null,
            },
            deliverables: deliverables.map((d: Record<string, unknown>) => ({
              ...d,
              created_at: String(d.created_at),
            })),
            messages: messages.map((m: Record<string, unknown>) => ({
              ...m,
              created_at: String(m.created_at),
            })),
            pipeline: pipelineLog.map((p: Record<string, unknown>) => ({
              ...p,
              created_at: String(p.created_at),
              updated_at: String(p.updated_at),
              deliverables: p.deliverables || null,
            })),
          };

          return new Response(
            JSON.stringify(serialized),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("Dashboard fetch error:", err.message);
          return new Response(
            JSON.stringify({ error: "Failed to load dashboard" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
