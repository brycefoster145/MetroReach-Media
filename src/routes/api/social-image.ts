/**
 * Serve generated social images from /tmp.
 * GET /api/social-image?file=abc123.webp
 *
 * This handles images saved to /tmp/social/generated/ (Vercel serverless fallback)
 * or public/social/generated/ (dev environment).
 */
import { createFileRoute } from "@tanstack/react-router";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { json } from "@tanstack/react-start";

const DIRS = [
  join(process.cwd(), "public", "social", "generated"),
  join("/", "tmp", "social", "generated"),
];

export const Route = createFileRoute("/api/social-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const file = url.searchParams.get("file");

        if (!file) {
          return json({ error: "Missing ?file= parameter" }, { status: 400 });
        }

        // Security: only allow alphanumeric + dot + hyphen filenames, max 64 chars
        if (!/^[a-zA-Z0-9._-]{1,64}$/.test(file)) {
          return json({ error: "Invalid filename" }, { status: 400 });
        }

        // Only .webp and .png extensions
        if (!file.endsWith(".webp") && !file.endsWith(".png")) {
          return json({ error: "Invalid file type" }, { status: 400 });
        }

        for (const dir of DIRS) {
          const filePath = join(dir, file);
          if (existsSync(filePath)) {
            const buffer = readFileSync(filePath);
            return new Response(buffer, {
              status: 200,
              headers: {
                "Content-Type":
                  file.endsWith(".png") ? "image/png" : "image/webp",
                "Cache-Control": "public, max-age=86400",
              },
            });
          }
        }

        return json({ error: "Image not found" }, { status: 404 });
      },
    },
  },
});
