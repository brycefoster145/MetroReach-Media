/**
 * Cancel Post API Route — POST /api/cancel-post
 *
 * Cancels a pending or failed scheduled post by ID.
 * Sets status to 'cancelled' so it won't be picked up by the scheduler.
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

export const Route = createFileRoute("/api/cancel-post")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { post_id, platform, reason } = body as {
          post_id?: string;
          platform?: string;
          reason?: string;
        };

        // ── Cancel by specific post ID ──
        if (post_id) {
          const existing = await sql`
            SELECT id, platform, status, due_at FROM scheduled_posts
            WHERE id = ${post_id}
            LIMIT 1
          `;

          if (existing.length === 0) {
            return new Response(
              JSON.stringify({ error: "Post not found", post_id }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }

          const post = existing[0];
          if (post.status === "cancelled") {
            return new Response(
              JSON.stringify({
                success: true,
                post_id,
                message: "Post was already cancelled",
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }

          await sql`
            DELETE FROM scheduled_posts
            WHERE id = ${post_id}
          `;

          return new Response(
            JSON.stringify({
              success: true,
              post_id,
              previous_status: post.status,
              platform: post.platform,
              message: `Post ${post_id} cancelled (was ${post.status})`,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── Cancel all pending posts for a platform with no media (bulk cleanup) ──
        if (platform) {
          const result = await sql`
            UPDATE scheduled_posts
            SET status = 'cancelled', posted_at = NOW()
            WHERE platform = ${platform}
              AND status = 'pending'
              AND (media_urls IS NULL OR media_urls = '[]'::jsonb)
            RETURNING id
          `;

          return new Response(
            JSON.stringify({
              success: true,
              platform,
              cancelled_count: result.length,
              cancelled_ids: result.map((r: any) => r.id),
              message: `Cancelled ${result.length} ${platform} posts with no media`,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ error: "Provide post_id or platform" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
