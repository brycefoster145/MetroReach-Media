import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, LockOpen, Spinner } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { pricingPage } from "~/data/pages";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Transparent Pricing — MetroReach Media" },
      { name: "description", content: "Clear, transparent social media marketing pricing. No hidden fees. Choose the package that fits your growth goals." },
      { property: "og:url", content: "https://www.metroreachagency.com/pricing" },
    ],
    links: [
      { rel: "canonical", href: "https://www.metroreachagency.com/pricing" },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function handleCheckout(slug: string, tierName: string) {
    setCheckingOut(tierName);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create checkout session. Please try again.");
      }
      const { url } = await res.json();
      if (!url) throw new Error("No checkout URL returned. Please try again.");
      window.location.href = url;
    } catch (err: any) {
      setCheckoutError(err.message || "Something went wrong. Please try again.");
      setCheckingOut(null);
    }
  }

  return (
    <section className="py-24 bg-bg-root min-h-dvh">
      <Container>
        <SectionHeading
          headline={pricingPage.headline}
          description={pricingPage.subheadline}
        />

        {/* Checkout error banner */}
        {checkoutError && (
          <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 mb-6 max-w-5xl mx-auto">
            <p className="text-sm text-red-400">{checkoutError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {pricingPage.tiers.map((tier) => {
            const isFeatured = tier.featured;

            return (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-8 flex flex-col ${
                  isFeatured
                    ? "bg-bg-surface border border-brand-primary/30 ring-1 ring-brand-primary/10 featured-card-hover"
                    : "bg-bg-surface border border-border-subtle card-hover"
                }`}
              >
                {/* Featured glow */}
                {isFeatured && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-primary/5 to-brand-accent/5 pointer-events-none" />
                )}

                {/* Most Popular badge */}
                {isFeatured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-block bg-brand-primary text-text-primary text-xs font-semibold rounded-full px-4 py-1">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="relative z-10 flex flex-col flex-1">
                  {/* Package name */}
                  <h3 className="text-xl font-semibold font-heading text-text-primary mb-2">
                    {tier.name}
                  </h3>

                  {/* Price */}
                  <div className="mb-2">
                    <span className="text-5xl font-bold font-heading text-text-primary">
                      {tier.price}
                    </span>
                    <span className="text-base text-text-muted">
                      {tier.period}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-text-secondary mb-6">
                    {tier.description}
                  </p>

                  {/* Feature list */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((f, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-3 text-sm text-text-secondary"
                      >
                        <Check
                          size={16}
                          weight="bold"
                          className="text-brand-accent flex-shrink-0 mt-0.5"
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Best for */}
                  <div className="mb-6">
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                      Best for
                    </p>
                    <p className="text-sm text-text-secondary">
                      {tier.bestFor}
                    </p>
                  </div>

                  {/* CTA */}
                  {tier.comingSoon ? (
                    <button
                      disabled
                      className="w-full justify-center inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold bg-bg-surface-high text-text-muted cursor-not-allowed border border-border-subtle"
                    >
                      Coming Soon
                    </button>
                  ) : (
                    <button
                      onClick={() => tier.serviceSlug && handleCheckout(tier.serviceSlug, tier.name)}
                      disabled={checkingOut === tier.name}
                      className={`w-full justify-center inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold transition-all duration-200 ${
                        isFeatured
                          ? "bg-brand-primary text-white hover:bg-brand-primary-glow hover:shadow-[0_0_20px_rgba(0,143,255,0.3)]"
                          : "bg-bg-surface-high text-text-primary border border-border-subtle hover:border-brand-primary hover:text-brand-primary"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {checkingOut === tier.name ? (
                        <>
                          <Spinner size={18} weight="bold" className="animate-spin" />
                          Redirecting...
                        </>
                      ) : (
                        tier.cta || "Get Started"
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add-on note */}
        <p className="text-sm text-text-secondary text-center mt-10 max-w-xl mx-auto">
          {pricingPage.addonNote}
        </p>

        {/* No-lock pledge */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <LockOpen size={18} weight="regular" className="text-brand-accent" />
          <p className="text-base text-text-secondary">
            {pricingPage.noLockPledge}
          </p>
        </div>
      </Container>
    </section>
  );
}
