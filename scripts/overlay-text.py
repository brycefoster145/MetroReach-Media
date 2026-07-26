#!/usr/bin/env python3
"""
MetroReach Media — Text Overlay Engine

Overlays guaranteed-correct text onto background images using Pillow.
Eliminates DALL-E text hallucinations forever — text is code-generated,
not AI-generated, so it can never be wrong.

Usage:
  python3 scripts/overlay-text.py \
    --bg background.webp \
    --headline "ONE CLIENT." \
    --subtitle "SEVEN SPECIALISTS." \
    --output output.webp

Font: DejaVu Sans Bold (system font, always available).
"""

import argparse
import sys
import os
from PIL import Image, ImageDraw, ImageFont

# ── Font paths (checked in priority order) ──────────────────────────────────
FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]

# ── Layout constants ────────────────────────────────────────────────────────
OVERLAY_OPACITY = 0.65          # Dark overlay bar opacity (0–1)
OVERLAY_HEIGHT_RATIO = 0.35     # Overlay bar height as fraction of image height
OVERLAY_Y_OFFSET_RATIO = 0.0    # 0 = bottom-aligned, negative = shift up
HEADLINE_SIZE_RATIO = 0.065     # Headline font size as fraction of image height
SUBTITLE_SIZE_RATIO = 0.035     # Subtitle font size as fraction of image height
TEXT_COLOR = (255, 255, 255)    # White
OVERLAY_COLOR = (6, 9, 18)      # #060912 — MetroReach dark background
HORIZONTAL_PADDING_RATIO = 0.08 # Padding from edges


def find_font():
    """Return the first available font path."""
    for path in FONT_PATHS:
        if os.path.exists(path):
            return path
    print("ERROR: No suitable font found. Tried:", FONT_PATHS, file=sys.stderr)
    sys.exit(1)


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    """Load a font at the given size, falling back gracefully."""
    try:
        return ImageFont.truetype(path, size)
    except Exception as e:
        print(f"WARNING: Failed to load font at size {size}: {e}", file=sys.stderr)
        return ImageFont.load_default()


def fit_text_to_width(
    draw: ImageDraw.Draw,
    text: str,
    font_path: str,
    max_width: int,
    max_height: int,
) -> tuple:
    """Binary-search for the largest font size that fits text within max_width and max_height."""
    lo, hi = 8, 300
    best_size = lo
    best_font = None

    while lo <= hi:
        mid = (lo + hi) // 2
        font = load_font(font_path, mid)
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]

        if w <= max_width and h <= max_height:
            best_size = mid
            best_font = font
            lo = mid + 1
        else:
            hi = mid - 1

    if best_font is None:
        best_font = load_font(font_path, best_size)

    return best_font, best_size


def wrap_text_to_width(
    draw: ImageDraw.Draw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
) -> list:
    """Wrap text into multiple lines to fit within max_width."""
    words = text.split()
    lines = []
    current_line = ""

    for word in words:
        test_line = f"{current_line} {word}".strip() if current_line else word
        bbox = draw.textbbox((0, 0), test_line, font=font)
        w = bbox[2] - bbox[0]

        if w <= max_width:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    return lines


