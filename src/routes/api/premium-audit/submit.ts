/**
 * Premium Growth Audit — API Endpoint
 * POST /api/premium-audit/submit
 *
 * Receives form data (JSON or form-encoded), saves the lead,
 * creates a Stripe Checkout Session, and returns the session URL.
 *
 * For native HTML forms: 302 redirect to Stripe Checkout.
 * For JS fetch: JSON response with { url: session.url }.
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
const SERVICE_SLUG = "premium-growth-audit";
const PRODUCT_NAME = "Premium Growth Audit — MetroReach Media";
const PRICE_AMOUNT_CENTS = 49500; // $495 one-time

// Cache: resolved price ID (module-level, lives for serverless instance lifetime)
let cachedPriceId: string | null = null;

/**
 * Resolves a one-time price for Premium Growth Audit.
 * If the configured price is recurring or missing, creates a new one-time price.
 */
async function resolveAuditPrice(stripe: Stripe): Promise<string> {
  if (cachedPriceId) return cachedPriceId;

  // First, try to find an existing one-time price with our metadata slug
  const existingPrices = await stripe.prices.list({
    active: true,
    limit: 50,
  });

  const matchingPrice = existingPrices.data.find(
    (p) =>
      p.metadata?.slug === SERVICE_SLUG &&
      p.type === "one_time" &&
      p.unit_amount === PRICE_AMOUNT_CENTS
  );

  if (matchingPrice) {
    console.log("Found existing one-time audit price:", matchingPrice.id);
    cachedPriceId = matchingPrice.id;
    return matchingPrice.id;
  }

  // Not found — create the product and price
  console.log("Creating new Premium Growth Audit product + one-time price...");
  const product = await stripe.products.create({
    name: PRODUCT_NAME,
    metadata: { slug: SERVICE_SLUG, service_type: "strategy" },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: PRICE_AMOUNT_CENTS,
    currency: "usd",
    metadata: { slug: SERVICE_SLUG },
  });

  console.log("Created product:", product.id, "price:", price.id);
  cachedPriceId = price.id;
  return price.id;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/api/premium-audit/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Determine submission type ──
        const contentType = request.headers.get("content-type") || "";
        const isNativeForm = contentType.includes("application/x-www-form-urlencoded");

        // ── Response helpers: JSON for JS fetch, redirect for native form ──
        function errorResponse(message: string, status: number): Response {
          if (isNativeForm) {
            const errorParam = encodeURIComponent(message);
            return new Response(null, {
              status: 302,
              headers: { Location: `/premium-audit?error=${errorParam}` },
            });
          }
          return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }

        function successResponse(url: string, leadId: string, sessionId: string): Response {
          if (isNativeForm) {
            return new Response(null, {
              status: 302,
              headers: { Location: url! },
            });
          }
          return new Response(
            JSON.stringify({
              id: leadId,
              success: true,
              url,
              sessionId,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // ── Rate limiting ──
        const ip = getClientIp(request);
        const rl = rateLimit(`premium-audit:${ip}`, 3, 60_000); // max 3 per minute
        if (!rl.allowed) {
          return errorResponse(
            "Too many requests. Please wait a moment before trying again.",
            429
          );
        }

        // ── Parse body (JSON for JS fetch, url-encoded for native form) ──
        let body: Record<string, unknown>;
        try {
          if (isNativeForm) {
            const text = await request.text();
            const params = new URLSearchParams(text);
            body = {};
            params.forEach((value, key) => {
              body[key] = value;
            });
            // Checkbox: only present in form data when checked
            body.consent = params.has("consent");
          } else {
            body = await request.json();
          }
        } catch {
          return errorResponse(
            "We couldn't process your submission. Please try again.",
            400
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
          return errorResponse(
            `Please complete these required fields: ${missing.join(", ")}.`,
            400
          );
        }

        if (!isValidEmail(formData.email)) {
          return errorResponse("Please enter a valid email address.", 400);
        }

        if (formData.websiteUrl && !isValidUrl(formData.websiteUrl)) {
          return errorResponse(
            "Please enter a valid website URL (e.g., https://yourbusiness.com).",
            400
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
            return errorResponse(
              `Please enter a valid ${label} or leave it blank.`,
              400
            );
          }
        }

        if (!body.consent) {
          return errorResponse(
            "Please confirm your consent for us to analyze your publicly accessible business information.",
            400
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
          return errorResponse(
            "We had trouble saving your information. Please try again.",
            500
          );
        }

        // Create Stripe Checkout Session
        const siteUrl = getSiteUrl();
        try {
          const stripe = getStripe();

          // Resolve (or create) the one-time $495 price
          const priceId = await resolveAuditPrice(stripe);

          const session = await stripe.checkout.sessions.create({
            line_items: [
              {
                price: priceId,
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

          if (!session.url) {
            return errorResponse("Failed to create checkout session. Please try again.", 500);
          }

          return successResponse(session.url, lead.id, session.id);
        } catch (err: any) {
          // Log the FULL Stripe error details for diagnosis
          console.error("Stripe checkout session creation failed:", {
            message: err.message,
            type: err.type,
            code: err.code,
            statusCode: err.statusCode,
            rawMessage: err.raw?.message,
            rawType: err.raw?.type,
            rawCode: err.raw?.code,
            param: err.raw?.param,
            declineCode: err.raw?.decline_code,
            leadId: lead.id,
          });
          return errorResponse(
            "Failed to create checkout session. Please try again.",
            500
          );
        }
      },
    },
  },
});
