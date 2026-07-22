import { useEffect, useRef, useState } from "react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Badge } from "~/components/Badge";
import { socialProof } from "~/data/content";

export function SocialProof() {
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
        <SectionHeading
          headline={socialProof.headline}
          description={socialProof.subheadline}
        />

        {/* Stats bar */}
        <div
          className={`border-b border-border-subtle pb-10 mb-16 transition-all duration-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{
            transitionDelay: "100ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {socialProof.stats.map((stat, i) => (
              <div
                key={stat.label}
                className="text-center relative"
              >
                {/* Dividers between items on desktop */}
                {i < socialProof.stats.length - 1 && (
                  <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-10 bg-border-subtle" />
                )}
                <p
                  className={`text-4xl md:text-5xl font-bold font-heading ${
                    i === 1 ? "text-brand-accent" : "text-text-primary"
                  }`}
                >
                  {stat.value}
                </p>
                <p className="text-sm text-text-muted mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {socialProof.testimonials.map((t, i) => (
            <div
              key={t.name}
              className={`relative bg-bg-surface border border-border-subtle rounded-2xl p-8 card-hover transition-all duration-500 ${
                visible ? "opacity-100 scale-100" : "opacity-0 scale-[0.97]"
              }`}
              style={{
                transitionDelay: `${300 + i * 100}ms`,
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {/* Large quote mark watermark */}
              <span className="absolute top-4 left-4 text-6xl font-serif text-brand-primary/10 select-none leading-none">
                &ldquo;
              </span>

              <blockquote className="relative z-10">
                <p className="text-lg text-text-primary italic mb-6 leading-relaxed">
                  {t.quote}
                </p>
              </blockquote>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {t.name}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {t.title}, {t.business}
                  </p>
                </div>
                <Badge>{t.industry}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
