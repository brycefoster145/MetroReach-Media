/**
 * Post Scheduler — GET|POST /api/cron/post-scheduler
 *
 * Cron fires every ~60s (Vercel cron + self-kicker in vercel-entry.ts).
 * Atomic claim-first: UPDATE claims posts before publishing, preventing
 * double-posts from overlapping cron invocations.
 *
 * No time slots. No grace windows. No recovery sweeps.
 *
 * Self-healing:
 *  - Atomic claim: UPDATE … AND status = 'pending' prevents double-claims
 *  - Retry: transient failures release the claim (status → 'pending')
 *  - Stale detection: alerts on posts 30+ min past due still pending/publishing
 *  - Platform dispatch table: clean PUBLISHERS object
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { publishPost, NoMediaError } from "~/lib/meta-poster";
import { publishToX } from "~/lib/x-poster";
import { publishToLinkedIn } from "~/lib/linkedin-poster";
import { checkMissedPosts } from "~/lib/post-watchdog";

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
 * Platforms awaiting OAuth credentials from the owner.
 * Posts for these platforms are held in "awaiting_credentials" status
 * (not "failed") — they will be published once credentials are connected.
 * This is NOT a transient error and should never be retried.
 */
class NotConnectedError extends Error {
  constructor(platform: string) {
    super(`Platform "${platform}" not yet connected — awaiting OAuth credentials`);
    this.name = "NotConnectedError";
  }
}

const PLATFORM_AWAITING_CREDENTIALS = new Set([
  "tiktok",
  "google",
  "youtube",
]);

/**
 * Platform dispatch table.
 * All 7 platforms we sell. Connected platforms use real API publishers.
 * Awaiting-credentials platforms throw NotConnectedError — scheduler
 * marks them as "awaiting_credentials" (NO retries).
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

        // ⛔ EMERGENCY KILL SWITCH — mass posting prevention
        // Remove this block to re-enable scheduled posting.
        return new Response(
          JSON.stringify({ published: 0, failed: 0, retried: 0, results: [], paused: true }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );

        try {
          // ── 1. Atomic claim — UPDATE … AND status = 'pending' prevents double-claims ──
          // Only one cron tick can claim each post: the second tick sees status != 'pending' and skips it.
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

          // ── 3. Publish each claimed post ──
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
              const isNotConnected = err instanceof NotConnectedError;
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
              } else if (isNotConnected) {
                // Platform not yet connected — hold, don't retry, don't fail
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
                // Transient failure — release claim (back to pending) for retry on next cron tick
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
          // Posts 30+ min past due that are still pending (unclaimed) or publishing (claimed but
          // stuck — e.g. process crashed mid-publish) signal deeper issues:
          // expired page tokens, revoked permissions, API outages, etc.
          try {
            const staleRows = await sql`
              SELECT id, platform, status, due_at FROM scheduled_posts
              WHERE status IN ('pending', 'publishing')
              AND due_at < NOW() - INTERVAL '30 minutes'
              ORDER BY due_at ASC
            `;
            if (staleRows.length > 0) {
              const staleIds = staleRows.map((r: any) =>
                `${r.id} (${r.platform}, ${r.status}, due ${r.due_at})`,
              );
              console.error(
                `[post-scheduler] ⚠️ STALE POSTS DETECTED: ${staleRows.length} post(s) 30+ min past due and still pending/publishing. ` +
                  `IDs: [${staleIds.join(", ")}]`,
              );

              // Reset stuck 'publishing' posts back to 'pending' so they can be retried.
              // Bump due_at to NOW() so the 5-min watchdog grace period restarts
              // and checkMissedPosts() doesn't immediately flag them as failed.
              let resetCount = 0;
              for (const row of staleRows) {
                if (row.status === "publishing") {
                  await sql`
                    UPDATE scheduled_posts
                    SET status = 'pending', posted_at = NULL, locked_at = NULL, due_at = NOW()
                    WHERE id = ${row.id}
                  `;
                  resetCount++;
                }
              }
              if (resetCount > 0) {
                console.log(
                  `[post-scheduler] 🔄 Reset ${resetCount} stuck publishing post(s) → pending`,
                );
              }
            }
          } catch (staleErr: any) {
            console.error("[post-scheduler] Stale detection query failed:", staleErr.message);
          }

          // ── 5. Post-failure watchdog — Telegram alerts for missed deadlines ──
          // Catches posts 5+ min past due that the scheduler never claimed.
          // Runs after every tick. Must never block the scheduler.
          try {
            console.log("[post-scheduler] Running post-failure watchdog...");
            const watchdogResult = await checkMissedPosts();
            if (watchdogResult.missed > 0) {
              console.error(
                `[post-scheduler] ⚠️ WATCHDOG: ${watchdogResult.missed} missed post(s) detected and alerted.`,
              );
            }
            console.log("[post-scheduler] Watchdog check complete.");
          } catch (watchdogErr: any) {
            console.error("[post-scheduler] Watchdog check failed:", watchdogErr.message);
          }

          // ── 6. Log run to cron_runs for health monitoring ──
          const elapsedMs = Date.now() - handlerStartTime;
          const postsFound = rows.length;
          const postsProcessed = published + failed + retried;
          try {
            await sql`
              INSERT INTO cron_runs (run_at, posts_found, posts_processed, posts_succeeded, posts_failed, elapsed_ms)
              VALUES (NOW(), ${postsFound}, ${postsProcessed}, ${published}, ${failed}, ${elapsedMs})
            `;
          } catch (logErr: any) {
            console.error("[post-scheduler] Failed to log cron run:", logErr.message);
          }

          return new Response(
            JSON.stringify({ published, failed, retried, results }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (topLevelErr: any) {
          // Cold-start guard: DB connection failures, module init errors, etc.
          // Log the error for debugging but return a clean response so h3 doesn't
          // wrap it as an opaque "HTTPError".
          const elapsedMs = Date.now() - handlerStartTime;
          console.error(
            `[post-scheduler] ❌ Top-level handler error (${elapsedMs}ms):`,
            topLevelErr.message || String(topLevelErr),
          );

          // Best-effort log to cron_runs
          try {
            await sql`
              INSERT INTO cron_runs (run_at, posts_found, posts_processed, posts_succeeded, posts_failed, elapsed_ms, error)
              VALUES (NOW(), 0, 0, 0, 0, ${elapsedMs}, ${topLevelErr.message || String(topLevelErr)})
            `;
          } catch (_) {
            // Can't even log — nothing more we can do
          }

          return new Response(
            JSON.stringify({
              published: 0,
              failed: 0,
              retried: 0,
              results: [],
              error: topLevelErr.message || String(topLevelErr),
            }),
            {
              status: 200, // Return 200 so cron monitors don't alert on transient cold-start failures
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
      POST: async () => {
        // POST also works for manual triggers — delegates to GET logic
        return Route.server.handlers.GET();
      },
    },
  },
});
