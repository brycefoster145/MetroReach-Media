/**
 * layered-depth.ts
 * ---------------------------------------------------------------------------
 * "Layered Depth" — the anti-"made in Paint" MetroReach Media template.
 *
 * Concept: genuine visual complexity through four stacked layers, each adding
 * depth the flat editorial template lacked:
 *
 *   1. BACKGROUND  — rich radial gradient (center lighter, edges darker) so the
 *                    canvas is never a flat fill.
 *   2. PATTERN     — a repeating geometric texture (dot grid / line grid /
 *                    diagonal) at low opacity for visual rhythm.
 *   3. ACCENT GEO  — 3-5 asymmetric geometric shapes at varied opacities and
 *                    sizes. Glow is *simulated* via stacked concentric circles
 *                    of decreasing opacity / increasing radius (no filters).
 *   4. CONTENT     — headline + optional subheadline in a semi-transparent dark
 *                    panel for readability, with the "MetroReach Media" wordmark
 *                    letter-spaced at the bottom.
 *
 * Palette:
 *   Background  radial #1B2A4A -> #0A1628
 *   Text        white + muted alphas
 *   Accent      gold #C9A84C, blue #4A90D9, rose #D94A6A (1-2 per image)
 *
 * Typography:
 *   DM Sans 900 — headline (display / grotesque)
 *   Inter 400   — subheadline + wordmark (refined, humanist)
 * ---------------------------------------------------------------------------
 */

import { createElement as h } from "react";
import type { ReactElement } from "react";
import type { DesignSpec } from "../image-renderer";
import { FONT_DM_SANS, FONT_INTER } from "../image-renderer";

/* ---------------------------------------------------------------- palette */
const BG_CENTER = "#1B2A4A";
const BG_EDGE = "#0A1628";
const WHITE = "#FFFFFF";
const GOLD = "#C9A84C";
const BLUE = "#4A90D9";
const ROSE = "#D94A6A";
const MUTED = "rgba(255,255,255,0.62)";
const FAINT = "rgba(255,255,255,0.38)";
/** Semi-transparent dark panel behind the headline — readability with depth. */
const PANEL = "rgba(6,16,32,0.62)";
const PANEL_BORDER = "rgba(255,255,255,0.14)";

export type LayeredPattern = "dots" | "grid" | "diagonal";

export interface LayeredDepthParams {
  /** Hero headline. Use "\n" to force a line break. */
  headline: string;
  /** Optional short supporting line under the headline. */
  subheadline?: string;
  /** Primary accent — drives glow + main shapes. Default gold. */
  accentColor?: string;
  /** Optional secondary accent. Default cool blue. */
  accentColor2?: string;
  /** Texture pattern for layer 2. Default dots. */
  pattern?: LayeredPattern;
}

/** Headline type scales down as the string grows so it never crowds the canvas. */
function headlineSize(text: string): number {
  const lines = text.split("\n");
  const longest = Math.max(...lines.map((l) => l.length));
  if (longest <= 8) return 96;
  if (longest <= 12) return 84;
  if (longest <= 17) return 74;
  if (longest <= 22) return 62;
  if (longest <= 28) return 52;
  return 44;
}

/** Build a simulated glow: a colored core wrapped in fading rings. */
function glow(
  cx: number,
  cy: number,
  coreR: number,
  color: string,
  coreOpacity: number,
): ReactElement[] {
  const els: ReactElement[] = [];
  // Outer-to-inner halos — decreasing opacity, increasing radius.
  const ringRadii = [coreR * 1.2, coreR * 1.7, coreR * 2.4, coreR * 3.4];
  const ringOpac = [0.11, 0.075, 0.045, 0.022];
  ringRadii.forEach((r, i) => {
    const d = r * 2;
    els.push(
      h("div", {
        style: {
          position: "absolute",
          left: cx - r,
          top: cy - r,
          width: d,
          height: d,
          borderRadius: "50%",
          backgroundColor: color,
          opacity: ringOpac[i],
        },
      }),
    );
  });
  // Dense core.
  const d = coreR * 2;
  els.push(
    h("div", {
      style: {
        position: "absolute",
        left: cx - coreR,
        top: cy - coreR,
        width: d,
        height: d,
        borderRadius: "50%",
        backgroundColor: color,
        opacity: coreOpacity,
      },
    }),
  );
  return els;
}

