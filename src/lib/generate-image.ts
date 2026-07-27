/**
 * Auto-generate social media images via OpenAI (gpt-image-2).
 *
 * Used by the schedule-post API route to auto-generate images
 * for Instagram posts that don't have media_urls.
 *
 * Caches by content hash (in-memory + disk) to avoid duplicate
 * API calls for the same content.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import OpenAI from "openai";

const GENERATED_DIR = join(process.cwd(), "public", "social", "generated");
const TEMP_FALLBACK_DIR = join("/", "tmp", "social", "generated");
const IMAGE_CACHE: Map<string, string> = new Map();

function ensureDir(): string {
  // Try public/ first (works in dev); fall back to /tmp (works in Vercel serverless)
  for (const dir of [GENERATED_DIR, TEMP_FALLBACK_DIR]) {
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      // Verify writable
      const testFile = join(dir, ".write-test");
      writeFileSync(testFile, "");
      existsSync(testFile); // no-op read, just verify
      return dir;
    } catch {
      // Not writable, try next
    }
  }
  throw new Error("No writable directory available for generated images");
}

function contentHash(content: string): string {
  return createHash("sha256")
    .update(content.slice(0, 500))
    .digest("hex")
    .slice(0, 16);
}

function buildPrompt(content: string): string {
  const text = content.slice(0, 100).replace(/\n/g, " ").trim();
  return (
    `Social media graphic for MetroReach Media agency. ` +
    `Dark professional background with brand colors (#12171d, #008fff, #00d4aa). ` +
    `Clean modern design. Text overlay: ${text}. ` +
    `No faces, no photos — graphic design style.`
  );
}

function resolveUrl(dir: string, filename: string): string {
  if (dir.startsWith("/tmp")) {
    // For temp dir, return an API-served path
    return `/api/social-image/${filename}`;
  }
  return `/social/generated/${filename}`;
}

/**
 * Generate a social media image for a post.
 * Returns a URL path to the generated image.
 * Cached by content hash — duplicate calls with the same content return instantly.
 */
export async function generateImage(postContent: string): Promise<string> {
  const hash = contentHash(postContent);

  // Check in-memory cache
  if (IMAGE_CACHE.has(hash)) {
    return IMAGE_CACHE.get(hash)!;
  }

  // Check disk cache in both possible locations
  const filename = `${hash}.webp`;
  for (const dir of [GENERATED_DIR, TEMP_FALLBACK_DIR]) {
    const filePath = join(dir, filename);
    if (existsSync(filePath)) {
      const url = resolveUrl(dir, filename);
      IMAGE_CACHE.set(hash, url);
      return url;
    }
  }

  // Generate with OpenAI
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const openai = new OpenAI({ apiKey, timeout: 50_000, maxRetries: 0 });
  const prompt = buildPrompt(postContent);

  const response = await openai.images.generate({
    model: "gpt-image-2",
    prompt,
    size: "1024x1024",
    quality: "high",
    n: 1,
  });

  const imageUrl = response.data[0]?.url;
  if (!imageUrl) {
    throw new Error("No image URL returned from OpenAI");
  }

  // Download the generated image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(
      `Failed to download generated image: HTTP ${imageResponse.status}`,
    );
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  // Save to writable directory
  const dir = ensureDir();
  const filePath = join(dir, filename);
  writeFileSync(filePath, buffer);

  const url = resolveUrl(dir, filename);
  IMAGE_CACHE.set(hash, url);
  return url;
}

/**
 * Clear the in-memory cache (useful for testing).
 */
export function clearImageCache(): void {
  IMAGE_CACHE.clear();
}
