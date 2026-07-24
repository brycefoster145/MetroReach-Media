/**
 * Stripe Webhook Handler — MetroReach Digital
 *
 * Receives Stripe webhook events, verifies signatures, and triggers the
 * automated client delivery pipeline on checkout.session.completed.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { sql } from "~/lib/db";
import {
  sendWelcomeEmail,
  sendOnboardingRequest,
  sendInternalNewClientAlert,
} from "~/lib/email-sequences";
import { sendTelegramMessage } from "~/lib/telegram";

// ── Stripe price ID → MetroReach service mapping ──
// Update these when Stripe Products/Prices are created in the Stripe dashboard.
const PRICE_TO_SERVICE: Record<string, { name: string; slug: string }> = {
  // Organic Content Management
  "price_organic_starter": { name: "Organic Content — Starter", slug: "organic-content-starter" },
  "price_organic_pro": { name: "Organic Content — Pro", slug: "organic-content-pro" },
  "price_organic_enterprise": { name: "Organic Content — Enterprise", slug: "organic-content-enterprise" },
  // Paid Advertising
  "price_ads_starter": { name: "Paid Advertising — Starter", slug: "paid-ads-starter" },
  "price_ads_pro": { name: "Paid Advertising — Pro", slug: "paid-ads-pro" },
  "price_ads_enterprise": { name: "Paid Advertising — Enterprise", slug: "paid-ads-enterprise" },
  // Social Strategy
  "price_strategy_one": { name: "Social Strategy — One-Time", slug: "social-strategy-onetime" },
  "price_strategy_quarterly": { name: "Social Strategy — Quarterly", slug: "social-strategy-quarterly" },
  // Analytics & Reporting
  "price_analytics_monthly": { name: "Analytics & Reporting — Monthly", slug: "analytics-reporting-monthly" },
  // Community Management
  "price_community_monthly": { name: "Community Management — Monthly", slug: "community-management-monthly" },
  // Full Service
  "price_fullservice_monthly": { name: "Full Service — Monthly", slug: "full-service-monthly" },
};

// ── Stripe instance (lazy) ──
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key, { apiVersion: "2025-06-30.acacia" as any });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerEmail = session.customer_details?.email || session.customer_email;
  const customerName = session.customer_details?.name || "Valued Client";
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (!customerEmail) {
    console.error("No customer email in checkout session", session.id);
    return;
  }

  // Determine which service was purchased
  const lineItemId = session.metadata?.service_slug;
  let serviceName = "MetroReach Service";
  let serviceSlug = "unknown";

  // Try metadata first, then fall back to line items
  if (lineItemId && PRICE_TO_SERVICE[lineItemId]) {
    serviceName = PRICE_TO_SERVICE[lineItemId].name;
    serviceSlug = PRICE_TO_SERVICE[lineItemId].slug;
  } else if (session.line_items?.data?.length) {
    // Look up from line items' price IDs
    for (const item of session.line_items.data) {
      const priceId = item.price?.id;
      if (priceId && PRICE_TO_SERVICE[priceId]) {
        serviceName = PRICE_TO_SERVICE[priceId].name;
        serviceSlug = PRICE_TO_SERVICE[priceId].slug;
        break;
      }
    }
  }

  const clientId = `client-${randomBytes(8).toString("hex")}`;
  const company = session.metadata?.company || "";

  // Insert client record
  try {
    await sql`
      INSERT INTO clients (
        id, email, name, company, service, service_slug,
        status, stripe_customer_id, stripe_subscription_id,
        pipeline_status, created_at, updated_at
      ) VALUES (
        ${clientId}, ${customerEmail}, ${customerName}, ${company || null},
        ${serviceName}, ${serviceSlug},
        'onboarding', ${customerId || null}, ${session.subscription as string || null},
        'pending', NOW(), NOW()
      )
    `;
  } catch (err: any) {
    // If duplicate (somehow), query and update instead
    if (err.message?.includes("duplicate") || err.code === "23505") {
      await sql`
        UPDATE clients
        SET
          email = ${customerEmail},
          name = ${customerName},
          company = ${company || null},
          service = ${serviceName},
          service_slug = ${serviceSlug},
          status = 'onboarding',
          stripe_customer_id = ${customerId || null},
          stripe_subscription_id = ${session.subscription as string || null},
          pipeline_status = 'pending',
          updated_at = NOW()
        WHERE id = ${clientId}
      `;
    } else {
      console.error("Failed to insert client:", err.message);
      throw err;
    }
  }

  const client = {
    id: clientId,
    email: customerEmail,
    name: customerName,
    company: company || undefined,
    service: serviceName,
    service_slug: serviceSlug,
    status: "onboarding" as const,
    stripe_customer_id: customerId || undefined,
    stripe_subscription_id: (session.subscription as string) || undefined,
    pipeline_status: "pending",
  };

  // ── Trigger delivery pipeline (non-blocking, fire-and-forget) ──

  // 1. Welcome email
  sendWelcomeEmail(client).catch((e) =>
    console.error("Welcome email failed:", e.message),
  );

  // 2. Onboarding request (sent after a short delay — ideally queued,
  //    but for now we send it immediately as part of the webhook)
  sendOnboardingRequest(client).catch((e) =>
    console.error("Onboarding email failed:", e.message),
  );

  // 3. Internal notification
  sendInternalNewClientAlert(client).catch((e) =>
    console.error("Internal alert failed:", e.message),
  );

  // 4. Telegram notification
  const tgLines = [
    "🎉 <b>New Client — MetroReach Digital</b>",
    "",
    `Name: ${customerName}`,
    `Email: ${customerEmail}`,
    `Company: ${company || "N/A"}`,
    `Service: ${serviceName}`,
    `Status: Onboarding`,
    "",
    `<a href="https://metroreachagency.com/dashboard?client=${clientId}">View Client →</a>`,
  ];
  sendTelegramMessage(tgLines.join("\n")).catch(() => {});

  console.log(`Client pipeline triggered: ${clientId} (${serviceSlug})`);
}

// ── Route Handler ──

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
          return new Response(
            JSON.stringify({ error: "Webhook secret not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return new Response(
            JSON.stringify({ error: "Missing stripe-signature header" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Read raw body for signature verification
        let rawBody: string;
        try {
          rawBody = await request.text();
        } catch {
          return new Response(
            JSON.stringify({ error: "Failed to read request body" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Verify and construct the event
        let event: Stripe.Event;
        try {
          const stripe = getStripe();
          event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            webhookSecret,
          );
        } catch (err: any) {
          console.error("Webhook signature verification failed:", err.message);
          return new Response(
            JSON.stringify({ error: `Signature verification failed: ${err.message}` }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Process the event
        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as Stripe.Checkout.Session;
              // Process async — acknowledge webhook immediately
              handleCheckoutCompleted(session).catch((err) =>
                console.error("handleCheckoutCompleted failed:", err.message),
              );
              break;
            }
            case "customer.subscription.updated": {
              const subscription = event.data.object as Stripe.Subscription;
              // Update client status based on subscription status
              if (subscription.customer && typeof subscription.customer === "string") {
                const newStatus =
                  subscription.status === "active"
                    ? "active"
                    : subscription.status === "canceled" || subscription.status === "unpaid"
                      ? "inactive"
                      : "onboarding";
                await sql`
                  UPDATE clients
                  SET status = ${newStatus}, updated_at = NOW()
                  WHERE stripe_customer_id = ${subscription.customer}
                `.catch(() => {});
              }
              break;
            }
            case "customer.subscription.deleted": {
              const subscription = event.data.object as Stripe.Subscription;
              if (subscription.customer && typeof subscription.customer === "string") {
                await sql`
                  UPDATE clients
                  SET status = 'inactive', updated_at = NOW()
                  WHERE stripe_customer_id = ${subscription.customer}
                `.catch(() => {});
              }
              break;
            }
            default:
              // Ignore unhandled event types
              console.log(`Unhandled Stripe event type: ${event.type}`);
          }
        } catch (err: any) {
          console.error(`Error processing webhook event ${event.type}:`, err.message);
          return new Response(
            JSON.stringify({ error: "Internal processing error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ received: true }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
