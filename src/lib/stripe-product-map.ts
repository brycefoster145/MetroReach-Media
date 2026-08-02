/**
 * stripe-product-map.ts
 *
 * Maps Stripe Price IDs to MetroReach Media business-plan services.
 * Manually maintained — mirrors the live Stripe catalog (verified 2026-08-02).
 *
 * Products: Starter, Growth, Scale, VIP Daily, Premium Growth Audit.
 */

export interface StripeProductMapping {
  slug: string;
  stripePriceId: string;
  stripeProductId: string;
  name: string;
  category: string;
  amount: number;
  recurring: boolean;
  priceLabel: string;
}

export const STRIPE_PRODUCT_MAP: StripeProductMapping[] = [
  {
    slug: "starter",
    stripePriceId: "price_1Tzxk7DGk9TbScamKYr6zmuR",
    stripeProductId: "prod_Uzxflo4CIl88D4",
    name: "Starter — 2 Platforms",
    category: "social-media-management",
    amount: 150000,
    recurring: true,
    priceLabel: "$1,500/month",
  },
  {
    slug: "growth",
    stripePriceId: "price_1TzxkDDGk9TbScamF5jDdxeU",
    stripeProductId: "prod_UzxfgJr30ygZUg",
    name: "Growth — 4 Platforms",
    category: "social-media-management",
    amount: 300000,
    recurring: true,
    priceLabel: "$3,000/month",
  },
  {
    slug: "scale",
    stripePriceId: "price_1TzxkDDGk9TbScamMYpzSgqh",
    stripeProductId: "prod_UzxfDmMLTIMZMG",
    name: "Scale — 7 Platforms",
    category: "social-media-management",
    amount: 550000,
    recurring: true,
    priceLabel: "$5,500/month",
  },
  {
    slug: "vip-daily",
    stripePriceId: "price_1TzxkODGk9TbScamA2Bc4tfy",
    stripeProductId: "prod_Uzxfd5RZwutNmo",
    name: "VIP Daily",
    category: "social-media-management",
    amount: 850000,
    recurring: true,
    priceLabel: "$8,500/month",
  },
  {
    slug: "premium-growth-audit",
    stripePriceId: "price_1TzxkODGk9TbScamvTbh7BIz",
    stripeProductId: "prod_UzxfNxM7UKwCg4",
    name: "Premium Growth Audit",
    category: "strategy",
    amount: 49500,
    recurring: false,
    priceLabel: "$495 one-time",
  },
];

/** Lookup a mapping by service slug */
export function getMappingBySlug(slug: string): StripeProductMapping | undefined {
  return STRIPE_PRODUCT_MAP.find((m) => m.slug === slug);
}

/** Lookup a mapping by Stripe Price ID */
export function getMappingByPriceId(priceId: string): StripeProductMapping | undefined {
  return STRIPE_PRODUCT_MAP.find((m) => m.stripePriceId === priceId);
}

/** PRICE_TO_SERVICE: Stripe Price ID → { name, slug } (for webhook) */
export const PRICE_TO_SERVICE: Record<string, { name: string; slug: string }> =
  STRIPE_PRODUCT_MAP.reduce(
    (acc, m) => {
      acc[m.stripePriceId] = { name: m.name, slug: m.slug };
      return acc;
    },
    {} as Record<string, { name: string; slug: string }>,
  );
