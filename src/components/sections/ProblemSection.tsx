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
    <section ref={ref} className="py-32 lg:py-40 bg-bg-surface relative overflow-hidden">
      {/* Dot grid background */}
      <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />

      {/* Subtle diagonal line */}
      <div className="absolute inset-0 pointer-events-none opacity-15">
        <div className="absolute top-0 left-1/2 w-px h-full bg-border-subtle rotate-[15deg] -translate-x-1/2" />
      </div>

      <Container>
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            badge={problem.label}
            headline={problem.headline}
          />

          {/* Pivot sentence */}
          <p
            className={`text-xl font-semibold text-text-primary text-center py-8 border-y border-border-subtle my-10 leading-loose transition-all duration-500 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{
              transitionDelay: "150ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {problem.pivot}
          </p>

          {/* Problem bullets - 2 column grid */}
          <div
            className={`grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6 mt-10 transition-all duration-500 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{
              transitionDelay: "300ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {problem.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-[0.55em] w-2 h-2 rounded-full bg-brand-primary flex-shrink-0" />
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
