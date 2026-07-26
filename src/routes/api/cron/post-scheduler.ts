/**
 * Post Scheduler Cron Route — POST /api/cron/post-scheduler
 *
 * Called by Vercel Cron Job every minute.
 * Queries for pending posts where due_at <= NOW(), publishes them
 * via the Meta Graph API, and updates their status.
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { publishPost } from "~/lib/meta-poster";

export const Route = createFileRoute("/api/cron/post-scheduler")({
  server: {
    handlers: {
      GET: async () => {
        return processDuePosts();
      },
      POST: async () => {
        return processDuePosts();
      },
    },
  },
});

async function processDuePosts(): Promise<Response> {
  const results: Array<{
    id: string;
    platform: string;
    status: string;
    post_id?: string;
    error?: string;
  }> = [];

  try {
    // Query for all pending posts where due_at <= NOW()
    const duePosts = await sql`
      SELECT id, client_id, platform, page_id, ig_user_id, content, media_urls, hashtags, due_at
      FROM scheduled_posts
      WHERE status = 'pending' AND due_at <= NOW()
      ORDER BY due_at ASC
      LIMIT 25
    `;

    console.log(`[post-scheduler] Found ${duePosts.length} due posts`);

    for (const post of duePosts) {
      const postId = post.id as string;
      const platform = post.platform as string;

      try {
        // LinkedIn: OAuth credentials pending from owner.
        // Posts are scheduled but actual publishing will be enabled once
        // LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET are available.
        if (platform === "linkedin") {
          console.log(
            `[post-scheduler] LinkedIn post ${postId} — OAuth not yet configured, skipping publish`,
          );
          results.push({
            id: postId,
            platform,
            status: "scheduled_linkedin",
          });
          continue;
        }

        // Only Facebook and Instagram are supported for now
        if (platform !== "facebook" && platform !== "instagram") {
          console.log(
            `[post-scheduler] Skipping post ${postId} — platform "${platform}" not yet supported`,
          );
          results.push({ id: postId, platform, status: "skipped" });
          continue;
        }

        const mediaUrls = Array.isArray(post.media_urls)
          ? (post.media_urls as string[])
          : [];

        const fullText = post.hashtags
          ? `${post.content}\n\n${post.hashtags}`
          : post.content;

        const result = await publishPost({
          platform: platform as "facebook" | "instagram",
          pageId: post.page_id as string,
          igUserId: (post.ig_user_id as string) || undefined,
          text: fullText as string,
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        });

        // Mark as posted
        await sql`
          UPDATE scheduled_posts
          SET status = 'posted', meta_post_id = ${result.post_id}, posted_at = NOW()
          WHERE id = ${postId}
        `;

        console.log(
          `[post-scheduler] Published ${platform} post ${postId} → Meta ID ${result.post_id}`,
        );
        results.push({
          id: postId,
          platform,
          status: "posted",
          post_id: result.post_id,
        });
      } catch (err: any) {
        console.error(
          `[post-scheduler] Failed to publish post ${postId}:`,
          err.message,
        );

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
      }
    }
  } catch (err: any) {
    console.error("[post-scheduler] Query error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message, results }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ results, count: results.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
