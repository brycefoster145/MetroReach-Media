/**
 * GET /api/portal/dashboard — Returns dashboard data for authenticated portal client
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/portal/dashboard")({
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
                   pipeline_status, created_at
            FROM clients WHERE id = ${client.sub} LIMIT 1
          `;

          if (clientRows.length === 0) {
            return new Response(
              JSON.stringify({ error: "Client not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }

          const profile = clientRows[0];

          // Fetch content approvals
          const approvals = await sql`
            SELECT id, title, content_type, platform, scheduled_date,
                   status, content_preview, client_notes, team_notes,
                   created_at, updated_at
            FROM content_approvals
            WHERE client_id = ${client.sub}
            ORDER BY created_at DESC
            LIMIT 50
          `;

          // Fetch portal messages
          const messages = await sql`
            SELECT id, sender_type, message, created_at
            FROM portal_messages
            WHERE client_id = ${client.sub}
            ORDER BY created_at ASC
            LIMIT 100
          `;

          // Fetch recent deliverables (for activity feed)
          const deliverables = await sql`
            SELECT id, title, type, status, created_at
            FROM deliverables
            WHERE client_id = ${client.sub}
            ORDER BY created_at DESC
            LIMIT 20
          `;

          // Counts
          const pendingCount = approvals.filter(
            (a: any) => a.status === "pending" || a.status === "changes_requested"
          ).length;

          const serialized = {
            profile: {
              ...profile,
              created_at: String(profile.created_at),
            },
            approvals: approvals.map((a: any) => ({
              ...a,
              created_at: String(a.created_at),
              updated_at: a.updated_at ? String(a.updated_at) : null,
            })),
            messages: messages.map((m: any) => ({
              ...m,
              created_at: String(m.created_at),
            })),
            deliverables: deliverables.map((d: any) => ({
              ...d,
              created_at: String(d.created_at),
            })),
            pendingApprovals: pendingCount,
          };

          return new Response(
            JSON.stringify(serialized),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("Portal dashboard error:", err.message);
          return new Response(
            JSON.stringify({ error: "Failed to load dashboard" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