def overlay_text(
    bg_path: str,
    headline: str,
    subtitle: str,
    output_path: str,
) -> None:
    """Main overlay function."""
    # ── Load background ─────────────────────────────────────────────────────
    if not os.path.exists(bg_path):
        print(f"ERROR: Background image not found: {bg_path}", file=sys.stderr)
        sys.exit(1)

    img = Image.open(bg_path).convert("RGBA")
    img_w, img_h = img.size

    # ── Font ────────────────────────────────────────────────────────────────
    font_path = find_font()

    # ── Create semi-transparent overlay bar ──────────────────────────────────
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)

    bar_height = int(img_h * OVERLAY_HEIGHT_RATIO)
    bar_y = img_h - bar_height + int(img_h * OVERLAY_Y_OFFSET_RATIO)
    bar_y = max(0, min(bar_y, img_h - bar_height))  # Clamp

    alpha = int(255 * OVERLAY_OPACITY)
    overlay_draw.rectangle(
        [(0, bar_y), (img_w, bar_y + bar_height)],
        fill=(*OVERLAY_COLOR, alpha),
    )

    # Composite overlay onto background
    img = Image.alpha_composite(img, overlay)

    # ── Prepare draw context ────────────────────────────────────────────────
    draw = ImageDraw.Draw(img)
    h_padding = int(img_w * HORIZONTAL_PADDING_RATIO)
    max_text_width = img_w - (2 * h_padding)

    # ── Calculate font sizes ────────────────────────────────────────────────
    headline_area_h = bar_height * 0.55
    subtitle_area_h = bar_height * 0.30

    # Ideally headline is larger; fit it
    headline_max_h = int(headline_area_h)
    headline_font, _ = fit_text_to_width(
        draw, headline, font_path, max_text_width, headline_max_h
    )

    subtitle_font = None
    if subtitle:
        subtitle_max_h = int(subtitle_area_h)
        subtitle_font, _ = fit_text_to_width(
            draw, subtitle, font_path, max_text_width, subtitle_max_h
        )

    # ── Measure and position ────────────────────────────────────────────────
    headline_lines = wrap_text_to_width(draw, headline, headline_font, max_text_width)
    subtitle_lines = (
        wrap_text_to_width(draw, subtitle, subtitle_font, max_text_width)
        if subtitle and subtitle_font
        else []
    )

    # Calculate total text block height
    line_heights = []
    for line in headline_lines + subtitle_lines:
        font = headline_font if line in headline_lines else subtitle_font
        bbox = draw.textbbox((0, 0), line, font=font)
        line_heights.append(bbox[3] - bbox[1])

    headline_height_total = sum(line_heights[:len(headline_lines)])
    subtitle_height_total = sum(line_heights[len(headline_lines):])
    gap = int(bar_height * 0.03) if subtitle_lines else 0

    total_text_h = headline_height_total + gap + subtitle_height_total

    # Center the text block vertically within the overlay bar
    text_start_y = bar_y + (bar_height - total_text_h) // 2

    # ── Draw headline lines ─────────────────────────────────────────────────
    y = text_start_y
    for i, line in enumerate(headline_lines):
        bbox = draw.textbbox((0, 0), line, font=headline_font)
        line_w = bbox[2] - bbox[0]
        line_h = bbox[3] - bbox[1]
        x = (img_w - line_w) // 2
        draw.text((x, y), line, fill=TEXT_COLOR, font=headline_font)
        y += line_h

    # ── Draw subtitle lines ─────────────────────────────────────────────────
    if subtitle_lines and subtitle_font:
        y += gap
        for line in subtitle_lines:
            bbox = draw.textbbox((0, 0), line, font=subtitle_font)
            line_w = bbox[2] - bbox[0]
            line_h = bbox[3] - bbox[1]
            x = (img_w - line_w) // 2
            draw.text((x, y), line, fill=TEXT_COLOR, font=subtitle_font)
            y += line_h

    # ── Convert to RGB and save as WEBP ──────────────────────────────────────
    img_rgb = img.convert("RGB")
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    img_rgb.save(output_path, "WEBP", quality=90)
    print(f"✅ Saved: {output_path} ({img_w}x{img_h})")


# ── CLI entry point ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Overlay text onto a background image (code-generated, no DALL-E hallucinations)"
    )
    parser.add_argument("--bg", required=True, help="Path to background image (WEBP/PNG/JPG)")
    parser.add_argument("--headline", required=True, help="Headline text to overlay")
    parser.add_argument("--subtitle", default="", help="Optional subtitle text")
    parser.add_argument("--output", required=True, help="Output path (WEBP)")
    args = parser.parse_args()

    overlay_text(
        bg_path=args.bg,
        headline=args.headline,
        subtitle=args.subtitle,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
