import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, LockOpen } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { pricingPage } from "~/data/pages";

export const Route = createFileRoute("/pricing")({
  component: Pricing,
});

function Pricing() {
  const [promoCode, setPromoCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleApply() {
    const trimmed = promoCode.trim();
    if (trimmed) {
      setAppliedCode(trimmed);
      setMessage("Code applied!");
    } else {
      setAppliedCode(null);
      setMessage(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleApply();
    }
  }

  function getPaymentLink(baseUrl: string) {
    if (!appliedCode) return baseUrl;
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}prefilled_promo_code=${encodeURIComponent(appliedCode)}`;
  }

  return (
    <section className="py-24 bg-bg-root min-h-dvh">
      <Container>
        <SectionHeading
          headline={pricingPage.headline}
          description={pricingPage.subheadline}
        />

        {/* Promo Code */}
        <div className="flex flex-col items-center gap-2 mb-10">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter code"
              aria-label="Promo Code"
              className="bg-bg-surface border border-border-subtle rounded-full px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary transition-colors duration-200 w-48"
            />
            <Button
              variant="ghost"
              onClick={handleApply}
              className="!px-5 !py-2 text-sm !rounded-full"
            >
              Apply
            </Button>
          </div>
          {message && (
            <p className="text-sm text-brand-accent font-medium">{message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {pricingPage.tiers.map((tier) => {
            const isFeatured = tier.featured;
            const link = getPaymentLink(tier.paymentLink);

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
                    <Button href={link} className="w-full justify-center">
                      Get started
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      href={link}
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
