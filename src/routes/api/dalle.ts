import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import OpenAI from "openai";

const ALLOWED_SIZES = ["1024x1024", "1792x1024", "1024x1792"] as const;
const ALLOWED_QUALITIES = ["low", "medium", "high", "auto"] as const;

type DalleSize = (typeof ALLOWED_SIZES)[number];
type DalleQuality = (typeof ALLOWED_QUALITIES)[number];

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
          const openai = new OpenAI({ apiKey });
          const response = await openai.images.generate({
            model: "gpt-image-2",
            prompt: prompt.trim(),
            size: resolvedSize,
            quality: resolvedQuality,
            n: 1,
          });

          const imageUrl = response.data[0]?.url;

          if (!imageUrl) {
            return json(
              { error: "No image URL returned from DALL-E" },
              { status: 502 },
            );
          }

          return json({ url: imageUrl });
        } catch (err: any) {
          console.error("DALL-E API error:", err.message);

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
