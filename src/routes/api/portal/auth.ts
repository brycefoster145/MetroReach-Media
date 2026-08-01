/**
 * POST /api/portal/auth — Portal email + password authentication
 *
 * Client submits their email and password. Looks up the client by email,
 * verifies the password hash, sets the JWT cookie, and returns client
 * info for the dashboard.
 *
 * Failure responses never reveal whether the email exists or the password
 * was wrong — always "Invalid email or password".
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { createClientToken, setTokenCookie, checkCsrf } from "~/lib/client-auth";
import { sql } from "~/lib/db";
import { rateLimit, getClientIp } from "~/lib/rate-limit";
import { verifyPassword } from "~/lib/password";

const INVALID_CREDENTIALS = JSON.stringify({
  error: "Invalid email or password.",
});

export const Route = createFileRoute("/api/portal/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Rate limit: 5 attempts per IP per minute
          const ip = getClientIp(request);
          const ipRl = rateLimit(`portal-auth:${ip}`, 5, 60_000);
          if (!ipRl.allowed) {
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

          let body: { email?: string; password?: string };
          try {
            body = await request.json();
          } catch {
            return new Response(
              JSON.stringify({ error: "Invalid JSON" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const email =
            typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
          const password = typeof body.password === "string" ? body.password : "";

          if (!email || !email.includes("@") || email.length > 254 || !password || password.length > 128) {
            return new Response(INVALID_CREDENTIALS, {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Rate limit: 5 attempts per email per minute (on top of the IP limit)
          const emailRl = rateLimit(`portal-auth:${email}`, 5, 60_000);
          if (!emailRl.allowed) {
            return new Response(
              JSON.stringify({ error: "Too many attempts. Please wait before trying again." }),
              { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } },
            );
          }

          // Look up client by email
          const rows = await sql`
            SELECT id, email, name, company, service, password_hash
            FROM clients
            WHERE email = ${email}
            LIMIT 1
          `;

          if (rows.length === 0) {
            return new Response(INVALID_CREDENTIALS, {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const client = rows[0];

          // No password set yet (account not set up) — same generic error,
          // never reveal which part of the credentials was wrong.
          const passwordHash = client.password_hash as string | null;
          if (!passwordHash) {
            return new Response(INVALID_CREDENTIALS, {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const valid = await verifyPassword(password, passwordHash);
          if (!valid) {
            return new Response(INVALID_CREDENTIALS, {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

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
        } catch (err) {
          console.error("[portal auth] error:", err);
          return new Response(
            JSON.stringify({ error: "Something went wrong. Please try again." }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
