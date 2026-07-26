/**
 * /api/client/leads — Lead tracking API
 *
 * GET    /api/client/leads?client_id=XXX          — List leads for a client
 * POST   /api/client/leads                         — Create a new lead
 * PATCH  /api/client/leads                         — Update lead (mark converted, add notes)
 * DELETE /api/client/leads?id=XXX                  — Delete a lead
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/client/leads")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const clientId = url.searchParams.get("client_id");

        if (!clientId) {
          return new Response(
            JSON.stringify({ error: "client_id is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const leads = await sql`
            SELECT id, client_id, source, lead_name, lead_email, lead_phone,
                   created_at, converted, conversion_value_cents, commission_cents, notes
            FROM client_leads
            WHERE client_id = ${clientId}
            ORDER BY created_at DESC
            LIMIT 200
          `;

          const serialized = leads.map((l: Record<string, unknown>) => ({
            ...l,
            created_at: String(l.created_at),
          }));

          const stats = await sql`
            SELECT
              COUNT(*)::int AS total_leads,
              COUNT(*) FILTER (WHERE converted = true)::int AS converted_leads,
              COALESCE(SUM(conversion_value_cents), 0)::int AS total_value_cents,
              COALESCE(SUM(commission_cents), 0)::int AS total_commission_cents
            FROM client_leads
            WHERE client_id = ${clientId}
          `;

          // Get click stats for this client
          const clientRow = await sql`
            SELECT service_slug FROM clients WHERE id = ${clientId} LIMIT 1
          `;
          let clickStats = { total_clicks: 0 };
          if (clientRow.length > 0) {
            const clicks = await sql`
              SELECT COUNT(*)::int AS total_clicks
              FROM click_tracking
              WHERE client_slug = ${clientRow[0].service_slug}
            `;
            clickStats = clicks[0] as { total_clicks: number };
          }

          return new Response(
            JSON.stringify({
              leads: serialized,
              stats: { ...stats[0], ...clickStats },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("Leads fetch error:", err.message);
          return new Response(
            JSON.stringify({ error: "Failed to load leads" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },

      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { client_id, source, lead_name, lead_email, lead_phone, notes } = body;

        if (!client_id) {
          return new Response(
            JSON.stringify({ error: "client_id is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const id = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        try {
          await sql`
            INSERT INTO client_leads (id, client_id, source, lead_name, lead_email, lead_phone, notes)
            VALUES (${id}, ${client_id}, ${source || ""}, ${lead_name || ""}, ${lead_email || ""}, ${lead_phone || ""}, ${notes || ""})
          `;

          return new Response(
            JSON.stringify({ success: true, id }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("Lead create error:", err.message);
          return new Response(
            JSON.stringify({ error: "Failed to create lead" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },

      PATCH: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { id, converted, conversion_value_cents, notes } = body;

        if (!id) {
          return new Response(
            JSON.stringify({ error: "id is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          if (converted !== undefined) {
            if (converted && conversion_value_cents) {
              const commission = Math.round(conversion_value_cents * 0.5);
              await sql`
                UPDATE client_leads
                SET converted = true,
                    conversion_value_cents = ${conversion_value_cents},
                    commission_cents = ${commission}
                WHERE id = ${id}
              `;
            } else {
              await sql`
                UPDATE client_leads SET converted = ${converted} WHERE id = ${id}
              `;
            }
          }

          if (conversion_value_cents !== undefined && converted === undefined) {
            const commission = Math.round(conversion_value_cents * 0.5);
            await sql`
              UPDATE client_leads
              SET conversion_value_cents = ${conversion_value_cents},
                  commission_cents = ${commission}
              WHERE id = ${id}
            `;
          }

          if (notes !== undefined) {
            await sql`
              UPDATE client_leads SET notes = ${notes} WHERE id = ${id}
            `;
          }

          return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("Lead update error:", err.message);
          return new Response(
            JSON.stringify({ error: "Failed to update lead" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },

      DELETE: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");

        if (!id) {
          return new Response(
            JSON.stringify({ error: "id is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          await sql`DELETE FROM client_leads WHERE id = ${id}`;
          return new Response(
            JSON.stringify({ success: true }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("Lead delete error:", err.message);
          return new Response(
            JSON.stringify({ error: "Failed to delete lead" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
