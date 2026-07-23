import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingCart, ArrowLeft, Check } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
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
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary text-text-primary px-8 py-3.5 text-base font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent transition-all duration-200"
        >
          <ArrowLeft size={18} weight="bold" />
          Back to Services
        </Link>
      </main>
    );
  }

  function handleAdd(item: CartItem) {
    const alreadyInCart = items.some((i) => i.slug === item.slug);
    if (!alreadyInCart) {
      addItem(item);
    }
    setAddedSlug(item.slug);
    setTimeout(() => setAddedSlug(null), 2000);
  }

  return (
    <main>
      {/* Hero */}
      <section className="relative py-20 lg:py-28 bg-bg-root overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_at_50%_30%,rgba(59,130,246,0.06),transparent)] pointer-events-none" />
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
              Select the services your business needs. Add them to your cart and our team will reach out with a tailored proposal.
            </p>
          </div>
        </Container>
      </section>

      {/* Sub-Services Grid */}
      <section className="py-20 bg-bg-surface">
        <Container>
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
                      <button
                        onClick={() =>
                          handleAdd({
                            slug: svc.slug,
                            name: svc.name,
                            category: svc.category,
                            price: svc.price,
                          })
                        }
                        disabled={isInCart}
                        className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                          isInCart || justAdded
                            ? "bg-brand-accent/20 text-brand-accent cursor-default"
                            : "bg-brand-primary text-text-primary hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                        }`}
                      >
                        {isInCart || justAdded ? (
                          <>
                            <Check size={16} weight="bold" />
                            {justAdded ? "Added" : "In Cart"}
                          </>
                        ) : (
                          <>
                            <ShoppingCart size={16} weight="bold" />
                            Add to Cart
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border-emphasis px-4 py-1.5 text-xs font-medium text-text-muted">
                        Coming Soon
                      </span>
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
