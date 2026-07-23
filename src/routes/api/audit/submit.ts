/**
 * Free Social Media Audit — API Endpoint
 * POST /api/audit/submit
 *
 * Receives form data, saves the lead, runs the audit analysis,
 * updates the lead with results, and returns the report URL.
 * Lead persists even if analysis fails.
 */

import { createFileRoute } from "@tanstack/react-router";
import { runAudit } from "~/lib/audit-analyzer";
import {
  createLead,
  findLeadByEmail,
  markAnalyzing,
  markComplete,
  markFailed,
  type LeadFormData,
} from "~/lib/lead-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidUrl(str: string): boolean {
  if (!str || !str.trim()) return true; // empty is OK for optional fields
  try {
    const url = new URL(str.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/api/audit/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Parse body
        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "We couldn't process your submission. Please try again." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const formData: LeadFormData = {
          businessName: String(body.businessName || "").trim(),
          websiteUrl: String(body.websiteUrl || "").trim(),
          industry: String(body.industry || "").trim(),
          location: String(body.location || "").trim(),
          primaryGoal: String(body.primaryGoal || "").trim(),
          facebookUrl: String(body.facebookUrl || "").trim(),
          instagramUrl: String(body.instagramUrl || "").trim(),
          linkedinUrl: String(body.linkedinUrl || "").trim(),
          tiktokUrl: String(body.tiktokUrl || "").trim(),
          googleBusinessUrl: String(body.googleBusinessUrl || "").trim(),
          contactName: String(body.contactName || "").trim(),
          email: String(body.email || "").trim(),
          phone: String(body.phone || "").trim(),
        };

        // Validate required fields
        const missing: string[] = [];
        if (!formData.businessName) missing.push("Business name");
        if (!formData.websiteUrl) missing.push("Website URL");
        if (!formData.industry) missing.push("Industry");
        if (!formData.location) missing.push("Business location");
        if (!formData.primaryGoal) missing.push("Primary goal");
        if (!formData.contactName) missing.push("Contact name");
        if (!formData.email) missing.push("Email");

        if (missing.length > 0) {
          return new Response(
            JSON.stringify({ error: `Please complete these required fields: ${missing.join(", ")}.` }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Validate formats
        if (!isValidEmail(formData.email)) {
          return new Response(
            JSON.stringify({ error: "Please enter a valid email address." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Validate website URL format
        if (formData.websiteUrl && !isValidUrl(formData.websiteUrl)) {
          return new Response(
            JSON.stringify({
              error: "Please enter a valid website URL (e.g., https://yourbusiness.com).",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Validate social URLs (optional but must be valid if provided)
        const socialFields: [string, string][] = [
          ["facebookUrl", "Facebook URL"],
          ["instagramUrl", "Instagram URL"],
          ["linkedinUrl", "LinkedIn URL"],
          ["tiktokUrl", "TikTok URL"],
          ["googleBusinessUrl", "Google Business Profile URL"],
        ];
        for (const [field, label] of socialFields) {
          const val = formData[field as keyof LeadFormData];
          if (val && !isValidUrl(val)) {
            return new Response(
              JSON.stringify({ error: `Please enter a valid ${label} or leave it blank.` }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
        }

        // Check consent
        if (!body.consent) {
          return new Response(
            JSON.stringify({
              error: "Please confirm your consent for us to analyze your publicly accessible business information.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // ── Step 1: Save the lead FIRST ──
        let lead;
        try {
          // Check for duplicate by email
          const existing = await findLeadByEmail(formData.email);
          if (existing) {
            // Return the existing lead's report — don't create duplicates
            return new Response(
              JSON.stringify({
                id: existing.id,
                success: true,
                redirect: `/free-audit/report?id=${existing.id}`,
                existing: true,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          lead = await createLead(formData);
        } catch (err: any) {
          console.error("Lead creation error:", err.message);
          return new Response(
            JSON.stringify({
              error: "We had trouble saving your information. Please try again.",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        // ── Step 2: Run analysis ──
        try {
          await markAnalyzing(lead.id);
          const result = await runAudit(formData, lead.id);

          // Build findings summary
          const recNames = result.serviceRecommendations.map((r) => r.name).join(", ");
          const findingsSummary =
            `Overall score: ${result.scores.overall}/100. ` +
            `Top strengths: ${result.strengths[0]?.slice(0, 80)}... ` +
            `Primary weaknesses: ${result.weaknesses[0]?.slice(0, 80)}... ` +
            `Recommended: ${recNames}. ` +
            `Confidence: ${result.recommendationConfidence}.`;

          const recommendedPackage =
            result.serviceRecommendations[0]?.name || "Scale Package";

          // Update lead with results
          await markComplete(
            lead.id,
            {
              overall: result.scores.overall,
              categories: result.scores.categories,
            },
            findingsSummary,
            recommendedPackage,
            result.recommendationConfidence
          );

          // Also save the full result to the audits directory for the report page
          const { mkdir, writeFile } = await import("node:fs/promises");
          const { join } = await import("node:path");
          const auditsDir = "/home/team/shared/data/audits";
          await mkdir(auditsDir, { recursive: true });
          await writeFile(
            join(auditsDir, `${lead.id}.json`),
            JSON.stringify(result, null, 2),
            "utf-8"
          );

          return new Response(
            JSON.stringify({
              id: lead.id,
              success: true,
              redirect: `/free-audit/report?id=${lead.id}`,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (err: any) {
          console.error("Audit analysis error:", err.message);

          // Mark as failed but the lead persists
          try {
            await markFailed(lead.id, err.message || "Analysis could not be completed");
          } catch {
            // Best effort
          }

          return new Response(
            JSON.stringify({
              error:
                "We encountered an issue while analyzing your profiles. Your information has been saved and our team will review it. Please try again or contact us directly for assistance.",
              leadId: lead.id,
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
