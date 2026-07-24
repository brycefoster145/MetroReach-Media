/**
 * Stripe Checkout Session API — MetroReach Digital
 *
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for a single service purchase.
 * Accepts a service slug, looks up the Stripe Price ID, and redirects
 * the client to a Stripe-hosted checkout page.
 *
 * One-time services → payment mode
 * Monthly services    → subscription mode
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { getMappingBySlug } from "~/lib/stripe-product-map";

// ── Stripe instance (lazy) ──
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key, { apiVersion: "2025-06-30.acacia" as any });
}

// ── Determine the site's public URL ──
function getSiteUrl(): string {
  // Vercel provides this at build time
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Fallback for local dev
  return process.env.SITE_URL || "http://localhost:3000";
}

export const Route = createFileRoute("/api/stripe/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { slug?: string; successUrl?: string; cancelUrl?: string };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const { slug, successUrl, cancelUrl } = body;

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
            metadata: {
              service_slug: slug,
              service_name: mapping.name,
              service_category: mapping.category,
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
                  // For one-time payments
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
