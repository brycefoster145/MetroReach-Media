import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");
const SOURCE = "/home/team/shared/social/B7C44E87-B3C5-4773-9CAF-FE02671D39E3.png";

async function main() {
  console.log("Loading source...");
  const src = sharp(SOURCE);

  // 1. Compressed logo.png (<100KB)
  console.log("Generating logo.png (<100KB)...");
  await src
    .clone()
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .png({ quality: 60, palette: true, colors: 256 })
    .toFile(join(PUBLIC, "logo.png"));
  console.log("  -> public/logo.png done");

  // 2. WebP version
  console.log("Generating logo.webp...");
  await src
    .clone()
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 70 })
    .toFile(join(PUBLIC, "logo.webp"));
  console.log("  -> public/logo.webp done");

  // 3. logo-nav.png (36px height)
  console.log("Generating logo-nav.png (36px)...");
  await src
    .clone()
    .resize(undefined, 36, { fit: "inside", withoutEnlargement: true })
    .png({ quality: 80, palette: true, colors: 256 })
    .toFile(join(PUBLIC, "logo-nav.png"));
  console.log("  -> public/logo-nav.png done");

  // 4. logo-footer.png (44px height)
  console.log("Generating logo-footer.png (44px)...");
  await src
    .clone()
    .resize(undefined, 44, { fit: "inside", withoutEnlargement: true })
    .png({ quality: 80, palette: true, colors: 256 })
    .toFile(join(PUBLIC, "logo-footer.png"));
  console.log("  -> public/logo-footer.png done");

  // 5. logo-email.png (44px height)
  console.log("Generating logo-email.png (44px)...");
  await src
    .clone()
    .resize(undefined, 44, { fit: "inside", withoutEnlargement: true })
    .png({ quality: 80, palette: true, colors: 256 })
    .toFile(join(PUBLIC, "logo-email.png"));
  console.log("  -> public/logo-email.png done");

  // 6. favicon-32.png (32x32)
  console.log("Generating favicon-32.png (32x32)...");
  await src
    .clone()
    .resize(32, 32, { fit: "cover" })
    .png({ quality: 80, palette: true, colors: 256 })
    .toFile(join(PUBLIC, "favicon-32.png"));
  console.log("  -> public/favicon-32.png done");

  // 7. logo-og.png on dark background 1200x630 <100KB
  console.log("Generating logo-og.png (1200x630, dark bg)...");
  // Create a dark background, then composite the logo on top
  const logoResized = await src
    .clone()
    .resize(300, 300, { fit: "inside" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 10, g: 10, b: 20, alpha: 1 },
    },
  })
    .composite([{ input: logoResized, gravity: "center" }])
    .png({ quality: 70, palette: true, colors: 256 })
    .toFile(join(PUBLIC, "logo-og.png"));
  console.log("  -> public/logo-og.png done");

  // Report sizes
  const files = [
    "logo.png",
    "logo.webp",
    "logo-nav.png",
    "logo-footer.png",
    "logo-email.png",
    "favicon-32.png",
    "logo-og.png",
  ];
  const { statSync } = await import("fs");
  for (const f of files) {
    const path = join(PUBLIC, f);
    try {
      const s = statSync(path);
      console.log(`  ${f}: ${(s.size / 1024).toFixed(1)} KB`);
    } catch (e) {
      console.log(`  ${f}: MISSING`);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
