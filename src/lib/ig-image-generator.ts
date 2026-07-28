/**
 * Instagram Image Generator — MetroReach Media
 *
 * Auto-generates images for Instagram posts that don't have media_urls.
 * Three-tier strategy:
 *   1. Primary:   OpenAI gpt-image-2 generates a unique image
 *   2. Fallback 1: Random brand image from /images/ig/ (8 assets)
 *   3. Fallback 2: Throw — but this should be near-impossible with 8 brand images
 *
 * ALWAYS returns a full public URL (not a relative path) so the cron
 * scheduler can pass it directly to Meta's Graph API as image_url.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { generateImage } from "~/lib/generate-image";
import { getSiteUrl } from "~/lib/site-url";

// ── Brand Image Fallback Set ──
// 8 premium agency-branded images served from public/images/ig/
const BRAND_IMAGES = [
  "/images/ig/01-social-media-work-hard.png",
  "/images/ig/02-posting-strategy-geometric.png",
  "/images/ig/03-stop-guessing-start-growing.png",
  "/images/ig/04-premium-management-service.png",
  "/images/ig/05-post-for-leads-bold.png",
  "/images/ig/06-competitors-online.png",
  "/images/ig/07-agency-grade-zero-overhead.png",
  "/images/ig/08-free-audit-cta.png",
] as const;

function pickRandomBrandImage(): string {
  const idx = Math.floor(Math.random() * BRAND_IMAGES.length);
  return `${getSiteUrl()}${BRAND_IMAGES[idx]}`;
}

function toFullUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${getSiteUrl()}${path}`;
}

export interface IgImageResult {
  url: string;
  source: "openai" | "brand-fallback";
}

/**
 * Generate an Instagram image for the given post content.
 *
 * Primary:     OpenAI gpt-image-2 → unique image based on post content
 * Fallback:    Random pick from 8 MetroReach brand images
 *
 * Returns a full public URL ready for Meta's Graph API image_url field.
 * The return value ALWAYS includes a source tag for observability.
 */
export async function generateInstagramImage(
  content: string,
): Promise<IgImageResult> {
  // ── Tier 1: OpenAI generation ──
  try {
    const relativePath = await generateImage(content);
    const url = toFullUrl(relativePath);

    console.log(
      `[ig-image-generator] OpenAI generated: ${url.slice(0, 80)}...`,
    );
    return { url, source: "openai" };
  } catch (openaiErr: any) {
    console.warn(
      `[ig-image-generator] OpenAI generation failed: ${openaiErr.message}. Falling back to brand image.`,
    );
  }

  // ── Tier 2: Brand image fallback ──
  try {
    const url = pickRandomBrandImage();
    console.log(`[ig-image-generator] Brand fallback: ${url}`);
    return { url, source: "brand-fallback" };
  } catch (brandErr: any) {
    // ── Tier 3: Everything failed (extremely unlikely) ──
    console.error(
      `[ig-image-generator] CRITICAL: Both OpenAI and brand fallback failed: ${brandErr.message}`,
    );
    throw new Error(
      `Instagram image generation failed at all tiers: ${brandErr.message}`,
    );
  }
}
