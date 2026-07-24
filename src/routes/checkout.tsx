import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Check, ShoppingCart } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { useCart } from "~/context/CartContext";

const categoryLabels: Record<string, string> = {
  "organic-content": "Organic Content",
  "paid-advertising": "Paid Advertising",
  "social-strategy": "Social Strategy",
  "analytics-reporting": "Analytics & Reporting",
  "community-management": "Community Management",
};

export const Route = createFileRoute("/checkout")({
  component: Checkout,
});

function Checkout() {
  const { items, clearCart, itemCount } = useCart();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  // Redirect if cart is empty and not submitted
  if (items.length === 0 && !submitted) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6 text-center bg-bg-root">
        <div className="w-16 h-16 rounded-2xl bg-bg-surface border border-border-subtle flex items-center justify-center mb-2">
          <ShoppingCart size={28} weight="duotone" className="text-text-muted" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold font-heading text-text-primary">
          Nothing to check out.
        </h1>
        <p className="text-lg text-text-secondary max-w-md">
          Your cart is empty. Add services to your cart before checking out.
        </p>
        <Link
          to="/services"
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary text-text-primary px-8 py-3.5 text-base font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent transition-all duration-200 mt-4"
        >
          Browse Services →
        </Link>
      </main>
    );
  }

  function handleApplyPromo() {
    const trimmed = promoCode.trim();
    if (trimmed) {
      setAppliedPromo(trimmed);
      setPromoMessage("Code applied!");
      setTimeout(() => setPromoMessage(null), 3000);
    } else {
      setAppliedPromo(null);
      setPromoMessage(null);
    }
  }

  function handlePromoKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApplyPromo();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !company.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);

    // Build cart summary for the message field
    const cartSummary = items
      .map(
        (item) =>
          `- ${item.name} (${categoryLabels[item.category] || item.category}): ${item.price}`
      )
      .join("\n");

    const fullMessage = [
      message.trim() || "No additional message provided.",
      "",
      "--- Selected Services ---",
      cartSummary,
      appliedPromo ? `\nPromo Code: ${appliedPromo}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          industry: "Service Cart Inquiry",
          message: fullMessage,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit");
      }

      clearCart();
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again or contact us directly at hello@metroreachagency.com.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6 text-center bg-bg-root">
        <div className="w-16 h-16 rounded-2xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center mb-2">
          <Check size={28} weight="bold" className="text-brand-accent" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold font-heading text-text-primary">
          Thanks!
        </h1>
        <p className="text-lg text-text-secondary max-w-lg">
          This is a proposal request — not a purchase. Our team will review your selections and reach out within one business day to discuss pricing, scope, and next steps. No charges have been made.
        </p>
        <Link
          to="/services"
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary text-text-primary px-8 py-3.5 text-base font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent transition-all duration-200 mt-4"
        >
          Back to Services →
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
              <Link to="/cart" className="hover:text-brand-primary transition-colors">
                Cart
              </Link>
              <span>/</span>
              <span className="text-text-primary font-medium">Checkout</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold font-heading text-text-primary mb-2">
              Request Your Proposal
            </h1>
            <p className="text-text-secondary mb-10">
              Review your selections below, then fill in your details. Our team will follow up with a tailored proposal — no payment required today.
            </p>

            {/* Cart Summary (read-only) */}
            <div className="mb-10">
              <h2 className="text-lg font-semibold font-heading text-text-primary mb-4">
                Selected Services ({itemCount})
              </h2>
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.slug}
                    className="flex items-center justify-between gap-4 rounded-xl bg-bg-surface border border-border-subtle p-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {item.name}
                      </p>
                      <span className="text-xs text-text-muted">
                        {categoryLabels[item.category] || item.category}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-brand-primary flex-shrink-0">
                      {item.price}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Promo Code */}
            <div className="mb-10">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  onKeyDown={handlePromoKeyDown}
                  placeholder="Enter promo code"
                  aria-label="Promo Code"
                  className="bg-bg-surface border border-border-subtle rounded-full px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary transition-colors duration-200 w-48"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="inline-flex items-center gap-2 border border-border-emphasis text-text-primary rounded-full px-5 py-2 text-sm font-semibold hover:border-brand-primary hover:text-brand-primary transition-all duration-200"
                >
                  Apply
                </button>
              </div>
              {promoMessage && (
                <p className="text-sm text-brand-accent font-medium mt-2">
                  {promoMessage}
                </p>
              )}
            </div>

            {/* Contact Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <h2 className="text-lg font-semibold font-heading text-text-primary mb-2">
                Your Details
              </h2>

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
                  {error}
                </div>
              )}

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
                  className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary transition-colors duration-200"
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
                  className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary transition-colors duration-200"
                />
              </div>

              <div>
                <label
                  htmlFor="company"
                  className="block text-sm font-medium text-text-secondary mb-1.5"
                >
                  Company <span className="text-brand-accent">*</span>
                </label>
                <input
                  id="company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                  placeholder="Your company name"
                  className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary transition-colors duration-200"
                />
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-text-secondary mb-1.5"
                >
                  Message <span className="text-text-muted">(optional)</span>
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Tell us about your business, your goals, and what you're looking for in a marketing partner."
                  className="w-full bg-bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary transition-colors duration-200 resize-none"
                />
              </div>

              {/* Submit */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
                <Link
                  to="/cart"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border-emphasis text-text-primary px-8 py-3.5 text-base font-semibold hover:border-brand-primary hover:text-brand-primary transition-all duration-200"
                >
                  <ArrowLeft size={18} weight="bold" />
                  Back to Cart
                </Link>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary text-text-primary px-8 py-3.5 text-base font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-200 flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Send to Our Team"}
                </button>
              </div>
            </form>
          </div>
        </Container>
      </section>
    </main>
  );
}
