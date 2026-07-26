import { useEffect, useRef, useState } from "react";
import {
  Brain,
  PaintBrush,
  Eye,
  PaperPlaneTilt,
  Target,
  ChartLineUp,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { process } from "~/data/content";

const iconMap: Record<number, typeof Brain> = {
  1: Brain,
  2: PaintBrush,
  3: Eye,
  4: PaperPlaneTilt,
  5: Target,
  6: ChartLineUp,
};

export function ProcessSection() {
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
    <section ref={ref} className="py-32 lg:py-40 bg-bg-root relative overflow-hidden">
      {/* Dot grid background */}
      <div className="absolute inset-0 bg-dot-grid pointer-events-none" />

      <Container className="relative z-10">
        <SectionHeading headline={process.headline} />

        {/* Desktop: horizontal timeline */}
        <div className="hidden lg:block max-w-6xl mx-auto">
          <div className="relative">
            {/* Gradient connecting line with pulse */}
            <div
              className="absolute top-9 left-[8%] right-[8%] h-0.5 process-line-gradient process-line-animate"
            />

            <div className="grid grid-cols-6 gap-8">
              {process.steps.map((step, i) => {
                const Icon = iconMap[step.number];
                const isFirst = i === 0;
                const isLast = i === process.steps.length - 1;

                return (
                  <div
                    key={step.number}
                    className={`flex flex-col items-center text-center relative z-10 transition-all duration-500 ${
                      visible ? "opacity-100 translate-y-0" : "opacity-[0.01] translate-y-8"
                    }`}
                    style={{
                      transitionDelay: `${i * 100}ms`,
                      transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  >
                    {/* Step circle */}
                    <div
                      className={`w-[72px] h-[72px] rounded-full flex items-center justify-center mb-5 border-2 transition-colors process-circle-tint ${
                        isFirst
                          ? "process-circle-active"
                          : isLast
                            ? "process-circle-complete"
                            : "border-border-subtle text-text-muted"
                      }`}
                    >
                      <Icon size={32} weight="duotone" />
                    </div>

                    {/* Step number */}
                    <p className="text-xs font-bold text-brand-teal uppercase tracking-[0.15em] mb-2">
                      Step {step.number}
                    </p>

                    {/* Label */}
                    <p className="text-base font-bold text-text-primary mb-2">
                      {step.label}
                    </p>

                    {/* Description */}
                    <p className="text-sm text-text-secondary leading-relaxed max-w-[150px] mx-auto">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="lg:hidden max-w-md mx-auto">
          {process.steps.map((step, i) => {
            const Icon = iconMap[step.number];
            const isLast = i === process.steps.length - 1;

            return (
              <div
                key={step.number}
                className={`flex gap-5 relative pb-12 transition-all duration-500 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-[0.01] translate-y-6"
                }`}
                style={{
                  transitionDelay: `${i * 100}ms`,
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* Vertical connecting line */}
                {!isLast && (
                  <div className="absolute left-[31px] top-[72px] bottom-0 w-0.5 process-line-gradient process-line-animate" />
                )}

                {/* Step circle */}
                <div
                  className={`w-[72px] h-[72px] rounded-full flex items-center justify-center flex-shrink-0 border-2 process-circle-tint ${
                    i === 0
                      ? "process-circle-active"
                      : i === process.steps.length - 1
                        ? "process-circle-complete"
                        : "border-border-subtle text-text-muted"
                  }`}
                >
                  <Icon size={30} weight="duotone" />
                </div>

                <div className="pt-4">
                  <p className="text-xs font-bold text-brand-teal uppercase tracking-[0.15em] mb-1">
                    Step {step.number}
                  </p>
                  <p className="text-base font-bold text-text-primary mb-1">
                    {step.label}
                  </p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
