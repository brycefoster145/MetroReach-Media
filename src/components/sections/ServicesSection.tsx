import { useEffect, useRef, useState } from "react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { services } from "~/data/content";

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

  return (
    <section ref={ref} className="py-24 bg-bg-surface">
      <Container>
        <SectionHeading headline={services.headline} />

        <div className="space-y-20">
          {services.items.map((svc, i) => {
            const isEven = i % 2 === 1;
            const content = (
              <div className="space-y-5">
                <h3 className="text-2xl font-semibold font-heading text-text-primary">
                  {svc.name}
                </h3>
                <p className="text-base text-text-secondary leading-relaxed max-w-lg">
                  {svc.description}
                </p>
                <ul className="space-y-3">
                  {svc.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-text-secondary">
                      <span className="mt-[0.45em] w-1 h-1 rounded-full bg-brand-accent flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );

            const visual = (
              <div className="flex items-center justify-center">
                {svc.image ? (
                  <img
                    src={svc.image}
                    alt={`${svc.name} performance visualization`}
                    className="w-full max-w-md rounded-xl"
                    loading="lazy"
                  />
                ) : svc.name.includes("Organic") ? (
                  /* Abstract content cards visual */
                  <div className="relative w-full max-w-sm aspect-[4/3]">
                    <div className="absolute top-4 left-4 w-3/5 h-1/3 rounded-xl bg-bg-surface-raised border border-border-subtle" />
                    <div className="absolute top-[45%] left-8 w-2/5 h-1/4 rounded-lg bg-bg-surface-raised border border-border-subtle" />
                    <div className="absolute bottom-4 right-4 w-1/2 h-1/4 rounded-xl bg-bg-surface-raised border border-brand-primary/20" />
                    <div className="absolute top-8 right-6 w-1/4 h-1/5 rounded-lg bg-bg-surface-raised border border-border-subtle" />
                  </div>
                ) : (
                  /* Abstract geometric composition for Strategy & Creative */
                  <div className="relative w-full max-w-sm aspect-[4/3]">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-brand-accent/30" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-brand-primary/20" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-brand-accent" />
                    <div className="absolute top-[30%] left-[55%] w-px h-16 bg-border-subtle rotate-45" />
                    <div className="absolute bottom-[30%] right-[55%] w-px h-16 bg-border-subtle -rotate-45" />
                    <div className="absolute top-[35%] right-[30%] w-2 h-2 rounded-full bg-brand-primary" />
                    <div className="absolute bottom-[35%] left-[30%] w-2 h-2 rounded-full bg-brand-primary-glow" />
                  </div>
                )}
              </div>
            );

            return (
              <div
                key={svc.name}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center transition-all duration-500 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{
                  transitionDelay: `${200 + i * 100}ms`,
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* On mobile, visual always comes first. On desktop, alternate */}
                <div className={`${isEven ? "lg:order-2" : "lg:order-1"}`}>
                  {visual}
                </div>
                <div className={`${isEven ? "lg:order-1" : "lg:order-2"}`}>
                  {content}
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
