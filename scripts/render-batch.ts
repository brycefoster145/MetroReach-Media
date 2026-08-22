/**
 * render-batch.ts — render many MetroReach Media social graphics in sequence.
 *
 * Usage:
 *   bun run scripts/render-batch.ts <batch.json>
 *
 * The JSON file is an array of design specs, each rendering to its own PNG
 * (+ a WebP alongside). Progress is logged per image.
 *
 * Batch spec shape:
 * [
 *   {
 *     "design": "editorial",
 *     "headline": "QUALITY OVER VOLUME",
 *     "subheadline": "MetroReach Media",
 *     "accentShape": "line",
 *     "output": "/path/to/out.png"        // optional; derived from headline if omitted
 *   },
 *   ...
 * ]
 */

import { join, parse } from "node:path";
import { readFile } from "node:fs/promises";
import {
  editorialPoster,
  toAccentShape,
  type EditorialPosterParams,
} from "../src/lib/designs/editorial-poster";
import {
  renderDesignMulti,
  slugify,
  withExtension,
} from "../src/lib/image-renderer";

interface BatchItem {
  design?: string;
  headline: string;
  subheadline?: string;
  accentShape?: string;
  output?: string;
}

const DEFAULT_DIR = "/home/team/shared/social/graphics";

async function main() {
  const [, , batchFile] = process.argv;
  if (!batchFile) {
    console.error("Usage: bun run scripts/render-batch.ts <batch.json>");
    process.exit(1);
  }

  const items = JSON.parse(
    await readFile(join(process.cwd(), batchFile), "utf8"),
  ) as BatchItem[];

  if (!Array.isArray(items) || items.length === 0) {
    console.error("Batch file must be a non-empty JSON array.");
    process.exit(1);
  }

  console.log(`Rendering ${items.length} graphic(s)...\n`);

  let ok = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const design = item.design ?? "editorial";

    if (design !== "editorial") {
      console.error(
        `  [${i + 1}/${items.length}] SKIP: unknown design "${design}"`,
      );
      continue;
    }

    const params: EditorialPosterParams = {
      headline: item.headline,
      subheadline: item.subheadline,
      accentShape: toAccentShape(item.accentShape),
    };
    const spec = editorialPoster(params);

    const outputPng = item.output
      ? join(process.cwd(), item.output)
      : join(DEFAULT_DIR, `${slugify(item.headline)}.png`);
    const outputWebp = withExtension(outputPng, "webp");

    const started = Date.now();
    const { png, webp } = await renderDesignMulti(spec, outputPng, outputWebp);
    const ms = Date.now() - started;

    console.log(
      `  [${i + 1}/${items.length}] OK "${item.headline}" -> ${parse(png).name}.png (+webp) (${ms}ms)`,
    );
    if (webp) console.log(`          -> ${webp}`);
    ok++;
  }

  console.log(`\nDone. ${ok}/${items.length} rendered.`);
  if (ok < items.length) process.exit(1);
}

main().catch((err) => {
  console.error("Batch render failed:", err);
  process.exit(1);
});
