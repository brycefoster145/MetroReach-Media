import { useEffect, useRef, useState } from "react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { socialProof, credibility } from "~/data/content";

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
    <section ref={ref} className="py-32 lg:py-40 bg-bg-surface">
      <Container>
        {/* ============================================= */}
        {/* Credibility Stats Bar (moved here)            */}
        {/* ============================================= */}
        <SectionHeading
          headline={credibility.headline}
        />

        {/* Industry badges */}
        <div
          className={`border-b border-border-subtle pb-16 mb-24 transition-all duration-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-[0.01] translate-y-6"
          }`}
          style={{
            transitionDelay: "0ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            {credibility.badges.map((badge) => (
              <span
                key={badge}
                className="inline-block text-xs font-medium rounded-full px-4 py-1.5 bg-bg-surface-raised border border-border-subtle text-text-muted"
              >
                {badge}
              </span>
            ))}
          </div>

          {/* Trust anchors */}
          <p className="text-sm text-text-secondary text-center mt-8">
            No contracts. 30-day cancellation. We earn your business every month.
          </p>
        </div>

        {/* ============================================= */}
        {/* No Case Studies Yet                            */}
        {/* ============================================= */}
        <div
          className={`mb-20 text-center transition-all duration-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-[0.01] translate-y-6"
          }`}
          style={{
            transitionDelay: "100ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <p className="text-2xl md:text-3xl font-bold font-heading text-text-primary mb-4">
            Case studies coming soon.
          </p>
          <p className="text-text-secondary max-w-md mx-auto">
            We're building our client roster. Be one of the first — and your results become our first case study.
          </p>
        </div>

        {/* Subtle divider before testimonials */}
        <div className="section-divider mb-20" />

        {/* ============================================= */}
        {/* Testimonials placeholder                       */}
        {/* ============================================= */}
        <SectionHeading
          headline={socialProof.headline}
          description={socialProof.subheadline}
        />

        <div className="text-center max-w-lg mx-auto">
          <p className="text-lg text-text-secondary leading-relaxed">
            We're looking for service businesses that want consistent, professional social media presence — and are ready to grow with us. Be one of our first clients and help shape what comes next.
          </p>
        </div>
      </Container>
    </section>
  );
}
