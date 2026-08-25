#!/usr/bin/env bun
/**
 * One-off regeneration of 4 flagged Instagram images (gpt-image-2) meeting the
 * Premium Standard. Overwrites public/images/social/<slug>.png + .webp for the
 * same canonical URLs, then verifies each via gpt-4o *chat completions* with an
 * EXACT title-case "MetroReach Media" wordmark check (+ service-question check
 * for #1). Retries up to 3x per image on failure. Writes verify-results.json.
 *
 * Fixes:
 *  1. ig-one-question-content-2026-08-10  -> service-business questions (was e-commerce)
 *  2. ig-comments-are-content-2026-08-12  -> exact "MetroReach Media" title case
 *  3. ig-friday-planning-2026-08-14       -> exact "MetroReach Media" title case
 *  4. ig-case-marina-2026-08-17           -> exact "MetroReach Media" title case
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import sharp from "sharp";

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error("FATAL: OPENAI_API_KEY env var not set");
  process.exit(1);
}
const OUT = "public/images/social";
mkdirSync(OUT, { recursive: true });
const MAX_RETRIES = 3;

const TITLE_CASE = `IMPORTANT: render the wordmark in exact title case as "MetroReach Media" — never all-caps, never mixed case, spelling must be perfect.`;

// Corrected #1: service-business customer questions on-image.
const ONE_QUESTION = `Premium editorial social media graphic for marketing agency MetroReach Media. Centered radial composition: a concentric radar-of-questions built from glowing gold rings emanating from a single bright question-mark node at the center, six small rounded-corner UI content frames orbiting around it on thin electric blue arcs like answered posts arranged on a calendar wheel, fine dotted ticks tracking each orbit. Each orbiting content frame displays one short SERVICE-BUSINESS customer question in clean small legible type — questions like "How much does it cost?", "How long will it take?", "Do you serve my area?", and "What happens first?". Bold white headline text "ASKED & ANSWERED" stacked at the bottom. Exact wordmark "MetroReach Media" in small clean type along the bottom-left edge. Deep navy to charcoal radial gradient background, warm gold primary rings with electric blue secondary ticks, subtle dot-grid texture, glassmorphism on the orbiting frames, layered depth, sophisticated, editorial quality. No fake people, no stock photos, no AI imagery. 1024x1024.`;

const COMMENTS = `Premium editorial social media graphic for marketing agency MetroReach Media. Distributed asymmetric network composition: a large rounded speech-bubble node with a bold reply arrow at the top center, smaller glowing comment bubbles cascading down and outward connected by thin electric blue thread lines like a live conversation thread, varying bubble opacities creating depth. Bold white headline text "REPLY COUNTS" placed low-center. Exact wordmark "MetroReach Media" in small clean type along the bottom-left edge. Deep navy to charcoal radial gradient background, warm gold primary bubbles with electric blue connector lines, subtle dot-grid texture, glassmorphism on the bubbles, layered depth, sophisticated, editorial quality. No fake people, no stock photos, no AI imagery. 1024x1024.`;

const FRIDAY = `Premium editorial social media graphic for marketing agency MetroReach Media. Corner-weighted calendar composition: a large translucent calendar-page sheet tilted slightly counterclockwise in the lower-left, the Friday column tile filled with a warm gold glow, a slim electric blue forward arrow breaking out of that tile and curving upward-right toward open negative space, faint month-grid lines on the sheet. Bold white headline text "FRIDAY FIRST" placed in the upper-right open area. Exact wordmark "MetroReach Media" in small clean type along the bottom-left edge. Deep navy to charcoal radial gradient background, gold highlight with electric blue accent, subtle dot-grid texture, glassmorphism on the calendar sheet, layered depth, sophisticated, editorial quality. No fake people, no stock photos, no AI imagery. 1024x1024.`;

const CASE_MARINA = `Premium editorial social media graphic for marketing agency MetroReach Media. Technical blueprint composition: an overhead plan-view schematic of a marina rendered as a tidy grid of glowing gold rectangular slip berths, a central compass-ring in the middle, an electric blue location pin, fine drafting grid lines and dimension ticks along the edges, faint topographic contour lines underneath. Bold white headline text "THE DOCK MAP" placed in the upper-left. Exact wordmark "MetroReach Media" in small clean type along the bottom-right edge. Deep navy to charcoal blueprint background, gold primary with electric blue callout accents, subtle dot-grid texture, layered depth, sophisticated, engineered editorial quality. No fake people, no stock photos, no AI imagery. 1024x1024.`;

const ITEMS: Array<{ slug: string; prompt: string; checkService: boolean }> = [
  { slug: "ig-one-question-content-2026-08-10", prompt: ONE_QUESTION + " " + TITLE_CASE, checkService: true },
  { slug: "ig-comments-are-content-2026-08-12", prompt: COMMENTS + " " + TITLE_CASE, checkService: false },
  { slug: "ig-friday-planning-2026-08-14", prompt: FRIDAY + " " + TITLE_CASE, checkService: false },
  { slug: "ig-case-marina-2026-08-17", prompt: CASE_MARINA + " " + TITLE_CASE, checkService: false },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function openai(path: string, body: unknown, timeoutMs = 180000): Promise<any> {
  const url = `https://api.openai.com/v1${path}`;
  let lastErr: any = null;
  for (let attempt = 0; attempt < 7; attempt++) {
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

async function generateImage(prompt: string): Promise<Buffer> {
  const d = await openai("/images/generations", { model: "gpt-image-2", prompt, n: 1, size: "1024x1024" });
  const item = d.data[0];
  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`image url download failed HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("no b64_json or url: " + JSON.stringify(d).slice(0, 300));
}

interface Verdict {
  pass: boolean;
  quoted: string;
  reason: string;
}

async function verify(png: Buffer, checkService: boolean): Promise<Verdict> {
  const dataUri = "data:image/png;base64," + png.toString("base64");
  const text =
    "Does this image contain the exact text 'MetroReach Media' in title case? Quote every visible word exactly." +
    (checkService
      ? " Also list every customer question shown on the image, exactly as written. Are they service-business questions (cost, timeline, area served, process) rather than e-commerce (returns, orders, discounts)?"
      : "");
  const d = await openai("/chat/completions", {
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text },
          { type: "image_url", image_url: { url: dataUri } },
        ],
      },
    ],
    max_tokens: 700,
  });
  const quoted = (d.choices?.[0]?.message?.content ?? "").trim();
  const reasons: string[] = [];
  if (!/MetroReach Media/i.test(quoted)) reasons.push("no 'MetroReach Media' text reported");
  else if (!quoted.includes("MetroReach Media")) {
    // present but maybe wrong casing for Media
    const m = quoted.match(/MetroReach\s+(\w+)/);
    if (m && /media/i.test(m[1]) && m[1] !== "Media") reasons.push(`wordmark case wrong: '${m[0]}'`);
    else reasons.push("wordmark not exactly 'MetroReach Media'");
  }
  if (checkService && !reasons.length) {
    const qText = quoted.toLowerCase();
    if (/return|order|discount|track/i.test(qText)) reasons.push("e-commerce language detected on-image");
    if (!/cost|how long|area|first|take/i.test(qText)) reasons.push("no service-business questions confirmed");
  }
  return { pass: reasons.length === 0, quoted, reason: reasons.join("; ") || "OK" };
}

async function main() {
  const results: Array<any> = [];
  let totalGen = 0;
  for (const it of ITEMS) {
    const pngPath = join(OUT, `${it.slug}.png`);
    const webpPath = join(OUT, `${it.slug}.webp`);
    console.log(`\n=== ${it.slug} ===`);
    let ok = false;
    let last: Verdict = { pass: false, quoted: "", reason: "no attempt" };
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      totalGen++;
      console.log(`  gen attempt ${attempt + 1}...`);
      const png = await generateImage(it.prompt);
      writeFileSync(pngPath, png);
      console.log(`  wrote png (${png.length} bytes)`);
      last = await verify(png, it.checkService);
      console.log(`  verify: ${last.pass ? "PASS" : "FAIL"} — ${last.reason}`);
      console.log(`  quoted: ${last.quoted.slice(0, 400)}`);
      if (last.pass) { ok = true; break; }
      await sleep(2000);
    }
    if (ok) {
      const webp = await sharp(pngPath).webp({ quality: 85 }).toFile(webpPath);
      console.log(`  wrote ${webpPath} (${webp.size} bytes)`);
    } else {
      console.log(`  FAILED after ${MAX_RETRIES + 1} attempts`);
    }
    results.push({ slug: it.slug, ok, attempts: totalGen, quoted: last.quoted, reason: last.reason });
  }
  writeFileSync("scripts/verify-results-regenerated.json", JSON.stringify(results, null, 2));
  console.log(`\nDONE: ${results.filter((r) => r.ok).length}/${results.length} ok, total gen calls ${totalGen}`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
