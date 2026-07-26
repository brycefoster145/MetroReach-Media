import { useEffect, useRef, useState } from "react";
import {
  Article,
  Target,
  Brain,
  ChartLineUp,
  ChatCircleText,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { services } from "~/data/content";

const iconMap: Record<string, typeof Article> = {
  Article,
  Target,
  Brain,
  ChartLineUp,
  ChatCircleText,
};

const iconColorMap: Record<string, string> = {
  Article: "text-brand-primary",
  Target: "text-brand-teal",
  Brain: "text-brand-gold",
  ChartLineUp: "text-brand-primary-glow",
  ChatCircleText: "text-brand-teal",
};

export function ServicesSection() {
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

  // First two services are "featured" (larger cards), rest are in a 3-col grid
  const featuredServices = services.items.slice(0, 2);
  const gridServices = services.items.slice(2);

  return (
    <section ref={ref} className="py-32 lg:py-40 bg-bg-surface relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />

      <Container className="relative z-10">
        <SectionHeading headline={services.headline} />

        {/* Featured row: 2 larger cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {featuredServices.map((svc, i) => {
            const Icon = iconMap[svc.icon] || Article;
            const iconColor = iconColorMap[svc.icon] || "text-brand-primary";

            return (
              <div
                key={svc.name}
                className={`glass-card p-10 lg:p-12 service-card-hover transition-all duration-500 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{
                  transitionDelay: `${i * 100}ms`,
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* Icon */}
                <div className={`${iconColor} mb-5`}>
                  <Icon size={48} weight="duotone" />
                </div>

                {/* Tagline */}
                <p className="text-sm font-semibold text-brand-teal uppercase tracking-[0.15em] mb-2">
                  {svc.tagline}
                </p>

                {/* Name */}
                <h3 className="text-2xl font-bold font-heading text-text-primary mb-4">
                  {svc.name}
                </h3>

                {/* Description */}
                <p className="text-base text-text-primary-light leading-loose mb-6">
                  {svc.description}
                </p>

                {/* Feature pills */}
                <div className="flex flex-wrap gap-2.5">
                  {svc.features.map((f, j) => (
                    <span key={j} className="feature-pill">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Grid row: 3 smaller cards for remaining services */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {gridServices.map((svc, i) => {
            const Icon = iconMap[svc.icon] || Article;
            const iconColor = iconColorMap[svc.icon] || "text-brand-primary";

            return (
              <div
                key={svc.name}
                className={`glass-card p-8 service-card-hover transition-all duration-500 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{
                  transitionDelay: `${300 + i * 100}ms`,
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* Icon */}
                <div className={`${iconColor} mb-4`}>
                  <Icon size={38} weight="duotone" />
                </div>

                {/* Tagline */}
                <p className="text-xs font-semibold text-brand-teal uppercase tracking-[0.15em] mb-2">
                  {svc.tagline}
                </p>

                {/* Name */}
                <h3 className="text-lg font-bold font-heading text-text-primary mb-3">
                  {svc.name}
                </h3>

                {/* Description */}
                <p className="text-sm text-text-primary-light leading-loose mb-5">
                  {svc.description}
                </p>

                {/* Feature pills */}
                <div className="flex flex-wrap gap-2">
                  {svc.features.map((f, j) => (
                    <span key={j} className="feature-pill text-xs">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
