/**
 * Publish Cron — GET|POST /api/cron/publish
 *
 * The #1 blocker fix: posts that clients have reviewed and approved sit in
 * `pending` status forever. This cron fires every minute (vercel.json) and
 * publishes every pending post whose due_at has arrived.
 *
 * Flow per tick:
 *   1. ATOMIC CLAIM — one UPDATE flips up to 10 due pending posts to
 *      'publishing' + locked_at. The `WHERE ... AND status = 'pending'`
 *      guard means a concurrent invocation can never claim the same row
 *      (the second UPDATE's subquery no longer sees status='pending' after
 *      the first commits) — no double-publishing.
 *   2. For each claimed post, dispatch to the platform publisher:
 *        facebook  → publishPost (posts to /{page_id}/feed internally)
 *        instagram → publishPost (posts to /{ig_user_id}/media_publish internally)
 *        x         → publishToX   (reads token from client_platform_tokens)
 *        linkedin  → publishToLinkedIn (reads token from client_platform_tokens)
 *      Meta tokens come from the system user token (META_ACCESS_TOKEN env) —
 *      publishPost resolves the FB page token via /me/accounts and uses the
 *      system token for IG, exactly like publish-now. X/LinkedIn resolve
 *      their access tokens from client_platform_tokens internally.
 *   3. Outcome per post:
 *        success          → status = 'posted', meta_post_id, posted_at
 *        failure, <3 tries → retry_count+1, status back to 'pending' (next tick retries)
 *        failure, >=3 tries → status = 'failed'
 *        instagram w/o media → status = 'skipped_no_media' (counted as skipped)
 *   4. Log the run to cron_runs (feeds /api/cron/health) and return
 *      { published, failed, skipped }.
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { publishPost, NoMediaError } from "~/lib/meta-poster";
import { publishToX } from "~/lib/x-poster";
import { publishToLinkedIn } from "~/lib/linkedin-poster";

const MAX_RETRIES = 3;
const CLAIM_LIMIT = 10;

class NotConnectedError extends Error {
  constructor(platform: string) {
    super(`Platform "${platform}" not yet connected — awaiting OAuth credentials`);
    this.name = "NotConnectedError";
  }
}

interface ClaimedPost {
  id: string;
  platform: string;
  fullText: string;
  mediaUrls: string[];
  page_id: string;
  ig_user_id?: string | null;
  client_id: string;
  retry_count: number;
}

interface PostResult {
  post_id: string;
}

/**
 * Platform dispatch table. Reuses the existing publishers — no new Meta API
 * calls. Tokens:
 *   - Meta (fb/ig): system user token from env (see publishPost internals);
 *     page_id / ig_user_id come from the scheduled_posts row.
 *   - X / LinkedIn: access tokens resolved from client_platform_tokens inside
 *     publishToX / publishToLinkedIn (client_id comes from the post row).
 */
const PUBLISHERS: Record<string, (post: ClaimedPost) => Promise<PostResult>> = {
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
      igUserId: post.ig_user_id || undefined,
      text: post.fullText,
      mediaUrls: post.mediaUrls.length > 0 ? post.mediaUrls : undefined,
    }),
  x: (post) => publishToX(post.client_id || "metroreach", post.page_id || "", post.fullText),
  linkedin: (post) => publishToLinkedIn(post.client_id || "metroreach", post.fullText),
  tiktok: () => { throw new NotConnectedError("tiktok"); },
  google: () => { throw new NotConnectedError("google"); },
  youtube: () => { throw new NotConnectedError("youtube"); },
};

export const Route = createFileRoute("/api/cron/publish")({
  server: {
    handlers: {
      GET: async () => runPublish(),
      POST: async () => runPublish(),
    },
  },
});

