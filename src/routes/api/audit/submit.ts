/**
 * Free Social Media Audit — API Endpoint
 * POST /api/audit/submit
 *
 * Receives form data, runs the audit analysis engine,
 * stores the result, and returns a redirect URL.
 */

import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { runAudit } from "~/lib/audit-analyzer";
import type { AuditFormData } from "~/lib/audit-analyzer";

function generateId(): string {
  return `metro-${randomBytes(6).toString("hex")}`;
}

export const Route = createFileRoute("/api/audit/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let formData: AuditFormData;
        try {
          formData = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Validate required fields
        const missing: string[] = [];
        if (!formData.businessName?.trim()) missing.push("Business Name");
        if (!formData.email?.trim()) missing.push("Email Address");
        if (!formData.websiteUrl?.trim()) missing.push("Website URL");

        if (missing.length > 0) {
          return new Response(
            JSON.stringify({
              error: `Required fields missing: ${missing.join(", ")}`,
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          return new Response(
            JSON.stringify({ error: "Please enter a valid email address." }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Generate ID and run audit
        const id = generateId();

        let result;
        try {
          result = await runAudit(formData, id);
        } catch (err: any) {
          console.error("Audit analysis error:", err.message);
          return new Response(
            JSON.stringify({
              error:
                "We encountered an issue analyzing your profiles. Please try again or contact our team directly.",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Store result
        const auditsDir = "/home/team/shared/audits";
        try {
          await mkdir(auditsDir, { recursive: true });
        } catch {
          // Directory exists
        }
        await writeFile(
          join(auditsDir, `${id}.json`),
          JSON.stringify(result, null, 2),
          "utf-8"
        );

        return new Response(
          JSON.stringify({
            id,
            success: true,
            redirect: `/free-audit/report?id=${id}`,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
    },
  },
});
