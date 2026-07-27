/**
 * GET /go/:clientSlug/:postId — Click tracking redirect
 * MetroReach Media
 *
 * Server-side GET handler:
 * 1. Looks up the post in scheduled_posts by matching clientSlug → client → postId
 * 2. Logs the click in click_tracking with IP, user agent, and ref
 * 3. 302 redirects to the post's utm_link (if set), or falls back to
 *    https://metroreachagency.com with UTM params appended
 *
 * Query params:
 *   ?ref=   — campaign reference (stored in click_tracking.ref)
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { getSiteUrl } from "~/lib/site-url";

export const Route = createFileRoute("/go/$clientSlug/$postId")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);

        // Extract path segments: /go/{clientSlug}/{postId}
        const pathParts = url.pathname.replace(/^\/go\//, "").split("/");
        const clientSlug = pathParts[0] || "unknown";
        const postId = pathParts[1] || "unknown";
        const ref = url.searchParams.get("ref") || "";

        const ip =
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "";
        const userAgent = request.headers.get("user-agent") || "";

        // ── 1. Record the click ──
        try {
          await sql`INSERT INTO click_tracking (client_slug, post_slug, ref, ip, user_agent)
            VALUES (${clientSlug}, ${postId}, ${ref}, ${ip}, ${userAgent})`;
        } catch (err: any) {
          console.error("[go] Click tracking insert error:", err.message);
        }

        // ── 2. Look up the scheduled post for utm_link ──
        let redirectUrl = getSiteUrl() + "?utm_source=direct&utm_medium=social&utm_campaign=" + encodeURIComponent(clientSlug) + "&utm_content=" + encodeURIComponent(postId);

        try {
          // Find the client ID from the slug
          const clientRows = await sql`SELECT id, service_slug FROM clients
            WHERE service_slug = ${clientSlug} OR id = ${clientSlug}
            LIMIT 1`;

          if (clientRows.length > 0) {
            const clientId = clientRows[0].id as string;

            // Look up the post
            const postRows = await sql`SELECT utm_link, platform FROM scheduled_posts
              WHERE client_id = ${clientId}
                AND id = ${postId}
              LIMIT 1`;

            if (postRows.length > 0 && postRows[0].utm_link) {
              redirectUrl = postRows[0].utm_link as string;
            }
          }
        } catch (err: any) {
          console.error("[go] Post lookup error:", err.message);
        }

        return new Response(null, {
          status: 302,
          headers: { Location: redirectUrl },
        });
      },
    },
  },
});
