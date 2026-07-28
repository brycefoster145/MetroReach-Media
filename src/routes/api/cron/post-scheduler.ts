/**
 * Post Scheduler — GET|POST /api/cron/post-scheduler
 *
 * Cron fires every ~60s (Vercel cron + self-kicker in vercel-entry.ts).
 * Buffer-style simplicity: publishes whatever is due, in order, no fuss.
 *
 * No time slots. No grace windows. No DB locks. No recovery sweeps.
 * Just: find pending posts whose due_at has passed, and publish them.
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { publishPost, NoMediaError } from "~/lib/meta-poster";
import { publishToX } from "~/lib/x-poster";

export const Route = createFileRoute("/api/cron/post-scheduler")({
  server: {
    handlers: {
      GET: async () => {
        // 1. Find pending posts whose due_at has passed
        const posts = await sql`
          SELECT * FROM scheduled_posts
          WHERE status = 'pending'
          AND due_at <= NOW()
          ORDER BY due_at ASC
          LIMIT 5
        `;

        const results: Array<{
          id: string;
          platform: string;
          status: string;
          post_id?: string;
          error?: string;
        }> = [];
        let published = 0;
        let failed = 0;

        // 2. Publish each one
        for (const post of posts) {
          try {
            const platform = post.platform as string;
            const postId = post.id as string;

            // Build full text: content + hashtags
            const fullText = post.hashtags
              ? `${post.content}\n\n${post.hashtags}`
              : (post.content as string);

            // Parse media_urls from JSONB
            const mediaUrls: string[] = Array.isArray(post.media_urls)
              ? (post.media_urls as string[])
              : [];

            if (platform === "x" || platform === "twitter") {
              // ── X (Twitter) ──
              const xUserId = (post.page_id as string) || "";
              const xResult = await publishToX(
                (post.client_id as string) || "metroreach",
                xUserId,
                fullText,
              );
              await sql`
                UPDATE scheduled_posts
                SET status = 'posted', meta_post_id = ${xResult.post_id}, posted_at = NOW()
                WHERE id = ${postId}
              `;
              published++;
              results.push({
                id: postId,
                platform,
                status: "posted",
                post_id: xResult.post_id,
              });
            } else if (platform === "facebook" || platform === "instagram") {
              // ── Meta (Facebook / Instagram) ──
              // Skip Instagram posts without media — they'll fail at the API level
              if (platform === "instagram" && mediaUrls.length === 0) {
                await sql`
                  UPDATE scheduled_posts
                  SET status = 'skipped_no_media', error_message = 'No media_urls — needs image generation'
                  WHERE id = ${postId}
                `;
                failed++;
                results.push({
                  id: postId,
                  platform,
                  status: "skipped_no_media",
                  error: "No media_urls — needs image generation",
                });
                continue;
              }

              const result = await publishPost({
                platform: platform as "facebook" | "instagram",
                pageId: (post.page_id as string) || "",
                igUserId: (post.ig_user_id as string) || undefined,
                text: fullText,
                mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
              });
              await sql`
                UPDATE scheduled_posts
                SET status = 'posted', meta_post_id = ${result.post_id}, posted_at = NOW()
                WHERE id = ${postId}
              `;
              published++;
              results.push({
                id: postId,
                platform,
                status: "posted",
                post_id: result.post_id,
              });
            } else {
              // ── Unsupported platform (LinkedIn, TikTok, Google — not yet live) ──
              await sql`
                UPDATE scheduled_posts
                SET status = 'failed', error_message = ${`Platform "${platform}" not yet supported`}
                WHERE id = ${postId}
              `;
              failed++;
              results.push({
                id: postId,
                platform,
                status: "failed",
                error: `Platform "${platform}" not yet supported`,
              });
            }
          } catch (err: any) {
            const isNoMedia = err instanceof NoMediaError || err?.message?.includes("No media");
            const newStatus = isNoMedia ? "skipped_no_media" : "failed";
            await sql`
              UPDATE scheduled_posts
              SET status = ${newStatus}, error_message = ${err.message || String(err)}
              WHERE id = ${post.id}
            `;
            failed++;
            results.push({
              id: post.id as string,
              platform: post.platform as string,
              status: newStatus,
              error: err.message || String(err),
            });
          }
        }

        return new Response(
          JSON.stringify({ published, failed, results }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
      POST: async () => {
        // POST also works for manual triggers — delegates to GET logic
        return Route.server.handlers.GET();
      },
    },
  },
});
