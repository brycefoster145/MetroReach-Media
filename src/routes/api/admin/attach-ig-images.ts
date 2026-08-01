/**
 * Admin endpoint: Attach IG images to Instagram scheduled posts.
 *
 * GET  /api/admin/attach-ig-images  — health check: IG post stats
 * POST /api/admin/attach-ig-images  — attach images to all pending IG posts
 *
 * Auth: x-api-key header (MS_API_KEY)
 *
 * Images are at: https://metroreachagency.com/social/ig-buffer-{01..42}.webp
 * Mapping: IG posts ordered by due_at ASC → image NN (1-indexed, zero-padded).
 */
import { createFileRoute } from "@tanstack/react-router";
import { requireApiKey } from "~/lib/env";
import { sql } from "~/lib/db";

const BASE_URL = "https://metroreachagency.com/social";

function imageUrl(n: number): string {
  return `${BASE_URL}/ig-buffer-${String(n).padStart(2, "0")}.webp`;
}

export const Route = createFileRoute("/api/admin/attach-ig-images")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const unauthorized = requireApiKey(request);
        if (unauthorized) return unauthorized;
        try {
          // Total Instagram posts in queue (any status)
          const totalResult = await sql`
            SELECT COUNT(*)::int AS count
            FROM scheduled_posts
            WHERE platform = 'instagram'
          `;
          const total = (totalResult[0] as any)?.count ?? 0;

          // How many have media_urls populated
          const withMediaResult = await sql`
            SELECT COUNT(*)::int AS count
            FROM scheduled_posts
            WHERE platform = 'instagram'
              AND media_urls IS NOT NULL
              AND media_urls::text <> '[]'
              AND media_urls::text <> ''
          `;
          const withMedia = (withMediaResult[0] as any)?.count ?? 0;

          // How many are pending
          const pendingResult = await sql`
            SELECT COUNT(*)::int AS count
            FROM scheduled_posts
            WHERE platform = 'instagram'
              AND status = 'pending'
          `;
          const pending = (pendingResult[0] as any)?.count ?? 0;

          // How many pending posts are missing images
          const missingResult = await sql`
            SELECT COUNT(*)::int AS count
            FROM scheduled_posts
            WHERE platform = 'instagram'
              AND status = 'pending'
              AND (
                media_urls IS NULL
                OR media_urls::text = '[]'
                OR media_urls::text = ''
              )
          `;
          const missing = (missingResult[0] as any)?.count ?? 0;

          // Pending posts with images already
          const readyResult = await sql`
            SELECT COUNT(*)::int AS count
            FROM scheduled_posts
            WHERE platform = 'instagram'
              AND status = 'pending'
              AND media_urls IS NOT NULL
              AND media_urls::text <> '[]'
              AND media_urls::text <> ''
          `;
          const ready = (readyResult[0] as any)?.count ?? 0;

          return new Response(
            JSON.stringify({
              platform: "instagram",
              total_posts: total,
              pending_posts: pending,
              pending_with_media: ready,
              pending_missing_media: missing,
              with_media_total: withMedia,
              images_available: 42,
              ready_to_attach: missing > 0,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("[attach-ig-images] Health check error:", err.message);
          return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },

      POST: async ({ request }) => {
        const unauthorized = requireApiKey(request);
        if (unauthorized) return unauthorized;
        // ── Auth check ──
        const apiKey = request.headers.get("x-api-key") ?? "";
        const expectedKey = process.env.MS_API_KEY ?? "";
        if (!apiKey || apiKey !== expectedKey) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        const results: Array<{
          id: string;
          due_at: string;
          image: string;
          status: string;
        }> = [];

        try {
          // ── Fetch all pending Instagram posts ordered by due_at ──
          const posts = await sql`
            SELECT id, due_at, content, media_urls
            FROM scheduled_posts
            WHERE platform = 'instagram'
              AND status = 'pending'
              AND (
                media_urls IS NULL
                OR media_urls::text = '[]'
                OR media_urls::text = ''
              )
            ORDER BY due_at ASC
          `;

          console.log(
            `[attach-ig-images] Found ${posts.length} pending IG posts with no media`,
          );

          if (posts.length === 0) {
            return new Response(
              JSON.stringify({
                success: true,
                message: "No pending Instagram posts need image attachment",
                total_found: 0,
                total_updated: 0,
                results: [],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }

          if (posts.length > 42) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Found ${posts.length} IG posts but only 42 images available (ig-buffer-01..42)`,
                total_found: posts.length,
                total_updated: 0,
                results: [],
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // ── Attach images: 1-to-1 sequential mapping ──
          let updated = 0;
          for (let i = 0; i < posts.length; i++) {
            const post = posts[i] as any;
            const imgNum = i + 1; // 1-indexed
            const url = imageUrl(imgNum);
            const mediaUrls = [url];

            try {
              await sql`
                UPDATE scheduled_posts
                SET media_urls = ${JSON.stringify(mediaUrls)}::jsonb
                WHERE id = ${post.id}
              `;

              console.log(
                `[attach-ig-images] ${post.id} → ${url}`,
              );

              results.push({
                id: post.id,
                due_at: (post.due_at as Date).toISOString(),
                image: url,
                status: "updated",
              });
              updated++;
            } catch (updateErr: any) {
              console.error(
                `[attach-ig-images] Failed to update ${post.id}: ${updateErr.message}`,
              );
              results.push({
                id: post.id,
                due_at: (post.due_at as Date).toISOString(),
                image: url,
                status: `error: ${updateErr.message}`,
              });
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              total_found: posts.length,
              total_updated: updated,
              total_errors: posts.length - updated,
              results,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("[attach-ig-images] Error:", err.message);
          return new Response(
            JSON.stringify({
              success: false,
              error: err.message,
              total_found: 0,
              total_updated: 0,
              results,
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
