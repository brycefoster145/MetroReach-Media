/**
 * Premium Growth Audit — API Endpoint
 * POST /api/premium-audit/submit
 *
 * Receives form data, saves the lead, returns Stripe payment URL.
 * Analysis happens on the report page after payment confirmation.
 */

import { createFileRoute } from "@tanstack/react-router";
import {
  createLead,
  findLeadByEmail,
  type LeadFormData,
} from "~/lib/lead-store";
import { rateLimit, getClientIp } from "~/lib/rate-limit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidUrl(str: string): boolean {
  if (!str || !str.trim()) return true;
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

// Stripe Payment Link for Premium Growth Audit ($495)
// Product: price_1TwKxKDGk9TbScamUD3JHGFO
// Owner: create this Payment Link at https://dashboard.stripe.com/payment-links
const STRIPE_PREMIUM_AUDIT_LINK =
  process.env.STRIPE_PREMIUM_AUDIT_LINK ||
  "https://buy.stripe.com/bJe7sLcTy6Ds0OQ2tv1ck1t";

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/api/premium-audit/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Rate limiting ──
        const ip = getClientIp(request);
        const rl = rateLimit(`premium-audit:${ip}`, 3, 60_000); // max 3 per minute
        if (!rl.allowed) {
          return new Response(
            JSON.stringify({ error: "Too many requests. Please wait a moment before trying again." }),
            { status: 429, headers: { "Content-Type": "application/json" } }
          );
        }

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

        if (!isValidEmail(formData.email)) {
          return new Response(
            JSON.stringify({ error: "Please enter a valid email address." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        if (formData.websiteUrl && !isValidUrl(formData.websiteUrl)) {
          return new Response(
            JSON.stringify({ error: "Please enter a valid website URL (e.g., https://yourbusiness.com)." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Validate social URLs
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

        if (!body.consent) {
          return new Response(
            JSON.stringify({
              error: "Please confirm your consent for us to analyze your publicly accessible business information.",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Save the lead
        let lead;
        try {
          const existing = await findLeadByEmail(formData.email);
          if (existing) {
            // Return existing lead
            const paymentUrl = `${STRIPE_PREMIUM_AUDIT_LINK}?prefilled_email=${encodeURIComponent(formData.email)}&client_reference_id=${existing.id}`;
            return new Response(
              JSON.stringify({
                id: existing.id,
                success: true,
                paymentUrl,
                existing: true,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }

          lead = await createLead(formData);
        } catch (err: any) {
          console.error("Lead creation error:", err.message);
          return new Response(
            JSON.stringify({ error: "We had trouble saving your information. Please try again." }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        // Build Stripe payment URL
        const paymentUrl = `${STRIPE_PREMIUM_AUDIT_LINK}?prefilled_email=${encodeURIComponent(formData.email)}&client_reference_id=${lead.id}`;

        return new Response(
          JSON.stringify({
            id: lead.id,
            success: true,
            paymentUrl,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      },
    },
  },
});
