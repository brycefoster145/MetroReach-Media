/**
 * Stripe Webhook Handler — MetroReach Media
 *
 * Receives Stripe webhook events, verifies signatures, and triggers the
 * automated client delivery pipeline on checkout.session.completed.
 *
 * ── Idempotency ──
 * Every event id is claimed in the `webhook_events` table before processing.
 * Duplicate deliveries (Stripe retries, serverless cold-start timeouts) of the
 * same event are detected and skipped, so retries can never create duplicate
 * or inconsistent client records. If processing fails, the claim is released
 * so the retry reprocesses cleanly.
 *
 * ── Client upsert ──
 * Client records are looked up by stripe_customer_id / email before insert.
 * Existing clients are UPDATED in place — their original portal_token is
 * preserved (never regenerated), so the token embedded in emails always
 * matches the database.
 *
 * ── Reliability ──
 * The critical path (client record + portal token + email dispatch) is
 * awaited before the webhook acknowledges, so a serverless runtime cannot
 * terminate mid-write.
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
import { createOrder } from "~/lib/order-router";
import { executePipeline } from "~/lib/pipeline-executor";
import { sendTelegramMessage } from "~/lib/telegram";
import { PRICE_TO_SERVICE, getMappingBySlug } from "~/lib/stripe-product-map";
import { generatePortalToken } from "~/lib/portal-auth";
import { resolveAttribution, writeConversionEvent } from "~/lib/attribution";
import { getLead } from "~/lib/lead-store";
import { requestBufferChannels, cancelBufferChannels } from "~/lib/buffer-client-lifecycle";

// Emails are awaited so the webhook ACK isn't sent until they are dispatched,
// but bounded so a slow mail provider can never hang the webhook past the
// serverless function limit. If the batch times out, emails already in flight
// still complete on the provider side and errors are logged.
const EMAIL_BATCH_TIMEOUT_MS = 25_000;

// ── Stripe instance (lazy) ──
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" as any });
}

/**
 * Claim a webhook event id in the idempotency ledger.
 * Returns true when this event has NOT been processed before (caller should
 * proceed); false when it is a duplicate delivery and must be skipped.
 */
async function claimWebhookEvent(eventId: string, eventType: string): Promise<boolean> {
  const result: any = await sql`
    INSERT INTO webhook_events (event_id, event_type)
    VALUES (${eventId}, ${eventType})
    ON CONFLICT (event_id) DO NOTHING
  `;
  const affected = Number(result?.rowCount ?? result?.count ?? 0);
  return affected > 0;
}

/**
 * Release an event claim after a processing failure so Stripe's retry of the
 * same event id can reprocess from scratch.
 */
