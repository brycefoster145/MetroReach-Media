/**
 * POST /api/portal/setup-password — One-time account setup / password reset
 *
 * Client visits /portal?token=XXX (from their invite email or a reset
 * link) and sets a password. The portal_token is consumed — cleared from
 * the clients row — so the link works exactly once. Afterward they log in
 * with email + password via /api/portal/auth.
 *
 * Also serves as the reset mechanism: "Forgot password?" regenerates a
 * portal_token and emails a fresh link, which lands here again.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { checkCsrf } from "~/lib/client-auth";
import { sql } from "~/lib/db";
import { rateLimit, getClientIp } from "~/lib/rate-limit";
import { hashPassword, validatePasswordStrength } from "~/lib/password";

export const Route = createFileRoute("/api/portal/setup-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Rate limit: 5 attempts per IP per minute
          const ip = getClientIp(request);
          const rl = rateLimit(`portal-setup-password:${ip}`, 5, 60_000);
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

          let body: { token?: string; password?: string };
          try {
            body = await request.json();
          } catch {
            return new Response(
              JSON.stringify({ error: "Invalid JSON" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const token = typeof body.token === "string" ? body.token.trim() : "";
          const password = typeof body.password === "string" ? body.password : "";

          if (!token || token.length < 8 || token.length > 128) {
            return new Response(
              JSON.stringify({ error: "Invalid or expired setup link. Please request a new one." }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const strengthError = validatePasswordStrength(password);
          if (strengthError) {
            return new Response(
              JSON.stringify({ error: strengthError }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // Look up client by their one-time portal_token
          const rows = await sql`
            SELECT id, email, name
            FROM clients
            WHERE portal_token = ${token}
            LIMIT 1
          `;

          if (rows.length === 0) {
            return new Response(
              JSON.stringify({ error: "Invalid or expired setup link. Please request a new one." }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const client = rows[0];

          // Hash and save the password, then consume the token so the link
          // can't be replayed. Works whether the client is brand new
          // (account setup) or already has a password (password reset).
          const passwordHash = await hashPassword(password);
          await sql`
            UPDATE clients
            SET password_hash = ${passwordHash},
                portal_token = NULL,
                updated_at = NOW()
            WHERE id = ${client.id}
          `;

          return new Response(
            JSON.stringify({
              success: true,
              message: "Your password has been set. You can now log in with your email and password.",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("[portal setup-password] error:", err);
          return new Response(
            JSON.stringify({ error: "Something went wrong. Please try again." }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
