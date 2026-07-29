/**
 * TEMPORARY: Creates the Premium Growth Audit one-time price in Stripe.
 * Hit once, record the price ID, then delete this file.
 */
import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

export const Route = createFileRoute("/api/create-audit-price")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
          return new Response(JSON.stringify({ error: "No Stripe key" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
        const stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia" as any });

        try {
          const product = await stripe.products.create({
            name: "Premium Growth Audit — MetroReach Media",
            metadata: { slug: "premium-growth-audit", service_type: "strategy" },
          });

          const price = await stripe.prices.create({
            product: product.id,
            unit_amount: 49500,
            currency: "usd",
            metadata: { slug: "premium-growth-audit" },
          });

          return new Response(JSON.stringify({
            success: true,
            product_id: product.id,
            price_id: price.id,
            amount: price.unit_amount,
            type: price.type,
          }, null, 2), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message, type: err.type }, null, 2), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
