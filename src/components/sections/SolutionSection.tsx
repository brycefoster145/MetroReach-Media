import { useEffect, useRef, useState } from "react";
import {
  ClockCounterClockwise,
  SealCheck,
  SquaresFour,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { solution } from "~/data/content";

const iconMap: Record<string, typeof ClockCounterClockwise> = {
  ClockCounterClockwise,
  SealCheck,
  SquaresFour,
};

const colorClasses: Record<string, string> = {
  "brand-primary": "text-brand-primary",
  "brand-accent": "text-brand-accent",
  "brand-primary-glow": "text-brand-primary-glow",
  "brand-teal": "text-brand-teal",
};

export function SolutionSection() {
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
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-32 lg:py-36 bg-bg-root">
      <Container>
        <SectionHeading
          headline={solution.headline}
          description={solution.subheadline}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {solution.differentiators.map((d, i) => {
            const Icon = iconMap[d.icon];
            return (
              <div
                key={d.number}
                className={`bg-bg-surface border border-border-subtle rounded-2xl p-10 card-hover transition-all duration-500 ${
                  visible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-6"
                }`}
                style={{
                  transitionDelay: `${150 + i * 80}ms`,
                  transitionTimingFunction:
                    "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* Icon */}
                <div className={`${colorClasses[d.color]} mb-5`}>
                  <Icon size={44} weight="duotone" />
                </div>

                {/* Number */}
                <p className="text-xs font-semibold text-text-muted tracking-[0.15em] uppercase mb-2">
                  {d.number}
                </p>

                {/* Headline */}
                <h3 className="text-xl font-bold font-heading text-text-primary mb-3">
                  {d.headline}
                </h3>

                {/* Body */}
                <p className="text-base text-text-secondary leading-loose">{d.body}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
