/**
 * /api/admin/leads-overview — Admin: all clients with lead stats
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/admin/leads-overview")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Get all clients
          const clients = await sql`
            SELECT id, name, company, service, service_slug, status, landing_url, created_at
            FROM clients
            ORDER BY created_at DESC
          `;

          // Get lead stats per client
          const clientIds = clients.map((c: Record<string, unknown>) => c.id as string);

          const results = [];
          for (const client of clients) {
            const c = client as Record<string, unknown>;
            const cid = c.id as string;

            // Lead stats
            const leadStats = await sql`
              SELECT
                COUNT(*)::int AS total_leads,
                COUNT(*) FILTER (WHERE converted = true)::int AS converted_leads,
                COALESCE(SUM(conversion_value_cents), 0)::int AS total_value_cents,
                COALESCE(SUM(commission_cents), 0)::int AS total_commission_cents
              FROM client_leads
              WHERE client_id = ${cid}
            `;

            // Click stats
            const clickStats = await sql`
              SELECT COUNT(*)::int AS total_clicks
              FROM click_tracking
              WHERE client_slug = ${c.service_slug || cid}
            `;

            results.push({
              id: cid,
              name: c.name,
              company: c.company,
              service: c.service,
              service_slug: c.service_slug,
              status: c.status,
              landing_url: c.landing_url,
              created_at: String(c.created_at),
              ...leadStats[0],
              ...clickStats[0],
            });
          }

          return new Response(
            JSON.stringify(results),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("Admin leads overview error:", err.message);
          return new Response(
            JSON.stringify({ error: "Failed to load overview" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
