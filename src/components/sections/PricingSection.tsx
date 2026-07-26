import { useEffect, useRef, useState } from "react";
import { Check, LockOpen, Star } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { pricing } from "~/data/content";

export function PricingSection() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

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
    <section ref={ref} id="pricing" className="py-28 lg:py-32 bg-bg-root relative overflow-hidden">
      {/* Subtle dot grid */}
      <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />

      <Container className="relative z-10">
        <SectionHeading
          headline={pricing.headline}
          description={pricing.subheadline}
        />

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
          {pricing.tiers.map((tier, i) => {
            const isFeatured = tier.featured;

            return (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-8 flex flex-col transition-all duration-500 ${
                  isFeatured
                    ? "bg-bg-surface border border-brand-gold/40 ring-1 ring-brand-gold/10 glow-gold scale-[1.02] md:scale-105 z-10"
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
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-gold/5 to-brand-primary/5 pointer-events-none" />
                )}

                {/* Most Popular badge */}
                {isFeatured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="badge-gold inline-flex items-center gap-1 text-xs rounded-full px-4 py-1 shadow-lg">
                      <Star size={12} weight="fill" /> Most Popular
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
                  {isFeatured ? (
                    <a
                      href="/contact"
                      className="inline-flex items-center justify-center gap-2 font-semibold bg-brand-primary text-text-primary rounded-full px-8 py-3.5 text-base cta-glow transition-all duration-200 w-full"
                    >
                      {tier.cta} →
                    </a>
                  ) : (
                    <Button
                      variant="ghost"
                      href="/contact"
                      className="w-full justify-center"
                    >
                      {tier.cta}
                    </Button>
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
      </Container>
    </section>
  );
}
