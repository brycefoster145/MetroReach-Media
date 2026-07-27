/**
 * Generate Images Endpoint — POST /api/generate-images
 *
 * Generates images for Instagram posts that are missing media_urls.
 * This runs OUTSIDE the cron context, so it can use longer timeouts
 * (up to Vercel's 60s serverless limit) for OpenAI image generation.
 *
 * Accepts:
 *   - { "postId": "post-xxx" } — generate image for one specific post
 *   - { "all": true } — generate images for ALL pending IG posts without media
 *   - { "resetFailed": true } — reset skipped_no_media posts to pending, then generate
 *
 * The cron scheduler will pick up posts with generated images on its next run.
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { generateImage } from "~/lib/generate-image";

export const Route = createFileRoute("/api/generate-images")({
  ssr: false,
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            status: "ok",
            endpoint: "/api/generate-images",
            method: "POST",
            usage: "POST { postId, all, resetFailed, dryRun } — generates images for Instagram posts missing media_urls",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const postId = body.postId as string | undefined;
        const all = body.all as boolean | undefined;
        const resetFailed = body.resetFailed as boolean | undefined;
        const dryRun = body.dryRun as boolean | undefined;

        // ── Determine which posts to process ──
        let postsToProcess: Array<{
          id: string;
          content: string;
          status: string;
          media_urls: unknown;
        }> = [];

        if (postId) {
          // Single post mode
          const rows = await sql`
            SELECT id, content, status, media_urls
            FROM scheduled_posts
            WHERE id = ${postId} AND platform = 'instagram'
            LIMIT 1
          `;
          if (rows.length === 0) {
            return new Response(
              JSON.stringify({ error: `Post not found: ${postId}` }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }
          postsToProcess = rows.map((r: any) => ({
            id: r.id as string,
            content: r.content as string,
            status: r.status as string,
            media_urls: r.media_urls,
          }));
        } else if (all || resetFailed) {
          // Batch mode — find all IG posts without media_urls
          let statusFilter: string[];
          if (resetFailed) {
            statusFilter = ["pending", "failed", "skipped_no_media"];
          } else {
            statusFilter = ["pending"];
          }

          const rows = await sql`
            SELECT id, content, status, media_urls
            FROM scheduled_posts
            WHERE platform = 'instagram'
              AND status = ANY(${statusFilter}::text[])
              AND (
                media_urls IS NULL
                OR jsonb_typeof(media_urls) != 'array'
                OR jsonb_array_length(media_urls) = 0
              )
            ORDER BY due_at ASC
            LIMIT 50
          `;
          postsToProcess = rows.map((r: any) => ({
            id: r.id as string,
            content: r.content as string,
            status: r.status as string,
            media_urls: r.media_urls,
          }));
        } else {
          return new Response(
            JSON.stringify({
              error: "Specify postId, all, or resetFailed",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (postsToProcess.length === 0) {
          return new Response(
            JSON.stringify({
              success: true,
              message: "No posts found that need image generation",
              generated: 0,
              results: [],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── If resetFailed, reset them to pending first ──
        if (resetFailed) {
          const ids = postsToProcess.map((p) => p.id);
          await sql`
            UPDATE scheduled_posts
            SET status = 'pending', meta_post_id = NULL, posted_at = NULL
            WHERE id = ANY(${ids}::text[])
          `;
          console.log(`[generate-images] Reset ${ids.length} posts to pending`);
        }

        if (dryRun) {
          return new Response(
            JSON.stringify({
              success: true,
              dryRun: true,
              message: `Would generate images for ${postsToProcess.length} posts`,
              postIds: postsToProcess.map((p) => p.id),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── Generate images for each post ──
        const results: Array<{
          id: string;
          status: string;
          imageUrl?: string;
          error?: string;
        }> = [];
        let succeeded = 0;
        let failed = 0;

        for (const post of postsToProcess) {
          try {
            console.log(
              `[generate-images] Generating image for ${post.id}... content_len=${post.content.length}`,
            );
            const startTime = Date.now();

            const imageUrl = await generateImage(post.content as string);

            const elapsed = Date.now() - startTime;
            console.log(
              `[generate-images] ✅ ${post.id}: image generated in ${elapsed}ms → ${imageUrl}`,
            );

            // Update the post with the generated image URL
            await sql`
              UPDATE scheduled_posts
              SET media_urls = ${JSON.stringify([imageUrl])}::jsonb
              WHERE id = ${post.id}
            `;

            results.push({ id: post.id, status: "generated", imageUrl });
            succeeded++;
          } catch (err: any) {
            console.error(
              `[generate-images] ❌ ${post.id}: generation failed — ${err.message}`,
            );
            results.push({
              id: post.id,
              status: "failed",
              error: err.message,
            });
            failed++;
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            total: postsToProcess.length,
            succeeded,
            failed,
            results,
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
