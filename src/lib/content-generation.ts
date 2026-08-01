/**
 * Content generation for a client — calendar + per-image incremental execution.
 *
 * This module powers the async pipeline:
 *   - `generateContentCalendar()`   — one OpenAI call to build the 30-day calendar (12 posts)
 *   - `generateOneImage()`          — ONE reviewable content item: image + copy + metadata.
 *                                     Designed to run within Vercel's 60s function limit.
 *   - `processContentGeneration()`  — full legacy run (calendar + all 12 posts + email),
 *                                     kept for offline/one-shot use.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createHash } from "node:crypto";
import OpenAI from "openai";
import { sql } from "~/lib/db";
import { getHashtags } from "~/lib/hashtags";
import { getSiteUrl } from "~/lib/site-url";
import { sendEmail } from "~/lib/email";
import { findLeadByEmail } from "~/lib/lead-store";

// ── Types ──

export interface CalendarPost {
  platform: "facebook" | "instagram";
  day_offset: number; // days from today
  time_slot: string; // HH:MM in EST (e.g. "13:00", "17:00", "20:00", "21:00")
  copy: string;
  image_prompt: string;
}

export interface GeneratedCalendar {
  client_name: string;
  client_industry: string;
  posts: CalendarPost[];
}

/** Everything the per-image step needs, resolved once from the clients table. */
export interface ClientData {
  client_id: string;
  name: string;
  email: string;
  company: string;
  industry: string;
  businessName: string;
  goalsText: string;
  voiceText: string;
  audienceText: string;
  service_slug: string;
}

/** One completed post (image + copy + slot) ready for review. */
export interface GeneratedPostResult {
  id: string;
  platform: string;
  due_at: string;
  image_url: string;
}

// ── Content cadence (Buffer owns scheduling and publishing) ──
interface GenerationConfig {
  totalPosts: number;
  schedule: { instagram: string[]; facebook: string[] };
}
const GENERIC_CONFIG: GenerationConfig = {
  totalPosts: 12,
  schedule: { instagram: ["13:00", "17:00", "21:00"], facebook: ["14:00", "20:00"] },
};
const VIP_CONFIG: GenerationConfig = {
  totalPosts: 180,
  schedule: { instagram: ["09:00", "12:00", "15:00", "18:00", "21:00"], facebook: ["14:00"] },
};
function getGenerationConfig(serviceSlug?: string | null): GenerationConfig {
  return serviceSlug === "vip-daily" ? VIP_CONFIG : GENERIC_CONFIG;
}

// ── Helpers ──

/**
 * Build a suggested Buffer scheduling timestamp from the requested cadence.
 * Stored as review metadata; publishing and final scheduling happen in Buffer.
 */
function buildDueAt(dayOffset: number, timeSlot: string): string {
  const [hours, minutes] = timeSlot.split(":").map(Number);
  const now = new Date();
  // Create date in EST: add dayOffset to today, set time
  const dueDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    hours,
    minutes,
    0,
    0,
  );
  // Convert to UTC by interpreting as EST (UTC-5)
  // EST is UTC-5, so add 5 hours to get UTC
  const utcDate = new Date(dueDate.getTime() + 5 * 60 * 60 * 1000);
  return utcDate.toISOString();
}

/**
 * Deterministic post ID for a client + calendar index.
 * Idempotent across retries: re-running the same step never creates a duplicate row
 * (the INSERT below uses ON CONFLICT DO NOTHING).
 */
function postIdFor(clientId: string, index: number): string {
  return `post-${createHash("sha1").update(`${clientId}:${index}`).digest("hex").slice(0, 16)}`;
}

/**
 * Download an image from a URL and save it to public/social/generated/.
 * Returns the public URL path.
 */
async function saveGeneratedImage(
  imageUrl: string,
  postId: string,
): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    const ext = "png";
    const filename = `${postId}.${ext}`;
    const fs = await import("node:fs");
    const path = await import("node:path");

    const dir = path.join(process.cwd(), "public", "social", "generated");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buffer);

    return `/social/generated/${filename}`;
  } catch (err: any) {
    console.error(`[content-gen] Failed to save image for ${postId}:`, err.message);
    return imageUrl; // Fallback to the original URL
  }
}

// ── 1. Client data ──

