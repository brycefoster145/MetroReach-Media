import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sparkle,
  PenNib,
  UsersThree,
  ChatCircleDots,
  ChartLine,
  MonitorPlay,
  Camera,
  CalendarCheck,
  Spinner,
  WarningCircle,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/vip")({
  head: () => ({
    meta: [
      { title: "Premium Daily Management — MetroReach Media" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VipPage,
});

const features = [
  {
    icon: Camera,
    label: "Facebook + Instagram",
    detail: "Full management across both platforms",
  },
  {
    icon: CalendarCheck,
    label: "2–3 Posts / Day",
    detail: "~60–90 original posts every month",
  },
  {
    icon: Sparkle,
    label: "Custom Graphics",
    detail: "Premium, original visuals for every post",
  },
  {
    icon: PenNib,
    label: "Professional Copywriting",
    detail: "Conversion-focused captions and hooks",
  },
  {
    icon: UsersThree,
    label: "Dedicated Specialist Team",
    detail: "Strategist, designer, copywriter, and media buyer",
  },
  {
    icon: ChatCircleDots,
    label: "Daily Engagement",
    detail: "Active community management on every post",
  },
  {
    icon: ChartLine,
    label: "Monthly Reporting",
    detail: "Detailed performance reports with insights",
  },
  {
    icon: MonitorPlay,
    label: "Live Dashboard",
    detail: "Real-time access to your campaign metrics",
  },
];

function VipPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGetStarted() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "vip-daily" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create checkout session. Please try again.");
      }

      const { url } = await res.json();

      if (!url) {
        throw new Error("No checkout URL returned. Please try again.");
      }

      // Redirect to Stripe-hosted checkout
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-bg-root flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        {/* Lockup */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-primary mb-4">
            Exclusive Package
          </p>
          <h1 className="text-3xl md:text-4xl font-bold font-heading text-text-primary mb-3">
            Premium Daily Management
          </h1>
          <p className="text-text-secondary text-base leading-relaxed max-w-md mx-auto">
            Full-service social media management designed for brands that demand
            daily presence and premium execution.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {features.map((f) => (
            <div
              key={f.label}
              className="flex items-start gap-3 rounded-xl bg-bg-surface border border-border-subtle p-4"
            >
              <f.icon
                size={22}
                weight="duotone"
                className="text-brand-primary flex-shrink-0 mt-0.5"
              />
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {f.label}
                </p>
                <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                  {f.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Price + CTA */}
        <div className="rounded-2xl bg-bg-surface-raised border border-border-emphasis p-6 text-center">
          <p className="text-sm text-text-muted mb-1">Investment</p>
          <p className="text-3xl font-bold font-heading text-text-primary mb-1">
            $6,000<span className="text-lg text-text-muted font-normal">/mo</span>
          </p>
          <p className="text-xs text-text-muted mb-6">
            Month-to-month. Pause or cancel anytime.
          </p>

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 mb-4 text-left">
              <WarningCircle size={18} weight="fill" className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* CTA Button */}
          <button
            type="button"
            onClick={handleGetStarted}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 w-full rounded-full bg-brand-primary text-text-primary px-8 py-3.5 text-base font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary hover:shadow-[0_0_20px_rgba(0,143,255,0.15)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Spinner size={20} weight="bold" className="animate-spin" />
                Redirecting to checkout...
              </>
            ) : (
              "Get Started"
            )}
          </button>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-text-muted mt-8">
          After checkout, your dedicated team will reach out within one business
          day to begin onboarding.
        </p>
      </div>
    </main>
  );
}
