import { useState, useEffect, useCallback } from "react";
import { List, X, ShoppingCart } from "@phosphor-icons/react";
import { Button } from "./Button";
import { useCart } from "~/context/CartContext";

const links = [
  { label: "Services", href: "/services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Case Studies", href: "/case-studies" },
  { label: "About", href: "/about" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { itemCount } = useCart();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-bg-root/80 backdrop-blur-xl border-b border-border-subtle"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a
          href="/"
          className="text-lg font-bold font-heading text-text-primary hover:text-brand-primary transition-colors"
        >
          MetroReach<span className="text-brand-accent"> Media</span>
        </a>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-4">
          <a
            href="/cart"
            className="relative p-2 text-text-secondary hover:text-brand-primary transition-colors"
            aria-label="View cart"
          >
            <ShoppingCart size={22} weight="regular" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-5 h-5 text-[11px] font-bold text-text-primary bg-brand-accent rounded-full">
                {itemCount}
              </span>
            )}
          </a>
          <Button href="/contact">Start getting leads</Button>
        </div>

        {/* Mobile Hamburger */}
        <button
          className="lg:hidden p-2 text-text-secondary hover:text-text-primary"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <List size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="lg:hidden fixed inset-0 top-16 nav-backdrop z-40 flex flex-col">
          <div className="flex flex-col gap-4 p-6 pt-8">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={close}
                className="text-lg font-medium text-text-primary hover:text-brand-primary transition-colors py-2"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-6">
              <Button href="/contact" onClick={close} className="w-full justify-center">
                Start getting leads
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
