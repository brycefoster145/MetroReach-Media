import { createFileRoute } from "@tanstack/react-router";
import {
  Sparkle,
  PenNib,
  UsersThree,
  ChatCircleDots,
  ChartLine,
  MonitorPlay,
  Camera,
  CalendarCheck,
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

          {/* Replace with Stripe payment link */}
          <a
            href="#"
            className="inline-flex items-center justify-center gap-2 w-full rounded-full bg-brand-primary text-text-primary px-8 py-3.5 text-base font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary hover:shadow-[0_0_20px_rgba(0,143,255,0.15)] transition-all duration-200"
          >
            Get Started
          </a>
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
