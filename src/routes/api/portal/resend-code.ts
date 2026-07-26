/**
 * POST /api/portal/resend-code — Resend invite code to client email
 *
 * Client enters their email address. If found, a new portal_token is
 * generated and returned. In production, this would be emailed.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { checkCsrf } from "~/lib/client-auth";
import { sql } from "~/lib/db";
import { rateLimit, getClientIp } from "~/lib/rate-limit";
import { randomBytes } from "node:crypto";

export const Route = createFileRoute("/api/portal/resend-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Rate limit: 3 attempts per IP per 5 minutes
        const ip = getClientIp(request);
        const rl = rateLimit(`resend-code:${ip}`, 3, 300_000);
        if (!rl.allowed) {
          return new Response(
            JSON.stringify({ error: "Too many attempts. Please wait before trying again." }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          );
        }

        // CSRF protection
        if (!checkCsrf(request)) {
          return new Response(
            JSON.stringify({ error: "Invalid request" }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }

        let body: { email: string };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { email } = body;
        if (!email || typeof email !== "string" || !email.includes("@") || email.length > 254) {
          return new Response(
            JSON.stringify({ error: "Please provide a valid email address." }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Look up client by email
        const rows = await sql`
          SELECT id, email, name FROM clients
          WHERE email = ${email.trim().toLowerCase()}
          LIMIT 1
        `;

        if (rows.length === 0) {
          return new Response(
            JSON.stringify({ error: "No account found with that email address." }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        const client = rows[0];

        // Generate new portal token
        const newToken = `mr-${randomBytes(16).toString("hex")}`;

        await sql`
          UPDATE clients
          SET portal_token = ${newToken}, updated_at = NOW()
          WHERE id = ${client.id}
        `;

        // In production, email the token. For now, return it in the response.
        return new Response(
          JSON.stringify({
            success: true,
            message: "Your invite code has been regenerated.",
            inviteCode: newToken,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  },
});
