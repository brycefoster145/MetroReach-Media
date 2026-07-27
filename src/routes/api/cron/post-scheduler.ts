/**
 * Post Scheduler Cron Route — GET|POST /api/cron/post-scheduler
 *
 * Called by Vercel Cron Job every minute.
 * Queries for pending posts where due_at <= NOW(), publishes them
 * via the Meta Graph API, updates their status, and records the
 * run in the cron_runs table for health monitoring.
 *
 * CRITICAL: This is the beating heart of MetroReach's posting
 * infrastructure. Posts MUST go out on time. Every run is logged.
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { publishPost, NoMediaError } from "~/lib/meta-poster";

export const Route = createFileRoute("/api/cron/post-scheduler")({
  server: {
    handlers: {
      GET: async () => {
        console.log("[cron] ⏰ GET /api/cron/post-scheduler — triggered");
        return processDuePosts();
      },
      POST: async () => {
        console.log("[cron] ⏰ POST /api/cron/post-scheduler — triggered");
        return processDuePosts();
      },
    },
  },
});

interface PostResult {
  id: string;
  platform: string;
  status: string;
  post_id?: string;
  error?: string;
}

async function processDuePosts(): Promise<Response> {
  const startTime = Date.now();
  const results: PostResult[] = [];
  let postsFound = 0;
  let postsProcessed = 0;
  let postsSucceeded = 0;
  let postsFailed = 0;
  let runError: string | null = null;

  console.log("[cron] ======== POST SCHEDULER RUN START ========");
  console.log(`[cron] Server time: ${new Date().toISOString()}`);

  try {
    // ── STEP 1: Query for due posts ──
    console.log("[cron] STEP 1: Querying for due posts...");
    const duePosts = await sql`
      SELECT id, client_id, platform, page_id, ig_user_id, content, media_urls, hashtags, due_at
      FROM scheduled_posts
      WHERE status = 'pending' AND due_at <= NOW()
      ORDER BY due_at ASC
      LIMIT 25
    `;

    postsFound = duePosts.length;
    console.log(`[cron] STEP 1 RESULT: Found ${postsFound} due posts`);

    if (postsFound === 0) {
      console.log("[cron] No due posts — nothing to publish. Run complete.");
    }

    // ── STEP 2: Process each post ──
    for (let i = 0; i < duePosts.length; i++) {
      const post = duePosts[i];
      const postId = post.id as string;
      const platform = post.platform as string;
      const dueAt = post.due_at as Date;

      console.log(
        `[cron] STEP 2 [${i + 1}/${postsFound}]: Processing post ${postId} — platform=${platform} due_at=${dueAt?.toISOString?.() ?? dueAt}`,
      );

      try {
        // LinkedIn: OAuth credentials pending from owner
        if (platform === "linkedin") {
          console.log(
            `[cron]   → LinkedIn post ${postId} — OAuth not configured, skipping`,
          );
          results.push({ id: postId, platform, status: "skipped_linkedin" });
          postsProcessed++;
          continue;
        }

        // Only Facebook and Instagram supported for now
        if (platform !== "facebook" && platform !== "instagram") {
          console.log(
            `[cron]   → Skipping ${postId} — platform "${platform}" not yet supported`,
          );
          results.push({ id: postId, platform, status: "skipped_unsupported" });
          postsProcessed++;
          continue;
        }

        const mediaUrls = Array.isArray(post.media_urls)
          ? (post.media_urls as string[])
          : [];

        const fullText = post.hashtags
          ? `${post.content}\n\n${post.hashtags}`
          : post.content;

        // ── PRE-FLIGHT: Instagram requires an image ──
        // Image generation happens at SCHEDULE time, not here.
        // If a post was scheduled without media_urls (generation failed/timed out),
        // skip it now rather than failing at the Meta API.
        if (platform === "instagram" && mediaUrls.length === 0) {
          console.log(
            `[cron]   → Instagram post ${postId} has no media_urls — skipping (needs image generation first)`,
          );
          await sql`
            UPDATE scheduled_posts
            SET status = 'skipped_no_media', posted_at = NOW()
            WHERE id = ${postId}
          `;
          results.push({ id: postId, platform, status: "skipped_no_media" });
          postsProcessed++;
          continue;
        }

        console.log(
          `[cron]   → Publishing to ${platform}: pageId=${post.page_id} igUserId=${post.ig_user_id || "N/A"} text_length=${(fullText as string).length} media_count=${mediaUrls.length}`,
        );

        // ── STEP 3: Publish via Meta Graph API ──
        const result = await publishPost({
          platform: platform as "facebook" | "instagram",
          pageId: post.page_id as string,
          igUserId: (post.ig_user_id as string) || undefined,
          text: fullText as string,
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        });

        console.log(
          `[cron]   ✅ PUBLISHED: ${platform} post ${postId} → Meta ID: ${result.post_id} status: ${result.status}`,
        );

        // ── STEP 4: Mark as posted ──
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
        postsSucceeded++;
        postsProcessed++;
      } catch (err: any) {
        // NoMediaError = post has no image. Mark as skipped, not failed.
        if (err.name === "NoMediaError" || err instanceof NoMediaError) {
          console.warn(
            `[cron]   ⚠️ SKIPPED (no media): ${postId} (${platform}): ${err.message}`,
          );
          await sql`
            UPDATE scheduled_posts
            SET status = 'skipped_no_media', posted_at = NOW()
            WHERE id = ${postId}
          `;
          results.push({ id: postId, platform, status: "skipped_no_media" });
          postsProcessed++;
          continue;
        }

        console.error(
          `[cron]   ❌ FAILED to publish ${postId} (${platform}): ${err.message}`,
        );
        if (err.stack) {
          console.error(`[cron]   Stack: ${err.stack.split("\n").slice(0, 3).join(" | ")}`);
        }

        // Mark as failed
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
        postsFailed++;
        postsProcessed++;
      }
    }
  } catch (err: any) {
    console.error(`[cron] ❌ QUERY ERROR: ${err.message}`);
    if (err.stack) console.error(`[cron] Stack: ${err.stack}`);
    runError = err.message;
  }

  // ── STEP 5: Record this run in cron_runs ──
  const elapsedMs = Date.now() - startTime;
  console.log(
    `[cron] ======== RUN COMPLETE: found=${postsFound} processed=${postsProcessed} succeeded=${postsSucceeded} failed=${postsFailed} elapsed=${elapsedMs}ms ========`,
  );

  try {
    await sql`
      INSERT INTO cron_runs (run_at, posts_found, posts_processed, posts_succeeded, posts_failed, elapsed_ms, error)
      VALUES (NOW(), ${postsFound}, ${postsProcessed}, ${postsSucceeded}, ${postsFailed}, ${elapsedMs}, ${runError})
    `;
    console.log("[cron] ✅ Run recorded in cron_runs table");
  } catch (logErr: any) {
    console.error(`[cron] ⚠️ Failed to record run in cron_runs: ${logErr.message}`);
  }

  const statusCode = runError ? 500 : 200;
  return new Response(
    JSON.stringify({
      results,
      summary: {
        found: postsFound,
        processed: postsProcessed,
        succeeded: postsSucceeded,
        failed: postsFailed,
        elapsed_ms: elapsedMs,
        error: runError,
        server_time: new Date().toISOString(),
      },
    }),
    {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    },
  );
}
