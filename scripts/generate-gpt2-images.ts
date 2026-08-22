#!/usr/bin/env bun
/**
 * Reusable batch generator for MetroReach Media Instagram images via OpenAI gpt-image-2.
 *
 * Reads a JSON manifest (array of { slug, headline, prompt }), generates each image at
 * 1024x1024 via gpt-image-2, saves <slug>.png, converts to <slug>.webp via sharp, then
 * verifies the "MetroReach Media" wordmark lockup with gpt-4o vision. Retries up to 3 times
 * per image with a lockup-reminder suffix on failures. Unfixable images are written to a
 * failed-lockup.json and do not block the run.
 *
 * Usage:
 *   OPENAI_API_KEY=... bun scripts/generate-gpt2-images.ts \
 *     --manifest /home/team/shared/social/gpt2-image-manifest.json \
 *     --out public/images/social
 *
 * Requires: bun, sharp (devDependency), OPENAI_API_KEY in env.
 * Note: gpt-image-2 responses carry b64_json (default) or a signed url — both are handled.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import sharp from "sharp";

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error("FATAL: OPENAI_API_KEY env var not set");
  process.exit(1);
}

const args = process.argv.slice(2);
const manifestPath =
  args[args.indexOf("--manifest") + 1] ||
  "/home/team/shared/social/gpt2-image-manifest.json";
const outDir = args[args.indexOf("--out") + 1] || "public/images/social";
const MAX_RETRIES = 3;

const LOCKUP_SUFFIX =
  " The exact text 'MetroReach Media' must be spelled correctly and legibly.";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** POST to OpenAI with exponential backoff on 429/5xx. */
async function openai(path: string, body: unknown, timeoutMs = 180000): Promise<any> {
  const url = `https://api.openai.com/v1${path}`;
  let lastErr: any = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.status === 429 || res.status >= 500) {
        const wait = 2 ** attempt + 1;
        console.log(`  [backoff] HTTP ${res.status}, waiting ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
      }
      return await res.json();
    } catch (e: any) {
      lastErr = e;
      if (e?.name === "AbortError") console.log("  [timeout] retrying");
      await sleep((2 ** attempt + 1) * 1000);
    }
  }
  throw lastErr;
}

/** Generate one image via gpt-image-2. Returns PNG Buffer. */
async function generateImage(prompt: string): Promise<Buffer> {
  const d = await openai("/images/generations", {
    model: "gpt-image-2",
    prompt,
    n: 1,
    size: "1024x1024",
  });
  const item = d.data[0];
  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }
  if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`image url download failed HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("no b64_json or url in response: " + JSON.stringify(d).slice(0, 300));
}

/** Verify the lockup with gpt-4o chat completions (NOT Responses API). Returns quoted text. */
async function verifyLockup(png: Buffer): Promise<string> {
  const dataUri = "data:image/png;base64," + png.toString("base64");
  const d = await openai("/chat/completions", {
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Does this image contain the exact text 'MetroReach Media'? Quote every visible word or phrase exactly as written, or reply NONE if there is no text.",
          },
          { type: "image_url", image_url: { url: dataUri } },
        ],
      },
    ],
    max_tokens: 500,
  });
  return (d.choices?.[0]?.message?.content ?? "").trim();
}

async function main() {
  const manifest: Array<{ slug: string; headline: string; prompt: string }> = JSON.parse(
    readFileSync(manifestPath, "utf8")
  );
  mkdirSync(outDir, { recursive: true });

  const failed: Array<any> = [];
  const results: Array<any> = [];
  let totalGen = 0;

  for (const [idx, item] of manifest.entries()) {
    const { slug, prompt } = item;
    const pngPath = join(outDir, `${slug}.png`);
    const webpPath = join(outDir, `${slug}.webp`);
    console.log(`[${idx + 1}/${manifest.length}] ${slug}`);

    // Skip if a valid file already exists (idempotent re-runs).
    if (existsSync(pngPath) && existsSync(webpPath)) {
      console.log("  already exists, skipping");
      results.push({ slug, ok: true, note: "exists" });
      continue;
    }

    let ok = false;
    let lockupText = "";
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      totalGen++;
      const p = attempt === 0 ? prompt : prompt + LOCKUP_SUFFIX;
      console.log(`  gen attempt ${attempt + 1}...`);
      const png = await generateImage(p);
      writeFileSync(pngPath, png);
      console.log(`  wrote ${pngPath} (${png.length} bytes)`);
      lockupText = await verifyLockup(png);
      console.log(`  lockup: ${lockupText.slice(0, 100) || "(empty)"}`);
      if (lockupText.includes("MetroReach Media")) {
        ok = true;
        break;
      }
      console.log("  lockup MISSING -> retry");
    }
    if (ok) {
      const webp = await sharp(pngPath).webp({ quality: 85 }).toFile(webpPath);
      console.log(`  wrote ${webpPath} (${webp.size} bytes)`);
      results.push({ slug, ok: true });
    } else {
      failed.push({ slug, prompt, gpt4o_text: lockupText });
      results.push({ slug, ok: false, gpt4o_text: lockupText });
    }
    await sleep(1500); // gentle pacing
  }

  writeFileSync(join(outDir, "verify-results.json"), JSON.stringify(results, null, 2));
  writeFileSync(join(outDir, "failed-lockup.json"), JSON.stringify(failed, null, 2));
  console.log(`\nDONE: ${results.filter((r) => r.ok).length}/${manifest.length} ok`);
  console.log(`Total gpt-image-2 API calls: ${totalGen}`);
  console.log(`Failed lockups: ${failed.map((f) => f.slug).join(", ") || "none"}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
