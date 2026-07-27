/**
 * Post Scheduler Cron Route — GET|POST /api/cron/post-scheduler
 *
 * Called by Vercel Cron Job every ~60 seconds.
 *
 * TIME-SLOT SCHEDULING:
 * Each platform has LOCKED posting time slots. The cron checks whether
 * the current Eastern time falls within a posting window for any platform.
 * If it does, it publishes the ONE post scheduled for that exact slot.
 * If no post exists for that slot, nothing happens.
 *
 * Posts that miss their designated time slot (e.g., cron was down) are
 * marked as 'missed' — they are NEVER published late.
 *
 * Time slots (LOCKED — from the business plan):
 *   Facebook:  2pm, 8pm EST (Mon–Sun)
 *   Instagram: 1pm, 5pm, 9pm EST (Mon–Sun)
 *   X/Twitter: 9am, 12pm, 5pm EST (Mon–Fri)
 *   LinkedIn:  12pm EST (Mon–Fri)
 *
 * Platforms without defined slots (Google, TikTok) fall back to the
 * old "due_at <= NOW()" behavior until their slots are ratified.
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { publishPost, NoMediaError } from "~/lib/meta-poster";
import { publishToX } from "~/lib/x-poster";
import { publishToGoogle } from "~/lib/google-poster";
import {
  SLOT_CONFIG,
  SLOT_GRACE_MINUTES,
  MISSED_THRESHOLD_MINUTES,
  getEasternInfo,
  computeSlotUtc,
} from "~/lib/slot-utils";

// ═══════════════════════════════════════════════════════════════════
// ROUTE DEFINITION
// ═══════════════════════════════════════════════════════════════════

export const Route = createFileRoute("/api/cron/post-scheduler")({
  server: {
    handlers: {
      GET: async () => {
        console.log("[cron] ⏰ GET /api/cron/post-scheduler — triggered");
        return processSlotRun();
      },
      POST: async () => {
        console.log("[cron] ⏰ POST /api/cron/post-scheduler — triggered");
        return processSlotRun();
      },
    },
  },
});

// ═══════════════════════════════════════════════════════════════════
// POST RESULT TRACKING
// ═══════════════════════════════════════════════════════════════════

interface PostResult {
  id: string;
  platform: string;
  status: string;
  post_id?: string;
  error?: string;
}

interface RunStats {
  found: number;
  processed: number;
  succeeded: number;
  failed: number;
  missed: number;
  elapsed_ms: number;
  error: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SCHEDULER LOGIC
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// H2: isRunning guard — prevents concurrent execution
// ═══════════════════════════════════════════════════════════════════
let isProcessing = false;

async function processSlotRun(): Promise<Response> {
  // SCHEDULER_PAUSED: env-var kill switch — removed 2026-07-27 to unblock posting
  // (was stuck paused for days, causing all IG/FB/X slots to be missed)

  // H2: Guard against concurrent runs (Vercel self-healing kicker + cron overlap)
  if (isProcessing) {
    console.log("[cron] ⚠️ Already processing — skipping duplicate run");
    return new Response(
      JSON.stringify({ message: "Already processing — skipping duplicate run" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  isProcessing = true;

  try {
    const startTime = Date.now();
    const results: PostResult[] = [];
    const stats: RunStats = {
      found: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      missed: 0,
      elapsed_ms: 0,
      error: null,
    };

    console.log("[cron] ======== SLOT SCHEDULER RUN START ========");
    console.log(`[cron] Server UTC: ${new Date().toISOString()}`);

    try {
      const now = new Date();
      const est = getEasternInfo(now);

    console.log(
      `[cron] Eastern time: ${est.dateStr} ${String(est.hour).padStart(2, "0")}:${String(est.minute).padStart(2, "0")} ` +
      `(day=${est.day}, offset=GMT${est.offsetHours >= 0 ? "+" : ""}${est.offsetHours})`,
    );

    // ── Determine active slots ──
    // A slot is "active" if the current hour matches a slot hour for
    // a platform on a valid day, AND we're within the grace window
    // (first SLOT_GRACE_MINUTES minutes after the top of the hour).

    const withinGraceWindow = est.minute < SLOT_GRACE_MINUTES;
    const activePlatforms: string[] = [];

    if (withinGraceWindow) {
      for (const [platform, config] of Object.entries(SLOT_CONFIG)) {
        if (config.days.includes(est.day) && config.hours.includes(est.hour)) {
          activePlatforms.push(platform);
        }
      }
    }

    if (activePlatforms.length > 0) {
      console.log(
        `[cron] Active slots: [${activePlatforms.join(", ")}] at ${String(est.hour).padStart(2, "0")}:00 Eastern`,
      );

      // ── Publish posts for active slots ──
      const slotUtc = computeSlotUtc(est.dateStr, est.hour, est.offsetHours);
      const slotWindowStart = new Date(
        new Date(slotUtc).getTime() - 90 * 1000,
      ).toISOString();
      const slotWindowEnd = new Date(
        new Date(slotUtc).getTime() + 90 * 1000,
      ).toISOString();

      console.log(
        `[cron] Slot window UTC: ${slotWindowStart} to ${slotWindowEnd}`,
      );

      for (const platform of activePlatforms) {
        console.log(`[cron] Checking slot: platform=${platform}`);

        try {
          const rows = await sql`
            SELECT id, client_id, platform, page_id, ig_user_id, content, media_urls, hashtags, due_at
            FROM scheduled_posts
            WHERE platform = ${platform}
              AND status = 'pending'
              AND due_at >= ${slotWindowStart}::timestamptz
              AND due_at < ${slotWindowEnd}::timestamptz
            ORDER BY due_at ASC
            LIMIT 1
          `;

          if (rows.length === 0) {
            console.log(`[cron]   → No post scheduled for ${platform} at this slot`);
            continue;
          }

          const post = rows[0];
          stats.found++;
          console.log(
            `[cron]   → Found post ${post.id} for ${platform} slot (due_at=${(post.due_at as Date).toISOString()})`,
          );

          await publishOnePost(post, results, stats);
        } catch (queryErr: any) {
          console.error(
            `[cron]   ❌ Error querying slot for ${platform}: ${queryErr.message}`,
          );
        }
      }
    } else {
      console.log(
        withinGraceWindow
          ? `[cron] No slots at ${String(est.hour).padStart(2, "0")}:00 Eastern — nothing to publish`
          : `[cron] Outside grace window (minute=${est.minute}, threshold=${SLOT_GRACE_MINUTES}) — skipping slot check`,
      );
    }

    // ── Also handle platforms without slot definitions (Google, TikTok) ──
    // These fall back to the old "due_at <= NOW()" behavior.
    const legacyPlatforms = ["google", "tiktok"];
    for (const platform of legacyPlatforms) {
      try {
        const rows = await sql`
          SELECT id, client_id, platform, page_id, ig_user_id, content, media_urls, hashtags, due_at
          FROM scheduled_posts
          WHERE platform = ${platform}
            AND status = 'pending'
            AND due_at <= NOW()
          ORDER BY due_at ASC
          LIMIT 1
        `;

        if (rows.length === 0) continue;

        const post = rows[0];
        stats.found++;
        console.log(
          `[cron]   → Found legacy ${platform} post ${post.id} (due_at=${(post.due_at as Date).toISOString()})`,
        );

        await publishOnePost(post, results, stats);
      } catch (queryErr: any) {
        console.error(
          `[cron]   ❌ Error querying legacy ${platform}: ${queryErr.message}`,
        );
      }
    }

    // ── C1: Retry sweep — retry failed posts with exponential backoff ──
    // Posts that errored on first attempt get retried: 1min → 5min → 15min
    // Only marks 'failed' after 3 failed attempts.
    try {
      const retryRows = await sql`
        SELECT id, client_id, platform, page_id, ig_user_id, content, media_urls, hashtags, due_at, retry_count
        FROM scheduled_posts
        WHERE status = 'pending'
          AND retry_count > 0
          AND retry_count < 3
          AND posted_at <= NOW() - INTERVAL '1 minute' * POWER(5, retry_count - 1)
        ORDER BY posted_at ASC
        LIMIT 5
      `;

      if (retryRows.length > 0) {
        console.log(
          `[cron] 🔄 Retry sweep: found ${retryRows.length} post(s) to retry`,
        );
        for (const post of retryRows) {
          stats.found++;
          console.log(
            `[cron]   → Retrying post ${post.id} for ${post.platform} (attempt ${(post.retry_count as number) + 1}/3)`,
          );
          await publishOnePost(post, results, stats);
        }
      }
    } catch (retryErr: any) {
      console.error(
        `[cron] ❌ Error during retry sweep: ${retryErr.message}`,
      );
    }

    // ── Missed-post sweep ──
    // Any pending post whose due_at is more than MISSED_THRESHOLD_MINUTES
    // in the past has missed its window and should NEVER be published.
    // Excludes posts being retried (retry_count > 0) — those are handled above.
    try {
      const missedResult = await sql`
        UPDATE scheduled_posts
        SET status = 'missed'
        WHERE status = 'pending'
          AND retry_count = 0
          AND due_at < (NOW() - INTERVAL '15 minutes')
        RETURNING id, platform
      `;
      stats.missed = missedResult.length;
      if (stats.missed > 0) {
        const missedIds = missedResult.map((r: any) => r.id).join(", ");
        console.log(
          `[cron] ⚠️ Marked ${stats.missed} posts as missed: [${missedIds}]`,
        );
        for (const row of missedResult) {
          results.push({
            id: row.id as string,
            platform: row.platform as string,
            status: "missed",
            error: "Post missed its designated time slot window",
          });
        }
      }
    } catch (missedErr: any) {
      console.error(
        `[cron] ❌ Error during missed-post sweep: ${missedErr.message}`,
      );
    }
  } catch (err: any) {
    console.error(`[cron] ❌ CRITICAL ERROR: ${err.message}`);
    if (err.stack) {
      console.error(
        `[cron] Stack: ${err.stack.split("\n").slice(0, 3).join(" | ")}`,
      );
    }
    stats.error = err.message;
  }

  // ── Record this run in cron_runs ──
  stats.elapsed_ms = Date.now() - startTime;
  console.log(
    `[cron] ======== RUN COMPLETE: found=${stats.found} processed=${stats.processed} ` +
    `succeeded=${stats.succeeded} failed=${stats.failed} missed=${stats.missed} ` +
    `elapsed=${stats.elapsed_ms}ms ========`,
  );

  try {
    await sql`
      INSERT INTO cron_runs (run_at, posts_found, posts_processed, posts_succeeded, posts_failed, elapsed_ms, error)
      VALUES (NOW(), ${stats.found}, ${stats.processed}, ${stats.succeeded}, ${stats.failed}, ${stats.elapsed_ms}, ${stats.error})
    `;
    console.log("[cron] ✅ Run recorded in cron_runs table");
  } catch (logErr: any) {
    console.error(
      `[cron] ⚠️ Failed to record run in cron_runs: ${logErr.message}`,
    );
  }

  const statusCode = stats.error ? 500 : 200;
  return new Response(
    JSON.stringify({
      results,
      summary: {
        found: stats.found,
        processed: stats.processed,
        succeeded: stats.succeeded,
        failed: stats.failed,
        missed: stats.missed,
        elapsed_ms: stats.elapsed_ms,
        error: stats.error,
        server_time: new Date().toISOString(),
      },
    }),
    {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    },
  );
  } finally {
    isProcessing = false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// C1: RETRY HELPER
// ═══════════════════════════════════════════════════════════════════

/**
 * Increment retry_count and update status based on retry threshold.
 * Keeps post as 'pending' for retries 1-2. Marks 'failed' on retry 3+.
 */
