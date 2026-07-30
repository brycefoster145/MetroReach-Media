/**
 * GET /api/portal/messages — Fetch messages for authenticated client
 * POST /api/portal/messages — Send a new message from client
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest, generateId, checkCsrf } from "~/lib/client-auth";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/portal/messages")({
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

        const messages = await sql`
          SELECT id, sender_type, message, created_at
          FROM portal_messages
          WHERE client_id = ${client.sub}
          ORDER BY created_at ASC
          LIMIT 200
        `;

        return new Response(
          JSON.stringify(messages.map((m: any) => ({
            ...m,
            created_at: String(m.created_at),
          }))),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },

      POST: async ({ request }) => {
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

        let body: { message: string };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { message } = body;
        if (!message || typeof message !== "string" || !message.trim()) {
          return new Response(
            JSON.stringify({ error: "Message is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        if (message.length > 5000) {
          return new Response(
            JSON.stringify({ error: "Message must be under 5000 characters" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const id = generateId("msg");
        await sql`
          INSERT INTO portal_messages (id, client_id, sender_type, message)
          VALUES (${id}, ${client.sub}, 'client', ${message.trim()})
        `;

        return new Response(
          JSON.stringify({ success: true, id }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
