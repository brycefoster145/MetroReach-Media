/**
 * Admin endpoint: Fix Stripe checkout branding.
 *
 * GET /api/admin/fix-stripe-branding
 *
 * One-off endpoint — hit once to update the Stripe account's
 * business_name from "MarinaOS" to "MetroReach Media".
 *
 * Uses STRIPE_SECRET_KEY from Vercel environment (real key in production).
 * No auth — hit once, then remove or leave dormant.
 *
 * MetroReach Media
 */
import { createFileRoute } from "@tanstack/react-router";
import { requireApiKey } from "~/lib/env";
import Stripe from "stripe";

export const Route = createFileRoute("/api/admin/fix-stripe-branding")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const unauthorized = requireApiKey(request);
        if (unauthorized) return unauthorized;
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "STRIPE_SECRET_KEY is not set in environment",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        try {
          const stripe = new Stripe(stripeKey, {
            apiVersion: "2026-06-24.dahlia" as any,
          });

          const account = await stripe.accounts.update({
            settings: {
              branding: {
                business_name: "MetroReach Media",
              },
            },
          } as any);

          return new Response(
            JSON.stringify({
              success: true,
              business_name: (account as any).settings?.branding?.business_name,
              message:
                "Stripe checkout branding updated to MetroReach Media",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (err: any) {
          console.error(
            "[fix-stripe-branding] Error:",
            err.message,
          );
          return new Response(
            JSON.stringify({
              success: false,
              error: err.message,
              hint: "If this is an API key error, the STRIPE_SECRET_KEY in Vercel may be a restricted key. A full secret key with account write access is required.",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});
