import { createFileRoute, Link } from "@tanstack/react-router";
import { X, ShoppingCart, ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { useCart } from "~/context/CartContext";

const categoryLabels: Record<string, string> = {
  "organic-content": "Organic Content",
  "paid-advertising": "Paid Advertising",
  "social-strategy": "Social Strategy",
  "analytics-reporting": "Analytics & Reporting",
  "community-management": "Community Management",
};

export const Route = createFileRoute("/cart")({
  component: Cart,
});

function Cart() {
  const { items, removeItem, itemCount } = useCart();

  if (items.length === 0) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6 text-center bg-bg-root">
        <div className="w-16 h-16 rounded-2xl bg-bg-surface border border-border-subtle flex items-center justify-center mb-2">
          <ShoppingCart size={28} weight="duotone" className="text-text-muted" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold font-heading text-text-primary">
          Your cart is empty.
        </h1>
        <p className="text-lg text-text-secondary max-w-md">
          Browse our services and add what your business needs. Our team will build a tailored proposal from your selections.
        </p>
        <Link
          to="/services"
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary text-text-primary px-8 py-3.5 text-base font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent transition-all duration-200 mt-4"
        >
          Browse Services
          <ArrowRight size={18} weight="bold" />
        </Link>
      </main>
    );
  }

  return (
    <main>
      <section className="py-20 lg:py-28 bg-bg-root">
        <Container>
          <div className="max-w-2xl mx-auto">
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
              <span className="text-text-primary font-medium">Cart</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold font-heading text-text-primary mb-2">
              Your Service Cart
            </h1>
            <p className="text-text-secondary mb-10">
              {itemCount} {itemCount === 1 ? "service" : "services"} selected — review your selections below.
            </p>

            {/* Cart Items */}
            <div className="space-y-4 mb-10">
              {items.map((item) => (
                <div
                  key={item.slug}
                  className="flex items-start justify-between gap-4 rounded-2xl bg-bg-surface border border-border-subtle p-5"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold font-heading text-text-primary mb-1">
                      {item.name}
                    </h3>
                    <span className="inline-block text-xs font-medium text-text-muted bg-bg-surface-raised rounded-full px-3 py-0.5 mb-2">
                      {categoryLabels[item.category] || item.category}
                    </span>
                    <p className="text-sm font-semibold text-brand-primary">
                      {item.price}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.slug)}
                    className="flex-shrink-0 p-2 text-text-muted hover:text-red-400 transition-colors rounded-lg hover:bg-bg-surface-raised"
                    aria-label={`Remove ${item.name}`}
                  >
                    <X size={18} weight="bold" />
                  </button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                to="/services"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border-emphasis text-text-primary px-8 py-3.5 text-base font-semibold hover:border-brand-primary hover:text-brand-primary transition-all duration-200"
              >
                <ArrowLeft size={18} weight="bold" />
                Continue Shopping
              </Link>
              <Link
                to="/checkout"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary text-text-primary px-8 py-3.5 text-base font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-200 flex-1 sm:flex-none"
              >
                Proceed to Checkout
                <ArrowRight size={18} weight="bold" />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
