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
import { getNextAvailableSlot } from "~/lib/slot-assigner";

export const Route = createFileRoute("/api/schedule-post")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Check for autoSlot query parameter ──
        const url = new URL(request.url);
        const autoSlot = url.searchParams.get("autoSlot") === "true";

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

        // Validate required fields (due_at is optional when autoSlot=true)
        const requiredFields = autoSlot
          ? { missing: !platform || !page_id || !content }
          : { missing: !platform || !page_id || !content || !due_at };

        if (requiredFields.missing) {
          const fields = autoSlot
            ? "platform, page_id, content"
            : "platform, page_id, content, due_at";
          return new Response(
            JSON.stringify({
              error: `Missing required fields: ${fields}`,
              hint: autoSlot
                ? "Use ?autoSlot=true to auto-assign the next available slot"
                : undefined,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── Resolve due_at ──
        let resolvedDueAt: string;

        if (autoSlot) {
          // Auto-assign next available slot
          const slot = await getNextAvailableSlot(platform as string);
          if (!slot) {
            return new Response(
              JSON.stringify({
                error: `No available slots for ${platform} in the next 30 days`,
              }),
              { status: 409, headers: { "Content-Type": "application/json" } },
            );
          }
          resolvedDueAt = slot.utcTimestamp;
        } else {
          // ── Validate due_at is in the future ──
          const dueAtDate = new Date(due_at as string);
          if (isNaN(dueAtDate.getTime())) {
            return new Response(
              JSON.stringify({
                error: "Invalid due_at: must be a valid ISO-8601 datetime string",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
          if (dueAtDate.getTime() <= Date.now()) {
            return new Response(
              JSON.stringify({
                error: "due_at must be in the future — cannot schedule posts for a past time",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
          resolvedDueAt = due_at as string;
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
          // ── Dedup check: REJECT duplicate platform + time slot ──
          // A pending post already exists for this platform + due_at.
          // Duplicate time slots are not allowed — the caller must pick a
          // different time or cancel the existing post first.
          const existing = await sql`
            SELECT id FROM scheduled_posts
            WHERE platform = ${platform}
              AND due_at = ${resolvedDueAt}::timestamptz
              AND status = 'pending'
            LIMIT 1
          `;

          if (existing.length > 0) {
            return new Response(
              JSON.stringify({
                error: "Duplicate time slot",
                detail: `A pending post already exists for ${platform} at ${resolvedDueAt}. Cancel it first or pick a different time.`,
                existingPostId: existing[0].id,
              }),
              { status: 409, headers: { "Content-Type": "application/json" } },
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
              ${JSON.stringify(finalMediaUrls)}::jsonb,
              ${hashtags as string},
              ${resolvedDueAt}::timestamptz,
              'pending'
            )
          `;

          return new Response(
            JSON.stringify({
              success: true,
              id,
              platform,
              due_at: resolvedDueAt,
              message: `Post scheduled for ${resolvedDueAt}${autoSlot ? " (auto-assigned slot)" : ""}`,
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
