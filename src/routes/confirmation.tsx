/**
 * /confirmation — Post-Payment Confirmation Page
 *
 * After Stripe checkout completes, clients land here.
 * Shows what they purchased + clear next steps.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  CheckCircle,
  Envelope,
  Clock,
  Rocket,
  ArrowRight,
  Buildings,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";

// ── Service display names (fallback if slug not in product map) ──
const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  "social-media-audit": "Social Media Audit",
  "monthly-content-calendar": "Monthly Content Calendar",
  "caption-writing": "Caption Writing",
  "hashtag-research": "Hashtag Research",
  "premium-audit": "Premium Marketing Audit",
  "social-media-management": "Social Media Management",
  "paid-ads-management": "Paid Ads Management",
  "content-creation": "Content Creation",
  "brand-strategy": "Brand Strategy Session",
};

function getServiceDisplayName(slug: string): string {
  return SERVICE_DISPLAY_NAMES[slug] || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const Route = createFileRoute("/confirmation")({
  head: () => ({
    meta: [
      { title: "Payment Confirmed — MetroReach Media" },
      { name: "description", content: "Your payment has been confirmed. Welcome to MetroReach Media." },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const [serviceSlug, setServiceSlug] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setServiceSlug(params.get("service") || "");
  }, []);

  const serviceName = serviceSlug ? getServiceDisplayName(serviceSlug) : "your service";

  const nextSteps = [
    {
      icon: Envelope,
      title: "Check Your Email",
      description:
        "We've sent a purchase confirmation with next steps. You'll receive your onboarding email within 1 hour — it includes everything we need to get started.",
    },
    {
      icon: Clock,
      title: "Strategy Kickoff",
      description:
        "Within 48 hours, your dedicated strategist begins building your content plan, audience research, and platform strategy tailored to your business.",
    },
    {
      icon: Rocket,
      title: "Content Goes Live",
      description:
        "First content begins posting within 5–7 business days after onboarding is complete. Every post is crafted by our team of specialists.",
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
              Payment Successful
            </h1>

            <p className="text-lg text-text-secondary leading-relaxed mb-8">
              Welcome to MetroReach Media. Your{" "}
              <span className="text-text-primary font-semibold">{serviceName}</span>{" "}
              purchase is confirmed and our team is preparing your account.
            </p>

            {/* Order summary card */}
            <div className="rounded-2xl bg-bg-surface border border-border-subtle p-6 mb-8">
              <p className="text-xs font-medium text-text-muted uppercase tracking-widest mb-3">
                Order Summary
              </p>
              <p className="text-base font-semibold text-text-primary">
                {serviceName}
              </p>
              <p className="text-sm text-text-secondary mt-1">
                Status: <span className="text-success font-medium">Confirmed</span>
              </p>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="/portal"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary transition-all duration-200"
              >
                Complete Onboarding
                <ArrowRight size={16} weight="bold" />
              </a>
              <a
                href="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-bg-surface border border-border-subtle text-text-secondary text-sm font-medium hover:border-border-emphasis hover:text-text-primary transition-colors"
              >
                Back to Home
              </a>
            </div>
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
