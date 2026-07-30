/**
 * POST /api/portal/logout — Clear client portal auth cookie
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { clearTokenCookie, checkCsrf } from "~/lib/client-auth";

export const Route = createFileRoute("/api/portal/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // CSRF protection
        if (!checkCsrf(request)) {
          return new Response(
            JSON.stringify({ error: "Invalid request" }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": clearTokenCookie(),
            },
          },
        );
      },
    },
  },
});
