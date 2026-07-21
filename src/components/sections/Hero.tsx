import { useEffect, useRef, useState } from "react";
import {
  FacebookLogo,
  InstagramLogo,
  TiktokLogo,
  GoogleLogo,
  YoutubeLogo,
  LinkedinLogo,
  XLogo,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { Button } from "~/components/Button";
import { hero, platforms } from "~/data/content";

const platformIcons = [
  { Icon: FacebookLogo, label: "Facebook" },
  { Icon: InstagramLogo, label: "Instagram" },
  { Icon: TiktokLogo, label: "TikTok" },
  { Icon: GoogleLogo, label: "Google" },
  { Icon: YoutubeLogo, label: "YouTube" },
  { Icon: LinkedinLogo, label: "LinkedIn" },
  { Icon: XLogo, label: "X" },
];

export function Hero() {
  const [sequenceDone, setSequenceDone] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger sequence on mount
    const timer = setTimeout(() => setSequenceDone(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
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

  // Stagger delays in ms
  const staggerDelays = [0, 150, 300, 450, 600, 750, 900];

  return (
    <section
      ref={sectionRef}
      className="relative min-h-dvh flex items-center bg-bg-root overflow-hidden"
    >
      {/* Background texture */}
      <img
        src="/images/hero-bg-texture.webp"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-screen pointer-events-none"
        loading="eager"
      />

      {/* Radial gradient wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_800px_at_50%_40%,rgba(59,130,246,0.08),transparent)] pointer-events-none" />

      <Container className="relative z-10 py-24 lg:py-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Tagline */}
          <p
            className={`text-xs font-medium text-brand-accent uppercase tracking-widest mb-6 transition-all duration-500 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {hero.tagline}
          </p>

          {/* Headline */}
          <h1
            className={`text-4xl md:text-5xl lg:text-6xl font-bold font-heading text-text-primary tracking-tighter leading-[1.05] mb-8 transition-all duration-600 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{ transitionDelay: "150ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            {hero.headline}
          </h1>

          {/* Subheadline */}
          <p
            className={`text-lg lg:text-xl text-text-secondary max-w-2xl mx-auto mb-10 transition-all duration-500 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: "300ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            {hero.subheadline}
          </p>

          {/* Platform icon sequence */}
          <div
            className={`flex flex-wrap items-center justify-center gap-3 sm:gap-5 mb-4 transition-all duration-500 ${
              visible ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDelay: "500ms" }}
          >
            {platformIcons.map(({ Icon, label }, i) => (
              <span
                key={label}
                className={`platform-icon-animate ${
                  sequenceDone ? "platform-breathing" : ""
                }`}
                style={{ animationDelay: `${staggerDelays[i]}ms` }}
                title={label}
                aria-label={label}
              >
                <Icon size={28} weight="fill" />
              </span>
            ))}

            {/* Live pulse dot */}
            <span className="relative flex items-center justify-center ml-3">
              <span className="absolute w-4 h-4 rounded-full bg-brand-accent/30 live-pulse-ring" />
              <span className="w-[6px] h-[6px] rounded-full bg-brand-accent" />
            </span>
            <span className="text-xs text-text-muted ml-1">
              Active — managing campaigns now
            </span>
          </div>

          {/* CTAs */}
          <div
            className={`flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 transition-all duration-400 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: "600ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <Button href="/contact">{hero.primaryCta} →</Button>
            <Button variant="secondary" href="/#how-it-works">
              {hero.secondaryCta}
            </Button>
          </div>

          {/* Trust bar */}
          <p
            className={`mt-12 text-sm text-text-muted transition-all duration-500 ${
              visible ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDelay: "800ms" }}
          >
            {hero.trustBar}
          </p>
        </div>
      </Container>
    </section>
  );
}