/** Fetch + flatten a client's onboarding data into what content generation needs. Throws if the client doesn't exist. */
export async function loadClientData(client_id: string): Promise<ClientData> {
  const clientRows = await sql`
    SELECT id, email, name, company, service, service_slug, onboarding_data, portal_token
    FROM clients WHERE id = ${client_id} LIMIT 1
  `;

  if (clientRows.length === 0) {
    throw new Error("Client not found");
  }

  const client = clientRows[0] as any;
  const onboarding = (client.onboarding_data as Record<string, any>) || {};
  const clientName = (client.name as string) || "Client";
  const clientEmail = (client.email as string) || "";

  // Onboarding is persisted as { businessInfo, brandInfo, ... }. Keep the
  // legacy flat reads as a compatibility fallback for older submissions.
  const businessInfo = (onboarding.businessInfo as Record<string, any>) || {};
  const brandInfo = (onboarding.brandInfo as Record<string, any>) || {};
  let lead: Awaited<ReturnType<typeof findLeadByEmail>> = null;
  if (Object.keys(onboarding).length === 0 && clientEmail) {
    try {
      lead = await findLeadByEmail(clientEmail);
    } catch (err: any) {
      console.error("[content-gen] Lead fallback lookup failed:", err.message);
    }
  }
  const leadBusinessInfo = lead?.businessInfo || {};
  const industry = (businessInfo.industry as string)
    || (onboarding.industry as string)
    || (leadBusinessInfo.industry as string)
    || (client.service as string)
    || "business";
  const goals = (businessInfo.goals as string[])
    || (onboarding.goals as string[])
    || [];
  const brandVoice = (brandInfo.brandVoice as string)
    || (onboarding.brandVoice as string)
    || "";
  const targetAudience = (businessInfo.targetAudience as string)
    || (onboarding.targetAudience as string)
    || "local customers looking for quality services";
  const businessName = (brandInfo.businessName as string)
    || (businessInfo.businessName as string)
    || (onboarding.businessName as string)
    || (leadBusinessInfo.businessName as string)
    || clientName;

  return {
    client_id,
    name: clientName,
    email: clientEmail,
    company: (client.company as string) || "",
    industry,
    businessName,
    goalsText: goals.length > 0 ? goals.join(", ") : "grow brand awareness and generate leads",
    voiceText: brandVoice || "professional, confident, and approachable",
    audienceText: targetAudience || "local customers looking for quality services",
    service_slug: (client.service_slug as string) || "",
  };
}

// ── 2. Calendar generation (one OpenAI call) ──

/** Generate a service-specific content calendar. Invalid output is retried once. */
export async function generateContentCalendar(client: ClientData): Promise<GeneratedCalendar> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const config = getGenerationConfig(client.service_slug);
  const isVip = client.service_slug === "vip-daily";
  const platformRequirements = isVip
    ? `- Exactly 180 posts total: 150 Instagram and 30 Facebook (6 posts every day for 30 days).
- EVERY day_offset from 0 through 29 must have exactly 5 Instagram posts and 1 Facebook post.
- Instagram slots each day: 09:00, 12:00, 15:00, 18:00, 21:00 EST (one post at each slot).
- Facebook slot each day: 14:00 EST (one post at this slot).`
    : `- Exactly 12 posts total: 6 for Instagram, 6 for Facebook.
- Instagram posts use 13:00, 17:00, or 21:00 EST.
- Facebook posts use 14:00 or 20:00 EST.
- Spread posts evenly across the 30-day window.`;
  const prompt = `You are a senior social media strategist at MetroReach Media, a premium marketing agency.
Create a 30-day organic social media content calendar. Return ONLY valid JSON — no markdown, no explanation.

CLIENT:
- Business: ${client.businessName}
- Industry: ${client.industry}
- Goals: ${client.goalsText}
- Brand voice: ${client.voiceText}
- Target audience: ${client.audienceText}

REQUIREMENTS:
${platformRequirements}
- Each post needs platform, day_offset (0-29), time_slot (HH:MM EST), copy (120-280 chars), image_prompt.
- Mix educational, promotional, behind-the-scenes, social proof, industry tips, and engagement content.
- Copy must be punchy, accurate, value-driven, and premium. Image prompts must be specific and describe a unique visual.
Return JSON: {"client_name":"${client.businessName}","client_industry":"${client.industry}","posts":[{"platform":"instagram","day_offset":0,"time_slot":"09:00","copy":"...","image_prompt":"..."}]}
Only use the exact slots listed above. Do not omit or duplicate a required daily slot.`;

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const openai = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You output only valid JSON." },
          { role: "user", content: prompt + (attempt ? "\nPrevious output failed validation. Rebuild it and satisfy every count and slot exactly." : "") },
        ],
        temperature: 0.8,
        max_tokens: isVip ? 16000 : 4000,
      });
      const raw = completion.choices[0]?.message?.content || "";
      const calendar = JSON.parse(raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()) as GeneratedCalendar;
      validateCalendar(calendar, config, isVip);
      return calendar;
    } catch (err: any) {
      lastError = String(err?.message || err);
      console.error(`[content-gen] Calendar attempt ${attempt + 1} failed:`, lastError);
    }
  }
  throw new Error(`Calendar validation failed after retry: ${lastError}`);
}

