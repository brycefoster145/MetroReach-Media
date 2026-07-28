/**
 * Post Scheduler — GET|POST /api/cron/post-scheduler
 *
 * Cron fires every ~60s (Vercel cron + self-kicker in vercel-entry.ts).
 * Buffer-style simplicity: publishes whatever is due, in order, no fuss.
 *
 * No time slots. No grace windows. No DB locks. No recovery sweeps.
 * Just: find pending posts whose due_at has passed, and publish them.
 *
 * Self-healing additions:
 *  - Retry: transient failures keep status='pending' up to MAX_RETRIES
 *  - Stale detection: alerts on posts 30+ min past due (dead tokens, API outages)
 *  - Platform dispatch table: clean PUBLISHERS object instead of if/else chain
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { publishPost, NoMediaError } from "~/lib/meta-poster";
import { publishToX } from "~/lib/x-poster";

const MAX_RETRIES = 3;

/** Shape each DB row is normalized into before dispatch. */
interface NormalizedPost {
  id: string;
  platform: string;
  fullText: string;
  mediaUrls: string[];
  page_id: string;
  ig_user_id?: string;
  client_id: string;
  retry_count: number;
}

/**
 * Platform dispatch table.
 * Each publisher receives a NormalizedPost and returns { post_id: string }.
 * Adding a new platform = 3 lines here + the import.
 */
const PUBLISHERS: Record<string, (post: NormalizedPost) => Promise<{ post_id: string }>> = {
  facebook: (post) =>
    publishPost({
      platform: "facebook",
      pageId: post.page_id,
      text: post.fullText,
      mediaUrls: post.mediaUrls.length > 0 ? post.mediaUrls : undefined,
    }),
  instagram: (post) =>
    publishPost({
      platform: "instagram",
      pageId: post.page_id,
      igUserId: post.ig_user_id,
      text: post.fullText,
      mediaUrls: post.mediaUrls.length > 0 ? post.mediaUrls : undefined,
    }),
  x: (post) =>
    publishToX(post.client_id || "metroreach", post.page_id || "", post.fullText),
};

export const Route = createFileRoute("/api/cron/post-scheduler")({
  server: {
    handlers: {
      GET: async () => {
        // ── 1. Find pending posts whose due_at has passed ──
        const rows = await sql`
          SELECT * FROM scheduled_posts
          WHERE status = 'pending'
          AND due_at <= NOW()
          ORDER BY due_at ASC
          LIMIT 5
        `;

        // ── 2. Pre-process into normalized shape ──
        const posts: NormalizedPost[] = rows.map((row: any) => ({
          id: row.id as string,
          platform: (row.platform as string).toLowerCase(),
          fullText: row.hashtags
            ? `${row.content}\n\n${row.hashtags}`
            : (row.content as string),
          mediaUrls: Array.isArray(row.media_urls) ? (row.media_urls as string[]) : [],
          page_id: (row.page_id as string) || "",
          ig_user_id: row.ig_user_id as string | undefined,
          client_id: (row.client_id as string) || "metroreach",
          retry_count: (row.retry_count as number) || 0,
        }));

        const results: Array<{
          id: string;
          platform: string;
          status: string;
          post_id?: string;
          error?: string;
        }> = [];
        let published = 0;
        let failed = 0;
        let retried = 0;

        // ── 3. Publish each one ──
        for (const post of posts) {
          const publisher = PUBLISHERS[post.platform];

          // ── Unsupported platform ──
          if (!publisher) {
            await sql`
              UPDATE scheduled_posts
              SET status = 'failed', error_message = ${`Platform "${post.platform}" not yet supported`}
              WHERE id = ${post.id}
            `;
            failed++;
            results.push({
              id: post.id,
              platform: post.platform,
              status: "failed",
              error: `Platform "${post.platform}" not yet supported`,
            });
            continue;
          }

          // ── Instagram no-media skip (checked BEFORE dispatch) ──
          if (post.platform === "instagram" && post.mediaUrls.length === 0) {
            await sql`
              UPDATE scheduled_posts
              SET status = 'skipped_no_media', error_message = 'No media_urls — needs image generation'
              WHERE id = ${post.id}
            `;
            failed++;
            results.push({
              id: post.id,
              platform: post.platform,
              status: "skipped_no_media",
              error: "No media_urls — needs image generation",
            });
            continue;
          }

          // ── Dispatch ──
          try {
            const result = await publisher(post);
            await sql`
              UPDATE scheduled_posts
              SET status = 'posted', meta_post_id = ${result.post_id}, posted_at = NOW(), retry_count = 0
              WHERE id = ${post.id}
            `;
            published++;
            results.push({
              id: post.id,
              platform: post.platform,
              status: "posted",
              post_id: result.post_id,
            });
          } catch (err: any) {
            const isNoMedia = err instanceof NoMediaError || err?.message?.includes("No media");
            const newRetryCount = post.retry_count + 1;

            if (isNoMedia) {
              // No media — not a transient error, skip forever
              await sql`
                UPDATE scheduled_posts
                SET status = 'skipped_no_media', error_message = ${err.message || String(err)}, retry_count = ${newRetryCount}
                WHERE id = ${post.id}
              `;
              failed++;
              results.push({
                id: post.id,
                platform: post.platform,
                status: "skipped_no_media",
                error: err.message || String(err),
              });
            } else if (newRetryCount < MAX_RETRIES) {
              // Transient failure — keep pending for retry on next cron tick
              await sql`
                UPDATE scheduled_posts
                SET retry_count = ${newRetryCount}, error_message = ${err.message || String(err)}
                WHERE id = ${post.id}
              `;
              retried++;
              results.push({
                id: post.id,
                platform: post.platform,
                status: "pending",
                error: `Retry ${newRetryCount}/${MAX_RETRIES}: ${err.message || String(err)}`,
              });
            } else {
              // Exhausted retries — genuinely broken
              await sql`
                UPDATE scheduled_posts
                SET status = 'failed', error_message = ${err.message || String(err)}, retry_count = ${newRetryCount}
                WHERE id = ${post.id}
              `;
              failed++;
              results.push({
                id: post.id,
                platform: post.platform,
                status: "failed",
                error: err.message || String(err),
              });
            }
          }
        }

        // ── 4. Stale post detection ──
        // Posts that are 30+ min past due and still pending signal deeper issues:
        // expired page tokens, revoked permissions, API outages, etc.
        try {
          const staleRows = await sql`
            SELECT id, platform, due_at FROM scheduled_posts
            WHERE status = 'pending'
            AND due_at < NOW() - INTERVAL '30 minutes'
            ORDER BY due_at ASC
          `;
          if (staleRows.length > 0) {
            const staleIds = staleRows.map((r: any) => `${r.id} (${r.platform}, due ${r.due_at})`);
            console.error(
              `[post-scheduler] ⚠️ STALE POSTS DETECTED: ${staleRows.length} post(s) 30+ min past due and still pending. ` +
                `IDs: [${staleIds.join(", ")}]`,
            );
          }
        } catch (staleErr: any) {
          console.error("[post-scheduler] Stale detection query failed:", staleErr.message);
        }

        return new Response(
          JSON.stringify({ published, failed, retried, results }),
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
