/**
 * Post Scheduler Cron Route — GET|POST /api/cron/post-scheduler
 *
 * Called by Vercel Cron Job every ~60 seconds.
 *
 * BUFFER-STYLE SLOT SCHEDULING:
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

// ═══════════════════════════════════════════════════════════════════
// TIME SLOT DEFINITIONS (EST/EDT, America/New_York)
// ═══════════════════════════════════════════════════════════════════

interface SlotConfig {
  /** Hours in Eastern time (24h) when posting is allowed */
  hours: number[];
  /** Days of week (0=Sunday, 6=Saturday) when posting is allowed */
  days: number[];
}

const SLOT_CONFIG: Record<string, SlotConfig> = {
  facebook:  { hours: [14, 20],       days: [0, 1, 2, 3, 4, 5, 6] },
  instagram: { hours: [13, 17, 21],   days: [0, 1, 2, 3, 4, 5, 6] },
  x:         { hours: [9, 12, 17],    days: [1, 2, 3, 4, 5] },
  linkedin:  { hours: [12],           days: [1, 2, 3, 4, 5] },
  // Google and TikTok have no ratified slots yet — fall through to
  // the legacy "due_at <= NOW()" behavior.
};

/** Grace window in minutes: the cron will publish a slot's post if it
 * fires within this many minutes after the top of the hour. */
const SLOT_GRACE_MINUTES = 2;

/** Missed threshold: pending posts whose due_at is this many minutes
 * in the past are marked 'missed' rather than published late. */
const MISSED_THRESHOLD_MINUTES = 15;

// ═══════════════════════════════════════════════════════════════════
// EASTERN TIME HELPERS
// ═══════════════════════════════════════════════════════════════════

interface EasternTimeInfo {
  hour: number;
  minute: number;
  day: number; // 0=Sun, 6=Sat
  dateStr: string; // "YYYY-MM-DD"
  offsetHours: number; // UTC offset of Eastern time (e.g. -4 for EDT, -5 for EST)
}

function getEasternInfo(now: Date): EasternTimeInfo {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  });

  const parts = fmt.formatToParts(now);
  const vals: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") vals[p.type] = p.value;
  }

  // Parse offset: "GMT-4" or "GMT-5"
  let offsetHours = -5; // default EST
  if (vals.timeZoneName) {
    const m = vals.timeZoneName.match(/GMT([+-]\d+)/);
    if (m) offsetHours = parseInt(m[1]);
  }

  return {
    hour: parseInt(vals.hour),
    minute: parseInt(vals.minute),
    day: new Date(`${vals.year}-${vals.month}-${vals.day}T12:00:00`).getDay(),
    dateStr: `${vals.year}-${vals.month}-${vals.day}`,
    offsetHours,
  };
}

/**
 * Compute the UTC ISO timestamp for "today at {estHour}:00 Eastern time".
 *
 * Example: estDateStr="2026-07-27", estHour=14 (2pm), estOffsetHours=-4 (EDT)
 *   → UTC = 14 - (-4) = 18:00 → "2026-07-27T18:00:00.000Z"
 *
 * Example with day wraparound: estHour=20 (8pm), estOffsetHours=-4 (EDT)
 *   → UTC = 20 - (-4) = 24:00 → "2026-07-28T00:00:00.000Z"
 */
function computeSlotUtc(
  estDateStr: string,
  estHour: number,
  estOffsetHours: number,
): string {
  const [year, month, day] = estDateStr.split("-").map(Number);
  const utcTotalMinutes = (estHour - estOffsetHours) * 60;
  const baseUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  const slotUtcMs = baseUtcMs + utcTotalMinutes * 60 * 1000;
  return new Date(slotUtcMs).toISOString();
}

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

async function processSlotRun(): Promise<Response> {
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

    // ── Missed-post sweep ──
    // Any pending post whose due_at is more than MISSED_THRESHOLD_MINUTES
    // in the past has missed its window and should NEVER be published.
    try {
      const missedResult = await sql`
        UPDATE scheduled_posts
        SET status = 'missed'
        WHERE status = 'pending'
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
        await sql`
          UPDATE scheduled_posts
          SET status = 'failed', posted_at = NOW()
          WHERE id = ${postId}
        `;
        results.push({
          id: postId,
          platform,
          status: "failed",
          error: xErr.message,
        });
        stats.failed++;
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

    await sql`
      UPDATE scheduled_posts
      SET status = 'failed', posted_at = NOW()
      WHERE id = ${postId}
    `;

    results.push({
      id: postId,
      platform,
      status: "failed",
      error: err.message,
    });
    stats.failed++;
    stats.processed++;
  }
}
