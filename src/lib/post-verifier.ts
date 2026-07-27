/**
 * Post-Publish Verifier — confirms scheduled posts actually published.
 *
 * Runs ~5 minutes after each posting slot. Checks:
 * 1. Posts in scheduled_posts with due_at in the last 10 min but status still "pending" or "failed"
 * 2. For Meta (FB/IG) posts: verifies existence on the Graph API
 * 3. Sends Telegram alerts for any failures
 *
 * MetroReach Media
 */
import { sql } from "~/lib/db";
import { sendTelegramMessage } from "~/lib/telegram";
import { getEasternInfo, DAY_NAMES } from "~/lib/slot-utils";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface FailedPost {
  id: string;
  platform: string;
  client_id: string;
  status: string;
  due_at: string;
  meta_post_id: string | null;
  error_detail?: string;
}

export interface VerifierReport {
  server_time_utc: string;
  checked_count: number;
  failed_count: number;
  failures: FailedPost[];
  alerts_sent: number;
}

// ═══════════════════════════════════════════════════════════════════
// META GRAPH API VERIFICATION
// ═══════════════════════════════════════════════════════════════════

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

async function verifyMetaPost(metaPostId: string): Promise<boolean> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return false;

  try {
    const url = new URL(`${GRAPH_API_BASE}/${metaPostId}`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("fields", "id");

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    const json = await res.json();

    // If the post exists, we get { id: "..." } back
    if ((json as any)?.id) return true;
    // If it doesn't exist, Meta returns an error object
    return false;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// CORE
// ═══════════════════════════════════════════════════════════════════

export async function runPostVerifier(): Promise<VerifierReport> {
  const failures: FailedPost[] = [];
  let alertsSent = 0;

  try {
    // ── Find posts due in the last 10 minutes that didn't publish ──
    const rows = await sql`
      SELECT id, platform, client_id, status, due_at, meta_post_id
      FROM scheduled_posts
      WHERE due_at >= (NOW() - INTERVAL '10 minutes')
        AND due_at <= (NOW() - INTERVAL '5 minutes')
        AND status IN ('pending', 'failed')
      ORDER BY due_at ASC
    `;

    for (const row of rows) {
      const post: FailedPost = {
        id: row.id as string,
        platform: row.platform as string,
        client_id: (row.client_id as string) || "unknown",
        status: row.status as string,
        due_at: (row.due_at as Date).toISOString(),
        meta_post_id: (row.meta_post_id as string) || null,
      };

      // ── For Meta (FB/IG): verify on Graph API ──
      if (
        (post.platform === "facebook" || post.platform === "instagram") &&
        post.meta_post_id
      ) {
        const exists = await verifyMetaPost(post.meta_post_id);
        if (exists) {
          // Post exists on Meta — mark as posted in our DB
          console.log(
            `[post-verifier] Post ${post.id} has meta_post_id=${post.meta_post_id} and exists on Meta — marking as posted`,
          );
          await sql`
            UPDATE scheduled_posts
            SET status = 'posted', posted_at = NOW()
            WHERE id = ${post.id}
          `;
          continue; // Not a failure — skip alert
        } else {
          post.error_detail = `Meta post ID ${post.meta_post_id} not found on Graph API`;
        }
      }

      // ── Also check: maybe it was published by the scheduler just now ──
      // Re-check status in case the scheduler updated it between our query and now
      const recheck = await sql`
        SELECT status FROM scheduled_posts WHERE id = ${post.id}
      `;
      if (recheck[0]?.status === "posted") {
        console.log(`[post-verifier] Post ${post.id} was published between queries — skipping`);
        continue;
      }

      failures.push(post);

      // ── Format due_at as EST for the alert ──
      const dueDate = new Date(post.due_at);
      const est = getEasternInfo(dueDate);
      const estTimeStr = `${DAY_NAMES[est.day]} ${String(est.hour).padStart(2, "0")}:${String(est.minute).padStart(2, "0")} EST`;

      await sendTelegramMessage(
        `❌ <b>[MetroReach] POST FAILED: ${post.platform} post <code>${post.id}</code> at ${estTimeStr} did not publish</b>\n\n` +
        `Status: ${post.status.toUpperCase()}\n` +
        `Due at (UTC): ${post.due_at}\n` +
        `Due at (EST): ${estTimeStr}\n` +
        `Platform: ${post.platform}\n` +
        `Meta post ID: ${post.meta_post_id || "N/A"}\n` +
        (post.error_detail ? `Detail: ${post.error_detail}\n` : "") +
        `\nAction: Investigate and re-schedule or manually publish.`
      );
      alertsSent++;
    }
  } catch (err: any) {
    console.error(`[post-verifier] Error: ${err.message}`);
  }

  return {
    server_time_utc: new Date().toISOString(),
    checked_count: failures.length, // We only count posts that needed checking
    failed_count: failures.length,
    failures,
    alerts_sent: alertsSent,
  };
}
