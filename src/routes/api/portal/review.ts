/**
 * GET  /api/portal/review — Fetch posts pending client review
 * POST /api/portal/review — Approve or reject a post
 *
 * Approve: status changes from 'pending_review' → 'pending' for Buffer scheduling
 * Reject:  triggers replacement generation, stores new post in 'pending_review'
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";
import OpenAI from "openai";
import { getClientFromRequest, checkCsrf } from "~/lib/client-auth";
import { sql } from "~/lib/db";
import { getHashtags } from "~/lib/hashtags";

// ── Helpers ──

function generatePostId(): string {
  return `post-${randomBytes(8).toString("hex")}`;
}

async function saveGeneratedImage(imageUrl: string, postId: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "public", "social", "generated");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${postId}.png`);
    fs.writeFileSync(filePath, buffer);
    return `/social/generated/${postId}.png`;
  } catch (err: any) {
    console.error(`[review] Failed to save image for ${postId}:`, err.message);
    return imageUrl;
  }
}

/**
 * Generate replacement copy + image for a rejected post.
 * Uses a different angle/approach than the original.
 */
async function generateReplacement(
  originalContent: string,
  originalPrompt: string,
  platform: string,
  industry: string,
  brandVoice: string,
  rejectionCount: number,
): Promise<{ copy: string; imageUrl: string; imagePrompt: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const openai = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });

  // Vary the approach based on rejection count
  const angles = [
    "Use a completely different hook and emotional angle.",
    "Take a more educational/informative approach.",
    "Use social proof or a customer-focused angle.",
    "Use a bold, direct value proposition.",
    "Take a storytelling/narrative approach.",
  ];
  const angle = angles[rejectionCount % angles.length];

  // Generate new copy
  const copyCompletion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a senior copywriter at MetroReach Media, a premium marketing agency. Write punchy, value-driven ${platform} copy. No jargon. No filler. Output ONLY the copy text — nothing else.`,
      },
      {
        role: "user",
        content: `The client rejected this ${platform} post. Write a replacement.

Original copy (DO NOT rephrase this — write something completely different):
"${originalContent}"

Industry: ${industry}
Brand voice: ${brandVoice || "professional, confident, approachable"}
${angle}

Write 120-280 characters of fresh, original copy for ${platform}.`,
      },
    ],
    temperature: 0.9,
    max_tokens: 300,
  });

  const newCopy = (copyCompletion.choices[0]?.message?.content || "").trim();

  // Generate new image prompt + image
  const imgPromptCompletion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a visual designer. Output only a detailed image generation prompt — no other text.",
      },
      {
        role: "user",
        content: `Create a detailed image generation prompt for a ${platform} social media post.

Original image prompt (DO NOT reuse — create something completely different):
"${originalPrompt}"

Post copy: "${newCopy}"
Industry: ${industry}
${angle}

