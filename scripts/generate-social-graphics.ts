/**
 * MetroReach Media — Social Graphics Generator
 *
 * Reads the Week 1 content calendar, identifies posts that need generated
 * graphics (🎨 New custom or ♻️ Template), constructs DALL-E 3 prompts from
 * their creative briefs, calls the /api/dalle endpoint, and saves the
 * resulting images to public/social/.
 *
 * Usage: bun run scripts/generate-social-graphics.ts
 *
 * Prerequisites:
 *   - Dev server running on port 3000 (bun run dev)
 *   - OPENAI_API_KEY set in .env.local
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, copyFileSync } from "node:fs";
import { join } from "node:path";

// ── Types ───────────────────────────────────────────────────────────────────

interface PostTask {
  /** Post number (1–33) */
  num: number;
  /** Platform: "IG" or "FB" */
  platform: "IG" | "FB";
  /** Day of week */
  day: string;
  /** Pillar */
  pillar: string;
  /** Short hook/summary for logging */
  hook: string;
  /** Image filename from posts-week-1.md (e.g. "ig-w1-mon-brand-team.webp") */
  filename: string;
  /** The creative brief from the content calendar */
  creativeBrief: string;
  /** DALL-E size: square for IG, landscape for FB */
  size: "1024x1024" | "1792x1024";
  /** Prompt constructed for DALL-E */
  prompt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const API_BASE = "https://www.metroreachagency.com";
const OUTPUT_DIR = "/home/team/shared/site/public/social";
const CALENDAR_PATH = "/home/team/shared/social/content-calendar-week-1.md";
const POSTS_PATH = "/home/team/shared/social/posts-week-1.md";

const SIZE_FB: "1792x1024" = "1792x1024";
const SIZE_IG: "1024x1024" = "1024x1024";
const QUALITY = "high";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the first value from a markdown key-value line like `**Key:** value` */
function extractKV(line: string, key: string): string {
  const re = new RegExp(`\\*\\*${key}\\*\\*[:\\s]+(.+?)`, "i");
  const m = line.match(re);
  return m ? m[1].trim() : "";
}

/** Sleep for ms milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Step 1: Parse posts-week-1.md for filename mapping ──────────────────────

function parseFilenames(): Map<number, string> {
  const content = readFileSync(POSTS_PATH, "utf-8");
  const map = new Map<number, string>();

  // Match patterns like:
  //   **Image:** `ig-w1-mon-brand-team.webp` (org-chart graphic...)
  //   **Image:** `fb-w1-mon-brand-lockup.webp` (1200×630 — brand lockup...)
  //   **Image:** Text-only
  const postHeaderRe = /### Post (\d+)\s*·/g;
  let m: RegExpExecArray | null;

  while ((m = postHeaderRe.exec(content)) !== null) {
    const num = parseInt(m[1], 10);
    const startIdx = m.index;
    // Find the next ### or end of file
    const nextHeaderIdx = content.indexOf("\n###", startIdx + 10);
    const blockEnd = nextHeaderIdx === -1 ? content.length : nextHeaderIdx;
    const block = content.slice(startIdx, blockEnd);

    const imageMatch = block.match(/\*\*Image:\*\*\s*`([^`]+\.webp)`/);
    if (imageMatch) {
      map.set(num, imageMatch[1]);
    }
  }

  return map;
}

// ── Step 2: Parse content-calendar-week-1.md for posts needing graphics ─────

function parseCalendarPosts(): PostTask[] {
  const content = readFileSync(CALENDAR_PATH, "utf-8");
  const filenameMap = parseFilenames();
  const tasks: PostTask[] = [];

  // Split into post sections. Each post starts with "### Post N ·"
  const sections = content.split(/(?=### Post \d+ ·)/g);

  for (const section of sections) {
    // Skip if no post header
    const headerMatch = section.match(/### Post (\d+)\s*·\s*(.+?)\s*·\s*(.+)/);
    if (!headerMatch) continue;

    const num = parseInt(headerMatch[1], 10);
    const platformDay = headerMatch[2].trim();
    const pillarRaw = headerMatch[3].trim();

    // Parse platform and day from e.g. "Instagram · Slot 1 · Brand"
    const platformMatch = platformDay.match(
      /(Instagram|Facebook|LinkedIn)/i,
    );
    if (!platformMatch) continue;
    const platformFull = platformMatch[1].toLowerCase();

    // Only process IG and FB (LinkedIn posts are text-only)
    if (platformFull === "linkedin") continue;

    const platform = platformFull === "instagram" ? "IG" : "FB";

    // Check for graphic tags
    const hasCustom = section.includes("🎨");
    const hasTemplate = section.includes("♻️");
    if (!hasCustom && !hasTemplate) continue;

    // Extract fields
    const lines = section.split("\n");
    let hook = "";
    let creativeBrief = "";
    let inBrief = false;

    for (const line of lines) {
      if (line.startsWith("**Hook:**")) {
        hook = extractKV(line, "Hook");
      }
      if (line.includes("**Creative brief:**")) {
        inBrief = true;
        creativeBrief = line.replace(/.*\*\*Creative brief:\*\*\s*/, "").trim();
        continue;
      }
      if (inBrief) {
        if (line.startsWith("---") || line.startsWith("## ") || line.startsWith("### ")) {
          inBrief = false;
        } else if (line.trim()) {
          creativeBrief += " " + line.trim();
        }
      }
    }

    // Clean up creative brief
    creativeBrief = creativeBrief.replace(/\s+/g, " ").trim();

    const filename = filenameMap.get(num);
    if (!filename) {
      console.warn(`  ⚠️  Post ${num}: no filename found in posts-week-1.md, skipping`);
      continue;
    }

    const size = platform === "IG" ? SIZE_IG : SIZE_FB;

    // Build DALL-E prompt
    const prompt = buildDallePrompt({
      platform,
      hook,
      creativeBrief,
      size,
    });

    tasks.push({
      num,
      platform,
      day: platformDay,
      pillar: pillarRaw,
      hook,
      filename,
      creativeBrief,
      size,
      prompt,
    });
  }

  return tasks;
}

