import { useEffect, useRef, useState } from "react";
import {
  FacebookLogo,
  InstagramLogo,
  TiktokLogo,
  GoogleLogo,
  YoutubeLogo,
  LinkedinLogo,
  XLogo,
  Star,
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

      {/* Radial gradient washes */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_800px_at_50%_40%,rgba(0,143,255,0.06),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_at_80%_60%,rgba(0,212,170,0.04),transparent)] pointer-events-none" />

      {/* Dot grid overlay (subtle) */}
      <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />

      {/* Noise texture */}
      <div className="absolute inset-0 bg-noise pointer-events-none" />

      <Container className="relative z-10 py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* ========================================= */}
          {/* LEFT: Text Content                         */}
          {/* ========================================= */}
          <div className="max-w-xl">
            {/* Tagline */}
            <p
              className={`text-xs font-bold text-brand-primary uppercase tracking-widest mb-6 transition-all duration-500 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              {hero.tagline}
            </p>

            {/* Headline with gradient on key phrase */}
            <h1
              className={`text-4xl md:text-5xl lg:text-6xl font-bold font-heading text-text-primary tracking-tighter leading-[1.05] mb-6 transition-all duration-600 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: "100ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
              Premium social media marketing for businesses that want<span className="gradient-text-blue-teal"> leads, not reports.</span>
            </h1>

            {/* Subheadline */}
            <p
              className={`text-lg text-text-primary-light max-w-lg mb-8 transition-all duration-500 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "250ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
              {hero.subheadline}
            </p>

            {/* CTAs */}
            <div
              className={`flex flex-col sm:flex-row items-start gap-4 mb-10 transition-all duration-400 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "400ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
              <a
                href="/contact"
                className="inline-flex items-center gap-2 font-semibold bg-brand-primary text-text-primary rounded-full px-8 py-3.5 text-base cta-glow transition-all duration-200"
              >
                {hero.primaryCta} →
              </a>
              <Button variant="secondary" href="#portfolio">
                {hero.secondaryCta}
              </Button>
            </div>

            {/* Trust bar */}
            <div
              className={`transition-all duration-500 ${
                visible ? "opacity-100" : "opacity-0"
              }`}
              style={{ transitionDelay: "600ms" }}
            >
              <div className="flex items-center gap-2 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} weight="fill" className="star-rating" />
                ))}
                <span className="text-xs text-text-muted ml-1">Trusted across 12+ markets</span>
              </div>
              <p className="text-sm text-text-muted">{hero.trustBar}</p>
            </div>
          </div>

          {/* ========================================= */}
          {/* RIGHT: Abstract Visual (Desktop only)      */}
          {/* ========================================= */}
          <div className="hidden lg:flex items-center justify-center relative">
            {/* Abstract geometric composition */}
            <div className="relative w-full max-w-md aspect-square">
              {/* Large gradient orb */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-gradient-to-br from-brand-primary/10 to-brand-teal/5 blur-3xl" />

              {/* Concentric rings */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full border border-brand-primary/10" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full border border-brand-teal/10" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border border-brand-primary/15" />

              {/* Platform icons floating around */}
              <div className="absolute inset-0">
                {platformIcons.map(({ Icon, label }, i) => {
                  const angle = (i / platformIcons.length) * Math.PI * 2 - Math.PI / 2;
                  const radius = 38; // percentage
                  const x = 50 + radius * Math.cos(angle);
                  const y = 50 + radius * Math.sin(angle);

                  return (
                    <span
                      key={label}
                      className={`absolute platform-icon-animate ${
                        sequenceDone ? "platform-breathing" : ""
                      }`}
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: "translate(-50%, -50%)",
                        animationDelay: `${staggerDelays[i]}ms`,
                      }}
                      title={label}
                      aria-label={label}
                    >
                      <Icon size={22} weight="fill" />
                    </span>
                  );
                })}

                {/* Center dot */}
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span className="absolute w-4 h-4 rounded-full bg-brand-primary/20 live-pulse-ring" />
                  <span className="w-2 h-2 rounded-full bg-brand-primary" />
                </span>
              </div>

              {/* Decorative dots */}
              <div className="absolute top-[15%] right-[20%] w-1.5 h-1.5 rounded-full bg-brand-teal" />
              <div className="absolute bottom-[20%] left-[18%] w-1.5 h-1.5 rounded-full bg-brand-gold" />
              <div className="absolute top-[30%] left-[12%] w-1 h-1 rounded-full bg-brand-primary-glow" />
            </div>
          </div>
        </div>

        {/* Platform icon sequence (mobile: below the split) */}
        <div
          className={`lg:hidden flex flex-wrap items-center justify-center gap-3 sm:gap-5 mt-8 transition-all duration-500 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          style={{ transitionDelay: "700ms" }}
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
              <Icon size={24} weight="fill" />
            </span>
          ))}
          <span className="relative flex items-center justify-center ml-3">
            <span className="absolute w-4 h-4 rounded-full bg-brand-primary/30 live-pulse-ring" />
            <span className="w-[6px] h-[6px] rounded-full bg-brand-primary" />
          </span>
          <span className="text-xs text-text-muted ml-1">
            Active — managing campaigns now
          </span>
        </div>
      </Container>
    </section>
  );
}
