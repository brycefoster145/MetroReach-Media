import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import OpenAI from "openai";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const ALLOWED_SIZES = [
  "1024x1024",
  "1792x1024",
  "1024x1792",
  "1536x1024",
  "1024x1536",
] as const;
const ALLOWED_QUALITIES = ["low", "medium", "high", "auto"] as const;

type DalleSize = (typeof ALLOWED_SIZES)[number];
type DalleQuality = (typeof ALLOWED_QUALITIES)[number];

// Directory for saving generated images (served as static files)
const SOCIAL_DIR = join(process.cwd(), "public", "social");

export const Route = createFileRoute("/api/dalle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return json(
            { error: "Server misconfigured: OPENAI_API_KEY not set" },
            { status: 500 },
          );
        }

        let body: {
          prompt?: string;
          size?: string;
          quality?: string;
          output_format?: string;
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, { status: 400 });
        }

        const { prompt, size, quality, output_format } = body;

        if (
          !prompt ||
          typeof prompt !== "string" ||
          prompt.trim().length === 0
        ) {
          return json(
            { error: "Missing required field: prompt" },
            { status: 400 },
          );
        }

        // gpt-image-2 supports up to 32000 chars (not 4000 like dalle-3)
        if (prompt.length > 32000) {
          return json(
            { error: "Prompt must be 32000 characters or fewer" },
            { status: 400 },
          );
        }

        // Validate size (gpt-image-2 supports 1024x1024, 1536x1024, 1024x1536)
        const resolvedSize: DalleSize = ALLOWED_SIZES.includes(size as DalleSize)
          ? (size as DalleSize)
          : "1024x1024";

        // Validate quality
        const resolvedQuality: DalleQuality = ALLOWED_QUALITIES.includes(
          quality as DalleQuality,
        )
          ? (quality as DalleQuality)
          : "high";

        // Validate output_format for gpt-image-2 (png, webp, jpeg)
        const resolvedFormat = ["png", "webp", "jpeg"].includes(
          output_format as string,
        )
          ? (output_format as "png" | "webp" | "jpeg")
          : "png";

        try {
          const openai = new OpenAI({ apiKey });
          const response = await openai.images.generate({
            model: "gpt-image-2",
            prompt: prompt.trim(),
            size: resolvedSize,
            quality: resolvedQuality,
            output_format: resolvedFormat,
            n: 1,
          });

          // ── Log the full response structure for debugging ──
          console.log(
            "[dalle] Response top-level keys:",
            Object.keys(response).join(", "),
          );
          console.log(
            "[dalle] response.data type:",
            typeof response.data,
            "length:",
            response.data?.length ?? "N/A",
          );

          // ── Extract image data ──
          // gpt-image-2 always returns b64_json (never url).
          // dalle-3 returns url (default) or b64_json (when response_format=b64_json).
          // The SDK normalizes both into response.data[0].{url, b64_json}.
          const imageItem = response.data?.[0];

          if (!imageItem) {
            console.error(
              "[dalle] response.data is empty or undefined. Full response:",
              JSON.stringify({
                keys: Object.keys(response),
                created: (response as any).created,
                data: response.data,
              }),
            );
            return json(
              {
                error:
                  "No image data in response. data array is empty or missing.",
              },
              { status: 502 },
            );
          }

          const imageKeys = Object.keys(imageItem);
          console.log("[dalle] data[0] keys:", imageKeys.join(", "));

          // Priority: url (dalle-3) → b64_json (gpt-image-2 / dalle-3 with b64_json)
          const b64Data: string | undefined =
            (imageItem as any).b64_json || undefined;
          const urlData: string | undefined =
            (imageItem as any).url || undefined;

          // ── Case 1: Direct URL (dalle-3 default) ──
          if (urlData) {
            console.log(
              "[dalle] Returning URL (length:",
              urlData.length,
              ")",
            );
            return json({ url: urlData });
          }

          // ── Case 2: Base64 (gpt-image-2 always, or dalle-3 with b64_json) ──
          if (b64Data) {
            console.log("[dalle] Decoding b64_json (length:", b64Data.length, ")");

            // Ensure output directory exists
            if (!existsSync(SOCIAL_DIR)) {
              mkdirSync(SOCIAL_DIR, { recursive: true });
            }

            // Decode base64 and save to file
            const buffer = Buffer.from(b64Data, "base64");
            const ext = resolvedFormat === "jpeg" ? "jpg" : resolvedFormat;
            const filename = `gen-${randomUUID().slice(0, 8)}.${ext}`;
            const filepath = join(SOCIAL_DIR, filename);
            writeFileSync(filepath, buffer);

            const publicUrl = `/social/${filename}`;
            console.log(
              "[dalle] Saved image to",
              filepath,
              "(",
              buffer.length,
              "bytes )",
            );
            console.log("[dalle] Public URL:", publicUrl);

            return json({ url: publicUrl, filename, saved: true });
          }

          // ── Case 3: Nothing found ──
          console.error(
            "[dalle] No url or b64_json in data[0]. Keys:",
            imageKeys.join(", "),
            "Sample values:",
            JSON.stringify(imageItem).slice(0, 200),
          );
          return json(
            {
              error: `No image data found. Available keys: [${imageKeys.join(", ")}]`,
            },
            { status: 502 },
          );
        } catch (err: any) {
          console.error("[dalle] API error:", err.message);

          // Forward OpenAI's error message when possible
          const message =
            err?.error?.message ||
            err?.message ||
            "DALL-E image generation failed";

          const status =
            err?.status === 401 || err?.status === 403
              ? 502
              : err?.status === 429
                ? 429
                : 502;

          return json({ error: message }, { status });
        }
      },
    },
  },
});
