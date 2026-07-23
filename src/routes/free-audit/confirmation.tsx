import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle,
  Clock,
  PhoneCall,
  Envelope,
  CalendarCheck,
  ArrowRight,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/free-audit/confirmation")({
  component: ConfirmationPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfirmationData {
  packageName: string;
  price: string;
  billingFrequency: string;
  leadId: string;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function ConfirmationPage() {
  const [data, setData] = useState<ConfirmationData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const packageName = params.get("package") || "Growth Package";
    const price = params.get("price") || "$3,000";
    const billingFrequency = params.get("billing") || "monthly";
    const leadId = params.get("leadId") || "";

    setData({ packageName, price, billingFrequency, leadId });
  }, []);

  const displayName = data?.packageName || "Growth Package";
  const displayPrice = data?.price || "$3,000";
  const displayBilling =
    data?.billingFrequency === "one-time"
      ? "one-time"
      : `/${data?.billingFrequency || "monthly"}`;

  const nextSteps = [
    {
      icon: CalendarCheck,
      title: "Team Assignment",
      description:
        "Your dedicated Metro Reach Media team is being assigned. You'll receive a welcome email within 24 hours introducing your specialist team.",
    },
    {
      icon: PhoneCall,
      title: "Strategy Call",
      description:
        "Your lead strategist will schedule a kickoff call to dive into your goals, brand voice, and priorities — so every piece of content and every campaign is built for your business.",
    },
    {
      icon: Envelope,
      title: "Platform Setup",
      description:
        "Our team will prepare your content calendar, ad accounts, and reporting dashboard. Depending on your package, first deliverables go live within 5 business days.",
    },
    {
      icon: Clock,
      title: "Ongoing Optimization",
      description:
        "Once live, your team continuously monitors, tests, and optimizes — adjusting creative, audiences, and strategy based on real performance data.",
    },
  ];

  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative py-20 lg:py-28 bg-bg-root overflow-hidden border-b border-border-subtle">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_at_50%_50%,rgba(6,214,160,0.06),transparent)] pointer-events-none" />
        <Container className="relative z-10">
          <div className="max-w-lg mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/15 mb-6">
              <CheckCircle size={32} weight="fill" className="text-success" />
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading text-text-primary tracking-tight mb-4">
              Thank you for choosing Metro Reach Media
            </h1>
            <p className="text-lg text-text-secondary leading-relaxed mb-8">
              Your order has been received. Our team is preparing everything you need
              to transform your social media presence.
            </p>

            {/* Order Summary */}
            <div className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6 mb-8">
              <p className="text-xs font-medium text-text-muted uppercase tracking-widest mb-3">
                Order Summary
              </p>
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-text-primary">
                  {displayName}
                </span>
                <span className="text-lg font-bold font-heading text-text-primary tabular-nums">
                  {displayPrice}
                  <span className="text-sm font-normal text-text-muted">
                    {displayBilling}
                  </span>
                </span>
              </div>
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
              Your dedicated team will reach out within 24 hours
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

      {/* ── CTA ── */}
      <section className="py-16 bg-bg-root border-t border-border-subtle">
        <Container>
          <div className="max-w-md mx-auto text-center">
            <p className="text-text-secondary mb-6">
              Have questions before your kickoff call?
            </p>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 font-semibold transition-all duration-200 ease-out bg-brand-primary text-text-primary rounded-full px-8 py-3.5 text-base hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:scale-[1.02]"
            >
              Contact Our Team
              <ArrowRight size={18} weight="bold" />
            </a>
            <p className="text-xs text-text-muted mt-8 pt-8 border-t border-border-subtle">
              Metro Reach Media &bull; Premium Social Media Marketing
            </p>
          </div>
        </Container>
      </section>
    </main>
  );
}
