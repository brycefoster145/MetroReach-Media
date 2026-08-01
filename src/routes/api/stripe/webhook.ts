/**
 * Stripe Webhook Handler — MetroReach Media
 *
 * Receives Stripe webhook events, verifies signatures, and triggers the
 * automated client delivery pipeline on checkout.session.completed.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { sql } from "~/lib/db";
import {
  sendWelcomeEmail,
  sendOnboardingRequest,
  sendInternalNewClientAlert,
  sendPurchaseConfirmation,
} from "~/lib/email-sequences";
import { sendEmail } from "~/lib/email";
import { createOrder } from "~/lib/order-router";
import { executePipeline } from "~/lib/pipeline-executor";
import { sendTelegramMessage } from "~/lib/telegram";
import { PRICE_TO_SERVICE, getMappingBySlug } from "~/lib/stripe-product-map";
import { generatePortalToken } from "~/lib/portal-auth";
import { resolveAttribution, writeConversionEvent } from "~/lib/attribution";
import { getLead, markPurchased } from "~/lib/lead-store";

// ── Stripe instance (lazy) ──
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" as any });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, request: Request): Promise<void> {
  const customerEmail = session.customer_details?.email || session.customer_email;
  const customerName = session.customer_details?.name || "Valued Client";
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (!customerEmail) {
    console.error("No customer email in checkout session", session.id);
    return;
  }

  // Determine which service was purchased
  let serviceName = "MetroReach Service";
  let serviceSlug = "unknown";

  // Try metadata service_slug first (supports dynamically-priced services like Premium Growth Audit)
  const serviceSlugMeta = session.metadata?.service_slug;
  if (serviceSlugMeta) {
    const mapping = getMappingBySlug(serviceSlugMeta);
    if (mapping) {
      serviceName = mapping.name;
      serviceSlug = mapping.slug;
    }
  }

  // Payment Links omit service_slug metadata. First use the lead ID carried in
  // client_reference_id, then fall back to the line-item price mapping.
  if (serviceSlug === "unknown" && session.client_reference_id) {
    try {
      const lead = await getLead(session.client_reference_id);
      const leadData = lead as (typeof lead & { service_slug?: string; serviceSlug?: string }) | null;
      const leadSlug = leadData?.service_slug || leadData?.serviceSlug || leadData?.recommendedPackage;
      if (leadSlug) {
        const mapping = getMappingBySlug(leadSlug) || PRICE_TO_SERVICE[leadSlug];
        if (mapping) {
          serviceName = mapping.name;
          serviceSlug = mapping.slug;
        } else if (leadSlug === "premium-growth-audit") {
          serviceName = "Premium Growth Audit";
          serviceSlug = leadSlug;
        }
      }
    } catch (err: any) {
      console.error("Failed to resolve service from lead reference:", err.message);
    }
  }

  if (serviceSlug === "unknown" && session.line_items?.data?.length) {
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
  const portalToken = generatePortalToken();
  const company = session.metadata?.company || "";

  // Insert client record
  try {
    await sql`
      INSERT INTO clients (
        id, email, name, company, service, service_slug,
        status, stripe_customer_id, stripe_subscription_id,
        pipeline_status, portal_token, created_at, updated_at
      ) VALUES (
        ${clientId}, ${customerEmail}, ${customerName}, ${company || null},
        ${serviceName}, ${serviceSlug},
        'onboarding', ${customerId || null}, ${session.subscription as string || null},
        'pending', ${portalToken}, NOW(), NOW()
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
    portal_token: portalToken,
  };

  // ── Trigger delivery pipeline (non-blocking, fire-and-forget) ──

  // 1. Purchase confirmation email
  sendPurchaseConfirmation(client, session.amount_total || 0).catch((e) =>
    console.error("Purchase confirmation email failed:", e.message),
  );

  // 2. Welcome email
  sendWelcomeEmail(client).catch((e) =>
    console.error("Welcome email failed:", e.message),
  );

  // 3. Onboarding request
  sendOnboardingRequest(client).catch((e) =>
    console.error("Onboarding email failed:", e.message),
  );

  // 4. Internal notification
  sendInternalNewClientAlert(client).catch((e) =>
    console.error("Internal alert failed:", e.message),
  );

  // 5. Create order record (DB + shared file)
  createOrder({
    clientEmail: customerEmail,
    clientName: customerName,
    serviceName,
    serviceSlug,
    amountCents: session.amount_total || 0,
    recurring: session.mode === "subscription",
    stripeSessionId: session.id,
  }).catch((e) =>
    console.error("Order creation failed:", e.message),
  );

  // 4. Telegram notification
  const tgLines = [
    "🎉 <b>New Client — MetroReach Media</b>",
    "",
    `Name: ${customerName}`,
    `Email: ${customerEmail}`,
    `Company: ${company || "N/A"}`,
    `Service: ${serviceName}`,
    `Status: Onboarding`,
    "",
    `<a href="https://metroreachagency.com/portal?token=${portalToken}">View Client →</a>`,
  ];
  sendTelegramMessage(tgLines.join("\n")).catch(() => {});

  // 5. Trigger automated pipeline execution (fire-and-forget)
  executePipeline(client).catch((e) =>
    console.error("Pipeline execution failed:", e.message),
  );

  // ── 6. Write conversion event with attribution (fire-and-forget) ──
  resolveAttribution(request)
    .then((attribution) => {
      // Override client_id to the one we just created/updated
      attribution.client_id = clientId;
      return writeConversionEvent(
        attribution,
        "purchase",
        session.amount_total || 0,
        customerName,
        customerEmail,
      );
    })
    .catch((e) => console.error("Conversion event write failed:", e.message));

  // ── 7. Premium Growth Audit: mark lead as paid + send report email ──
  if (serviceSlug === "premium-growth-audit") {
    const leadId = session.metadata?.lead_id;
    if (leadId) {
      try {
        await markPurchased(leadId);
        console.log(`Premium audit lead marked paid: ${leadId}`);
      } catch (e: any) {
        console.error("Failed to mark premium audit lead as paid:", e.message);
      }

      // Send report-access email with direct link
      const reportUrl = `https://metroreachagency.com/premium-audit/report?id=${leadId}&email=${encodeURIComponent(customerEmail)}`;
      sendEmail({
        to: customerEmail,
        from: "reports@metroreachagency.com",
        subject: "Your Premium Growth Audit Report Is Ready",
        body: [
          `Hi ${customerName},`,
          "",
          "Your Premium Growth Audit report is ready to view.",
          "",
          `View your report: ${reportUrl}`,
          "",
          "This comprehensive analysis includes 12-category scoring, a priority matrix, and a phased growth roadmap — all evidence-based and built by our team of marketing specialists.",
          "",
          "If you have any questions about your report or the service recommendations, just reply to this email — our team is here to help.",
          "",
          "— The MetroReach Media Team",
        ].join("\n"),
      }).catch((e) => console.error("Premium audit report email failed:", e.message));
    }
  }

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
              handleCheckoutCompleted(session, request).catch((err) =>
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