/** Layer 2 — repeating dot grid across the canvas at low opacity. */
function dotGrid(size: number, spacing: number): ReactElement[] {
  const els: ReactElement[] = [];
  const r = 3.5;
  for (let y = spacing / 2; y < size; y += spacing) {
    for (let x = spacing / 2; x < size; x += spacing) {
      els.push(
        h("div", {
          style: {
            position: "absolute",
            left: x - r,
            top: y - r,
            width: r * 2,
            height: r * 2,
            borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,0.07)",
          },
        }),
      );
    }
  }
  return els;
}

/** Layer 2 — thin intersecting line grid at low opacity. */
function lineGrid(size: number, spacing: number): ReactElement[] {
  const els: ReactElement[] = [];
  for (let p = spacing; p < size; p += spacing) {
    els.push(
      h("div", {
        style: {
          position: "absolute",
          left: 0,
          top: p,
          width: size,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.05)",
        },
      }),
    );
    els.push(
      h("div", {
        style: {
          position: "absolute",
          top: 0,
          left: p,
          width: 1,
          height: size,
          backgroundColor: "rgba(255,255,255,0.05)",
        },
      }),
    );
  }
  return els;
}

/** Layer 2 — diagonal hatch lines at low opacity. */
function diagonal(size: number, spacing: number): ReactElement[] {
  const els: ReactElement[] = [];
  const cols = Math.ceil(size / spacing) * 2;
  for (let i = -cols; i < cols; i++) {
    const offset = i * spacing;
    els.push(
      h("div", {
        style: {
          position: "absolute",
          left: offset,
          top: 0,
          width: size * 1.5,
          height: 2,
          backgroundColor: "rgba(255,255,255,0.05)",
          transform: `rotate(${-22}deg)`,
          transformOrigin: "0 0",
        },
      }),
    );
  }
  return els;
}

/** Layer 2 — dispatch by pattern. */
function pattern(pat: LayeredPattern, size: number, spacing: number): ReactElement[] {
  switch (pat) {
    case "grid":
      return lineGrid(size, spacing);
    case "diagonal":
      return diagonal(size, spacing);
    default:
      return dotGrid(size, spacing);
  }
}

/**
 * Compose a full "Layered Depth" DesignSpec.
 */
