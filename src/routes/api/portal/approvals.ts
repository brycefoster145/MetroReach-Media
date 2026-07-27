/**
 * GET /api/portal/approvals — Fetch content approvals
 * PATCH /api/portal/approvals — Update approval status (approve / request changes)
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest, checkCsrf } from "~/lib/client-auth";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/portal/approvals")({
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

        const approvals = await sql`
          SELECT id, title, content_type, platform, scheduled_date,
                 status, content_preview, client_notes, team_notes,
                 created_at, updated_at
          FROM content_approvals
          WHERE client_id = ${client.sub}
          ORDER BY created_at DESC
          LIMIT 100
        `;

        return new Response(
          JSON.stringify(approvals.map((a: any) => ({
            ...a,
            created_at: String(a.created_at),
            updated_at: a.updated_at ? String(a.updated_at) : null,
          }))),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },

      PATCH: async ({ request }) => {
        // CSRF protection
        if (!checkCsrf(request)) {
          return new Response(
            JSON.stringify({ error: "Invalid request" }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }

        const client = getClientFromRequest(request);
        if (!client) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        let body: { id: string; status: string; notes?: string };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { id, status, notes } = body;
        if (!id || !status) {
          return new Response(
            JSON.stringify({ error: "Approval ID and status are required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const validStatuses = ["approved", "changes_requested"];
        if (!validStatuses.includes(status)) {
          return new Response(
            JSON.stringify({ error: "Invalid status. Use 'approved' or 'changes_requested'" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Validate notes length
        if (notes && notes.length > 2000) {
          return new Response(
            JSON.stringify({ error: "Notes must be under 2000 characters" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Verify the approval belongs to this client
        const existing = await sql`
          SELECT id FROM content_approvals
          WHERE id = ${id} AND client_id = ${client.sub}
          LIMIT 1
        `;

        if (existing.length === 0) {
          return new Response(
            JSON.stringify({ error: "Approval not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        await sql`
          UPDATE content_approvals
          SET status = ${status},
              client_notes = ${notes || ""},
              updated_at = NOW()
          WHERE id = ${id}
        `;

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