Describe a premium, professional social media graphic. Include: visual scene, color palette, composition, mood. No text overlays. Suitable for gpt-image-2 at 1024x1024.`,
      },
    ],
    temperature: 0.9,
    max_tokens: 300,
  });

  const newImagePrompt = (imgPromptCompletion.choices[0]?.message?.content || "").trim();

  // Generate image via gpt-image-2
  let imageUrl = "";
  try {
    const imgResponse = await openai.images.generate({
      model: "gpt-image-2",
      prompt: `Premium social media graphic for a ${industry} business. ${newImagePrompt}. Clean, professional design with modern aesthetic. No text overlays. High contrast, brand-safe colors. Suitable for ${platform}.`,
      size: "1024x1024",
      quality: "high",
      n: 1,
    });
    const rawUrl = imgResponse.data[0]?.url;
    if (rawUrl) {
      const tempId = generatePostId();
      imageUrl = await saveGeneratedImage(rawUrl, tempId);
    }
  } catch (err: any) {
    console.error("[review] Replacement image generation failed:", err.message);
  }

  return { copy: newCopy, imageUrl, imagePrompt: newImagePrompt };
}

// ── Route ──

export const Route = createFileRoute("/api/portal/review")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const client = getClientFromRequest(request);
        if (!client) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        const posts = await sql`
          SELECT id, platform, content, media_urls, hashtags, due_at,
                 status, rejection_count, content_prompt, created_at
          FROM scheduled_posts
          WHERE client_id = ${client.sub}
            AND status IN ('pending_review', 'draft')
          ORDER BY due_at ASC
          LIMIT 50
        `;

        return new Response(
          JSON.stringify(
            posts.map((p: any) => ({
              id: p.id,
              platform: p.platform,
              content: p.content,
              media_urls: p.media_urls || [],
              hashtags: p.hashtags,
              due_at: String(p.due_at),
              status: p.status,
              rejection_count: p.rejection_count || 0,
              created_at: String(p.created_at),
            })),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },

      POST: async ({ request }) => {
        // CSRF protection for state-changing operations
        if (!checkCsrf(request)) {
          return new Response(
            JSON.stringify({ error: "Invalid request" }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }

        const client = getClientFromRequest(request);
        if (!client) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        let body: { action: string; post_id: string };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { action, post_id } = body;
        if (!action || !post_id) {
          return new Response(
            JSON.stringify({ error: "action and post_id are required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (!["approve", "reject"].includes(action)) {
          return new Response(
            JSON.stringify({ error: "Invalid action. Use 'approve' or 'reject'" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Verify post belongs to this client and is awaiting review
        const existing = await sql`
          SELECT id, platform, content, media_urls, hashtags, due_at,
                 page_id, ig_user_id, rejection_count, content_prompt, client_id
          FROM scheduled_posts
          WHERE id = ${post_id} AND client_id = ${client.sub}
          LIMIT 1
        `;

        if (existing.length === 0) {
          return new Response(
            JSON.stringify({ error: "Post not found or not authorized" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        const post = existing[0];

        if (post.status !== "pending_review" && post.status !== "draft") {
          return new Response(
            JSON.stringify({ error: `Post is not in review status (current: ${post.status})` }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── APPROVE ──
        if (action === "approve") {
          await sql`
            UPDATE scheduled_posts
            SET status = 'pending', rejection_count = 0
            WHERE id = ${post_id}
          `;

          return new Response(
            JSON.stringify({ success: true, action: "approved", post_id }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        // ── REJECT ──
        if (action === "reject") {
          const rejectionCount = (post.rejection_count as number) || 0;

          // Fetch client industry/brand info for replacement generation
          const clientRows = await sql`
            SELECT onboarding_data, service FROM clients WHERE id = ${client.sub} LIMIT 1
          `;
          const onboarding = (clientRows[0]?.onboarding_data as Record<string, unknown>) || {};
          const industry = (onboarding.industry as string) || (clientRows[0]?.service as string) || "business";
          const brandVoice = (onboarding.brandVoice as string) || "";

          try {
            // Generate replacement
            const replacement = await generateReplacement(
              post.content as string,
              (post.content_prompt as string) || "",
              post.platform as string,
              industry,
              brandVoice,
              rejectionCount,
            );

            // Generate new hashtags
            const hashtags = getHashtags(post.platform as string, replacement.copy);

            // Create new post in pending_review
            const newPostId = generatePostId();
            const mediaUrls = replacement.imageUrl ? [replacement.imageUrl] : [];

            await sql`
              INSERT INTO scheduled_posts (
                id, client_id, platform, page_id, ig_user_id,
                content, media_urls, hashtags, due_at, status,
                rejection_count, replaced_post_id, content_prompt
              ) VALUES (
                ${newPostId},
                ${client.sub},
                ${post.platform},
                ${post.page_id as string},
                ${post.ig_user_id as string || null},
                ${replacement.copy},
                ${JSON.stringify(mediaUrls)}::jsonb,
                ${hashtags},
                ${post.due_at}::timestamptz,
                'pending_review',
                ${rejectionCount + 1},
                ${post_id},
                ${replacement.imagePrompt}
              )
            `;

            // Mark original as replaced
            await sql`
              UPDATE scheduled_posts
              SET status = 'draft', replaced_post_id = ${newPostId}
              WHERE id = ${post_id}
            `;

            return new Response(
              JSON.stringify({
                success: true,
                action: "rejected",
                original_post_id: post_id,
                new_post_id: newPostId,
                message: "Replacement post generated and ready for review",
              }),
              { status: 201, headers: { "Content-Type": "application/json" } },
            );
          } catch (genErr: any) {
            console.error("[review] Replacement generation failed:", genErr.message);
            return new Response(
              JSON.stringify({
                error: "Failed to generate replacement",
                detail: genErr.message,
              }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
        }

        // Unreachable
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
