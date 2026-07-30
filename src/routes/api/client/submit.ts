/**
 * POST /api/client/submit — Client Content Submission Upload
 *
 * Handles multipart form uploads from the client submission page.
 * Saves files to public/uploads/<client-name>/<YYYY-MM-DD>/
 * Stores metadata alongside in a JSON manifest.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VIDEO_MAX = 100 * 1024 * 1024; // 100MB
const IMAGE_MAX = 20 * 1024 * 1024; // 20MB
const ALLOWED_VIDEO = ["video/mp4", "video/quicktime"];
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];

function sanitizeName(name: string): string {
  // Replace non-alphanumeric (except hyphens, underscores, spaces) with hyphens
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_\s]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export const Route = createFileRoute("/api/client/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require authentication
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
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Extract text fields
        const clientName = (formData.get("clientName") as string) || "";
        const assetType = (formData.get("assetType") as string) || "";
        const platformsRaw = (formData.get("platforms") as string) || "";
        const preferredDate = (formData.get("preferredDate") as string) || "";
        const caption = (formData.get("caption") as string) || "";
        const instructions = (formData.get("instructions") as string) || "";

        if (!clientName.trim()) {
          return new Response(
            JSON.stringify({ error: "Client name or account ID is required." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Parse platforms
        const platforms = platformsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        // Generate reference ID
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomPart = randomBytes(3).toString("hex").toUpperCase();
        const referenceId = `MR-${dateStr}-${randomPart}`;

        // Prepare storage directory
        const sanitizedClient = sanitizeName(clientName) || "unknown-client";
        const uploadDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const uploadDir = join(
          process.cwd(),
          "public",
          "uploads",
          sanitizedClient,
          uploadDate
        );

        try {
          mkdirSync(uploadDir, { recursive: true });
        } catch (err: any) {
          console.error("Failed to create upload directory:", err.message);
          return new Response(
            JSON.stringify({ error: "Server storage error. Please try again." }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        // Process files
        const savedFiles: {
          originalName: string;
          savedName: string;
          type: string;
          size: number;
          path: string;
        }[] = [];

        for (const [_key, value] of formData.entries()) {
          if (!(value instanceof File)) continue;

          // Validate type
          const isVideo = ALLOWED_VIDEO.includes(value.type);
          const isImage = ALLOWED_IMAGE.includes(value.type);

          if (!isVideo && !isImage) {
            return new Response(
              JSON.stringify({
                error: `Unsupported file type for "${value.name}". Use MP4, MOV, JPG, PNG, or WebP.`,
              }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Validate size
          const maxSize = isVideo ? VIDEO_MAX : IMAGE_MAX;
          const maxLabel = isVideo ? "100MB" : "20MB";

          if (value.size > maxSize) {
            return new Response(
              JSON.stringify({
                error: `File "${value.name}" exceeds ${maxLabel} limit.`,
              }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Generate safe filename with timestamp prefix to avoid collisions
          const timestamp = Date.now();
          const safeName = value.name
            .replace(/[^a-zA-Z0-9.\-_]/g, "-")
            .replace(/-+/g, "-")
            .slice(-120);
          const savedName = `${timestamp}-${safeName}`;

          // Write file to disk
          try {
            const buffer = Buffer.from(await value.arrayBuffer());
            const filePath = join(uploadDir, savedName);
            writeFileSync(filePath, buffer);

            savedFiles.push({
              originalName: value.name,
              savedName,
              type: value.type,
              size: value.size,
              path: filePath,
            });
          } catch (err: any) {
            console.error("Failed to write file:", err.message);
            return new Response(
              JSON.stringify({
                error: `Failed to save "${value.name}". Please try again.`,
              }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }
        }

        if (savedFiles.length === 0) {
          return new Response(
            JSON.stringify({ error: "No valid files were uploaded." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Save metadata manifest alongside files
        const manifest = {
          referenceId,
          submittedAt: new Date().toISOString(),
          clientName: clientName.trim(),
          assetType,
          platforms,
          preferredDate: preferredDate || null,
          caption: caption || null,
          instructions: instructions || null,
          files: savedFiles.map((f) => ({
            originalName: f.originalName,
            savedName: f.savedName,
            type: f.type,
            size: f.size,
          })),
        };

        try {
          const manifestPath = join(uploadDir, `${referenceId}-manifest.json`);
          writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        } catch (err: any) {
          console.error("Failed to write manifest:", err.message);
          // Non-fatal — files are saved, just log the warning
        }

        return new Response(
          JSON.stringify({
            success: true,
            referenceId,
            filesSaved: savedFiles.length,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      },
    },
  },
});
