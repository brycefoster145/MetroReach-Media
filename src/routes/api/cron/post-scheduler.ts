/**
 * Post Scheduler — GET|POST /api/cron/post-scheduler
 *
 * Cron fires every ~60s. Picks up posts where due_at <= NOW(),
 * publishes them via the platform dispatch table, marks posted or failed.
 * Retries transient failures up to 3 times.
 *
 * That's it. No stale detection. No watchdog. No Telegram alerts.
 * No auto-reset. No kill switch. No mass-posting guard.
 *
 * If a post misses its slot, it publishes next tick. If it breaks, it fails.
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { publishPost, NoMediaError } from "~/lib/meta-poster";
import { publishToX } from "~/lib/x-poster";
import { publishToLinkedIn } from "~/lib/linkedin-poster";

const MAX_RETRIES = 3;

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

class NotConnectedError extends Error {
  constructor(platform: string) {
    super(`Platform "${platform}" not yet connected — awaiting OAuth credentials`);
    this.name = "NotConnectedError";
  }
}

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
  linkedin: (post) =>
    publishToLinkedIn(post.client_id || "metroreach", post.fullText),
  tiktok: () => { throw new NotConnectedError("tiktok"); },
  google: () => { throw new NotConnectedError("google"); },
  youtube: () => { throw new NotConnectedError("youtube"); },
};

export const Route = createFileRoute("/api/cron/post-scheduler")({
  server: {
    handlers: {
      GET: async () => {
        const handlerStartTime = Date.now();

        try {
          // ── 1. Atomic claim ──
          const rows = await sql`
            UPDATE scheduled_posts
            SET status = 'publishing', locked_at = NOW()
            WHERE id IN (
              SELECT id FROM scheduled_posts
              WHERE status = 'pending'
              AND due_at <= NOW()
              ORDER BY due_at ASC
              LIMIT 5
            )
            AND status = 'pending'
            RETURNING *
          `;

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

          // ── 2. Publish each claimed post ──
          for (const post of posts) {
            const publisher = PUBLISHERS[post.platform];

            if (!publisher) {
              await sql`
                UPDATE scheduled_posts
                SET status = 'failed', error_message = ${`Platform "${post.platform}" not supported`}
                WHERE id = ${post.id}
              `;
              failed++;
              results.push({
                id: post.id,
                platform: post.platform,
                status: "failed",
                error: `Platform "${post.platform}" not supported`,
              });
              continue;
            }

            if (post.platform === "instagram" && post.mediaUrls.length === 0) {
              await sql`
                UPDATE scheduled_posts
                SET status = 'skipped_no_media', error_message = 'No media_urls'
                WHERE id = ${post.id}
              `;
              failed++;
              results.push({
                id: post.id,
                platform: post.platform,
                status: "skipped_no_media",
                error: "No media_urls",
              });
              continue;
            }

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
              const isNotConnected = err instanceof NotConnectedError;
              const newRetryCount = post.retry_count + 1;

              if (isNoMedia) {
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
              } else if (isNotConnected) {
                await sql`
                  UPDATE scheduled_posts
                  SET status = 'awaiting_credentials', error_message = ${err.message || String(err)}
                  WHERE id = ${post.id}
                `;
                results.push({
                  id: post.id,
                  platform: post.platform,
                  status: "awaiting_credentials",
                  error: err.message || String(err),
                });
              } else if (newRetryCount < MAX_RETRIES) {
                await sql`
                  UPDATE scheduled_posts
                  SET status = 'pending', retry_count = ${newRetryCount}, error_message = ${err.message || String(err)}
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

          // ── 3. Log run ──
          const elapsedMs = Date.now() - handlerStartTime;
          try {
            await sql`
              INSERT INTO cron_runs (run_at, posts_found, posts_processed, posts_succeeded, posts_failed, elapsed_ms)
              VALUES (NOW(), ${rows.length}, ${published + failed + retried}, ${published}, ${failed}, ${elapsedMs})
            `;
          } catch (logErr: any) {
            console.error("[post-scheduler] Failed to log cron run:", logErr.message);
          }

          return new Response(
            JSON.stringify({ published, failed, retried, results }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (topLevelErr: any) {
          const elapsedMs = Date.now() - handlerStartTime;
          console.error(`[post-scheduler] Handler error (${elapsedMs}ms):`, topLevelErr.message || String(topLevelErr));

          try {
            await sql`
              INSERT INTO cron_runs (run_at, posts_found, posts_processed, posts_succeeded, posts_failed, elapsed_ms, error)
              VALUES (NOW(), 0, 0, 0, 0, ${elapsedMs}, ${topLevelErr.message || String(topLevelErr)})
            `;
          } catch (_) {}

          return new Response(
            JSON.stringify({ published: 0, failed: 0, retried: 0, results: [], error: topLevelErr.message || String(topLevelErr) }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      POST: async () => {
        return Route.server.handlers.GET();
      },
    },
  },
});
