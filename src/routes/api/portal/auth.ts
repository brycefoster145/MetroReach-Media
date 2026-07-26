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
import { createClientToken, setTokenCookie, checkCsrf } from "~/lib/client-auth";
import { sql } from "~/lib/db";
import { rateLimit, getClientIp } from "~/lib/rate-limit";

export const Route = createFileRoute("/api/portal/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Rate limit: 5 attempts per IP per minute
        const ip = getClientIp(request);
        const rl = rateLimit(`portal-auth:${ip}`, 5, 60_000);
        if (!rl.allowed) {
          return new Response(
            JSON.stringify({ error: "Too many attempts. Please wait before trying again." }),
            { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } },
          );
        }

        // CSRF protection
        if (!checkCsrf(request)) {
          return new Response(
            JSON.stringify({ error: "Invalid request" }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }

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
        if (!token || typeof token !== "string" || token.length < 8 || token.length > 128) {
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
