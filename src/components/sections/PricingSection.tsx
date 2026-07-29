import { useEffect, useRef, useState } from "react";
import { Check, LockOpen, Star, Spinner } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { pricing } from "~/data/content";

export function PricingSection() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} id="pricing" className="py-32 lg:py-40 bg-bg-root relative overflow-hidden">
      {/* Subtle dot grid */}
      <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />

      <Container className="relative z-10">
        <SectionHeading
          headline={pricing.headline}
          description={pricing.subheadline}
        />

        {/* Checkout error banner */}
        {checkoutError && (
          <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 mb-6 max-w-5xl mx-auto">
            <p className="text-sm text-red-400">{checkoutError}</p>
          </div>
        )}

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
          {pricing.tiers.map((tier, i) => {
            const isFeatured = tier.featured;

            return (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-10 flex flex-col transition-all duration-500 ${
                  isFeatured
                    ? "bg-bg-surface border border-brand-gold/50 ring-1 ring-brand-gold/15 glow-gold scale-[1.02] md:scale-[1.10] z-10 gradient-border-card shadow-2xl"
                    : "bg-bg-surface border border-border-subtle card-hover"
                } ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{
                  transitionDelay: `${i * 100}ms`,
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* Featured gradient background */}
                {isFeatured && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-gold/8 to-brand-primary/8 pointer-events-none" />
                )}

                {/* Most Popular badge */}
                {isFeatured && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-transparent via-brand-gold to-transparent rounded-full" />
                    <span className="badge-gold badge-gold-glow inline-flex items-center gap-1 text-xs rounded-full px-5 py-1.5 shadow-lg">
                      <Star size={14} weight="fill" /> Most Popular
                    </span>
                  </div>
                )}

                <div className="relative z-10 flex flex-col flex-1">
                  {/* Package name */}
                  <h3 className="text-xl font-semibold font-heading text-text-primary mb-2">
                    {tier.name}
                  </h3>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-5xl font-bold font-heading text-text-primary">
                      {tier.price}
                    </span>
                    <span className="text-base text-text-muted">{tier.period}</span>
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm text-text-secondary">
                        <Check
                          size={16}
                          weight="bold"
                          className={`flex-shrink-0 mt-0.5 ${
                            isFeatured ? "text-brand-gold" : "text-brand-teal"
                          }`}
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
                    <p className="text-sm text-text-secondary">{tier.bestFor}</p>
                  </div>

                  {/* CTA */}
                  {(tier as any).comingSoon ? (
                    <button
                      disabled
                      className="w-full justify-center inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold bg-bg-surface-high text-text-muted cursor-not-allowed border border-border-subtle"
                    >
                      Coming Soon
                    </button>
                  ) : isFeatured ? (
                    <button
                      onClick={() => (tier as any).serviceSlug && handleCheckout((tier as any).serviceSlug, tier.name)}
                      disabled={checkingOut === tier.name}
                      className="cta-featured-hover inline-flex items-center justify-center gap-2 font-semibold bg-brand-primary text-text-primary rounded-full px-8 py-3.5 text-base cta-glow w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {checkingOut === tier.name ? (
                        <>
                          <Spinner size={18} weight="bold" className="animate-spin" />
                          Redirecting...
                        </>
                      ) : (
                        <>{tier.cta} →</>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => (tier as any).serviceSlug && handleCheckout((tier as any).serviceSlug, tier.name)}
                      disabled={checkingOut === tier.name}
                      className="inline-flex items-center justify-center gap-2 font-semibold rounded-full px-8 py-3.5 text-base w-full border border-border-subtle text-text-secondary bg-bg-surface hover:border-brand-primary hover:text-brand-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {checkingOut === tier.name ? (
                        <>
                          <Spinner size={18} weight="bold" className="animate-spin" />
                          Redirecting...
                        </>
                      ) : (
                        tier.cta
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* No-lock pledge */}
        <div
          className={`flex items-center justify-center gap-2 mt-10 transition-all duration-500 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transitionDelay: "600ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <LockOpen size={18} weight="regular" className="text-brand-teal" />
          <p className="text-base text-text-secondary">{pricing.noLockPledge}</p>
        </div>

        {/* Trust anchor — visible below cards */}
        <div
          className={`flex items-center justify-center gap-3 mt-6 transition-all duration-500 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transitionDelay: "700ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <span className="bg-bg-surface-raised border border-border-subtle rounded-full px-5 py-2 text-sm font-medium text-text-secondary">
            No contracts. Cancel anytime. 30-day notice.
          </span>
        </div>
      </Container>
    </section>
  );
}
