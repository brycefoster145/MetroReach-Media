/**
 * Admin endpoint: Update media_urls for a single scheduled post.
 *
 * POST /api/admin/update-post-media
 * Body: { "post_id": "post-871a070552d9a07a", "media_urls": ["https://..."] }
 *
 * Auth: x-api-key header (MS_API_KEY)
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/admin/update-post-media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Auth check ──
        const apiKey = request.headers.get("x-api-key") ?? "";
        const expectedKey = process.env.MS_API_KEY ?? "";
        if (!apiKey || apiKey !== expectedKey) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── Parse body ──
        let body: { post_id?: string; media_urls?: string[] };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { post_id, media_urls } = body;

        if (!post_id || typeof post_id !== "string") {
          return new Response(
            JSON.stringify({ error: "Missing or invalid post_id" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (!Array.isArray(media_urls) || media_urls.length === 0) {
          return new Response(
            JSON.stringify({ error: "Missing or invalid media_urls (must be non-empty array of strings)" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          // ── Update the post ──
          const result = await sql`
            UPDATE scheduled_posts
            SET media_urls = ${JSON.stringify(media_urls)}::jsonb
            WHERE id = ${post_id}
            RETURNING id, media_urls
          `;

          if (result.length === 0) {
            return new Response(
              JSON.stringify({ error: "Post not found", id: post_id }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }

          const row = result[0] as any;
          console.log(`[update-post-media] Updated ${post_id} → ${JSON.stringify(media_urls)}`);

          return new Response(
            JSON.stringify({
              success: true,
              id: row.id,
              media_urls: row.media_urls,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("[update-post-media] DB error:", err.message);
          return new Response(
            JSON.stringify({ error: err.message, id: post_id }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
