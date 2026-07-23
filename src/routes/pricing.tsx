import { createFileRoute } from "@tanstack/react-router";
import { Check, LockOpen } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { pricingPage } from "~/data/pages";

export const Route = createFileRoute("/pricing")({
  component: Pricing,
});

function Pricing() {
  return (
    <section className="py-24 bg-bg-root min-h-dvh">
      <Container>
        <SectionHeading
          headline={pricingPage.headline}
          description={pricingPage.subheadline}
        />

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
                  {isFeatured ? (
                    <Button href={tier.paymentLink} className="w-full justify-center">
                      Get started
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      href={tier.paymentLink}
                      className="w-full justify-center"
                    >
                      Get started
                    </Button>
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
