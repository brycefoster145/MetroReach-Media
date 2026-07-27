/**
 * TEMPORARY — GET /api/admin/x-user-id
 *
 * Returns the X (Twitter) user ID for the metroreach client.
 * Will be deleted after one use.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/admin/x-user-id")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const rows = await sql`
            SELECT page_id
            FROM client_platform_tokens
            WHERE client_id = 'metroreach'
              AND platform = 'x'
            ORDER BY created_at DESC
            LIMIT 1
          `;

          if (rows.length === 0) {
            return new Response(
              JSON.stringify({ error: "No X account found for metroreach" }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({ page_id: rows[0].page_id }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("x-user-id endpoint error:", err.message);
          return new Response(
            JSON.stringify({ error: "Failed to retrieve X user ID" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
