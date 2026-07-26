/**
 * POST /api/portal/auth — Portal invite-code authentication
 *
 * Client submits their invite token (portal_token).
 * Validates against the clients table, sets a JWT cookie,
 * returns client info for the dashboard.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { createClientToken, setTokenCookie } from "~/lib/client-auth";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/portal/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { token: string };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { token } = body;
        if (!token || typeof token !== "string" || token.length < 8) {
          return new Response(
            JSON.stringify({ error: "Invalid invite code" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Look up client by portal_token
        const rows = await sql`
          SELECT id, email, name, company, service, status
          FROM clients
          WHERE portal_token = ${token.trim()}
          LIMIT 1
        `;

        if (rows.length === 0) {
          return new Response(
            JSON.stringify({ error: "Invalid invite code. Please check and try again." }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        const client = rows[0];
        const jwt = createClientToken(client.id as string, client.email as string);

        return new Response(
          JSON.stringify({
            success: true,
            client: {
              id: client.id,
              name: client.name,
              company: client.company,
              service: client.service,
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": setTokenCookie(jwt),
            },
          },
        );
      },
    },
  },
});
