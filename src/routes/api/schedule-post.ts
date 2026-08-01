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
import { getSiteUrl } from "~/lib/site-url";
import { requireApiKey } from "~/lib/env";
import { getClientFromRequest } from "~/lib/client-auth";

export const Route = createFileRoute("/api/schedule-post")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const adminAuth = requireApiKey(request);
        if (adminAuth && !getClientFromRequest(request)) return adminAuth;
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

        // ── Apply MetroReach Media defaults ──
        const resolvedPageId = page_id || (client_id === "metroreach" ? "623055204204992" : undefined);

        // Validate required fields — due_at is always required
        const needsPageId = platform && ["facebook", "instagram", "fb", "ig"].includes(platform.toLowerCase());
        const missingFields = !platform || (needsPageId && !resolvedPageId) || !content || !due_at;

        if (missingFields) {
          const fields = needsPageId
            ? "platform, page_id, content, due_at"
            : "platform, content, due_at";
          return new Response(
            JSON.stringify({ error: `Missing required fields: ${fields}` }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── Validate due_at is in the future ──
        const dueAtDate = new Date(due_at as string);
        if (isNaN(dueAtDate.getTime())) {
          return new Response(
            JSON.stringify({ error: "Invalid due_at: must be a valid ISO-8601 datetime string" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        if (dueAtDate.getTime() <= Date.now()) {
          return new Response(
            JSON.stringify({ error: "due_at must be in the future — cannot schedule posts for a past time" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        const resolvedDueAt = due_at as string;

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

        // ── Hashtag minimum validation per platform (LOCKED IN — 2026-07-29) ──
        // Enforces the mandatory hashtag minimums from the business plan / CONTENT-RULES.md.
        // Never under-tag a post. Hashtag counts include #MetroReachMedia.
        const HASHTAG_MINIMUMS: Record<string, number> = {
          instagram: 20,
          facebook: 3,
          linkedin: 3,
          x: 1,
          tiktok: 3,
          google: 3,
        };
        const minHashtags = HASHTAG_MINIMUMS[platform] ?? 0;
        const hashtagCount = ((hashtags as string) || "").split(" ").filter((t) => t.startsWith("#")).length;
        if (minHashtags > 0 && hashtagCount < minHashtags) {
          return new Response(
            JSON.stringify({
              error: `Insufficient hashtags for ${platform}`,
              detail: `${platform} requires at least ${minHashtags} hashtags. Post has ${hashtagCount}. Add ${minHashtags - hashtagCount} more. Every post on every platform must include #MetroReachMedia.`,
              required: minHashtags,
              actual: hashtagCount,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
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

          // ── Generate UTM-tagged click-tracking link ──
          let utmLink: string | null = null;
          try {
            const clientRows = await sql`
              SELECT service_slug FROM clients WHERE id = ${client_id as string} LIMIT 1
            `;
            const clientSlug =
              clientRows.length > 0
                ? (clientRows[0].service_slug as string)
                : (client_id as string);
            const params = new URLSearchParams({
              utm_source: platform,
              utm_medium: "social",
              utm_campaign: clientSlug,
              utm_content: id,
            });
            utmLink = `${getSiteUrl()}/go/${encodeURIComponent(clientSlug)}/${encodeURIComponent(id)}?${params.toString()}`;
          } catch (utmErr: any) {
            console.error(
              "[schedule-post] UTM link generation error:",
              utmErr.message,
            );
          }

          // Generate the INSERT with utm_link only if the column exists
          let insertResult;
          try {
            insertResult = await sql`
              INSERT INTO scheduled_posts (id, client_id, platform, page_id, ig_user_id, content, media_urls, hashtags, due_at, status, utm_link)
              VALUES (
                ${id},
                ${client_id as string},
                ${platform},
                ${resolvedPageId},
                ${ig_user_id ? (ig_user_id as string) : null},
                ${content as string},
                ${JSON.stringify(finalMediaUrls)}::jsonb,
                ${hashtags as string},
                ${resolvedDueAt}::timestamptz,
                'pending',
                ${utmLink || null}
              )
            `;
          } catch (insertErr: any) {
            // If utm_link column doesn't exist, fall back to insert without it
            if (insertErr.message?.includes('utm_link')) {
              insertResult = await sql`
                INSERT INTO scheduled_posts (id, client_id, platform, page_id, ig_user_id, content, media_urls, hashtags, due_at, status)
                VALUES (
                  ${id},
                  ${client_id as string},
                  ${platform},
                  ${resolvedPageId},
                  ${ig_user_id ? (ig_user_id as string) : null},
                  ${content as string},
                  ${JSON.stringify(finalMediaUrls)}::jsonb,
                  ${hashtags as string},
                  ${resolvedDueAt}::timestamptz,
                  'pending'
                )
              `;
            } else {
              throw insertErr;
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              id,
              platform,
              due_at: resolvedDueAt,
              message: `Post scheduled for ${resolvedDueAt}`,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          // H1: Catch unique constraint violation from idx_scheduled_posts_slot
          if (err.code === '23505' || err.message?.includes('duplicate key') || err.message?.includes('unique')) {
            return new Response(
              JSON.stringify({
                error: "Duplicate time slot",
                detail: `A pending post already exists for ${platform} at ${resolvedDueAt}. Cancel it first or pick a different time.`,
              }),
              { status: 409, headers: { "Content-Type": "application/json" } },
            );
          }
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
