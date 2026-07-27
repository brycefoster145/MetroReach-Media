/**
 * GET /api/client/verify — Validate magic link token, set cookie, redirect to dashboard
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { verifyClientToken, setTokenCookie } from "~/lib/client-auth";

export const Route = createFileRoute("/api/client/verify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");

        if (!token) {
          return new Response(
            JSON.stringify({ error: "Missing token" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const payload = verifyClientToken(token);
        if (!payload) {
          // Token invalid or expired — redirect to login with error
          const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "https://metroreachagency.com";
          return new Response(null, {
            status: 302,
            headers: {
              Location: `${baseUrl}/client?error=expired`,
            },
          });
        }

        // Valid token — set cookie and redirect to dashboard
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "https://metroreachagency.com";

        return new Response(null, {
          status: 302,
          headers: {
            "Set-Cookie": setTokenCookie(token),
            Location: `${baseUrl}/client/dashboard`,
          },
        });
      },
    },
  },
});
