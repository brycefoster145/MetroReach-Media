/**
 * create-stripe-products.ts
 *
 * One-shot script that reads all verified services from pages.ts and creates
 * corresponding Stripe Products + Prices via the Stripe API.
 *
 * Usage: bun run src/lib/create-stripe-products.ts
 *
 * Output: src/lib/stripe-product-map.ts (committed to version control)
 */

import Stripe from "stripe";
import { subServices } from "../data/pages";

// ── Parse price string → { amount, recurring } ──
// "$500 one-time"          → { amount: 500,  recurring: false }
// "From $1,000/month"      → { amount: 1000, recurring: true }
// "From $1,000/month + 10%" → { amount: 1000, recurring: true }
// "From $750 one-time"      → { amount: 750,  recurring: false }
function parsePrice(priceStr: string): { amount: number; recurring: boolean } {
  const cleaned = priceStr.replace(/,/g, "").replace(/\$/g, "").trim();
  // Extract the dollar amount
  const amountMatch = cleaned.match(/([\d.]+)/);
  if (!amountMatch) {
    throw new Error(`Cannot parse price amount from: ${priceStr}`);
  }

  let amount: number;
  // Handle "X/month" or "one-time" patterns
  const amountStr = amountMatch[1];
  if (amountStr.includes(".")) {
    amount = Math.round(parseFloat(amountStr) * 100); // Convert to cents
  } else {
    amount = parseInt(amountStr, 10) * 100;
  }

  // Determine if recurring
  const recurring = /\/month|per month|monthly/i.test(cleaned);

  return { amount, recurring };
}

// ── Category → human-friendly group label ──
const categoryLabels: Record<string, string> = {
  "organic-content": "Organic Content Management",
  "paid-advertising": "Paid Advertising",
  "social-strategy": "Social Strategy",
  "analytics-reporting": "Analytics & Reporting",
  "community-management": "Community Management",
};

interface MappingEntry {
  slug: string;
  stripePriceId: string;
  stripeProductId: string;
  name: string;
  category: string;
  amount: number;
  recurring: boolean;
  priceLabel: string;
}

export async function createStripeProducts(): Promise<MappingEntry[]> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  const stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia" as any });
  const entries: MappingEntry[] = [];

  // Only create products for verified services
  const verified = subServices.filter(
    (s) => s.pipelineStatus === "verified",
  );

  console.log(`Found ${verified.length} verified services. Creating Stripe products...\n`);

  for (const svc of verified) {
    const { amount, recurring } = parsePrice(svc.price);
    const groupLabel = categoryLabels[svc.category] || svc.category;

    console.log(
      `  [${svc.slug}] Creating product "${svc.name}" — $${(amount / 100).toFixed(2)} ${recurring ? "/month" : "one-time"}`,
    );

    // ── Create Product ──
    const product = await stripe.products.create({
      name: svc.name,
      description: svc.description,
      metadata: {
        service_slug: svc.slug,
        category: svc.category,
        group: groupLabel,
      },
      // Use statement_descriptor for card statements (max 22 chars)
      statement_descriptor: svc.name.substring(0, 22).toUpperCase(),
    });

    console.log(`    Product created: ${product.id}`);

    // ── Create Price ──
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: amount,
      ...(recurring
        ? {
            recurring: {
              interval: "month" as const,
              interval_count: 1,
            },
          }
        : {}),
      metadata: {
        service_slug: svc.slug,
        category: svc.category,
        price_label: svc.price,
      },
    });

    console.log(`    Price created:  ${price.id}\n`);

    entries.push({
      slug: svc.slug,
      stripePriceId: price.id,
      stripeProductId: product.id,
      name: svc.name,
      category: svc.category,
      amount,
      recurring,
      priceLabel: svc.price,
    });
  }

  console.log(`Done. Created ${entries.length} products + prices.`);
  return entries;
}

// ── Generate the mapping file ──
function generateMappingFile(entries: MappingEntry[]): string {
  const lines: string[] = [
    "/**",
    " * GENERATED: stripe-product-map.ts",
    " *",
    " * Maps Stripe Price IDs to MetroReach service slugs.",
    " * Regenerate with: bun run src/lib/create-stripe-products.ts",
    " *",
    ` * Generated: ${new Date().toISOString()}`,
    ` * Services: ${entries.length}`,
    " */",
    "",
    "export interface StripeProductMapping {",
    "  slug: string;",
    "  stripePriceId: string;",
    "  stripeProductId: string;",
    "  name: string;",
    "  category: string;",
    "  amount: number;",
    "  recurring: boolean;",
    "  priceLabel: string;",
    "}",
    "",
    "export const STRIPE_PRODUCT_MAP: StripeProductMapping[] = [",
  ];

  for (const e of entries) {
    lines.push("  {");
    lines.push(`    slug: "${e.slug}",`);
    lines.push(`    stripePriceId: "${e.stripePriceId}",`);
    lines.push(`    stripeProductId: "${e.stripeProductId}",`);
    lines.push(`    name: "${e.name.replace(/"/g, '\\"')}",`);
    lines.push(`    category: "${e.category}",`);
    lines.push(`    amount: ${e.amount},`);
    lines.push(`    recurring: ${e.recurring},`);
    lines.push(`    priceLabel: "${e.priceLabel.replace(/"/g, '\\"')}",`);
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");
  lines.push("/** Lookup a mapping by service slug */");
  lines.push(
    "export function getMappingBySlug(slug: string): StripeProductMapping | undefined {",
  );
  lines.push("  return STRIPE_PRODUCT_MAP.find((m) => m.slug === slug);");
  lines.push("}");
  lines.push("");
  lines.push("/** Lookup a mapping by Stripe Price ID */");
  lines.push(
    "export function getMappingByPriceId(priceId: string): StripeProductMapping | undefined {",
  );
  lines.push("  return STRIPE_PRODUCT_MAP.find((m) => m.stripePriceId === priceId);");
  lines.push("}");
  lines.push("");
  lines.push("/** PRICE_TO_SERVICE: Stripe Price ID → { name, slug } (for webhook) */");
  lines.push(
    "export const PRICE_TO_SERVICE: Record<string, { name: string; slug: string }> = {",
  );
  for (const e of entries) {
    lines.push(`  "${e.stripePriceId}": { name: "${e.name.replace(/"/g, '\\"')}", slug: "${e.slug}" },`);
  }
  lines.push("};");
  lines.push("");

  return lines.join("\n");
}

// ── Main ──
async function main() {
  const entries = await createStripeProducts();
  const fileContent = generateMappingFile(entries);

  const outPath = new URL("./stripe-product-map.ts", import.meta.url).pathname;
  await Bun.write(outPath, fileContent);
  console.log(`\nMapping file written to: ${outPath}`);
}

// Only run when executed directly (not imported)
if (import.meta.main) {
  main().catch((err) => {
    console.error("Failed to create Stripe products:", err);
    process.exit(1);
  });
}
