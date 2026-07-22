import { useEffect, useRef, useState } from "react";
import {
  Brain,
  PaintBrush,
  Article,
  ChartLineUp,
  ChartBar,
  ChatCircleText,
  Heartbeat,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { howItWorks } from "~/data/content";

const iconMap: Record<string, typeof Brain> = {
  Brain,
  PaintBrush,
  Article,
  ChartLineUp,
  ChartBar,
  ChatCircleText,
};

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} id="how-it-works" className="py-24 bg-bg-root">
      <Container>
        <SectionHeading
          headline={howItWorks.headline}
          description={howItWorks.subheadline}
        />

        {/* Role cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {howItWorks.roles.map((role, i) => {
            const Icon = iconMap[role.icon];
            return (
              <div
                key={role.name}
                className={`bg-bg-surface border border-border-subtle rounded-2xl p-6 card-hover transition-all duration-500 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{
                  transitionDelay: `${i * 80}ms`,
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <div className="text-brand-primary mb-3">
                  <Icon size={28} weight="duotone" />
                </div>
                <h4 className="text-lg font-semibold font-heading text-text-primary mb-2">
                  {role.name}
                </h4>
                <p className="text-sm text-text-secondary">{role.description}</p>
              </div>
            );
          })}
        </div>

        {/* Network diagram */}
        <div
          className={`my-16 flex justify-center transition-all duration-500 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transitionDelay: "600ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <img
            src="/images/how-it-works-network.webp"
            alt="Specialist team network diagram"
            className="w-full max-w-lg"
            loading="lazy"
          />
        </div>

        {/* Quality control callout */}
        <div
          className={`border border-border-subtle rounded-2xl bg-bg-surface p-6 flex items-start sm:items-center gap-4 mb-20 transition-all duration-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{
            transitionDelay: "700ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div className="text-brand-accent flex-shrink-0 mt-1 sm:mt-0">
            <Heartbeat size={28} weight="duotone" />
          </div>
          <p className="text-base text-text-secondary">
            {howItWorks.qualityControl.text}
          </p>
        </div>

        {/* Onboarding timeline */}
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold font-heading text-text-primary text-center mb-12">
            How you get started
          </h3>

          {/* Desktop: horizontal timeline */}
          <div className="hidden md:flex items-start justify-between relative">
            {/* Connecting line */}
            <div className="absolute top-5 left-[calc(12.5%+16px)] right-[calc(12.5%+16px)] h-px bg-border-subtle" />

            {howItWorks.onboarding.map((step, i) => (
              <div
                key={step.step}
                className={`flex flex-col items-center text-center w-[22%] relative z-10 transition-all duration-500 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{
                  transitionDelay: `${800 + i * 100}ms`,
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* Step circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold font-heading text-sm mb-3 border-2 ${
                    i === 0
                      ? "border-brand-primary text-brand-primary bg-brand-primary/10"
                      : "border-border-subtle text-text-muted bg-bg-surface"
                  }`}
                >
                  {step.step}
                </div>
                <p className="text-sm font-semibold text-text-primary mb-1">
                  {step.label}
                </p>
                <p className="text-xs text-text-muted">{step.detail}</p>
              </div>
            ))}
          </div>

          {/* Mobile: vertical timeline */}
          <div className="md:hidden space-y-0">
            {howItWorks.onboarding.map((step, i) => (
              <div
                key={step.step}
                className={`flex gap-4 relative pb-8 transition-all duration-500 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{
                  transitionDelay: `${800 + i * 100}ms`,
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* Vertical line */}
                {i < howItWorks.onboarding.length - 1 && (
                  <div className="absolute left-5 top-10 w-px h-full bg-border-subtle" />
                )}

                {/* Step circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold font-heading text-sm flex-shrink-0 border-2 ${
                    i === 0
                      ? "border-brand-primary text-brand-primary bg-brand-primary/10"
                      : "border-border-subtle text-text-muted bg-bg-surface"
                  }`}
                >
                  {step.step}
                </div>

                <div className="pt-2">
                  <p className="text-sm font-semibold text-text-primary mb-1">
                    {step.label}
                  </p>
                  <p className="text-xs text-text-muted">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