export function createLayeredDesign(
  params: LayeredDepthParams,
): DesignSpec {
  const size = 1080;
  const pad = 110;
  const {
    headline,
    subheadline,
    accentColor = GOLD,
    accentColor2 = BLUE,
    pattern: pat = "dots",
  } = params;

  /* Layer 1 — rich radial background (center lighter, edges darker). */
  const background = h("div", {
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: `radial-gradient(circle at 50% 34%, ${BG_CENTER} 0%, ${BG_EDGE} 72%)`,
    },
  });
  // A second, faint sheen for extra tonal variation (never flat).
  const sheen = h("div", {
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: `linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 42%)`,
    },
  });

  /* Layer 2 — geometric texture. */
  const texture = h("div", {
    style: { position: "absolute", inset: 0, display: "flex" },
    children: pattern(pat, size, 56),
  });

  /* Layer 3 — accent geometry (glow + scattered shapes). */
  const accents: ReactElement[] = [];
  // Large warm glow, offset top-right — the primary depth anchor.
  accents.push(...glow(848, 246, 108, accentColor, 0.5));
  // Secondary cool glow, bottom-left — complementary light source.
  accents.push(...glow(176, 806, 74, accentColor2, 0.42));
  // Small tertiary glow, mid-right edge.
  accents.push(...glow(1006, 640, 52, accentColor, 0.3));
  // Scattered smaller geometric shapes at varying opacity.
  // Soft rounded rectangle, left-mid, rotated.
  accents.push(
    h("div", {
      style: {
        position: "absolute",
        left: 96,
        top: 470,
        width: 132,
        height: 196,
        borderRadius: 28,
        backgroundColor: accentColor,
        opacity: 0.22,
        transform: "rotate(-14deg)",
        transformOrigin: "center",
      },
    }),
  );
  // Outlined ring, upper-left, hexagonal rhythm.
  accents.push(
    h("div", {
      style: {
        position: "absolute",
        left: 118,
        top: 120,
        width: 70,
        height: 70,
        borderRadius: "50%",
        border: `2px solid ${accentColor2}`,
        opacity: 0.35,
        boxSizing: "border-box",
      },
    }),
  );
  // Small filled circle, lower-right.
  accents.push(
    h("div", {
      style: {
        position: "absolute",
        left: 940,
        top: 812,
        width: 46,
        height: 46,
        borderRadius: "50%",
        backgroundColor: accentColor2,
        opacity: 0.5,
      },
    }),
  );
  // Small filled square, upper-center-right.
  accents.push(
    h("div", {
      style: {
        position: "absolute",
        left: 640,
        top: 150,
        width: 20,
        height: 20,
        backgroundColor: WHITE,
        opacity: 0.18,
        transform: "rotate(45deg)",
        transformOrigin: "center",
      },
    }),
  );
  // Thin diagonal line spanning the canvas at low opacity.
  accents.push(
    h("div", {
      style: {
        position: "absolute",
        left: -180,
        top: 330,
        width: size * 1.4,
        height: 2,
        backgroundColor: "rgba(255,255,255,0.10)",
        transform: "rotate(-20deg)",
        transformOrigin: "0 0",
      },
    }),
  );
  // A second faint diagonal crossing the first for depth.
  accents.push(
    h("div", {
      style: {
        position: "absolute",
        left: 80,
        top: -160,
        width: size * 1.2,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.06)",
        transform: "rotate(18deg)",
        transformOrigin: "0 0",
      },
    }),
  );

  const layersBack = h(
    "div",
    {
      // Paint first (DOM order) so it sits behind in-flow content.
      style: { position: "absolute", inset: 0, display: "flex" },
    },
    background,
    sheen,
    texture,
    ...accents,
  );

  /* Layer 4 — content: headline panel + subheadline + wordmark. */
  const contentChildren: ReactElement[] = [];
  // Eyebrow-accent tick above the panel.
  contentChildren.push(
    h("div", {
      style: {
        width: 56,
        height: 4,
        backgroundColor: accentColor,
        marginBottom: 34,
        borderRadius: 2,
      },
    }),
  );
  contentChildren.push(
    h(
      "div",
      {
        style: {
          fontFamily: FONT_DM_SANS,
          fontWeight: 900,
          fontSize: headlineSize(headline),
          lineHeight: 1.05,
          letterSpacing: "-0.012em",
          color: WHITE,
          textAlign: "center",
          whiteSpace: "pre-line",
          maxWidth: size - pad * 2,
        },
      },
      headline,
    ),
  );
  if (subheadline) {
    contentChildren.push(
      h(
        "div",
        {
          style: {
            fontFamily: FONT_INTER,
            fontWeight: 400,
            fontSize: 26,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: MUTED,
            textAlign: "center",
            marginTop: 36,
            maxWidth: size - pad * 2,
          },
        },
        subheadline,
      ),
    );
  }

  const content = h(
    "div",
    {
      style: {
        position: "relative",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: `0 ${pad}px`,
        boxSizing: "border-box",
      },
    },
    // The semi-transparent dark backdrop panel behind the text block.
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: PANEL,
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 28,
          padding: "58px 60px 52px",
          maxWidth: size - pad * 2 - 60,
          position: "relative",
        },
      },
      // Inner hairline ring echoes the panel framing (stable across renderers).
      h("div", {
        style: {
          position: "absolute",
          inset: 8,
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 20,
        },
      }),
      ...contentChildren,
    ),
  );

  // Bottom wordmark.
  const wordmark = h(
    "div",
    {
      style: {
        position: "relative",
        display: "flex",
        justifyContent: "center",
        paddingBottom: 52,
      },
    },
    h(
      "div",
      {
        style: {
          fontFamily: FONT_INTER,
          fontWeight: 400,
          fontSize: 28,
          letterSpacing: "0.34em",
          color: "rgba(255,255,255,0.7)",
        },
      },
      "MetroReach Media",
    ),
  );

  const element = h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        backgroundColor: BG_EDGE,
      },
    },
    layersBack,
    content,
    wordmark,
  );

  const fonts = [
    { name: FONT_DM_SANS, weight: 900 as const, fileName: "dm-sans-900.ttf" },
    { name: FONT_INTER, weight: 400 as const, fileName: "inter-400.ttf" },
  ];

  return { width: size, height: size, fonts, element };
}

/** Registry of available design templates (name -> factory). */
export const designRegistry: Record<string, (p: LayeredDepthParams) => DesignSpec> = {
  layered: createLayeredDesign,
};

/** Resolve the pattern string to a valid LayeredPattern. */
export function toLayeredPattern(value: string | undefined): LayeredPattern {
  const allowed: LayeredPattern[] = ["dots", "grid", "diagonal"];
  if (value && allowed.includes(value as LayeredPattern)) {
    return value as LayeredPattern;
  }
  return "dots";
}
