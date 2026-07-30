/**
 * Publish Now API Route — POST /api/publish-now
 *
 * Emergency publish — bypasses the slot scheduler and publishes a post
 * to Facebook or Instagram immediately. Use when a slot was missed or
 * when you need to push content outside the normal schedule.
 *
 * NOT for routine use. The slot scheduler is the normal path.
 */
import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";
import { sql } from "~/lib/db";
import { publishPost, deleteInstagramPost, listInstagramMedia, NoMediaError } from "~/lib/meta-poster";

// ── MetroReach Media account defaults ──
// Used when client_id === "metroreach" so publish-now works via curl
// without requiring page_id/ig_user_id to be passed explicitly.
const DEFAULT_PAGE_ID = "623055204204992";
const DEFAULT_IG_USER_ID = "17841472858895937";

export const Route = createFileRoute("/api/publish-now")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action");

        if (action === "list") {
          const igUserId =
            url.searchParams.get("ig_user_id") || DEFAULT_IG_USER_ID;
          const limit = parseInt(url.searchParams.get("limit") || "25", 10);

          try {
            console.log(
              `[publish-now] Listing Instagram media for user ${igUserId}...`,
            );

            const media = await listInstagramMedia(igUserId, limit);

            return new Response(JSON.stringify({ media }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (err: any) {
            console.error(
              `[publish-now] ❌ List failed: ${err.message}`,
            );

            return new Response(
              JSON.stringify({
                error: "Failed to list Instagram media",
                detail: err.message,
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
        }

        return new Response(
          JSON.stringify({
            error: "Missing or invalid action",
            usage:
              "Use ?action=list to list recent Instagram media. Optional: &ig_user_id=...&limit=25",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      },

      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const {
          client_id = "metroreach",
          platform,
          page_id,
          ig_user_id,
          content,
          media_urls,
          hashtags = "#MetroReachMedia",
        } = body as {
          client_id?: string;
          platform?: string;
          page_id?: string;
          ig_user_id?: string;
          content?: string;
          media_urls?: string[];
          hashtags?: string;
        };

        // Apply MetroReach Media defaults when no explicit IDs are provided
        const resolvedPageId = page_id || (client_id === "metroreach" ? DEFAULT_PAGE_ID : undefined);
        const resolvedIgUserId = ig_user_id || (client_id === "metroreach" ? DEFAULT_IG_USER_ID : undefined);

        if (!platform || !resolvedPageId || !content) {
          return new Response(
            JSON.stringify({ error: "Missing required fields: platform, page_id, content" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (platform !== "facebook" && platform !== "instagram") {
          return new Response(
            JSON.stringify({ error: "Publish-now only supports facebook and instagram" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── Hard validation: Instagram posts REQUIRE media_urls ──
        // AI-generated images undermine the premium agency brand.
        // All Instagram images must be human-crafted by the Designer.
        const finalMediaUrls: string[] = (media_urls || []) as string[];
        if (platform === "instagram" && finalMediaUrls.length === 0) {
          return new Response(
            JSON.stringify({
              error: "Instagram posts require media_urls",
              detail:
                "Each Instagram post must include at least one image URL (1024x1024 PNG recommended). Coordinate with the Designer before scheduling.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const fullText = hashtags ? `${content}\n\n${hashtags}` : content;
        const postId = `post-${randomBytes(8).toString("hex")}`;

        try {
          console.log(`[publish-now] Publishing ${platform} post ${postId} immediately...`);

          const result = await publishPost({
            platform: platform as "facebook" | "instagram",
            pageId: resolvedPageId,
            igUserId: resolvedIgUserId || undefined,
            text: fullText,
            mediaUrls: finalMediaUrls.length > 0 ? finalMediaUrls : undefined,
          });

          console.log(`[publish-now] ✅ PUBLISHED: ${platform} post ${postId} → Meta ID: ${result.post_id}`);

          // Record in scheduled_posts for tracking
          await sql`
            INSERT INTO scheduled_posts (id, client_id, platform, page_id, ig_user_id, content, media_urls, hashtags, due_at, status, meta_post_id, posted_at)
            VALUES (
              ${postId},
              ${client_id as string},
              ${platform},
              ${resolvedPageId},
              ${resolvedIgUserId ? resolvedIgUserId : null},
              ${content as string},
              ${JSON.stringify(finalMediaUrls)}::jsonb,
              ${hashtags as string},
              NOW(),
              'posted',
              ${result.post_id},
              NOW()
            )
          `;

          return new Response(
            JSON.stringify({
              success: true,
              id: postId,
              platform,
              meta_post_id: result.post_id,
              message: `Published ${platform} post immediately. Meta ID: ${result.post_id}`,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error(`[publish-now] ❌ FAILED: ${err.message}`);

          // Still record the attempt
          try {
            await sql`
              INSERT INTO scheduled_posts (id, client_id, platform, page_id, ig_user_id, content, media_urls, hashtags, due_at, status, posted_at)
              VALUES (
                ${postId},
                ${client_id as string},
                ${platform},
                ${resolvedPageId},
                ${resolvedIgUserId ? resolvedIgUserId : null},
                ${content as string},
                ${JSON.stringify(finalMediaUrls)}::jsonb,
                ${hashtags as string},
                NOW(),
                'failed',
                NOW()
              )
            `;
          } catch (_) {}

          return new Response(
            JSON.stringify({ error: "Failed to publish", detail: err.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },

      DELETE: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { platform, meta_post_id } = body as {
          platform?: string;
          meta_post_id?: string;
        };

        if (!platform || !meta_post_id) {
          return new Response(
            JSON.stringify({ error: "Missing required fields: platform, meta_post_id" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (platform !== "instagram") {
          return new Response(
            JSON.stringify({ error: "Delete currently only supports instagram" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          console.log(`[publish-now] Deleting ${platform} post ${meta_post_id}...`);

          await deleteInstagramPost(meta_post_id);

          console.log(`[publish-now] ✅ DELETED: ${platform} post ${meta_post_id}`);

          return new Response(
            JSON.stringify({
              success: true,
              deleted: meta_post_id,
              platform,
              message: `Deleted ${platform} post ${meta_post_id}`,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error(`[publish-now] ❌ DELETE FAILED: ${err.message}`);

          return new Response(
            JSON.stringify({ error: "Failed to delete post", detail: err.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
