import { useEffect, useRef, useState } from "react";
import {
  Image,
  VideoCamera,
  CalendarDots,
  ChartBar,
  Article,
  TiktokLogo,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { portfolio } from "~/data/content";

const visualIconMap: Record<string, typeof Image> = {
  instagram: Image,
  "ad-creative": VideoCamera,
  calendar: CalendarDots,
  dashboard: ChartBar,
  "case-study": Article,
  tiktok: TiktokLogo,
};

const visualColors: Record<string, string> = {
  instagram: "from-pink-500/20 to-purple-500/20",
  "ad-creative": "from-brand-primary/20 to-brand-teal/20",
  calendar: "from-amber-500/20 to-orange-500/20",
  dashboard: "from-brand-teal/20 to-green-500/20",
  "case-study": "from-brand-gold/20 to-amber-500/20",
  tiktok: "from-gray-500/20 to-brand-primary/20",
};

export function PortfolioSection() {
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

  // Responsive masonry: 2 cols on mobile, 3 on md+
  return (
    <section ref={ref} className="py-32 lg:py-40 bg-bg-surface relative overflow-hidden">
      <Container>
        <SectionHeading
          headline={portfolio.headline}
          description={portfolio.subheadline}
        />

        {/* Masonry grid */}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 max-w-6xl mx-auto">
          {portfolio.items.map((item, i) => {
            const Icon = visualIconMap[item.visual] || Image;
            const bgGradient = visualColors[item.visual] || "from-brand-primary/20 to-brand-teal/20";

            // Vary heights for masonry look
            const heightClass =
              i % 3 === 0
                ? "h-[17rem]"
                : i % 3 === 1
                  ? "h-[21rem]"
                  : "h-[19rem]";

            return (
              <div
                key={item.title}
                className={`break-inside-avoid mb-6 transition-all duration-500 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{
                  transitionDelay: `${i * 100}ms`,
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <div
                  className={`relative rounded-2xl overflow-hidden border border-border-subtle bg-bg-surface-raised portfolio-card cursor-pointer group ${heightClass}`}
                >
                  {/* Mockup visual area */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} flex items-center justify-center`}>
                    <Icon size={56} weight="duotone" className="text-text-primary/20" />
                  </div>

                  {/* Hover overlay */}
                  <div className="portfolio-overlay absolute inset-0 flex flex-col justify-end p-7">
                    <div className="transform translate-y-3 group-hover:translate-y-0 transition-transform duration-500 ease-out">
                      <span className="inline-block text-xs font-semibold text-brand-teal uppercase tracking-[0.15em] mb-2">
                        {item.category}
                      </span>
                      <h4 className="text-xl font-bold font-heading text-text-primary mb-2">
                        {item.title}
                      </h4>
                      <p className="text-sm text-text-primary-light leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Border glow on hover */}
                  <div className="absolute inset-0 rounded-2xl border border-transparent group-hover:border-brand-primary/40 transition-colors duration-500 pointer-events-none" />
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
