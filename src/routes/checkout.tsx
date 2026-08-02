/**
 * /checkout — Real Payment Checkout
 *
 * Customers pick a plan (Starter / Growth / Scale / VIP Daily) or the
 * Premium Growth Audit, enter their details, and are redirected to
 * Stripe-hosted checkout to pay. No lead form, no proposal request.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  CreditCard,
  Lightning,
  LockKey,
  Spinner,
  Star,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { STRIPE_PRODUCT_MAP, getMappingBySlug } from "~/lib/stripe-product-map";

// ── Search params ──
interface CheckoutSearch {
  service?: string;
}

// ── Per-plan feature lists (from the business plan) ──
const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    "Up to 2 platforms",
    "12 original posts per month",
    "Monthly strategy report",
  ],
  growth: [
    "Up to 4 platforms",
    "20 posts per month",
    "Weekly performance snapshots",
  ],
  scale: [
    "Up to 7 platforms",
    "30+ posts per month",
    "Video scripts + custom reporting",
  ],
  "vip-daily": [
    "180 posts/month (5 IG + 1 FB daily)",
    "Service-aware pipeline",
    "Token-gated portal + review-ready workflow",
  ],
  "premium-growth-audit": [
    "Deep-dive audit of your social presence",
    "Growth roadmap with prioritized wins",
    "One-time investment — no commitment",
  ],
};

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    service: typeof search.service === "string" ? search.service : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Checkout — MetroReach Media" },
      { name: "description", content: "Choose a plan and pay securely through Stripe. MetroReach Media — premium social media marketing." },
      { property: "og:url", content: "https://www.metroreachagency.com/checkout" },
    ],
    links: [
      { rel: "canonical", href: "https://www.metroreachagency.com/checkout" },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const search = Route.useSearch();

  // Preselect from ?service= param when it's a valid product slug.
  const initialSlug =
    search.service && getMappingBySlug(search.service)
      ? search.service
      : "starter";

  const [selectedSlug, setSelectedSlug] = useState<string>(initialSlug);
  const [purchasingSlug, setPurchasingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Customer details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");

  function validateDetails(): string | null {
    if (!name.trim()) return "Please enter your name.";
    if (!email.trim()) return "Please enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return "Please enter a valid email address.";
    }
    return null;
  }

  async function handlePurchase(e: FormEvent, slug: string) {
    e.preventDefault();
    setError(null);

    const validationError = validateDetails();
    if (validationError) {
      setError(validationError);
      return;
    }

    setPurchasingSlug(slug);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          customerEmail: email.trim(),
          customerName: name.trim(),
          company: company.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create checkout session. Please try again.");
      }
      if (!data?.url) {
        throw new Error("No checkout URL returned. Please try again.");
      }

      // Redirect to Stripe-hosted checkout.
      window.location.assign(data.url);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
      setPurchasingSlug(null);
    }
  }

  const selectedMapping = getMappingBySlug(selectedSlug);

  return (
    <main>
      <section className="py-20 lg:py-28 bg-bg-root">
        <Container>
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-text-muted mb-8">
              <Link to="/" className="hover:text-brand-primary transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link to="/pricing" className="hover:text-brand-primary transition-colors">
                Pricing
              </Link>
              <span>/</span>
              <span className="text-text-primary font-medium">Checkout</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold font-heading text-text-primary mb-2">
              Choose Your Plan
            </h1>
            <p className="text-text-secondary mb-2">
              Select a plan below and pay securely with Stripe. Your service starts the moment payment clears.
            </p>
            <p className="flex items-center gap-1.5 text-sm text-text-muted mb-10">
              <LockKey size={15} weight="bold" className="text-brand-accent" />
              Secure checkout — payments processed by Stripe.
            </p>

            {/* Customer details */}
            <form
              onSubmit={(e) => selectedMapping && handlePurchase(e, selectedMapping.slug)}
              className="rounded-2xl bg-bg-surface border border-border-subtle p-6 md:p-8 mb-10"
            >
              <h2 className="text-lg font-semibold font-heading text-text-primary mb-1">
                Your Details
              </h2>
              <p className="text-sm text-text-muted mb-6">
                Used for your invoice and service setup.
              </p>

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 mb-6">
                  {error}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-text-secondary mb-1.5"
                  >
                    Name <span className="text-brand-accent">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Your full name"
                    className="w-full bg-bg-root border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary transition-colors duration-200"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-text-secondary mb-1.5"
                  >
                    Email <span className="text-brand-accent">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@company.com"
                    className="w-full bg-bg-root border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary transition-colors duration-200"
                  />
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="company"
                    className="block text-sm font-medium text-text-secondary mb-1.5"
                  >
                    Company <span className="text-text-muted">(optional)</span>
                  </label>
                  <input
                    id="company"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Your company name"
                    className="w-full bg-bg-root border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary transition-colors duration-200"
                  />
                </div>
              </div>
            </form>

            {/* Plans */}
            <div className="grid md:grid-cols-2 gap-5 mb-10">
              {STRIPE_PRODUCT_MAP.map((plan) => {
                const isSelected = selectedSlug === plan.slug;
                const isPurchasing = purchasingSlug === plan.slug;
                const isRecurring = plan.recurring;
                return (
                  <div
                    key={plan.slug}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedSlug(plan.slug)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedSlug(plan.slug);
                      }
                    }}
                    className={`rounded-2xl border p-6 flex flex-col transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "bg-bg-surface border-brand-primary shadow-[0_0_24px_rgba(0,143,255,0.12)]"
                        : "bg-bg-surface/60 border-border-subtle hover:border-border-emphasis"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold font-heading text-text-primary">
                            {plan.name}
                          </h3>
                          {plan.slug === "vip-daily" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent/10 border border-brand-accent/20 px-2.5 py-0.5 text-xs font-semibold text-brand-accent">
                              <Star size={12} weight="fill" /> Most complete
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                          {isRecurring ? "Monthly retainer" : "One-time"}
                        </span>
                      </div>
                      <span
                        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? "border-brand-primary bg-brand-primary"
                            : "border-border-emphasis"
                        }`}
                      >
                        {isSelected && <Check size={13} weight="bold" className="text-text-primary" />}
                      </span>
                    </div>

                    <p className="text-2xl font-bold font-heading text-text-primary mb-4">
                      {plan.priceLabel}
                    </p>

                    <ul className="space-y-2 mb-6 flex-1">
                      {(PLAN_FEATURES[plan.slug] || []).map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-sm text-text-secondary">
                          <Check size={16} weight="bold" className="text-brand-accent flex-shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      disabled={isPurchasing}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePurchase(e as unknown as FormEvent, plan.slug);
                      }}
                      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? "bg-brand-primary text-text-primary hover:shadow-[0_0_20px_rgba(0,143,255,0.15)]"
                          : "border border-border-emphasis text-text-primary hover:border-brand-primary hover:text-brand-primary"
                      }`}
                    >
                      {isPurchasing ? (
                        <>
                          <Spinner size={16} weight="bold" className="animate-spin" />
                          Redirecting to Stripe…
                        </>
                      ) : (
                        <>
                          <CreditCard size={16} weight="bold" />
                          Purchase {plan.slug === "premium-growth-audit" ? "Audit" : "Plan"} —{" "}
                          {plan.priceLabel}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Reassurance */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-bg-surface/60 border border-border-subtle p-6">
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center">
                  <Lightning size={20} weight="duotone" className="text-brand-accent" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Start immediately after payment
                  </p>
                  <p className="text-sm text-text-muted">
                    You'll be redirected to Stripe to complete payment. Questions? Email{" "}
                    <a href="mailto:contact@metroreachagency.com" className="text-brand-primary hover:underline">
                      contact@metroreachagency.com
                    </a>
                  </p>
                </div>
              </div>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-brand-primary transition-colors flex-shrink-0"
              >
                Compare plans <ArrowRight size={15} weight="bold" />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
