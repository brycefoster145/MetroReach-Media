/**
 * render-image.ts — render a single MetroReach Media social graphic.
 *
 * Usage:
 *   bun run scripts/render-image.ts editorial "QUALITY OVER VOLUME" \
 *     "MetroReach Media" [accentShape] [outputPath]
 *
 * Arguments:
 *   design       (required) template name, e.g. "editorial"
 *   headline     (required) hero headline text ("\n" for a line break)
 *   subheadline  (optional) supporting line under the headline
 *   accentShape  (optional) line | square | circle | frame | dot (default line)
 *   outputPath   (optional) destination PNG; defaults to
 *                /home/team/shared/social/graphics/code-test.png
 *
 * Also writes a .webp alongside the output when a destination is given.
 */

import { join } from "node:path";
import {
  editorialPoster,
  toAccentShape,
  type EditorialPosterParams,
} from "../src/lib/designs/editorial-poster";
import { renderDesignMulti, slugify } from "../src/lib/image-renderer";

function usageAndExit(): never {
  console.error(
    `Usage: bun run scripts/render-image.ts <design> "<headline>" [subheadline] [accentShape] [outputPath]\n` +
      `  design:      editorial\n` +
      `  accentShape: line | square | circle | frame | dot\n` +
      `  example: bun run scripts/render-image.ts editorial "QUALITY OVER VOLUME" "MetroReach Media"`,
  );
  process.exit(1);
}

async function main() {
  const [, , design, headline, subheadline, accentShapeArg, outputPathArg] =
    process.argv;

  if (!design || !headline) usageAndExit();

  if (design !== "editorial") {
    console.error(`Unknown design "${design}". Available: editorial`);
    process.exit(1);
  }

  const params: EditorialPosterParams = {
    headline,
    subheadline:
      subheadline && subheadline !== "undefined" && subheadline !== "null"
        ? subheadline
        : undefined,
    accentShape: toAccentShape(accentShapeArg),
  };

  const spec = editorialPoster(params);

  const defaultOut = "/home/team/shared/social/graphics/code-test.png";
  const outputPng = outputPathArg
    ? join(process.cwd(), outputPathArg)
    : defaultOut;

  const started = Date.now();
  const { png, webp } = await renderDesignMulti(spec, outputPng);
  const ms = Date.now() - started;

  console.log(`Rendered "${headline}" -> ${png} (${ms}ms)`);
  if (webp) console.log(`                     -> ${webp}`);
  console.log(`Slug: ${slugify(headline)}`);
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
