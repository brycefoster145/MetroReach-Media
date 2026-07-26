/**
 * GET /go/:client/:postId — Click tracking redirect
 *
 * Records the click in click_tracking, then redirects to client's landing page.
 * Accepts ?ref= for UTM-style campaign tracking.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/go/$client/$postId")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const pathParts = url.pathname.replace(/^\/go\//, "").split("/");
        const clientSlug = pathParts[0] || "unknown";
        const postSlug = pathParts[1] || "unknown";
        const ref = url.searchParams.get("ref") || "";

        // Record the click
        try {
          await sql`
            INSERT INTO click_tracking (client_slug, post_slug, ref, ip, user_agent)
            VALUES (
              ${clientSlug},
              ${postSlug},
              ${ref},
              ${request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || ""},
              ${request.headers.get("user-agent") || ""}
            )
          `;
        } catch (err: any) {
          console.error("Click tracking error:", err.message);
        }

        // Look up client landing_url
        let landingUrl = "https://metroreachagency.com";
        try {
          const rows = await sql`
            SELECT landing_url FROM clients
            WHERE service_slug = ${clientSlug} OR id = ${clientSlug}
            LIMIT 1
          `;
          if (rows.length > 0 && rows[0].landing_url) {
            landingUrl = rows[0].landing_url;
          }
        } catch (err: any) {
          console.error("Client lookup error:", err.message);
        }

        return new Response(null, {
          status: 302,
          headers: { Location: landingUrl },
        });
      },
    },
  },
});
