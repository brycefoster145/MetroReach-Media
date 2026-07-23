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
  markEmailSent,
  type LeadFormData,
} from "~/lib/lead-store";
import { sendEmail } from "~/lib/email";

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
          // Gracefully handle read-only filesystems (Vercel serverless)
          try {
            const { mkdir, writeFile } = await import("node:fs/promises");
            const { join } = await import("node:path");
            const auditsDir = "/home/team/shared/data/audits";
            await mkdir(auditsDir, { recursive: true });
            await writeFile(
              join(auditsDir, `${lead.id}.json`),
              JSON.stringify(result, null, 2),
              "utf-8"
            );
          } catch (fsErr: any) {
            console.warn("Audit file write skipped (read-only filesystem):", fsErr.message);
            // Non-critical — lead record already contains all data via markComplete
          }

          // ── Step 3: Send email notification ──
          try {
            const reportUrl = `https://www.metroreachagency.com/free-audit/report?id=${lead.id}`;
            const primaryRec = result.serviceRecommendations[0];
            const emailBody = `
              <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; background: #fafafa;">
                <div style="background: #ffffff; border-radius: 16px; padding: 40px 32px; border: 1px solid #e5e7eb;">
                  <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 8px;">
                    Your Free Social Media Audit is Ready
                  </h1>
                  <p style="font-size: 15px; color: #6b7280; margin: 0 0 32px; line-height: 1.6;">
                    Metro Reach Media completed a comprehensive analysis of ${result.formData.businessName}'s online presence.
                    Here's a snapshot of what we found.
                  </p>

                  <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                      <div style="width: 56px; height: 56px; border-radius: 50%; background: ${result.scores.overall >= 70 ? '#ecfdf5' : result.scores.overall >= 40 ? '#fffbeb' : '#fef2f2'}; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 20px; font-weight: 700; color: ${result.scores.overall >= 70 ? '#059669' : result.scores.overall >= 40 ? '#d97706' : '#dc2626'};">
                          ${result.scores.overall}
                        </span>
                      </div>
                      <div>
                        <p style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 2px;">Overall Marketing Score</p>
                        <p style="font-size: 13px; color: #6b7280; margin: 0;">out of 100 — ${result.scores.overall >= 70 ? 'Strong Foundation' : result.scores.overall >= 40 ? 'Growth Opportunity' : 'Needs Attention'}</p>
                      </div>
                    </div>
                    <p style="font-size: 14px; color: #374151; margin: 0 0 12px; line-height: 1.6;">${result.executiveSummary}</p>
                  </div>

                  ${primaryRec ? `
                  <div style="background: #eff6ff; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #dbeafe;">
                    <p style="font-size: 13px; font-weight: 600; color: #1d4ed8; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">Recommended Growth Plan</p>
                    <p style="font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 8px;">${primaryRec.name} — ${primaryRec.price}${primaryRec.billingFrequency ? '/' + primaryRec.billingFrequency : ''}</p>
                    <p style="font-size: 14px; color: #374151; margin: 0; line-height: 1.6;">${primaryRec.reason.slice(0, 200)}...</p>
                  </div>
                  ` : ''}

                  <a href="${reportUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 15px;">
                    View Full Report →
                  </a>

                  <p style="font-size: 12px; color: #9ca3af; margin: 24px 0 0; line-height: 1.5;">
                    Prepared by Metro Reach Media for ${result.formData.businessName}.<br/>
                    Questions? Reply to this email or contact us at bryce@metroreachagency.com.
                  </p>
                </div>
              </div>
            `;

            const emailResult = await sendEmail({
              to: formData.email,
              from: "reports@metroreachagency.com",
              subject: "Your Free Social Media Audit is Ready — Metro Reach Media",
              body: emailBody,
            });

            if (emailResult.success) {
              await markEmailSent(lead.id);
            } else {
              console.error("Email send failed for lead", lead.id, ":", emailResult.error);
              // Don't break the flow — online report is the fallback
            }
          } catch (emailErr: any) {
            console.error("Email delivery error for lead", lead.id, ":", emailErr.message || emailErr);
            // Don't break the flow — online report is the fallback
          }

          return new Response(
            JSON.stringify({
              id: lead.id,
              success: true,
              redirect: `/free-audit/report?id=${lead.id}`,
              result,
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
