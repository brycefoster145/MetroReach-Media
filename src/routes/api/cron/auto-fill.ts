/**
 * Auto-Fill Cron — GET|POST /api/cron/auto-fill
 *
 * GET:  Returns health check — how many empty slots in next 24h, which ones.
 * POST: Fills ALL empty slots for the next 24 hours with AI-generated content.
 *
 * Protected by CRON_SECRET (POST only — same pattern as collect-analytics.ts).
 * Runs daily at 8am EST (12:00 UTC) via Vercel cron.
 *
 * MetroReach Media
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { getAllEmptySlots, fillSlot } from "~/lib/slot-assigner";
import { SLOT_CONFIG } from "~/lib/slot-utils";
import { generateImage } from "~/lib/generate-image";
import { getHashtags } from "~/lib/hashtags";
import OpenAI from "openai";

// ═══════════════════════════════════════════════════════════════════
// PLATFORM CONTENT PROFILES
// ═══════════════════════════════════════════════════════════════════

interface PlatformProfile {
  charLimit: number;
  tone: string;
}

const PLATFORM_PROFILES: Record<string, PlatformProfile> = {
  facebook: {
    charLimit: 200,
    tone: "professional yet approachable, focused on business growth",
  },
  instagram: {
    charLimit: 200,
    tone: "visual-forward, punchy, aspirational, and value-driven",
  },
  x: {
    charLimit: 270,
    tone: "concise, sharp, high-impact, conversation-sparking",
  },
  linkedin: {
    charLimit: 250,
    tone: "authoritative, professional, thought-leadership style",
  },
};

// ═══════════════════════════════════════════════════════════════════
// AI CONTENT GENERATION
// ═══════════════════════════════════════════════════════════════════

async function generatePostContent(
  platform: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured — cannot generate auto-fill content");
  }

  const profile = PLATFORM_PROFILES[platform] || PLATFORM_PROFILES.facebook;

  const prompt = [
    `Write a professional social media post for ${platform} about social media marketing.`,
    `Tone: ${profile.tone}`,
    `Keep it under ${profile.charLimit} characters.`,
    `Include a hook, value, and implied CTA.`,
    `Do NOT include hashtags.`,
    `Do NOT use emojis unless it fits the platform naturally.`,
    `Return ONLY the post text — no quotes, no explanations, no JSON wrapper.`,
  ].join(" ");

  try {
    const openai = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a senior social media copywriter for MetroReach Media, a premium marketing agency. Write short, punchy, value-driven posts. Never use hashtags. Never use filler words.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 150,
      temperature: 0.8,
    });

    const text = response.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("OpenAI returned empty response");
    }

    return text;
  } catch (err: any) {
    console.error(`[auto-fill] AI generation failed for ${platform}: ${err.message}`);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// CRON SECRET AUTH
// ═══════════════════════════════════════════════════════════════════

function verifyCronSecret(request: Request): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return null; // No secret configured — allow (dev mode)

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  if (authHeader !== expected) {
    return new Response(
      JSON.stringify({ error: "Unauthorized — invalid or missing CRON_SECRET" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  return null; // Auth OK
}

// ═══════════════════════════════════════════════════════════════════
// ROUTE
// ═══════════════════════════════════════════════════════════════════

export const Route = createFileRoute("/api/cron/auto-fill")({
  server: {
    handlers: {
      GET: async () => {
        // Health check — report empty slots for next 24h
        const now = new Date();
        const twentyFourHours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        try {
          const emptySlots = await getAllEmptySlots(now, twentyFourHours);

          // Group by platform
          const byPlatform: Record<string, number> = {};
          for (const slot of emptySlots) {
            byPlatform[slot.platform] = (byPlatform[slot.platform] || 0) + 1;
          }

          return new Response(
            JSON.stringify({
              status: "ok",
              server_time_utc: now.toISOString(),
              window: {
                from: now.toISOString(),
                to: twentyFourHours.toISOString(),
                hours: 24,
              },
              total_empty_slots: emptySlots.length,
              by_platform: byPlatform,
              slots: emptySlots.map((s) => ({
                platform: s.platform,
                est_hour: s.estHour,
                est_day: s.estDayName,
                utc: s.utcTimestamp,
              })),
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({
              status: "error",
              error: err.message,
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },

      POST: async ({ request }) => {
        // Auth check
        const authError = verifyCronSecret(request);
        if (authError) return authError;

        const now = new Date();
        const twentyFourHours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        console.log("[auto-fill] ⏰ Auto-fill cron triggered");
        console.log(`[auto-fill] Window: ${now.toISOString()} → ${twentyFourHours.toISOString()}`);

        let emptySlots: Awaited<ReturnType<typeof getAllEmptySlots>>;
        try {
          emptySlots = await getAllEmptySlots(now, twentyFourHours);
        } catch (err: any) {
          console.error(`[auto-fill] Failed to query empty slots: ${err.message}`);
          return new Response(
            JSON.stringify({
              slots_checked: 0,
              slots_filled: 0,
              posts_created: 0,
              errors: [{ phase: "query", message: err.message }],
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        console.log(`[auto-fill] Found ${emptySlots.length} empty slots in next 24h`);

        if (emptySlots.length === 0) {
          return new Response(
            JSON.stringify({
              slots_checked: 0,
              slots_filled: 0,
              posts_created: 0,
              message: "No empty slots in the next 24 hours — all good!",
              errors: [],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const errors: Array<{ platform: string; slot: string; message: string }> = [];
        let filled = 0;

        for (const slot of emptySlots) {
          // Only auto-fill platforms with slot configs and AI content profiles
          if (!SLOT_CONFIG[slot.platform] || !PLATFORM_PROFILES[slot.platform]) {
            console.log(`[auto-fill] Skipping ${slot.platform} — no content profile defined`);
            continue;
          }

          console.log(
            `[auto-fill] Filling slot: ${slot.platform} ${slot.estDayName} ${String(slot.estHour).padStart(2, "0")}:00 EST`,
          );

          try {
            // Generate content
            const content = await generatePostContent(slot.platform);

            // Schedule it
            const result = await fillSlot(
              slot.platform,
              content,
              getHashtags(slot.platform, content),
              "metroreach",
            );

            if (result.success) {
              filled++;
              console.log(`[auto-fill] ✅ Created ${result.id} for ${slot.platform}`);

              // Instagram posts need media — generate an image immediately
              if (slot.platform === "instagram" && result.id) {
                try {
                  console.log(`[auto-fill] 🎨 Generating image for IG post ${result.id}...`);
                  const imageUrl = await generateImage(content);
                  await sql`
                    UPDATE scheduled_posts
                    SET media_urls = ${JSON.stringify([imageUrl])}::jsonb
                    WHERE id = ${result.id}
                  `;
                  console.log(`[auto-fill] 🖼️ Image generated and linked to ${result.id}: ${imageUrl}`);
                } catch (imgErr: any) {
                  console.error(
                    `[auto-fill] ⚠️ Image generation failed for ${result.id}: ${imgErr.message}. Post will be published without media.`,
                  );
                  // Don't fail the whole slot — post exists, cron will skip it as skipped_no_media
                }
              }
            } else {
              errors.push({
                platform: slot.platform,
                slot: slot.utcTimestamp,
                message: result.error || "Unknown error",
              });
              console.error(
                `[auto-fill] ❌ Failed to fill ${slot.platform} slot: ${result.error}`,
              );
            }
          } catch (err: any) {
            errors.push({
              platform: slot.platform,
              slot: slot.utcTimestamp,
              message: err.message,
            });
            console.error(
              `[auto-fill] ❌ Error filling ${slot.platform} slot: ${err.message}`,
            );
          }
        }

        const summary = {
          slots_checked: emptySlots.length,
          slots_filled: filled,
          posts_created: filled,
          errors,
        };

        console.log(
          `[auto-fill] ======== COMPLETE: checked=${summary.slots_checked} filled=${summary.slots_filled} errors=${errors.length} ========`,
        );

        return new Response(JSON.stringify(summary), {
          status: errors.length > 0 ? 207 : 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
