/**
 * Premium Growth Audit — API Endpoint
 * POST /api/premium-audit/submit
 *
 * Receives form data, saves the lead, creates a Stripe Checkout Session,
 * and returns the session URL for client-side redirect.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import {
  createLead,
  findLeadByEmail,
  type LeadFormData,
} from "~/lib/lead-store";
import { getSiteUrl } from "~/lib/site-url";
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

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" as any });
}

// Premium Growth Audit product
const PREMIUM_AUDIT_PRICE_ID = "price_1TwKxKDGk9TbScamUD3JHGFO";
const SERVICE_SLUG = "premium-growth-audit";

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

        // Save or retrieve the lead
        let lead;
        try {
          const existing = await findLeadByEmail(formData.email);
          if (existing) {
            lead = existing;
          } else {
            lead = await createLead(formData);
          }
        } catch (err: any) {
          console.error("Lead creation error:", err.message);
          return new Response(
            JSON.stringify({ error: "We had trouble saving your information. Please try again." }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        // Create Stripe Checkout Session
        const siteUrl = getSiteUrl();
        try {
          const stripe = getStripe();

          const session = await stripe.checkout.sessions.create({
            line_items: [
              {
                price: PREMIUM_AUDIT_PRICE_ID,
                quantity: 1,
              },
            ],
            mode: "payment",
            client_reference_id: lead.id,
            success_url: `${siteUrl}/confirmation?service=${encodeURIComponent(SERVICE_SLUG)}&leadId=${lead.id}`,
            cancel_url: `${siteUrl}/premium-audit`,
            metadata: {
              service_slug: SERVICE_SLUG,
              lead_id: lead.id,
            },
            billing_address_collection: "auto",
            allow_promotion_codes: true,
            payment_intent_data: {
              metadata: {
                service_slug: SERVICE_SLUG,
                lead_id: lead.id,
              },
            },
          });

          return new Response(
            JSON.stringify({
              id: lead.id,
              success: true,
              url: session.url,
              sessionId: session.id,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (err: any) {
          console.error("Stripe checkout session creation failed:", err.message);
          return new Response(
            JSON.stringify({ error: "Failed to create checkout session. Please try again." }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
