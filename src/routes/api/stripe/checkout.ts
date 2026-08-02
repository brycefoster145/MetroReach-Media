/**
 * Stripe Checkout Session API — MetroReach Media
 *
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for a single service purchase.
 * Accepts a service slug, looks up the Stripe Price ID, and redirects
 * the client to a Stripe-hosted checkout page.
 *
 * One-time services → payment mode
 * Monthly services    → subscription mode
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { getMappingBySlug } from "~/lib/stripe-product-map";
import { getSiteUrl } from "~/lib/site-url";

// ── Stripe instance (lazy) ──
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" as any });
}

/**
 * Same-origin redirect guard.
 * Accepts only same-origin absolute URLs or relative paths (e.g. "/services").
 * Rejects protocol-relative ("//evil.com"), backslash, and cross-origin URLs.
 */
function isSafeRedirectUrl(raw: unknown, siteUrl: string): raw is string {
  if (typeof raw !== "string" || raw.trim().length === 0) return false;
  const value = raw.trim();
  if (value.startsWith("/")) {
    return !value.startsWith("//") && !value.startsWith("/\\") && !value.startsWith("\\");
  }
  if (/^\\/.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.origin === new URL(siteUrl).origin;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/stripe/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          slug?: string;
          customerEmail?: string;
          customerName?: string;
          company?: string;
          leadId?: string;
          successUrl?: string;
          cancelUrl?: string;
        };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { slug, customerEmail, customerName, company, leadId, successUrl, cancelUrl } = body;

        if (!slug) {
          return new Response(
            JSON.stringify({ error: "Missing required field: slug" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Look up the mapping
        const mapping = getMappingBySlug(slug);
        if (!mapping) {
          return new Response(
            JSON.stringify({ error: `No Stripe mapping found for service: ${slug}` }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }

        // Validate the price ID isn't a placeholder
        if (mapping.stripePriceId.startsWith("price_placeholder_")) {
          return new Response(
            JSON.stringify({
              error: "Stripe products not yet configured. Run `bun run src/lib/create-stripe-products.ts` with a valid STRIPE_SECRET_KEY.",
            }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }

        const siteUrl = getSiteUrl();
        const defaultSuccessUrl = `${siteUrl}/confirmation?service=${encodeURIComponent(slug)}`;
        const defaultCancelUrl = `${siteUrl}/services`;

        // Same-origin guard: only allow safe redirect targets.
        if (successUrl !== undefined && !isSafeRedirectUrl(successUrl, siteUrl)) {
          return new Response(
            JSON.stringify({ error: "Invalid successUrl: must be same-origin or a relative path" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        if (cancelUrl !== undefined && !isSafeRedirectUrl(cancelUrl, siteUrl)) {
          return new Response(
            JSON.stringify({ error: "Invalid cancelUrl: must be same-origin or a relative path" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const stripe = getStripe();

          const sessionConfig: Stripe.Checkout.SessionCreateParams = {
            line_items: [
              {
                price: mapping.stripePriceId,
                quantity: 1,
              },
            ],
            mode: mapping.recurring ? "subscription" : "payment",
            success_url: successUrl || defaultSuccessUrl,
            cancel_url: cancelUrl || defaultCancelUrl,
            // Set customer_email so the webhook reliably receives the email
            // even before the customer completes checkout details.
            ...(customerEmail ? { customer_email: customerEmail } : {}),
            // Carry the lead reference for webhook service resolution.
            ...(leadId ? { client_reference_id: leadId } : {}),
            metadata: {
              service_slug: slug,
              service_name: mapping.name,
              service_category: mapping.category,
              ...(company ? { company } : {}),
              ...(leadId ? { lead_id: leadId } : {}),
            },
            // Collect customer info
            billing_address_collection: "auto",
            ...(mapping.recurring
              ? {
                  // For subscriptions, allow promo codes
                  allow_promotion_codes: true,
                  subscription_data: {
                    metadata: {
                      service_slug: slug,
                      service_name: mapping.name,
                    },
                  },
                }
              : {
                  // For one-time payments — should also allow promo codes
                  allow_promotion_codes: true,
                  payment_intent_data: {
                    metadata: {
                      service_slug: slug,
                      service_name: mapping.name,
                    },
                  },
                }),
          };

          const session = await stripe.checkout.sessions.create(sessionConfig);

          return new Response(
            JSON.stringify({
              url: session.url,
              sessionId: session.id,
              mode: mapping.recurring ? "subscription" : "payment",
              amount: mapping.amount,
              serviceName: mapping.name,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("Stripe checkout session creation failed:", err.message);
          return new Response(
            JSON.stringify({ error: "Failed to create checkout session. Please try again." }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
