/**
 * Schedule Post API Route — POST /api/schedule-post
 *
 * Internal API for the Content Strategist and other team tools
 * to insert posts into the scheduled_posts table for the
 * posting scheduler to pick up and publish.
 */
import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";
import { sql } from "~/lib/db";
import { generateImage } from "~/lib/generate-image";

export const Route = createFileRoute("/api/schedule-post")({
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
          due_at,
        } = body as {
          client_id?: string;
          platform?: string;
          page_id?: string;
          ig_user_id?: string;
          content?: string;
          media_urls?: string[];
          hashtags?: string;
          due_at?: string;
        };

        // Validate required fields
        if (!platform || !page_id || !content || !due_at) {
          return new Response(
            JSON.stringify({
              error: "Missing required fields: platform, page_id, content, due_at",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const validPlatforms = [
          "facebook",
          "instagram",
          "linkedin",
          "tiktok",
          "x",
          "google",
        ];
        if (!validPlatforms.includes(platform)) {
          return new Response(
            JSON.stringify({
              error: `Invalid platform: ${platform}. Must be one of: ${validPlatforms.join(", ")}`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── Auto-generate image for Instagram posts without media ──
        // Instagram REQUIRES images — never let a text-only IG post through.
        // Facebook posts without images pass through (FB supports text-only).
        let finalMediaUrls: string[] = (media_urls || []) as string[];
        if (platform === "instagram" && finalMediaUrls.length === 0) {
          try {
            const generatedUrl = await generateImage(content as string);
            finalMediaUrls = [generatedUrl];
          } catch (imgErr: any) {
            return new Response(
              JSON.stringify({
                error:
                  "Instagram posts require an image, and auto-generation failed. Provide media_urls or try again.",
                detail: imgErr.message,
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
        }

        try {
          // ── Dedup check: upsert by platform + due_at ──
          // If a pending post already exists for this platform + time slot,
          // update it instead of creating a duplicate.
          const existing = await sql`
            SELECT id FROM scheduled_posts
            WHERE platform = ${platform}
              AND due_at = ${due_at}::timestamptz
              AND status = 'pending'
            LIMIT 1
          `;

          if (existing.length > 0) {
            // Update the existing post
            const existingId = existing[0].id as string;
            await sql`
              UPDATE scheduled_posts
              SET
                client_id = ${client_id as string},
                page_id = ${page_id as string},
                ig_user_id = ${ig_user_id ? (ig_user_id as string) : null},
                content = ${content as string},
                media_urls = ${sql.json(finalMediaUrls)},
                hashtags = ${hashtags as string}
              WHERE id = ${existingId}
            `;

            return new Response(
              JSON.stringify({
                success: true,
                id: existingId,
                platform,
                due_at,
                updated: true,
                message: `Post updated for ${due_at} (existing post replaced)`,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }

          const id = `post-${randomBytes(8).toString("hex")}`;

          await sql`
            INSERT INTO scheduled_posts (id, client_id, platform, page_id, ig_user_id, content, media_urls, hashtags, due_at, status)
            VALUES (
              ${id},
              ${client_id as string},
              ${platform},
              ${page_id as string},
              ${ig_user_id ? (ig_user_id as string) : null},
              ${content as string},
              ${sql.json(finalMediaUrls)},
              ${hashtags as string},
              ${due_at}::timestamptz,
              'pending'
            )
          `;

          return new Response(
            JSON.stringify({
              success: true,
              id,
              platform,
              due_at,
              message: `Post scheduled for ${due_at}`,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("[schedule-post] Insert error:", err.message);
          return new Response(
            JSON.stringify({ error: "Failed to schedule post", detail: err.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
