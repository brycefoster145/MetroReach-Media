/**
 * editorial-poster.ts
 * ---------------------------------------------------------------------------
 * Editorial Poster — the flagship MetroReach Media design template.
 *
 * Concept: award-style typographic poster. One unmistakable focal point (the
 * headline), a single gold geometric accent, heavy negative space, and the
 * "MetroReach Media" wordmark set in small refined type at the bottom.
 *
 * Palette (3-colour max):
 *   Navy  #0A1628  — full-bleed background
 *   White #FFFFFF  — headline + tints (muted via alpha, still "white")
 *   Gold  #C9A84C  — the single geometric accent
 *
 * Typography:
 *   DM Sans 700  — headline (display / grotesque, strong impact)
 *   Inter 400    — subheadline + wordmark (refined, humanist)
 * ---------------------------------------------------------------------------
 */

import { createElement as h } from "react";
import type { DesignSpec } from "../image-renderer";
import {
  FONT_DM_SANS,
  FONT_INTER,
} from "../image-renderer";

/* ------------------------------------------------------------------ palette */
const NAVY = "#0A1628";
const WHITE = "#FFFFFF";
const GOLD = "#C9A84C";
/** Muted white (same white family, reduced alpha — keeps palette to 3). */
const MUTED = "rgba(255,255,255,0.62)";
const FAINT = "rgba(255,255,255,0.42)";

export type AccentShape = "line" | "square" | "circle" | "frame" | "dot";

export interface EditorialPosterParams {
  /** The hero headline. Use "\n" to force a line break. */
  headline: string;
  /** Optional short supporting line under the headline. */
  subheadline?: string;
  /** The single gold geometric accent shape. */
  accentShape?: AccentShape;
  /** Optional eyebrow label above the accent + headline. */
  eyebrow?: string;
}

/** Headline type scales down as the string grows so it never crowds the canvas. */
function headlineSize(text: string): number {
  const lines = text.split("\n");
  const longest = Math.max(...lines.map((l) => l.length));
  if (longest <= 11) return 118;
  if (longest <= 15) return 104;
  if (longest <= 20) return 92;
  if (longest <= 26) return 78;
  return 66;
}

/** Build the single gold accent element. */
function accent(node: AccentShape, color: string) {
  switch (node) {
    case "line":
      return h("div", {
        style: {
          width: 72,
          height: 4,
          backgroundColor: color,
        },
      });
    case "square":
      return h("div", {
        style: { width: 22, height: 22, backgroundColor: color },
      });
    case "dot":
      return h("div", {
        style: {
          width: 12,
          height: 12,
          borderRadius: "50%",
          backgroundColor: color,
        },
      });
    case "frame":
      return h("div", {
        style: {
          width: 32,
          height: 32,
          border: `3px solid ${color}`,
          boxSizing: "border-box",
        },
      });
    case "circle":
    default:
      return h("div", {
        style: {
          width: 20,
          height: 20,
          borderRadius: "50%",
          backgroundColor: color,
        },
      });
  }
}

/**
 * Compose a full editorial-poster DesignSpec.
 */
export function editorialPoster(
  params: EditorialPosterParams,
): DesignSpec {
  const {
    headline,
    subheadline,
    accentShape = "line",
    eyebrow,
  } = params;

  const hero: any[] = [];

  if (eyebrow) {
    hero.push(
      h(
        "div",
        {
          style: {
            fontFamily: FONT_INTER,
            fontWeight: 400,
            fontSize: 15,
            letterSpacing: "0.42em",
            textTransform: "uppercase",
            color: FAINT,
            marginBottom: 56,
          },
        },
        eyebrow,
      ),
    );
  }

  hero.push(accent(accentShape, GOLD));
  hero.push(
    h(
      "div",
      {
        style: {
          fontFamily: FONT_DM_SANS,
          fontWeight: 700,
          fontSize: headlineSize(headline),
          lineHeight: 1.05,
          letterSpacing: "-0.012em",
          color: WHITE,
          textAlign: "center",
          whiteSpace: "pre-line",
          marginTop: 44,
          maxWidth: 840,
        },
      },
      headline,
    ),
  );

  if (subheadline) {
    hero.push(
      h(
        "div",
        {
          style: {
            fontFamily: FONT_INTER,
            fontWeight: 400,
            fontSize: 28,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: MUTED,
            textAlign: "center",
            marginTop: 44,
            maxWidth: 720,
          },
        },
        subheadline,
      ),
    );
  }

  const element = h(
    "div",
    {
      style: {
        width: 1024,
        height: 1024,
        backgroundColor: NAVY,
        display: "flex",
        flexDirection: "column",
        padding: "96px 96px 84px",
        boxSizing: "border-box",
      },
    },
    // Top tract — intentionally empty (heavy negative space).
    h("div", { style: { display: "flex" } }),
    // Hero — vertically centred with generous air around it.
    h(
      "div",
      {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
        },
      },
      ...hero,
    ),
    // Bottom — the refined wordmark, centred, small, letter-spaced.
    h(
      "div",
      { style: { display: "flex", justifyContent: "center" } },
      h(
        "div",
        {
          style: {
            fontFamily: FONT_INTER,
            fontWeight: 400,
            fontSize: 15,
            letterSpacing: "0.34em",
            color: FAINT,
          },
        },
        "MetroReach Media",
      ),
    ),
  );

  const fonts = [
    { name: FONT_DM_SANS, weight: 700 as const, fileName: "dm-sans-700.ttf" },
    { name: FONT_INTER, weight: 400 as const, fileName: "inter-400.ttf" },
  ];

  return { width: 1024, height: 1024, fonts, element };
}

/** Registry of available design templates (design name -> factory). */
export const designRegistry: Record<
  string,
  (p: EditorialPosterParams) => DesignSpec
> = {
  editorial: editorialPoster,
};

/** Resolve the accent-shape string to a valid AccentShape. */
export function toAccentShape(value: string | undefined): AccentShape {
  const allowed: AccentShape[] = ["line", "square", "circle", "frame", "dot"];
  if (value && allowed.includes(value as AccentShape)) {
    return value as AccentShape;
  }
  return "line";
}
