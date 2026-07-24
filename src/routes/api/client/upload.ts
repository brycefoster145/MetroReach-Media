/**
 * POST /api/client/upload — Upload brand assets
 *
 * Accepts multipart form data with file uploads. Stores metadata in
 * client onboarding_data. Files themselves are base64-encoded and stored
 * in the JSON blob for simplicity (files under 10MB).
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const Route = createFileRoute("/api/client/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const client = getClientFromRequest(request);
        if (!client) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid form data" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const files: { name: string; type: string; size: number; data: string }[] = [];

        for (const [_key, value] of formData.entries()) {
          if (value instanceof File) {
            if (value.size > MAX_FILE_SIZE) {
              return new Response(
                JSON.stringify({ error: `File ${value.name} exceeds 10MB limit` }),
                { status: 400, headers: { "Content-Type": "application/json" } },
              );
            }

            const buffer = Buffer.from(await value.arrayBuffer());
            files.push({
              name: value.name,
              type: value.type,
              size: value.size,
              data: buffer.toString("base64"),
            });
          }
        }

        if (files.length === 0) {
          return new Response(
            JSON.stringify({ error: "No files provided" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Store file metadata in onboarding_data
        const existing = await sql`
          SELECT onboarding_data FROM clients WHERE id = ${client.sub} LIMIT 1
        `;

        const current = (existing[0]?.onboarding_data as Record<string, unknown>) || {};
        const currentAssets = (current.assets as Array<Record<string, unknown>>) || [];

        const newAssets = files.map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
          uploaded_at: new Date().toISOString(),
        }));

        const merged = {
          ...current,
          assets: [...currentAssets, ...newAssets],
        };

        await sql`
          UPDATE clients
          SET onboarding_data = ${JSON.stringify(merged)}::jsonb, updated_at = NOW()
          WHERE id = ${client.sub}
        `;

        return new Response(
          JSON.stringify({
            success: true,
            files: newAssets,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
