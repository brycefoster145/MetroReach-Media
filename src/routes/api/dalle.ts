import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import OpenAI from "openai";

const ALLOWED_SIZES = ["1024x1024", "1792x1024", "1024x1792"] as const;
const ALLOWED_QUALITIES = ["low", "medium", "high", "auto"] as const;

type DalleSize = (typeof ALLOWED_SIZES)[number];
type DalleQuality = (typeof ALLOWED_QUALITIES)[number];

// Must stay under Vercel Pro's 60s limit; 50s gives a 10s buffer
const OPENAI_TIMEOUT_MS = 50_000;

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

        let body: { prompt?: string; size?: string; quality?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, { status: 400 });
        }

        const { prompt, size, quality } = body;

        if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
          return json(
            { error: "Missing required field: prompt" },
            { status: 400 },
          );
        }

        if (prompt.length > 4000) {
          return json(
            { error: "Prompt must be 4000 characters or fewer" },
            { status: 400 },
          );
        }

        // Validate size
        const resolvedSize: DalleSize = ALLOWED_SIZES.includes(size as DalleSize)
          ? (size as DalleSize)
          : "1024x1024";

        // Validate quality
        const resolvedQuality: DalleQuality = ALLOWED_QUALITIES.includes(
          quality as DalleQuality,
        )
          ? (quality as DalleQuality)
          : "high";

        try {
          const openai = new OpenAI({
            apiKey,
            timeout: OPENAI_TIMEOUT_MS,
            maxRetries: 0,
          });

          const response = await openai.images.generate({
            model: "gpt-image-2",
            prompt: prompt.trim(),
            size: resolvedSize,
            quality: resolvedQuality,
            n: 1,
          });

          // gpt-image-2 may return url or b64_json — handle both
          const imageUrl = response.data[0]?.url;
          const b64Json = response.data[0]?.b64_json;

          if (imageUrl) {
            return json({ url: imageUrl });
          }

          if (b64Json) {
            return json({ image: b64Json });
          }

          return json(
            { error: "No image data returned from image generation" },
            { status: 502 },
          );
        } catch (err: any) {
          console.error("Image generation API error:", err.message || err);

          // Detect timeout/abort errors
          if (
            err.name === "AbortError" ||
            err.name === "TimeoutError" ||
            (err.message && err.message.includes("timed out"))
          ) {
            return json(
              { error: "Image generation timed out — please try a smaller image size or a shorter prompt" },
              { status: 504 },
            );
          }

          // Forward OpenAI's error message when possible
          const message =
            err?.error?.message ||
            err?.message ||
            "Image generation failed";

          const status =
            err?.status === 401 || err?.status === 403
              ? 502
              : err?.status === 429
                ? 429
                : err?.status === 400
                  ? 400
                  : 502;

          return json({ error: message }, { status });
        }
      },
    },
  },
});
