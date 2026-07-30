/**
 * /confirmation/premium-audit — Premium Growth Audit Post-Payment Page
 *
 * After Stripe checkout completes for the Premium Growth Audit ($495),
 * clients land here. Dedicated hardcoded page that:
 * - Shows "Premium Growth Audit" correctly (no SSR/URL-param issues)
 * - Generates a portal token server-side
 * - Creates/updates client record so onboarding is immediately accessible
 * - Replaces "Check Your Email" with "Start Onboarding Immediately"
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
import {
  CheckCircle,
  ClipboardText,
  Clock,
  Rocket,
  ArrowRight,
  Buildings,
  WarningCircle,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { sql } from "~/lib/db";
import { generatePortalToken } from "~/lib/portal-auth";
import { getLead } from "~/lib/lead-store";

// ── Loader data ──

interface LoaderData {
  portalToken: string | null;
  error: string | null;
}

// ── Route definition ──

export const Route = createFileRoute("/confirmation/premium-audit")({
  loader: async ({ request }): Promise<LoaderData> => {
    const url = new URL(request.url);
    const leadId = url.searchParams.get("leadId");

    if (!leadId) {
      return { portalToken: null, error: "Missing lead ID" };
    }

    try {
      // Look up the lead to get email and contact info
      const lead = await getLead(leadId);
      if (!lead) {
        return { portalToken: null, error: "Lead not found" };
      }

      const email = lead.contactInfo.email;
      const name = lead.contactInfo.name;
      const company = lead.businessInfo.businessName;

      // Check if client already exists (webhook may have already fired)
      const existingRows = await sql`
        SELECT id, portal_token FROM clients WHERE email = ${email} LIMIT 1
      `;

      let portalToken: string;

      if (existingRows.length > 0) {
        // Client exists — use existing token or generate new one
        portalToken = existingRows[0].portal_token as string;
        if (!portalToken) {
          portalToken = generatePortalToken();
          await sql`
            UPDATE clients
            SET portal_token = ${portalToken}, updated_at = NOW()
            WHERE id = ${existingRows[0].id as string}
          `;
        }

        // Update service info to reflect this purchase
        await sql`
          UPDATE clients
          SET service = 'Premium Growth Audit',
              service_slug = 'premium-growth-audit',
              status = 'onboarding',
              updated_at = NOW()
          WHERE id = ${existingRows[0].id as string}
        `;
      } else {
        // No client yet — create one (webhook hasn't fired or this is ahead of it)
        const clientId = `client-${randomHex(8)}`;
        portalToken = generatePortalToken();

        await sql`
          INSERT INTO clients (
            id, email, name, company, service, service_slug,
            status, pipeline_status, portal_token, created_at, updated_at
          ) VALUES (
            ${clientId}, ${email}, ${name}, ${company},
            'Premium Growth Audit', 'premium-growth-audit',
            'onboarding', 'pending', ${portalToken}, NOW(), NOW()
          )
          ON CONFLICT (id) DO NOTHING
        `;
      }

      return { portalToken, error: null };
    } catch (err: any) {
      console.error("Premium audit confirmation loader error:", err.message);
      return { portalToken: null, error: "Failed to set up portal access. Please contact support." };
    }
  },

  head: () => ({
    meta: [
      { title: "Payment Successful — Premium Growth Audit — MetroReach Media" },
      {
        name: "description",
        content:
          "Your Premium Growth Audit payment has been confirmed. Start your onboarding immediately.",
      },
    ],
  }),

  component: PremiumAuditConfirmation,
});

// ── Component ──

function PremiumAuditConfirmation() {
  const data = Route.useLoaderData();
  const portalToken = data?.portalToken;
  const error = data?.error;

  const nextSteps = [
    {
      icon: ClipboardText,
      title: "Start Onboarding Immediately",
      description:
        "Complete your detailed business questionnaire now so our strategists can begin work right away. No waiting for email — get started in seconds.",
    },
    {
      icon: Clock,
      title: "Strategy Kickoff",
      description:
        "Within 48 hours, your dedicated strategist begins building your content plan, audience research, and platform strategy tailored to your business.",
    },
    {
      icon: Rocket,
      title: "Analysis Delivered",
      description:
        "Your comprehensive growth audit is delivered within 5–7 business days. Every recommendation is backed by data, competitive research, and platform expertise.",
    },
  ];

  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative py-20 lg:py-28 bg-bg-root overflow-hidden border-b border-border-subtle">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_at_50%_50%,rgba(0,143,255,0.06),transparent)] pointer-events-none" />
        <Container className="relative z-10">
          <div className="max-w-lg mx-auto text-center">
            {/* Success icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/15 mb-6">
              <CheckCircle size={32} weight="fill" className="text-success" />
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading text-text-primary tracking-tight mb-4">
              Payment Successful — Premium Growth Audit
            </h1>

            <p className="text-lg text-text-secondary leading-relaxed mb-8">
              Welcome to MetroReach Media. Your Premium Growth Audit is confirmed
              and our team is preparing your analysis.
            </p>

            {/* Order summary card */}
            <div className="rounded-2xl bg-bg-surface border border-border-subtle p-6 mb-8">
              <p className="text-xs font-medium text-text-muted uppercase tracking-widest mb-3">
                Order Summary
              </p>
              <p className="text-base font-semibold text-text-primary">
                Premium Growth Audit
              </p>
              <p className="text-sm text-text-secondary mt-1">
                Status: <span className="text-success font-medium">Confirmed</span>
              </p>
              <p className="text-lg font-bold text-text-primary mt-3">$495</p>
            </div>

            {/* CTA buttons */}
            {error ? (
              <div className="rounded-2xl bg-error/10 border border-error/20 p-5 mb-6 flex items-start gap-3 text-left">
                <WarningCircle size={20} className="text-error flex-shrink-0 mt-0.5" weight="fill" />
                <div>
                  <p className="text-sm font-semibold text-error">Portal Setup Issue</p>
                  <p className="text-xs text-error/80 mt-1">{error}</p>
                  <p className="text-xs text-text-secondary mt-2">
                    Please contact{" "}
                    <a
                      href="mailto:support@metroreachagency.com"
                      className="text-brand-primary underline hover:no-underline"
                    >
                      support@metroreachagency.com
                    </a>{" "}
                    and we'll get you set up right away.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={`/portal/onboarding?token=${portalToken}`}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary transition-all duration-200"
                >
                  Start Your Onboarding
                  <ArrowRight size={16} weight="bold" />
                </a>
                <a
                  href="/"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-bg-surface border border-border-subtle text-text-secondary text-sm font-medium hover:border-border-emphasis hover:text-text-primary transition-colors"
                >
                  Back to Home
                </a>
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* ── Next Steps ── */}
      <section className="py-20 bg-bg-surface">
        <Container>
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-medium text-text-muted uppercase tracking-widest text-center mb-2">
              What to Expect
            </p>
            <h2 className="text-2xl font-bold font-heading text-text-primary text-center mb-12">
              Your team gets to work immediately
            </h2>

            <div className="space-y-4">
              {nextSteps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div
                    key={i}
                    className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6 flex items-start gap-5"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                      <Icon size={20} weight="fill" className="text-brand-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-semibold text-text-muted tabular-nums">
                          {i + 1}
                        </span>
                        <h3 className="text-base font-semibold text-text-primary">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Container>
      </section>

      {/* ── Footer ── */}
      <section className="py-16 bg-bg-root border-t border-border-subtle">
        <Container>
          <div className="max-w-md mx-auto text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-primary/10 border border-brand-primary/20 mb-4">
              <Buildings size={18} className="text-brand-primary" weight="fill" />
            </div>
            <p className="text-sm text-text-secondary mb-4">
              Questions before your kickoff? We're here to help.
            </p>
            <a
              href="mailto:support@metroreachagency.com"
              className="text-sm font-medium text-brand-primary hover:text-brand-primary-glow transition-colors"
            >
              support@metroreachagency.com
            </a>
            <p className="text-xs text-text-muted mt-8 pt-8 border-t border-border-subtle">
              &copy; {new Date().getFullYear()} MetroReach Media. Premium Social Media Marketing.
            </p>
          </div>
        </Container>
      </section>
    </main>
  );
}
