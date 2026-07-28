/**
 * Content Batch Scheduling — POST /api/content/batch
 *
 * Accepts a batch of posts across platforms with explicit due_at timestamps.
 *
 * Request body:
 * {
 *   "client_id": "metroreach",
 *   "page_id": "...",          // required fallback, overridden per-post if given
 *   "ig_user_id": "...",
 *   "posts": [
 *     { "platform": "instagram", "content": "...", "hashtags": "#tag1 #tag2" },
 *     ...
 *   ]
 * }
 *
 * Returns all created posts with their assigned slots.
 * If a platform has no available slots, returns an error for that
 * specific post — does NOT block other posts in the batch.
 *
 * MetroReach Media
 */
import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";
import { sql } from "~/lib/db";

// ── Types ──

interface BatchPost {
  platform: string;
  content: string;
  due_at: string;
  hashtags?: string;
  page_id?: string;
  ig_user_id?: string;
}

interface BatchRequest {
  client_id?: string;
  page_id?: string;
  ig_user_id?: string;
  posts: BatchPost[];
}

interface BatchResultEntry {
  platform: string;
  success: boolean;
  id?: string;
  due_at?: string;
  message?: string;
  error?: string;
}

// ── Validation ──

const VALID_PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "x",
  "google",
];

// ── Route ──

export const Route = createFileRoute("/api/content/batch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: BatchRequest;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (!Array.isArray(body.posts) || body.posts.length === 0) {
          return new Response(
            JSON.stringify({
              error: "posts array is required and must be non-empty",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const clientId = body.client_id || "metroreach";
        const defaultPageId = body.page_id;
        const defaultIgUserId = body.ig_user_id;

        const results: BatchResultEntry[] = [];
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < body.posts.length; i++) {
          const post = body.posts[i];

          // Validate platform
          if (!post.platform || !VALID_PLATFORMS.includes(post.platform)) {
            results.push({
              platform: post.platform || "(missing)",
              success: false,
              error: `Invalid platform: "${post.platform}". Must be one of: ${VALID_PLATFORMS.join(", ")}`,
            });
            errorCount++;
            continue;
          }

          if (!post.content || post.content.trim().length === 0) {
            results.push({
              platform: post.platform,
              success: false,
              error: "content is required and must be non-empty",
            });
            errorCount++;
            continue;
          }

          if (!post.due_at) {
            results.push({
              platform: post.platform,
              success: false,
              error: "due_at is required (ISO-8601 timestamp)",
            });
            errorCount++;
            continue;
          }

          const hashtags =
            post.hashtags || "#MetroReachMedia";
          const pageId = post.page_id || defaultPageId;
          const igUserId = post.ig_user_id || defaultIgUserId;

          try {
            const id = `post-${randomBytes(8).toString("hex")}`;
            await sql`
              INSERT INTO scheduled_posts (id, client_id, platform, page_id, ig_user_id, content, media_urls, hashtags, due_at, status)
              VALUES (
                ${id},
                ${clientId},
                ${post.platform},
                ${pageId || null},
                ${igUserId || null},
                ${post.content.trim()},
                ${JSON.stringify([])}::jsonb,
                ${hashtags},
                ${post.due_at}::timestamptz,
                'pending'
              )
            `;

            results.push({
              platform: post.platform,
              success: true,
              id,
              due_at: post.due_at,
              message: `Post scheduled for ${post.due_at}`,
            });
            successCount++;
          } catch (err: any) {
            results.push({
              platform: post.platform,
              success: false,
              error: `Unexpected error: ${err.message}`,
            });
            errorCount++;
          }
        }

        const overallSuccess = errorCount === 0;
        const statusCode = results.length === errorCount ? 422 : 207;

        return new Response(
          JSON.stringify({
            summary: {
              total: body.posts.length,
              succeeded: successCount,
              failed: errorCount,
            },
            results,
          }),
          {
            status: overallSuccess ? 201 : statusCode,
            headers: { "Content-Type": "application/json" },
          },
        );
      },

      // GET — return usage info
      GET: async () => {
        return new Response(
          JSON.stringify({
            endpoint: "/api/content/batch",
            method: "POST",
            description:
              "Batch-schedule posts with explicit due_at timestamps",
            body: {
              client_id: "string (optional, default: metroreach)",
              page_id: "string (optional fallback)",
              ig_user_id: "string (optional fallback)",
              posts: [
                {
                  platform: "instagram",
                  content: "Post text...",
                  due_at: "2026-07-29T13:00:00-04:00",
                  hashtags: "#tag1 #tag2 (optional)",
                  page_id: "string (optional override)",
                  ig_user_id: "string (optional override)",
                },
              ],
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  },
});