async function markPostRetryable(postId: string): Promise<{ retryCount: number; isFailed: boolean }> {
  const rows = await sql`
    UPDATE scheduled_posts
    SET retry_count = retry_count + 1,
        posted_at = NOW(),
        status = CASE WHEN retry_count + 1 >= 3 THEN 'failed' ELSE 'pending' END
    WHERE id = ${postId}
    RETURNING retry_count, status
  `;
  if (rows.length === 0) return { retryCount: 0, isFailed: true };
  return {
    retryCount: rows[0].retry_count as number,
    isFailed: (rows[0].status as string) === 'failed',
  };
}

// ═══════════════════════════════════════════════════════════════════
// SINGLE-POST PUBLISHER
// ═══════════════════════════════════════════════════════════════════

async function publishOnePost(
  post: Record<string, unknown>,
  results: PostResult[],
  stats: RunStats,
): Promise<void> {
  const postId = post.id as string;
  const platform = post.platform as string;

  try {
    // LinkedIn: OAuth credentials pending from owner
    if (platform === "linkedin") {
      console.log(
        `[cron]   → LinkedIn post ${postId} — OAuth not configured, skipping`,
      );
      results.push({ id: postId, platform, status: "skipped_linkedin" });
      stats.processed++;
      return;
    }

    // TikTok: OAuth credentials pending from owner
    if (platform === "tiktok") {
      console.log(
        `[cron]   → TikTok post ${postId} — OAuth not configured, skipping`,
      );
      results.push({ id: postId, platform, status: "skipped_tiktok" });
      stats.processed++;
      return;
    }

    const fullText = post.hashtags
      ? `${post.content}\n\n${post.hashtags}`
      : (post.content as string);

    // ── X (Twitter) ──
    if (platform === "x") {
      const xUserId = (post.page_id as string) || "";
      if (!xUserId) {
        console.log(
          `[cron]   → X post ${postId} has no page_id — skipping`,
        );
        await sql`
          UPDATE scheduled_posts
          SET status = 'failed', posted_at = NOW()
          WHERE id = ${postId}
        `;
        results.push({
          id: postId,
          platform,
          status: "failed",
          error: "No page_id (X user ID) configured",
        });
        stats.failed++;
        stats.processed++;
        return;
      }

      console.log(
        `[cron]   → Publishing to X: userId=${xUserId} text_length=${fullText.length}`,
      );

      try {
        const xResult = await publishToX(
          (post.client_id as string) || "metroreach",
          xUserId,
          fullText,
        );
        console.log(
          `[cron]   ✅ PUBLISHED: X post ${postId} → Tweet ID: ${xResult.post_id}`,
        );
        await sql`
          UPDATE scheduled_posts
          SET status = 'posted', posted_at = NOW()
          WHERE id = ${postId}
        `;
        results.push({
          id: postId,
          platform,
          status: "posted",
          post_id: xResult.post_id,
        });
        stats.succeeded++;
        stats.processed++;
      } catch (xErr: any) {
        console.error(
          `[cron]   ❌ FAILED to publish X post ${postId}: ${xErr.message}`,
        );
        const { retryCount, isFailed } = await markPostRetryable(postId);
        if (isFailed) {
          console.error(
            `[cron]   🚫 X post ${postId} permanently failed after ${retryCount} attempts`,
          );
          stats.failed++;
        } else {
          console.log(
            `[cron]   🔄 X post ${postId} queued for retry (attempt ${retryCount}/3)`,
          );
        }
        results.push({
          id: postId,
          platform,
          status: isFailed ? "failed" : "pending_retry",
          error: xErr.message,
        });
        stats.processed++;
      }
      return;
    }

    // ── Google (GMB + YouTube) ──
    if (platform === "google") {
      const googleMediaUrls = Array.isArray(post.media_urls)
        ? (post.media_urls as string[])
        : [];

      const googleResult = await publishToGoogle(
        (post.client_id as string) || "metroreach",
        post.page_id as string,
        fullText,
        googleMediaUrls.length > 0 ? googleMediaUrls : undefined,
      );

      await sql`
        UPDATE scheduled_posts
        SET status = 'posted', meta_post_id = ${googleResult.post_id}, posted_at = NOW()
        WHERE id = ${postId}
      `;

      console.log(
        `[cron]   ✅ PUBLISHED: Google post ${postId} → ${googleResult.platform} ID ${googleResult.post_id}`,
      );
      results.push({
        id: postId,
        platform: googleResult.platform,
        status: "posted",
        post_id: googleResult.post_id,
      });
      stats.succeeded++;
      stats.processed++;
      return;
    }

    // ── Facebook / Instagram (Meta) ──
    if (platform !== "facebook" && platform !== "instagram") {
      console.log(
        `[cron]   → Skipping ${postId} — platform "${platform}" not supported`,
      );
      results.push({ id: postId, platform, status: "skipped_unsupported" });
      stats.processed++;
      return;
    }

    const mediaUrls = Array.isArray(post.media_urls)
      ? (post.media_urls as string[])
      : [];

    // Instagram requires an image
    if (platform === "instagram" && mediaUrls.length === 0) {
      console.log(
        `[cron]   → Instagram post ${postId} has no media_urls — skipping`,
      );
      await sql`
        UPDATE scheduled_posts
        SET status = 'failed', posted_at = NOW()
        WHERE id = ${postId}
      `;
      results.push({
        id: postId,
        platform,
        status: "skipped_no_media",
        error:
          "No media_urls — needs image generation. Run POST /api/generate-images with postId to fix.",
      });
      stats.processed++;
      return;
    }

    console.log(
      `[cron]   → Publishing to ${platform}: pageId=${post.page_id} ` +
      `igUserId=${post.ig_user_id || "N/A"} text_length=${fullText.length} media_count=${mediaUrls.length}`,
    );

    const result = await publishPost({
      platform: platform as "facebook" | "instagram",
      pageId: post.page_id as string,
      igUserId: (post.ig_user_id as string) || undefined,
      text: fullText,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    });

    console.log(
      `[cron]   ✅ PUBLISHED: ${platform} post ${postId} → Meta ID: ${result.post_id}`,
    );

    await sql`
      UPDATE scheduled_posts
      SET status = 'posted', meta_post_id = ${result.post_id}, posted_at = NOW()
      WHERE id = ${postId}
    `;

    results.push({
      id: postId,
      platform,
      status: "posted",
      post_id: result.post_id,
    });
    stats.succeeded++;
    stats.processed++;
  } catch (err: any) {
    if (err.name === "NoMediaError" || err instanceof NoMediaError) {
      console.warn(
        `[cron]   ⚠️ SKIPPED (no media): ${postId} (${platform}): ${err.message}`,
      );
      await sql`
        UPDATE scheduled_posts
        SET status = 'failed', posted_at = NOW()
        WHERE id = ${postId}
      `;
      results.push({
        id: postId,
        platform,
        status: "skipped_no_media",
        error:
          "No media_urls — needs image generation.",
      });
      stats.processed++;
      return;
    }

    console.error(
      `[cron]   ❌ FAILED to publish ${postId} (${platform}): ${err.message}`,
    );
    if (err.stack) {
      console.error(
        `[cron]   Stack: ${err.stack.split("\n").slice(0, 3).join(" | ")}`,
      );
    }

    const { retryCount, isFailed } = await markPostRetryable(postId);
    if (isFailed) {
      console.error(
        `[cron]   🚫 ${platform} post ${postId} permanently failed after ${retryCount} attempts`,
      );
      stats.failed++;
    } else {
      console.log(
        `[cron]   🔄 ${platform} post ${postId} queued for retry (attempt ${retryCount}/3)`,
      );
    }

    results.push({
      id: postId,
      platform,
      status: isFailed ? "failed" : "pending_retry",
      error: err.message,
    });
    stats.processed++;
  }
}
