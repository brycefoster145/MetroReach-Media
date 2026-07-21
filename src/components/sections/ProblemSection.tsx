import { useEffect, useRef, useState } from "react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { problem } from "~/data/content";

export function ProblemSection() {
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
    <section ref={ref} className="py-24 bg-bg-surface relative overflow-hidden">
      {/* Subtle diagonal line */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-1/2 w-px h-full bg-border-subtle rotate-[15deg] -translate-x-1/2" />
      </div>

      <Container>
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            badge={problem.label}
            headline={problem.headline}
          />

          <div
            className={`space-y-6 text-lg text-text-secondary leading-relaxed mb-10 transition-all duration-500 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            }`}
            style={{
              transitionDelay: "100ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {problem.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* Pivot sentence */}
          <p
            className={`text-xl font-medium text-text-primary text-center py-6 transition-all duration-500 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{
              transitionDelay: "300ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {problem.pivot}
          </p>

          {/* Problem bullets - 2 column grid */}
          <div
            className={`grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mt-10 transition-all duration-500 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{
              transitionDelay: "450ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {problem.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-[0.65em] w-1 h-1 rounded-full bg-brand-accent flex-shrink-0" />
                <p className="text-base text-text-secondary">
                  <strong className="text-text-primary font-semibold">
                    {b.lead}
                  </strong>
                  {" — "}
                  {b.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