async function runPublish() {
  const start = Date.now();
  try {
    // ── 1. Atomic claim — one statement, no double-publishing possible ──
    const rows = await sql`
      UPDATE scheduled_posts
      SET status = 'publishing', locked_at = NOW()
      WHERE id IN (
        SELECT id FROM scheduled_posts
        WHERE status = 'pending'
        AND due_at <= NOW()
        ORDER BY due_at ASC
        LIMIT ${CLAIM_LIMIT}
      )
      AND status = 'pending'
      RETURNING *
    `;

    const posts: ClaimedPost[] = rows.map((row: any) => ({
      id: row.id as string,
      platform: (row.platform as string).toLowerCase(),
      fullText: row.hashtags
        ? `${row.content}\n\n${row.hashtags}`
        : (row.content as string),
      mediaUrls: Array.isArray(row.media_urls) ? (row.media_urls as string[]) : [],
      page_id: (row.page_id as string) || "",
      ig_user_id: row.ig_user_id as string | null | undefined,
      client_id: (row.client_id as string) || "metroreach",
      retry_count: Number(row.retry_count ?? 0),
    }));

    let published = 0;
    let failed = 0;
    let skipped = 0;
    let retried = 0;
    const results: Array<{ id: string; platform: string; status: string; post_id?: string; error?: string }> = [];

    // ── 2. Publish each claimed post ──
    for (const post of posts) {
      const publisher = PUBLISHERS[post.platform];

      // Unsupported platform — permanent condition, mark failed immediately (no retry).
      if (!publisher) {
        const message = `Platform "${post.platform}" not supported`;
        await sql`
          UPDATE scheduled_posts
          SET status = 'failed', error_message = ${message}, retry_count = COALESCE(retry_count, 0) + 1
          WHERE id = ${post.id}
        `.catch((e: any) => console.error(`[cron/publish] error_message write failed for ${post.id}:`, e.message));
        failed++;
        results.push({ id: post.id, platform: post.platform, status: "failed", error: message });
        continue;
      }

      // Instagram REQUIRES an image — skip instead of attempting (Meta rejects text-only).
      if (post.platform === "instagram" && post.mediaUrls.length === 0) {
        await sql`
          UPDATE scheduled_posts
          SET status = 'skipped_no_media', error_message = 'No media_urls — Instagram posts require an image'
          WHERE id = ${post.id}
        `.catch((e: any) => console.error(`[cron/publish] error_message write failed for ${post.id}:`, e.message));
        skipped++;
        results.push({ id: post.id, platform: post.platform, status: "skipped_no_media", error: "No media_urls" });
        continue;
      }

      try {
        const result = await publisher(post);
        await sql`
          UPDATE scheduled_posts
          SET status = 'posted', meta_post_id = ${result.post_id}, posted_at = NOW(), retry_count = 0, locked_at = NULL
          WHERE id = ${post.id}
        `;
        published++;
        results.push({ id: post.id, platform: post.platform, status: "posted", post_id: result.post_id });
      } catch (err: any) {
        const message = err?.message || String(err);
        const isNoMedia = err instanceof NoMediaError || message.includes("No media");
        const newRetryCount = post.retry_count + 1;

        if (isNoMedia) {
          await sql`
            UPDATE scheduled_posts
            SET status = 'skipped_no_media', error_message = ${message}, retry_count = ${newRetryCount}
            WHERE id = ${post.id}
          `.catch((e: any) => console.error(`[cron/publish] error_message write failed for ${post.id}:`, e.message));
          skipped++;
          results.push({ id: post.id, platform: post.platform, status: "skipped_no_media", error: message });
        } else if (newRetryCount < MAX_RETRIES) {
          await sql`
            UPDATE scheduled_posts
            SET status = 'pending', retry_count = ${newRetryCount}, error_message = ${message}, locked_at = NULL
            WHERE id = ${post.id}
          `.catch((e: any) => console.error(`[cron/publish] error_message write failed for ${post.id}:`, e.message));
          retried++;
          results.push({ id: post.id, platform: post.platform, status: "pending", error: `Retry ${newRetryCount}/${MAX_RETRIES}: ${message}` });
        } else {
          await sql`
            UPDATE scheduled_posts
            SET status = 'failed', retry_count = ${newRetryCount}, error_message = ${message}
            WHERE id = ${post.id}
          `.catch((e: any) => console.error(`[cron/publish] error_message write failed for ${post.id}:`, e.message));
          failed++;
          results.push({ id: post.id, platform: post.platform, status: "failed", error: message });
        }
      }
    }

    // ── 3. Log run for /api/cron/health + watchdog ──
    try {
      await sql`
        INSERT INTO cron_runs (run_at, posts_found, posts_processed, posts_succeeded, posts_failed, elapsed_ms)
        VALUES (NOW(), ${posts.length}, ${published + failed + skipped + retried}, ${published}, ${failed}, ${Date.now() - start})
      `;
    } catch (logErr: any) {
      console.error("[cron/publish] Failed to log cron run:", logErr.message);
    }

    console.log(`[cron/publish] ${posts.length} claimed → published: ${published}, failed: ${failed}, skipped: ${skipped}, retried: ${retried} (${Date.now() - start}ms)`);

    return new Response(JSON.stringify({ published, failed, skipped, retried, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[cron/publish] Handler error (${Date.now() - start}ms):`, err?.message || String(err));
    // Log the error run so health dashboards see it rather than silently stalling.
    try {
      await sql`
        INSERT INTO cron_runs (run_at, posts_found, posts_processed, posts_succeeded, posts_failed, elapsed_ms, error)
        VALUES (NOW(), 0, 0, 0, 0, ${Date.now() - start}, ${err?.message || String(err)})
      `;
    } catch (_) {}
    // Return 200 with error field — transient failures must not false-alert monitors.
    return new Response(JSON.stringify({ published: 0, failed: 0, skipped: 0, error: err?.message || String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