function validateCalendar(calendar: GeneratedCalendar, config: GenerationConfig, vip: boolean): void {
  if (!calendar.posts || calendar.posts.length !== config.totalPosts) {
    throw new Error(`Expected exactly ${config.totalPosts} posts, received ${calendar.posts?.length || 0}`);
  }
  const counts = { facebook: 0, instagram: 0 };
  for (const post of calendar.posts) {
    if (!(post.platform in counts)) throw new Error(`Invalid platform: ${post.platform}`);
    counts[post.platform]++;
    const slots = config.schedule[post.platform];
    if (!slots.includes(post.time_slot)) throw new Error(`Invalid ${post.platform} slot ${post.time_slot}`);
    if (!Number.isInteger(post.day_offset) || post.day_offset < 0 || post.day_offset >= 30) throw new Error(`Invalid day_offset ${post.day_offset}`);
  }
  if (vip && (counts.instagram !== 150 || counts.facebook !== 30)) {
    throw new Error(`VIP distribution mismatch: Instagram ${counts.instagram}, Facebook ${counts.facebook}`);
  }
  if (!vip && (counts.instagram !== 6 || counts.facebook !== 6)) {
    throw new Error(`Generic distribution mismatch: Instagram ${counts.instagram}, Facebook ${counts.facebook}`);
  }
  if (vip) {
    for (let day = 0; day < 30; day++) {
      const posts = calendar.posts.filter((p) => p.day_offset === day);
      const ig = posts.filter((p) => p.platform === "instagram");
      const fb = posts.filter((p) => p.platform === "facebook");
      if (ig.length !== 5 || fb.length !== 1 || new Set(ig.map((p) => p.time_slot)).size !== 5 || fb[0]?.time_slot !== "14:00") {
        throw new Error(`VIP cadence mismatch on day ${day}`);
      }
    }
  }
}

// ── 3. One image + one post (one worker tick) ──

/**
 * Generate ONE reviewable content item at `index`: image via gpt-image-2 and copy
 * metadata, then INSERT the item for approval. Approved content is scheduled in Buffer.
 *
 * Throws on image-generation failure so the pipeline worker can count retries.
 * The insert is idempotent (deterministic id + ON CONFLICT DO NOTHING) so a
 * retried step never duplicates a post.
 */
