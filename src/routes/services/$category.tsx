import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingCart, ArrowLeft, Check, CreditCard, Spinner, WarningCircle } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { subServices } from "~/data/pages";
import { useCart, type CartItem } from "~/context/CartContext";
import { useState } from "react";

const categoryDisplayNames: Record<string, string> = {
  "organic-content": "Organic Content Management",
  "paid-advertising": "Paid Advertising",
  "social-strategy": "Social Strategy",
  "analytics-reporting": "Analytics & Reporting",
  "community-management": "Community Management",
};

export const Route = createFileRoute("/services/$category")({
  component: ServiceCategory,
});

function ServiceCategory() {
  const { category } = Route.useParams();
  const { addItem, items } = useCart();
  const [addedSlug, setAddedSlug] = useState<string | null>(null);
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const displayName = categoryDisplayNames[category];
  const categoryServices = subServices.filter((s) => s.category === category);

  if (!displayName || categoryServices.length === 0) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6 text-center bg-bg-root">
        <h1 className="text-4xl md:text-5xl font-bold font-heading text-text-primary">
          Category not found.
        </h1>
        <p className="text-lg text-text-secondary max-w-md">
          The service category you're looking for doesn't exist — but our team can help you find what you need.
        </p>
        <Link
          to="/services"
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary text-text-primary px-8 py-3.5 text-base font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary transition-all duration-200"
        >
          <ArrowLeft size={18} weight="bold" />
          Back to Services
        </Link>
      </main>
    );
  }

  /** Legacy cart add — kept for cart page compatibility */
  function handleAddToCart(item: CartItem) {
    const alreadyInCart = items.some((i) => i.slug === item.slug);
    if (!alreadyInCart) {
      addItem(item);
    }
    setAddedSlug(item.slug);
    setTimeout(() => setAddedSlug(null), 2000);
  }

  /** Stripe checkout via API — supports promo codes */
  async function handleBuyNow(slug: string) {
    setCheckoutSlug(slug);
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

      if (!url) {
        throw new Error("No checkout URL returned. Please try again.");
      }

      // Redirect to Stripe-hosted checkout (promo code field visible)
      window.location.href = url;
    } catch (err: any) {
      setCheckoutError(err.message || "Something went wrong. Please try again.");
      setCheckoutSlug(null);
    }
  }

  return (
    <main>
      {/* Hero */}
      <section className="relative py-20 lg:py-28 bg-bg-root overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_at_50%_30%,rgba(0,143,255,0.06),transparent)] pointer-events-none" />
        <Container className="relative z-10">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-text-muted mb-8">
            <Link to="/" className="hover:text-brand-primary transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link to="/services" className="hover:text-brand-primary transition-colors">
              Services
            </Link>
            <span>/</span>
            <span className="text-text-primary font-medium">{displayName}</span>
          </div>
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading text-text-primary tracking-tight leading-[1.05] mb-6">
              {displayName}
            </h1>
            <p className="text-lg lg:text-xl text-text-secondary">
              Purchase any service below with secure Stripe checkout. Your pipeline auto-executes on payment — no waiting, no manual handoff.
            </p>
          </div>
        </Container>
      </section>

      {/* Sub-Services Grid */}
      <section className="py-20 bg-bg-surface">
        <Container>
          {/* Checkout error banner */}
          {checkoutError && (
            <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 mb-6 max-w-4xl mx-auto">
              <WarningCircle size={18} weight="fill" className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{checkoutError}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {categoryServices.map((svc) => {
              const isCartReady = ["verified", "production-proven", "optimized"].includes(svc.pipelineStatus);
              const isInCart = items.some((i) => i.slug === svc.slug);
              const justAdded = addedSlug === svc.slug;

              return (
                <div
                  key={svc.slug}
                  className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6 flex flex-col card-hover"
                >
                  <h3 className="text-lg font-semibold font-heading text-text-primary mb-2">
                    {svc.name}
                  </h3>
                  <p className="text-sm text-text-secondary mb-4 flex-1 leading-relaxed">
                    {svc.description}
                  </p>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-subtle">
                    <span className="text-sm font-semibold text-brand-primary">
                      {svc.price}
                    </span>
                    {isCartReady ? (
                      <div className="flex items-center gap-2">
                        {/* Add to Cart (secondary) */}
                        <button
                          onClick={() =>
                            handleAddToCart({
                              slug: svc.slug,
                              name: svc.name,
                              category: svc.category,
                              price: svc.price,
                            })
                          }
                          disabled={isInCart}
                          title={isInCart ? "Already in cart" : "Add to cart"}
                          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                            isInCart || justAdded
                              ? "bg-brand-accent/20 text-brand-accent cursor-default"
                              : "border border-border-emphasis text-text-secondary hover:text-brand-primary hover:border-brand-primary"
                          }`}
                        >
                          {isInCart || justAdded ? (
                            <>
                              <Check size={14} weight="bold" />
                              {justAdded ? "Added" : "Cart"}
                            </>
                          ) : (
                            <>
                              <ShoppingCart size={14} weight="bold" />
                              Cart
                            </>
                          )}
                        </button>

                        {/* Buy Now — Primary */}
                        <button
                          onClick={() => handleBuyNow(svc.slug)}
                          disabled={checkoutSlug === svc.slug}
                          className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 bg-brand-primary text-text-primary hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary hover:shadow-[0_0_20px_rgba(0,143,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {checkoutSlug === svc.slug ? (
                            <>
                              <Spinner size={16} weight="bold" className="animate-spin" />
                              Redirecting...
                            </>
                          ) : (
                            <>
                              <CreditCard size={16} weight="bold" />
                              Buy Now
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                        <button disabled className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold bg-bg-surface-high text-text-muted cursor-not-allowed border border-border-subtle">
                        Coming Soon
                        </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>
    </main>
  );
}
