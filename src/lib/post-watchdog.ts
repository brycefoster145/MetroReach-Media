/**
 * Post-Failure Watchdog — Telegram alerts for missed publish deadlines.
 *
 * After every scheduler run, `checkMissedPosts()` scans for posts that are
 * 5+ minutes past their `due_at` but still stuck in `pending` status.
 *
 * These are posts the scheduler never claimed — the cron missed a tick,
 * the claim UPDATE didn't match, or some other edge case swallowed the post.
 * The watchdog fires a Telegram alert so the team can investigate immediately.
 *
 * Only active platforms are checked: facebook, instagram, x.
 * Posts for LinkedIn/TikTok/Google/YouTube are excluded — those platforms
 * are awaiting OAuth credentials and are handled separately.
 *
 * Missed posts are marked `failed` with a watchdog note so we never
 * re-alert on the same post.
 */

import { sql } from "~/lib/db";
import { sendTelegramMessage } from "~/lib/telegram";

/** Platforms that are live and actively publishing. */
const ACTIVE_PLATFORMS = ["facebook", "instagram", "x"];

export interface MissedPost {
  id: string;
  platform: string;
  due_at: string;
  client_id: string;
  page_id: string;
  status: string;
}

/**
 * Scan for posts that missed their publish deadline.
 *
 * Queries for posts where:
 *  - `due_at <= NOW() - INTERVAL '5 minutes'`  (deadline passed 5+ min ago)
 *  - `status = 'pending'`                      (never claimed by scheduler)
 *  - `platform` is one of the active platforms (facebook, instagram, x)
 *
 * For each match: sends a Telegram alert, then marks the post as `failed`
 * with `error_message = 'watchdog: missed deadline'` so we never re-alert.
 */
export async function checkMissedPosts(): Promise<{
  missed: number;
  posts: MissedPost[];
}> {
  // ── 1. Find posts that missed their deadline ──
  const rows = await sql`
    SELECT id, platform, due_at, client_id, page_id, status
    FROM scheduled_posts
    WHERE status = 'pending'
      AND due_at <= NOW() - INTERVAL '5 minutes'
      AND platform = ANY(${ACTIVE_PLATFORMS})
    ORDER BY due_at ASC
  `;

  if (rows.length === 0) {
    return { missed: 0, posts: [] };
  }

  const missedPosts: MissedPost[] = rows.map((r: any) => ({
    id: r.id as string,
    platform: r.platform as string,
    due_at: String(r.due_at),
    client_id: (r.client_id as string) || "metroreach",
    page_id: (r.page_id as string) || "unknown",
    status: r.status as string,
  }));

  // ── 2. Alert & mark each missed post ──
  for (const post of missedPosts) {
    // Format due_at in EST for the alert
    const dueDate = new Date(post.due_at);
    const estTime = dueDate.toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "medium",
      timeStyle: "medium",
    });

    const message = [
      "🚨 <b>MISSED POST ALERT</b>",
      `Client: ${post.client_id}`,
      `Platform: ${post.platform}`,
      `Scheduled: ${estTime} (EST)`,
      `Post ID: ${post.id}`,
      `Status: ${post.status}`,
      `Action: Post did not publish by deadline. Investigate immediately.`,
    ].join("\n");

    // Fire-and-forget: send Telegram alert (don't block on failure)
    try {
      await sendTelegramMessage(message);
      console.log(`[post-watchdog] Alert sent for missed post ${post.id} (${post.platform})`);
    } catch (telegramErr: any) {
      console.error(
        `[post-watchdog] Failed to send Telegram alert for post ${post.id}:`,
        telegramErr.message,
      );
    }

    // Mark as failed so we never re-alert on this post
    try {
      await sql`
        UPDATE scheduled_posts
        SET status = 'failed',
            error_message = 'watchdog: missed deadline',
            retry_count = COALESCE(retry_count, 0)
        WHERE id = ${post.id}
      `;
    } catch (dbErr: any) {
      console.error(
        `[post-watchdog] Failed to mark post ${post.id} as failed:`,
        dbErr.message,
      );
    }
  }

  return { missed: missedPosts.length, posts: missedPosts };
}