// ── Step 3: Build DALL-E prompt from creative brief ─────────────────────────

function buildDallePrompt(opts: {
  platform: "IG" | "FB";
  hook: string;
  creativeBrief: string;
  size: string;
}): string {
  const brandContext = [
    "Premium marketing agency brand style: dark background (#060912 or #0D1117),",
    "clean architectural layout, teal (#06D6A0) and blue (#3B82F6) accents.",
    "Typography-forward design with bold headlines and minimal decoration.",
    "No photos of people. No stock photography clichés. No AI/robot imagery.",
    "Professional, restrained, confident aesthetic.",
  ].join(" ");

  const basePrompt = opts.creativeBrief || opts.hook;

  // Truncate to stay within DALL-E's prompt limits while keeping quality
  const fullPrompt = `${brandContext} Create a ${opts.platform === "IG" ? "square 1080x1080" : "landscape 1200x630"} social media graphic for ${opts.platform === "IG" ? "Instagram" : "Facebook"}. ${basePrompt}`;

  // DALL-E 3 prompt limit is 4000 chars; stay well under
  return fullPrompt.length > 3800
    ? fullPrompt.slice(0, 3800)
    : fullPrompt;
}

// ── Step 4: Call /api/dalle endpoint ─────────────────────────────────────────

interface DalleApiResponse {
  url?: string;
  filename?: string;
  saved?: boolean;
  error?: string;
}

async function generateImage(prompt: string, size: string): Promise<DalleApiResponse> {
  const res = await fetch(`${API_BASE}/api/dalle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size, quality: QUALITY }),
  });

  const data = (await res.json()) as DalleApiResponse;

  if (!res.ok || data.error) {
    throw new Error(`DALL-E API error (${res.status}): ${data.error || "Unknown"}`);
  }

  if (!data.url) {
    throw new Error("No URL returned from DALL-E API");
  }

  return data;
}

// ── Step 5: Download and save image ──────────────────────────────────────────

async function downloadImage(
  url: string,
  filepath: string,
  savedFilename: string | undefined,
): Promise<void> {
  // If the API already saved the image locally (gpt-image-2 b64_json path),
  // the file is at public/social/<savedFilename> — move/copy to desired path.
  if (savedFilename) {
    const apiSavedPath = join(OUTPUT_DIR, savedFilename);
    if (existsSync(apiSavedPath)) {
      copyFileSync(apiSavedPath, filepath);
      console.log(`  💾 Copied from API-saved: ${apiSavedPath} → ${filepath}`);
      return;
    }
    console.log(`  ⚠️  API saved file not found at ${apiSavedPath}, downloading...`);
  }

  // For remote URLs (dalle-3 url path), download normally
  const fetchUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
  const res = await fetch(fetchUrl);
  if (!res.ok) {
    throw new Error(`Failed to download image: ${res.status} from ${fetchUrl}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(filepath, buffer);
  console.log(`  💾 Saved: ${filepath}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🎨 MetroReach Social Graphics Generator");
  console.log("════════════════════════════════════════\n");

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Parse calendar
  console.log("📋 Parsing content calendar...");
  const tasks = parseCalendarPosts();
  console.log(`  Found ${tasks.length} posts needing graphics\n`);

  if (tasks.length === 0) {
    console.log("No graphics to generate. Done.");
    return;
  }

  // Check server is running
  console.log("🔌 Checking API endpoint...");
  try {
    const healthCheck = await fetch(`${API_BASE}/api/dalle`, { method: "POST", body: "{}" });
    // 400 is expected (missing prompt) — server is up
    if (healthCheck.status === 404) {
      throw new Error("API route not found. Is the dev server running?");
    }
  } catch (err: any) {
    if (err.message?.includes("fetch")) {
      console.error("❌ Cannot reach dev server at", API_BASE);
      console.error("   Make sure 'bun run dev' is running on port 3000.");
      process.exit(1);
    }
    // Other errors are fine (e.g., missing prompt)
  }
  console.log("  Server is reachable.\n");

  // Generate each image
  let success = 0;
  let failed = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const outputPath = join(OUTPUT_DIR, task.filename);

    // Skip if already exists
    if (existsSync(outputPath)) {
      console.log(`⏭️  [${i + 1}/${tasks.length}] Post ${task.num} (${task.platform}): ${task.filename} already exists, skipping`);
      continue;
    }

    console.log(
      `🖼️  [${i + 1}/${tasks.length}] Post ${task.num} (${task.platform} ${task.pillar}): ${task.hook.slice(0, 60)}...`,
    );
    console.log(`    Size: ${task.size}, File: ${task.filename}`);

    try {
      const result = await generateImage(task.prompt, task.size);
      await downloadImage(result.url!, outputPath, result.filename);
      success++;

      // Rate-limit: DALL-E 3 has rate limits, be gentle
      if (i < tasks.length - 1) {
        console.log("    ⏳ Waiting 2s before next request...");
        await sleep(2000);
      }
    } catch (err: any) {
      console.error(`  ❌ Failed: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Done. ${success} generated, ${failed} failed, ${tasks.length - success - failed} skipped.`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