async function releaseWebhookEvent(eventId: string): Promise<void> {
  try {
    await sql`DELETE FROM webhook_events WHERE event_id = ${eventId}`;
  } catch (err: any) {
    console.error("Failed to release webhook event claim:", err.message);
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  request: Request,
  eventId: string,
): Promise<void> {
  const customerEmail = session.customer_details?.email || session.customer_email;
  const customerName = session.customer_details?.name || "Valued Client";
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (!customerEmail) {
    console.error("No customer email in checkout session", session.id);
    return;
  }

  // Idempotency: claim this event id. If it was already processed (Stripe
  // retried a webhook whose response we never acknowledged, or a duplicate
  // delivery), skip entirely — no duplicate client rows, no duplicate emails,
  // no token regeneration.
  const claimed = await claimWebhookEvent(eventId, "checkout.session.completed");
  if (!claimed) {
    console.log(`Duplicate Stripe event ${eventId} — skipping (already processed)`);
    return;
  }

  try {
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

    const company = session.metadata?.company || "";
    const preferredPlatforms = (session.metadata?.preferred_platforms || "")
      .split(",")
      .map((platform) => platform.trim())
      .filter(Boolean);

    // ── Upsert client record (critical path — awaited) ──
    // Look up any existing client for this Stripe customer or email. A
    // duplicate/retried checkout must update that record, never insert a
    // second one — and must keep the original portal_token.
    const existingRows: any[] = customerId
      ? await sql`
          SELECT id, portal_token FROM clients
          WHERE stripe_customer_id = ${customerId}
             OR LOWER(email) = LOWER(${customerEmail})
          ORDER BY created_at ASC
          LIMIT 1
        `
      : await sql`
          SELECT id, portal_token FROM clients
          WHERE LOWER(email) = LOWER(${customerEmail})
          ORDER BY created_at ASC
          LIMIT 1
        `;
    const existing = existingRows?.[0];

    let clientId: string;
    let portalToken: string;

    if (existing?.id) {
      // Existing client — update in place, preserve the existing portal_token.
      clientId = existing.id as string;
      portalToken = existing.portal_token as string;
      if (!portalToken) {
        // Legacy record without a token yet — generate one AND persist it so
        // the token in emails always matches the database.
        portalToken = generatePortalToken();
        await sql`
          UPDATE clients
          SET portal_token = ${portalToken}, updated_at = NOW()
          WHERE id = ${clientId}
        `;
      }
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
      console.log(`Updated existing client ${clientId} (preserved portal_token)`);
    } else {
      // New client — generate id + portal token and insert.
      clientId = `client-${randomBytes(8).toString("hex")}`;
      portalToken = generatePortalToken();
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
      console.log(`Inserted new client ${clientId}`);
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

    // ── Email dispatch (awaited — bounded so the webhook cannot hang) ──
    // All emails use the stored portal_token via the `client` object above, so
    // the token in the email always matches the database — even when a
    // duplicate event updated an existing client.
    const emailTasks: Array<{ name: string; task: Promise<unknown> }> = [
      { name: "purchase-confirmation", task: sendPurchaseConfirmation(client, session.amount_total || 0) },
      { name: "welcome", task: sendWelcomeEmail(client) },
      { name: "onboarding", task: sendOnboardingRequest(client) },
      { name: "internal-alert", task: sendInternalNewClientAlert(client) },
    ];

    // Premium Growth Audit: NO premature report email here. The pipeline's
    // executePremiumAuditPipeline runs the real analysis and sends the report
    // email only after analysis completes (status: delivered).
    // (markPurchased is handled inside executePremiumAuditPipeline.)

    await dispatchEmails(emailTasks);

    // ── Post-email fire-and-forget (non-critical path) ──

    // 1. Create order record (DB only — task briefs are written by the pipeline executor)
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

    // 2. Telegram notification
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

    // 3. Trigger automated pipeline execution (fire-and-forget)
    executePipeline(client).catch((e) =>
      console.error("Pipeline execution failed:", e.message),
    );

    // 4. Write conversion event with attribution (fire-and-forget)
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

    await requestBufferChannels({
      stripeCustomerId: customerId || null,
      email: customerEmail,
      packageSlug: serviceSlug,
      preferredPlatforms,
    });

    console.log(`Client pipeline triggered: ${clientId} (${serviceSlug}); Buffer channel setup recorded`);
  } catch (err: any) {
    // Processing failed — release the idempotency claim so Stripe's retry of
    // this same event id reprocesses from scratch instead of being skipped.
    console.error("handleCheckoutCompleted failed, releasing event claim:", err.message);
    await releaseWebhookEvent(eventId);
    throw err;
  }
}

/**
 * Dispatch all pending emails, awaiting completion so the webhook ACK is not
 * sent until emails are handed to the provider. Bounded by a timeout so a
 * slow mail provider cannot hang the webhook; individual failures are logged
 * and do not fail the webhook.
 */
async function dispatchEmails(tasks: Array<{ name: string; task: Promise<unknown> }>): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`email batch exceeded ${EMAIL_BATCH_TIMEOUT_MS}ms`)),
      EMAIL_BATCH_TIMEOUT_MS,
    );
  });
  try {
    const settled = await Promise.race([
      Promise.allSettled(tasks.map((t) => t.task)),
      timeout,
    ]);
    if (settled) {
      settled.forEach((result, i) => {
        const taskName = tasks[i]?.name || `email-${i}`;
        if (result.status === "rejected") {
          console.error(
            `Email "${taskName}" failed:`,
            result.reason instanceof Error ? result.reason.message : String(result.reason),
          );
        } else if (
          result.value &&
          typeof result.value === "object" &&
          (result.value as { success?: boolean }).success === false
        ) {
          // Email sequences resolve with { success:false } instead of throwing —
          // surface those failures here so they are not silently swallowed.
          console.error(
            `Email "${taskName}" reported failure:`,
            (result.value as { error?: string }).error || "unknown error",
          );
        }
      });
    }
  } catch (err: any) {
    console.error("Email dispatch timed out:", err.message);
  } finally {
    if (timer) clearTimeout(timer);
  }
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
              // AWAITED: the critical path (client record + portal token +
              // email dispatch) must finish before we acknowledge, or the
              // serverless runtime could terminate mid-write.
              await handleCheckoutCompleted(session, request, event.id);
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
                await cancelBufferChannels(subscription.customer);
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
