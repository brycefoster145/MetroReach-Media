/**
 * image-renderer.ts
 * ---------------------------------------------------------------------------
 * Code-based image rendering pipeline for MetroReach Media social graphics.
 *
 * Replaces failed AI image generation with precise, programmatic design.
 * Uses Satori (HTML/CSS -> SVG) for layout + typography, then Sharp (SVG -> PNG)
 * for rasterization. Every position is mathematically exact — no AI artifacts,
 * no base64 decoding, no API costs, no rate limits.
 *
 * Pipeline:
 *   1. A design template composes a React element tree (JSX-like) from a spec.
 *   2. Satori lays it out with real OpenType fonts to an SVG string.
 *   3. Sharp converts the SVG to a 1024x1024 PNG written to disk.
 *
 * Fonts are bundled locally (src/lib/fonts/*.ttf) so rendering is deterministic
 * and offline — nothing is fetched at render time.
 * ---------------------------------------------------------------------------
 */

import satori from "satori";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";

/** Absolute path to the local bundled fonts directory. */
const FONTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "fonts");

/** A single font face available to Satori. `fileName` is relative to FONTS_DIR. */
export interface FontSpec {
  name: string;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  fileName: string;
}

/** The full design contract passed to the renderer. */
export interface DesignSpec {
  /** Canvas width in px. 1024 for a square Instagram/fb post. */
  width: number;
  /** Canvas height in px. 1024 for a square post. */
  height: number;
  /** Font faces this design may reference. */
  fonts: FontSpec[];
  /** The composed React element tree (built by a design template). */
  element: ReactElement;
}

/*
 * ---------------------------------------------------------------------------
 * Standalone font registry — the faces this pipeline ships with.
 * ---------------------------------------------------------------------------
 * Inter          — body / refined small caps (the "wordmark" face)
 * DM Sans        — headline / display face (geometric grotesque, strong impact)
 */
export const FONT_INTER = "Inter";
export const FONT_DM_SANS = "DM Sans";

export const bundledFonts: FontSpec[] = [
  { name: FONT_INTER, weight: 400, fileName: "inter-400.ttf" },
  { name: FONT_INTER, weight: 700, fileName: "inter-700.ttf" },
  { name: FONT_DM_SANS, weight: 500, fileName: "dm-sans-500.ttf" },
  { name: FONT_DM_SANS, weight: 700, fileName: "dm-sans-700.ttf" },
  { name: FONT_DM_SANS, weight: 900, fileName: "dm-sans-900.ttf" },
];

/**
 * Load every font listed in the design's `fonts` array from the bundled
 * directory and return the Satori `fonts` option value.
 */
async function resolveFonts(fonts: FontSpec[]) {
  return Promise.all(
    fonts.map(async (f) => {
      const data = await readFile(join(FONTS_DIR, f.fileName));
      return {
        name: f.name,
        weight: f.weight,
        style: "normal" as const,
        data,
      };
    }),
  );
}

/** Render a design spec to an SVG string (no disk IO). */
export async function renderToSvg(spec: DesignSpec): Promise<string> {
  const fonts = await resolveFonts(spec.fonts);
  return satori(spec.element, {
    width: spec.width,
    height: spec.height,
    fonts,
  });
}

/** Render a design spec to a PNG buffer. */
export async function renderToPngBuffer(spec: DesignSpec): Promise<Buffer> {
  const svg = await renderToSvg(spec);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Render a design spec to a PNG on disk.
 * @returns the absolute path the PNG was written to.
 */
export async function renderDesign(
  spec: DesignSpec,
  outputPath: string,
): Promise<string> {
  const png = await renderToPngBuffer(spec);
  const dir = dirname(outputPath);
  await mkdir(dir, { recursive: true });
  await writeFile(outputPath, png);
  return outputPath;
}

/** Render to both PNG and WebP (the CDN format MetroReach serves). */
export async function renderDesignMulti(
  spec: DesignSpec,
  outputPng: string,
  outputWebp?: string,
): Promise<{ png: string; webp: string | null }> {
  const svg = await renderToSvg(spec);
  const pngBuf = await sharp(Buffer.from(svg)).png().toBuffer();
  await mkdir(dirname(outputPng), { recursive: true });
  await writeFile(outputPng, pngBuf);
  if (outputWebp) {
    await mkdir(dirname(outputWebp), { recursive: true });
    const webpBuf = await sharp(pngBuf).webp({ quality: 90 }).toBuffer();
    await writeFile(outputWebp, webpBuf);
  }
  return { png: outputPng, webp: outputWebp ?? null };
}

/** Slug-ify a string for use as a filename. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled"
  );
}

/** Derive a filename from an output path's base, e.g. "QUALITY OVER VOLUME". */
export function baseNameFrom(headline: string): string {
  return slugify(headline);
}

/** Replace the extension in a path with a new one. */
export function withExtension(path: string, ext: string): string {
  const p = parse(path);
  return join(p.dir, `${p.name}.${ext}`);
}
