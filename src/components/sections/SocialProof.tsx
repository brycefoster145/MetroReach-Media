import { useEffect, useRef, useState } from "react";
import { Star, ArrowUpRight } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Badge } from "~/components/Badge";
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
    <section ref={ref} className="py-28 lg:py-32 bg-bg-surface">
      <Container>
        {/* ============================================= */}
        {/* Credibility Stats Bar (moved here)            */}
        {/* ============================================= */}
        <SectionHeading
          headline={credibility.headline}
        />

        {/* Stats bar */}
        <div
          className={`border-b border-border-subtle pb-12 mb-16 transition-all duration-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-[0.01] translate-y-6"
          }`}
          style={{
            transitionDelay: "0ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {credibility.stats.map((stat, i) => (
              <div key={stat.label} className="text-center relative">
                {i < credibility.stats.length - 1 && (
                  <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-10 bg-border-subtle" />
                )}
                <p
                  className={`text-4xl md:text-5xl font-bold font-heading ${
                    i === 1 ? "text-brand-teal" : "text-text-primary"
                  }`}
                >
                  {stat.value}
                </p>
                <p className="text-sm text-text-secondary mt-2">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Industry badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
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
          <p className="text-sm text-text-secondary text-center mt-6">
            No contracts. 30-day cancellation. We earn your business every month.
          </p>
        </div>

        {/* ============================================= */}
        {/* Case Study Snapshots                            */}
        {/* ============================================= */}
        <div
          className={`mb-20 transition-all duration-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-[0.01] translate-y-6"
          }`}
          style={{
            transitionDelay: "100ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-brand-gold uppercase tracking-widest mb-2">
              Case Studies
            </p>
            <h3 className="text-2xl md:text-3xl font-bold font-heading text-text-primary">
              Three businesses. Three industries. One result: more leads.
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {socialProof.caseStudies.map((cs, i) => (
              <div
                key={cs.name}
                className="glass-card p-6 card-hover transition-all duration-500"
                style={{
                  transitionDelay: `${200 + i * 80}ms`,
                }}
              >
                <p className="text-xs font-semibold text-brand-teal uppercase tracking-wider mb-3">
                  {cs.industry}
                </p>
                <h4 className="text-lg font-semibold font-heading text-text-primary mb-4">
                  {cs.name}
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-2xl font-bold font-heading text-text-primary">
                      {cs.metric}
                    </p>
                    <p className="text-xs text-text-muted mt-1">{cs.metricLabel}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-heading text-brand-teal">
                      {cs.subMetric}
                    </p>
                    <p className="text-xs text-text-muted mt-1">{cs.subLabel}</p>
                  </div>
                </div>
                <a
                  href="/case-studies"
                  className="inline-flex items-center gap-1 text-sm text-brand-primary hover:text-brand-primary-glow transition-colors"
                >
                  Read case study <ArrowUpRight size={14} weight="bold" />
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* ============================================= */}
        {/* Testimonials (updated with star ratings)       */}
        {/* ============================================= */}
        <SectionHeading
          headline={socialProof.headline}
          description={socialProof.subheadline}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {socialProof.testimonials.map((t, i) => (
            <div
              key={t.name}
              className={`relative bg-bg-surface border border-border-subtle rounded-2xl p-8 card-hover transition-all duration-500 ${
                visible ? "opacity-100 scale-100" : "opacity-[0.01] scale-[0.97]"
              }`}
              style={{
                transitionDelay: `${300 + i * 100}ms`,
                transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {/* Star rating */}
              <div className="flex items-center gap-0.5 mb-5">
                {Array.from({ length: 5 }).map((_, si) => (
                  <Star
                    key={si}
                    size={16}
                    weight="fill"
                    className={si < t.rating ? "star-rating" : "star-rating-empty"}
                  />
                ))}
              </div>

              {/* Large quote mark watermark */}
              <span className="absolute top-4 left-4 text-6xl font-serif text-brand-primary/10 select-none leading-none">
                &ldquo;
              </span>

              <blockquote className="relative z-10">
                <p className="text-base text-text-primary-light leading-relaxed mb-6">
                  {t.quote}
                </p>
              </blockquote>

              <div className="flex items-center justify-between border-t border-border-subtle pt-5">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {t.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {t.title}, {t.business}
                  </p>
                  <p className="text-xs text-text-muted">{t.location}</p>
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
