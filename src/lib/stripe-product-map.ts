/**
 * GENERATED: stripe-product-map.ts
 *
 * Maps Stripe Price IDs to MetroReach service slugs.
 * Regenerate with: bun run src/lib/create-stripe-products.ts
 *
 * Generated: 2026-07-24T23:04:00.000Z (placeholder — run script to populate real IDs)
 * Services: 43 verified
 *
 * ⚠️  PRICE IDs ARE PLACEHOLDERS — run `bun run src/lib/create-stripe-products.ts`
 *     with a valid STRIPE_SECRET_KEY to replace them with real Stripe Price IDs.
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
  // ── Organic Content Management ──
  { slug: "social-media-audit", stripePriceId: "price_placeholder_social-media-audit", stripeProductId: "prod_placeholder_social-media-audit", name: "Social Media Audit", category: "organic-content", amount: 50000, recurring: false, priceLabel: "$500 one-time" },
  { slug: "monthly-content-calendar", stripePriceId: "price_placeholder_monthly-content-calendar", stripeProductId: "prod_placeholder_monthly-content-calendar", name: "Monthly Content Calendar", category: "organic-content", amount: 100000, recurring: true, priceLabel: "From $1,000/month" },
  { slug: "caption-writing", stripePriceId: "price_placeholder_caption-writing", stripeProductId: "prod_placeholder_caption-writing", name: "Caption Writing", category: "organic-content", amount: 75000, recurring: true, priceLabel: "From $750/month" },
  { slug: "hashtag-research", stripePriceId: "price_placeholder_hashtag-research", stripeProductId: "prod_placeholder_hashtag-research", name: "Hashtag Research", category: "organic-content", amount: 30000, recurring: false, priceLabel: "$300 one-time" },
  { slug: "brand-voice-development", stripePriceId: "price_placeholder_brand-voice-development", stripeProductId: "prod_placeholder_brand-voice-development", name: "Brand Voice Development", category: "organic-content", amount: 50000, recurring: false, priceLabel: "From $500 one-time" },
  { slug: "posting-schedule-optimization", stripePriceId: "price_placeholder_posting-schedule-optimization", stripeProductId: "prod_placeholder_posting-schedule-optimization", name: "Posting Schedule Optimization", category: "organic-content", amount: 40000, recurring: true, priceLabel: "From $400/month" },
  { slug: "trend-research", stripePriceId: "price_placeholder_trend-research", stripeProductId: "prod_placeholder_trend-research", name: "Trend Research", category: "organic-content", amount: 35000, recurring: true, priceLabel: "From $350/month" },
  { slug: "daily-engagement", stripePriceId: "price_placeholder_daily-engagement", stripeProductId: "prod_placeholder_daily-engagement", name: "Daily Engagement", category: "organic-content", amount: 60000, recurring: true, priceLabel: "From $600/month" },
  { slug: "dm-management", stripePriceId: "price_placeholder_dm-management", stripeProductId: "prod_placeholder_dm-management", name: "DM Management", category: "organic-content", amount: 40000, recurring: true, priceLabel: "From $400/month" },
  { slug: "social-listening", stripePriceId: "price_placeholder_social-listening", stripeProductId: "prod_placeholder_social-listening", name: "Social Listening", category: "organic-content", amount: 50000, recurring: true, priceLabel: "From $500/month" },
  { slug: "single-platform-management", stripePriceId: "price_placeholder_single-platform-management", stripeProductId: "prod_placeholder_single-platform-management", name: "Single-Platform Management", category: "organic-content", amount: 80000, recurring: true, priceLabel: "From $800/month" },
  { slug: "multi-platform-management", stripePriceId: "price_placeholder_multi-platform-management", stripeProductId: "prod_placeholder_multi-platform-management", name: "Multi-Platform Management — 5 Platforms", category: "organic-content", amount: 200000, recurring: true, priceLabel: "From $2,000/month" },
  { slug: "platform-setup-optimization", stripePriceId: "price_placeholder_platform-setup-optimization", stripeProductId: "prod_placeholder_platform-setup-optimization", name: "Platform Setup & Optimization", category: "organic-content", amount: 75000, recurring: false, priceLabel: "From $750 one-time" },
  { slug: "profile-bio-optimization", stripePriceId: "price_placeholder_profile-bio-optimization", stripeProductId: "prod_placeholder_profile-bio-optimization", name: "Profile/Bio Optimization", category: "organic-content", amount: 40000, recurring: false, priceLabel: "$400 one-time" },
  // ── Paid Advertising ──
  { slug: "meta-ads-management", stripePriceId: "price_placeholder_meta-ads-management", stripeProductId: "prod_placeholder_meta-ads-management", name: "Meta Ads Management", category: "paid-advertising", amount: 100000, recurring: true, priceLabel: "From $1,000/month + 10% ad spend" },
  { slug: "ad-account-setup", stripePriceId: "price_placeholder_ad-account-setup", stripeProductId: "prod_placeholder_ad-account-setup", name: "Ad Account Setup", category: "paid-advertising", amount: 50000, recurring: false, priceLabel: "$500 one-time" },
  { slug: "ad-creative-package", stripePriceId: "price_placeholder_ad-creative-package", stripeProductId: "prod_placeholder_ad-creative-package", name: "Ad Creative Package", category: "paid-advertising", amount: 75000, recurring: true, priceLabel: "From $750/month" },
  { slug: "ab-testing-optimization", stripePriceId: "price_placeholder_ab-testing-optimization", stripeProductId: "prod_placeholder_ab-testing-optimization", name: "A/B Testing & Optimization", category: "paid-advertising", amount: 50000, recurring: true, priceLabel: "From $500/month" },
  { slug: "pixel-conversion-tracking", stripePriceId: "price_placeholder_pixel-conversion-tracking", stripeProductId: "prod_placeholder_pixel-conversion-tracking", name: "Pixel & Conversion Tracking", category: "paid-advertising", amount: 40000, recurring: false, priceLabel: "$400 one-time" },
  { slug: "landing-page-review", stripePriceId: "price_placeholder_landing-page-review", stripeProductId: "prod_placeholder_landing-page-review", name: "Landing Page Review", category: "paid-advertising", amount: 35000, recurring: false, priceLabel: "$350 one-time" },
  // ── Social Strategy ──
  { slug: "social-media-audit-strategy", stripePriceId: "price_placeholder_social-media-audit-strategy", stripeProductId: "prod_placeholder_social-media-audit-strategy", name: "Social Media Audit", category: "social-strategy", amount: 50000, recurring: false, priceLabel: "$500 one-time" },
  { slug: "competitor-analysis", stripePriceId: "price_placeholder_competitor-analysis", stripeProductId: "prod_placeholder_competitor-analysis", name: "Competitor Analysis", category: "social-strategy", amount: 75000, recurring: false, priceLabel: "$750 one-time" },
  { slug: "social-media-strategy", stripePriceId: "price_placeholder_social-media-strategy", stripeProductId: "prod_placeholder_social-media-strategy", name: "Social Media Strategy", category: "social-strategy", amount: 120000, recurring: false, priceLabel: "From $1,200 one-time" },
  { slug: "content-strategy", stripePriceId: "price_placeholder_content-strategy", stripeProductId: "prod_placeholder_content-strategy", name: "Content Strategy", category: "social-strategy", amount: 100000, recurring: false, priceLabel: "From $1,000 one-time" },
  { slug: "campaign-strategy", stripePriceId: "price_placeholder_campaign-strategy", stripeProductId: "prod_placeholder_campaign-strategy", name: "Campaign Strategy", category: "social-strategy", amount: 80000, recurring: false, priceLabel: "From $800 one-time" },
  { slug: "audience-research", stripePriceId: "price_placeholder_audience-research", stripeProductId: "prod_placeholder_audience-research", name: "Audience Research", category: "social-strategy", amount: 60000, recurring: false, priceLabel: "From $600 one-time" },
  { slug: "organic-growth-strategy", stripePriceId: "price_placeholder_organic-growth-strategy", stripeProductId: "prod_placeholder_organic-growth-strategy", name: "Organic Growth Strategy", category: "social-strategy", amount: 70000, recurring: true, priceLabel: "From $700/month" },
  { slug: "monthly-strategy-reviews", stripePriceId: "price_placeholder_monthly-strategy-reviews", stripeProductId: "prod_placeholder_monthly-strategy-reviews", name: "Monthly Strategy Reviews", category: "social-strategy", amount: 50000, recurring: true, priceLabel: "From $500/month" },
  // ── Analytics & Reporting ──
  { slug: "monthly-performance-reports", stripePriceId: "price_placeholder_monthly-performance-reports", stripeProductId: "prod_placeholder_monthly-performance-reports", name: "Monthly Performance Reports", category: "analytics-reporting", amount: 50000, recurring: true, priceLabel: "From $500/month" },
  { slug: "weekly-performance-summaries", stripePriceId: "price_placeholder_weekly-performance-summaries", stripeProductId: "prod_placeholder_weekly-performance-summaries", name: "Weekly Performance Summaries", category: "analytics-reporting", amount: 35000, recurring: true, priceLabel: "From $350/month" },
  { slug: "kpi-dashboard-setup", stripePriceId: "price_placeholder_kpi-dashboard-setup", stripeProductId: "prod_placeholder_kpi-dashboard-setup", name: "KPI Dashboard Setup", category: "analytics-reporting", amount: 75000, recurring: false, priceLabel: "$750 one-time" },
  { slug: "executive-reports", stripePriceId: "price_placeholder_executive-reports", stripeProductId: "prod_placeholder_executive-reports", name: "Executive Reports", category: "analytics-reporting", amount: 60000, recurring: true, priceLabel: "From $600/month" },
  { slug: "competitor-benchmarking", stripePriceId: "price_placeholder_competitor-benchmarking", stripeProductId: "prod_placeholder_competitor-benchmarking", name: "Competitor Benchmarking", category: "analytics-reporting", amount: 50000, recurring: true, priceLabel: "From $500/month" },
  // ── Community Management ──
  { slug: "community-management", stripePriceId: "price_placeholder_community-management", stripeProductId: "prod_placeholder_community-management", name: "Community Management", category: "community-management", amount: 120000, recurring: true, priceLabel: "From $1,200/month" },
  { slug: "daily-monitoring-engagement", stripePriceId: "price_placeholder_daily-monitoring-engagement", stripeProductId: "prod_placeholder_daily-monitoring-engagement", name: "Daily Monitoring & Engagement", category: "community-management", amount: 60000, recurring: true, priceLabel: "From $600/month" },
  { slug: "comment-dm-response", stripePriceId: "price_placeholder_comment-dm-response", stripeProductId: "prod_placeholder_comment-dm-response", name: "Comment & DM Response", category: "community-management", amount: 40000, recurring: true, priceLabel: "From $400/month" },
  { slug: "review-management", stripePriceId: "price_placeholder_review-management", stripeProductId: "prod_placeholder_review-management", name: "Review Management", category: "community-management", amount: 35000, recurring: true, priceLabel: "From $350/month" },
  { slug: "social-listening-community", stripePriceId: "price_placeholder_social-listening-community", stripeProductId: "prod_placeholder_social-listening-community", name: "Social Listening", category: "community-management", amount: 50000, recurring: true, priceLabel: "From $500/month" },
  { slug: "influencer-research", stripePriceId: "price_placeholder_influencer-research", stripeProductId: "prod_placeholder_influencer-research", name: "Influencer Research", category: "community-management", amount: 75000, recurring: true, priceLabel: "From $750/month" },
  { slug: "community-engagement-templates", stripePriceId: "price_placeholder_community-engagement-templates", stripeProductId: "prod_placeholder_community-engagement-templates", name: "Community Engagement Templates", category: "community-management", amount: 30000, recurring: false, priceLabel: "$300 one-time" },
  { slug: "platform-setup-community", stripePriceId: "price_placeholder_platform-setup-community", stripeProductId: "prod_placeholder_platform-setup-community", name: "Platform Setup & Optimization", category: "community-management", amount: 75000, recurring: false, priceLabel: "From $750 one-time" },
  { slug: "social-inbox-management", stripePriceId: "price_placeholder_social-inbox-management", stripeProductId: "prod_placeholder_social-inbox-management", name: "Social Inbox Management", category: "community-management", amount: 50000, recurring: true, priceLabel: "From $500/month" },
  { slug: "social-inbox-design", stripePriceId: "price_placeholder_social-inbox-design", stripeProductId: "prod_placeholder_social-inbox-design", name: "Social Inbox Design", category: "community-management", amount: 60000, recurring: false, priceLabel: "From $600 one-time" },
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
export const PRICE_TO_SERVICE: Record<string, { name: string; slug: string }> = {};
// Populate from the array
for (const m of STRIPE_PRODUCT_MAP) {
  PRICE_TO_SERVICE[m.stripePriceId] = { name: m.name, slug: m.slug };
}
