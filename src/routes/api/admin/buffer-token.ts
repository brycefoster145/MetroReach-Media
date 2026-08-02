/**
 * GET /api/admin/buffer-token
 *
 * Returns the agency's Buffer access token for scheduling.
 * Admin-gated — requires MS_API_KEY.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { requireApiKey } from "~/lib/env";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/admin/buffer-token")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const unauthorized = requireApiKey(request);
        if (unauthorized) return unauthorized;

        try {
          const rows = await sql`
            SELECT access_token, token_type, scope, expires_at
            FROM buffer_credentials
            WHERE id = 'default'
          `;
          if (!rows || rows.length === 0) {
            return new Response(JSON.stringify({ error: "No Buffer token stored" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify(rows[0]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