export async function generateOneImage(
  client: ClientData,
  calendar: GeneratedCalendar,
  index: number,
): Promise<GeneratedPostResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const post = calendar.posts[index];
  if (!post) throw new Error(`Calendar has no post at index ${index}`);

  const postId = postIdFor(client.client_id, index);

  // Validate platform
  if (!["facebook", "instagram"].includes(post.platform)) {
    throw new Error(`Invalid platform: ${post.platform}`);
  }

  // Preserve the requested slot as review metadata; Buffer schedules approved content.
  const config = getGenerationConfig(client.service_slug);
  const validSlots = config.schedule[post.platform];
  const timeSlot = validSlots.includes(post.time_slot) ? post.time_slot : validSlots[0];
  const dueAt = buildDueAt(post.day_offset, timeSlot);

  // Generate image via gpt-image-2 — throws on failure so the worker can retry
  const openai = new OpenAI({ apiKey, timeout: 50_000, maxRetries: 0 });
  const imgResponse = await openai.images.generate({
    model: "gpt-image-2",
    prompt: `Premium social media graphic for a ${client.industry} business. ${post.image_prompt}. Clean, professional design with modern aesthetic. No text overlays. High contrast, brand-safe colors. Suitable for ${post.platform}.`,
    size: "1024x1024",
    quality: "high",
    n: 1,
  });
  const rawUrl = imgResponse.data[0]?.url;
  if (!rawUrl) throw new Error("Image generation returned no URL");
  const imageUrl = await saveGeneratedImage(rawUrl, postId);

  // Generate hashtags
  const hashtags = getHashtags(post.platform, post.copy);

  // Store generated content for review. Buffer is the only publishing layer.
  // scheduled_posts remains the review/content record; it is never dispatched here.
  const mediaUrls = imageUrl ? [imageUrl] : [];
  await sql`
    INSERT INTO scheduled_posts (
      id, client_id, platform, page_id, ig_user_id,
      content, media_urls, hashtags, due_at, status,
      content_prompt
    ) VALUES (
      ${postId},
      ${client.client_id},
      ${post.platform},
      ${"pending"},
      ${null},
      ${post.copy},
      ${JSON.stringify(mediaUrls)}::jsonb,
      ${hashtags},
      ${dueAt}::timestamptz,
      'pending_review',
      ${post.image_prompt}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  return {
    id: postId,
    platform: post.platform,
    due_at: dueAt,
    image_url: imageUrl || "(none)",
  };
}

// ── 4. Legacy full run (calendar + all posts + email) — offline/one-shot use ──

/**
 * Execute the full content generation for one queued client.
 * Kept for offline/one-shot use: calendar, then every post, then the review email.
 * The async pipeline worker uses the incremental functions instead.
 */
export async function processContentGeneration(client_id: string) {
  let client: ClientData;
  try {
    client = await loadClientData(client_id);
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Client not found", detail: err.message }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  let calendar: GeneratedCalendar;
  try {
    calendar = await generateContentCalendar(client);
  } catch (err: any) {
    console.error("[content-gen] Calendar generation failed:", err.message);
    return new Response(
      JSON.stringify({ error: "Failed to generate content calendar", detail: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const results: Array<{ id: string; platform: string; due_at: string; image_url: string }> = [];
  const errors: Array<{ platform: string; day_offset: number; error: string }> = [];

  for (let i = 0; i < calendar.posts.length; i++) {
    try {
      results.push(await generateOneImage(client, calendar, i));
    } catch (postErr: any) {
      const post = calendar.posts[i];
      console.error(`[content-gen] Failed to create post for ${post.platform} day ${post.day_offset}:`, postErr.message);
      errors.push({
        platform: post.platform,
        day_offset: post.day_offset,
        error: postErr.message,
      });
    }
  }

  // ── 5. Send email notification to client ──
  const clientEmail = client.email;
  const businessName = client.businessName;
  if (clientEmail && results.length > 0) {
    const portalUrl = `${getSiteUrl()}/portal/review`;
    try {
      await sendEmail({
        to: clientEmail,
        from: "support@metroreachagency.com",
        subject: `Your content calendar is ready for review — ${businessName}`,
        body: `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">
  <p style="font-size:13px;font-weight:600;color:#3B82F6;letter-spacing:0.05em;text-transform:uppercase;">MetroReach Media</p>
  <h2 style="color:#1a1a1a;font-size:20px;font-weight:700;">Your Content Calendar Is Ready</h2>
  <p style="font-size:15px;color:#374151;">Hi ${client.name},</p>
  <p style="font-size:15px;color:#374151;">Your 30-day content calendar has been created with <strong>${results.length} posts</strong> across Facebook and Instagram. Each post includes professional copy and a custom image designed for your brand.</p>
  <p style="font-size:15px;color:#374151;">Review and approve your posts in the client portal. Once approved, they'll be scheduled automatically.</p>
  <div style="margin:28px 0;">
    <a href="${portalUrl}" style="display:inline-block;background:#3B82F6;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Review Your Posts →</a>
  </div>
  <p style="font-size:13px;color:#9ca3af;">You can approve posts individually or reject any that need changes — we'll regenerate replacements automatically.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
  <p style="font-size:12px;color:#9ca3af;">MetroReach Media — Premium Social Media Marketing</p>
</body>
</html>`.trim(),
      });
      console.log(`[content-gen] Review notification email sent to ${clientEmail}`);
    } catch (emailErr: any) {
      console.error(`[content-gen] Failed to send review email:`, emailErr.message);
    }
  }

  return { posts_generated: results.length, posts_with_errors: errors.length, results, errors };
}
