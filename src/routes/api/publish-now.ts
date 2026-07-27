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
import { publishPost, NoMediaError } from "~/lib/meta-poster";
import { generateImage } from "~/lib/generate-image";

export const Route = createFileRoute("/api/publish-now")({
  server: {
    handlers: {
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

        if (!platform || !page_id || !content) {
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

        // ── Auto-generate image for Instagram ──
        let finalMediaUrls: string[] = (media_urls || []) as string[];
        if (platform === "instagram" && finalMediaUrls.length === 0) {
          try {
            const generatedUrl = await generateImage(content as string);
            finalMediaUrls = [generatedUrl];
          } catch (imgErr: any) {
            return new Response(
              JSON.stringify({
                error: "Instagram requires an image, and auto-generation failed.",
                detail: imgErr.message,
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
        }

        const fullText = hashtags ? `${content}\n\n${hashtags}` : content;
        const postId = `post-${randomBytes(8).toString("hex")}`;

        try {
          console.log(`[publish-now] Publishing ${platform} post ${postId} immediately...`);

          const result = await publishPost({
            platform: platform as "facebook" | "instagram",
            pageId: page_id as string,
            igUserId: (ig_user_id as string) || undefined,
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
              ${page_id as string},
              ${ig_user_id ? (ig_user_id as string) : null},
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
                ${page_id as string},
                ${ig_user_id ? (ig_user_id as string) : null},
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
    },
  },
});
