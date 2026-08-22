/**
 * render-image.ts — render a single MetroReach Media social graphic.
 *
 * Usage:
 *   bun run scripts/render-image.ts layered "QUALITY OVER VOLUME" \
 *     "MetroReach Media" --accent "#C9A84C" --pattern dots [outputPath]
 *
 *   bun run scripts/render-image.ts editorial "QUALITY OVER VOLUME" \
 *     "MetroReach Media" [accentShape] [outputPath]
 *
 * Arguments:
 *   design       (required) template name: editorial | layered
 *   headline     (required) hero headline text ("\n" for a line break)
 *   subheadline  (optional) supporting line under the headline
 *   --accent     (layered, optional) primary accent hex, default #C9A84C
 *   --accent2    (layered, optional) secondary accent hex, default #4A90D9
 *   --pattern    (layered, optional) dots | grid | diagonal (default dots)
 *   outputPath   (optional) destination PNG
 *
 * Default output (layered): /home/team/shared/social/graphics/layered-test.png
 * Default output (editorial): /home/team/shared/social/graphics/code-test.png
 * Also writes a .webp alongside the output when a destination is given.
 */
import { join } from "node:path";
import type { DesignSpec } from "../src/lib/image-renderer";
import {
  editorialPoster,
  toAccentShape,
  type EditorialPosterParams,
} from "../src/lib/designs/editorial-poster";
import {
  createLayeredDesign,
  toLayeredPattern,
  type LayeredDepthParams,
} from "../src/lib/designs/layered-depth";
import { renderDesignMulti, slugify } from "../src/lib/image-renderer";

const DESIGN_NAMES = "editorial | layered";

function usageAndExit(): never {
  console.error(
    `Usage: bun run scripts/render-image.ts <design> "<headline>" [subheadline] [flags] [outputPath]\n` +
      `  design:      ${DESIGN_NAMES}\n` +
      `  flags (layered):\n` +
      `    --accent <hex>    primary accent color (default #C9A84C)\n` +
      `    --accent2 <hex>   secondary accent color (default #4A90D9)\n` +
      `    --pattern <type>  dots | grid | diagonal (default dots)\n` +
      `  example: bun run scripts/render-image.ts layered "QUALITY OVER VOLUME" "MetroReach Media" --accent "#C9A84C" --pattern dots`,
  );
  process.exit(1);
}

/** Extract `--flag value` pairs and positional tails from argv after index 2. */
function parseArgs(argv: string[]): {
  design: string;
  headline: string;
  subheadline?: string;
  accent: string;
  accent2: string;
  pattern: string;
  outputPath?: string;
} {
  const tokens = argv;
  if (tokens.length < 2) usageAndExit();
  const design = tokens[0];
  const headline = tokens[1];

  const flags: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 2; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith("--")) {
      const key = t.slice(2);
      const val = tokens[i + 1];
      if (val === undefined || val.startsWith("--")) {
        console.error(`Flag --${key} requires a value.`);
        usageAndExit();
      }
      flags[key] = val;
      i++; // consume value
    } else {
      positional.push(t);
    }
  }

  const subheadline =
    positional[0] && positional[0] !== "undefined" && positional[0] !== "null"
      ? positional[0]
      : undefined;
  const outputPath = positional[1];

  return {
    design,
    headline,
    subheadline,
    accent: flags.accent ?? "#C9A84C",
    accent2: flags.accent2 ?? "#4A90D9",
    pattern: flags.pattern ?? "dots",
    outputPath,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let spec: DesignSpec;
  if (args.design === "editorial") {
    const params: EditorialPosterParams = { headline: args.headline };
    if (args.subheadline) params.subheadline = args.subheadline;
    // Legacy positional 4th arg may carry an accent-shape token; not a --flag.
    const tail = process.argv.slice(4).filter((t) => !t.startsWith("--"));
    const shapeArg = tail.find((t) =>
      ["line", "square", "circle", "frame", "dot"].includes(t),
    );
    if (shapeArg) params.accentShape = toAccentShape(shapeArg);
    spec = editorialPoster(params);
  } else if (args.design === "layered") {
    const params: LayeredDepthParams = {
      headline: args.headline,
      accentColor: args.accent,
      accentColor2: args.accent2,
      pattern: toLayeredPattern(args.pattern),
    };
    if (args.subheadline) params.subheadline = args.subheadline;
    spec = createLayeredDesign(params);
  } else {
    console.error(`Unknown design "${args.design}". Available: ${DESIGN_NAMES}`);
    process.exit(1);
  }

  const defaultOut =
    args.design === "layered"
      ? "/home/team/shared/social/graphics/layered-test.png"
      : "/home/team/shared/social/graphics/code-test.png";
  const outputPng = args.outputPath ? join(process.cwd(), args.outputPath) : defaultOut;

  const started = Date.now();
  const { png, webp } = await renderDesignMulti(spec, outputPng);
  const ms = Date.now() - started;
  console.log(`Rendered "${args.headline}" -> ${png} (${ms}ms)`);
  if (webp) console.log(`                     -> ${webp}`);
  console.log(`Slug: ${slugify(args.headline)}`);
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
