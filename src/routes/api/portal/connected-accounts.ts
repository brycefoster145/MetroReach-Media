/**
 * GET /api/portal/connected-accounts
 *
 * Returns all connected social media accounts for the authenticated client.
 * Used by /portal/connect to display connection status.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/portal/connected-accounts")({
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
          const rows = await sql`
            SELECT platform, page_id, account_name, created_at
            FROM client_platform_tokens
            WHERE client_id = ${client.sub}
            ORDER BY created_at DESC
          `;

          // Determine if each page is Facebook or Instagram
          const accounts = rows.map((r: any) => ({
            platform: r.page_id && r.page_id.length > 20 ? "instagram" : "facebook",
            page_id: r.page_id,
            account_name: r.account_name,
            created_at: String(r.created_at),
          }));

          return new Response(
            JSON.stringify({ accounts }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("Connected accounts error:", err.message);
          return new Response(
            JSON.stringify({ error: "Failed to load connected accounts" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
