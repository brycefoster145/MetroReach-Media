import { useEffect, useRef, useState } from "react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { portfolio } from "~/data/content";

// Kept for backward compatibility — no longer used in rendering
const visualIconMap: Record<string, string> = {
  instagram: "instagram",
  "ad-creative": "ad-creative",
  calendar: "calendar",
  dashboard: "dashboard",
  "case-study": "case-study",
  tiktok: "tiktok",
};

const visualColors: Record<string, string> = {
  instagram: "from-pink-500/20 to-purple-500/20",
  "ad-creative": "from-brand-primary/20 to-brand-teal/20",
  calendar: "from-amber-500/20 to-orange-500/20",
  dashboard: "from-brand-teal/20 to-green-500/20",
  "case-study": "from-brand-gold/20 to-amber-500/20",
  tiktok: "from-gray-500/20 to-brand-primary/20",
};

/* ── Inline SVG icons (tiny, no imports needed) ── */

function HeartIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function PlayIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1">
      <polygon points="8,5 20,12 8,19" />
    </svg>
  );
}

function ShareIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function BookmarkIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/* ── Mockup Components ── */

function InstagramMockup() {
  return (
    <div className="absolute inset-0 bg-white flex flex-col overflow-hidden font-sans">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 shrink-0">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex-shrink-0 ring-1 ring-pink-200" />
        <span className="text-[10px] font-semibold text-gray-800">lumia.aesthetics</span>
        <span className="ml-auto text-[10px] text-gray-400">···</span>
      </div>
      {/* Image */}
      <div className="flex-1 bg-gradient-to-br from-pink-100 via-purple-50 to-rose-100 relative overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px">
          <div className="bg-gradient-to-br from-pink-300/60 to-rose-300/60 rounded-sm m-1" />
          <div className="bg-gradient-to-br from-purple-300/60 to-pink-300/60 rounded-sm m-1" />
          <div className="bg-gradient-to-br from-rose-300/60 to-pink-200/60 rounded-sm m-1" />
          <div className="bg-gradient-to-br from-pink-200/60 to-purple-300/60 rounded-sm m-1" />
        </div>
      </div>
      {/* Action bar */}
      <div className="flex items-center gap-3 px-3 py-2 shrink-0">
        <span className="text-gray-700"><HeartIcon size={15} /></span>
        <span className="text-gray-700"><CommentIcon size={15} /></span>
        <span className="text-gray-700"><ShareIcon size={15} /></span>
        <span className="ml-auto text-gray-700"><BookmarkIcon size={15} /></span>
      </div>
      {/* Caption */}
      <div className="px-3 pb-2.5 shrink-0">
        <p className="text-[10px] text-gray-500 leading-tight">
          <span className="font-semibold text-gray-800">lumia.aesthetics</span>{" "}
          Fresh results, every time. ✨ #glowup
        </p>
        <p className="text-[9px] text-gray-400 mt-0.5">View all 14 comments</p>
      </div>
    </div>
  );
}

function MetaAdMockup() {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden font-sans" style={{ background: "#12171d" }}>
      {/* Top: page name + sponsored */}
      <div className="flex items-center gap-2 px-4 pt-3 shrink-0">
        <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: "#008fff" }} />
        <div>
          <p className="text-xs font-semibold text-white leading-tight">Ridgeway Heating</p>
          <p className="text-[10px] text-gray-400 leading-tight">Sponsored</p>
        </div>
      </div>
      {/* Ad body */}
      <div className="flex-1 flex flex-col justify-center px-4">
        <h3 className="text-white font-bold text-base leading-tight mb-2">
          Your Furnace Shouldn't<br />Surprise You This Winter.
        </h3>
        <p className="text-gray-400 text-[11px] leading-tight mb-4">
          $89 tune-up. Same-day availability. 500+ 5-star reviews.
        </p>
        <button
          className="self-start px-4 py-1.5 rounded text-xs font-semibold text-white"
          style={{ background: "#008fff" }}
        >
          Book Now
        </button>
      </div>
      {/* Bottom bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-700 shrink-0">
        <span className="flex items-center gap-1 text-gray-400 text-[10px]">
          <span style={{ color: "#008fff" }}>👍</span> 247
        </span>
        <span className="text-gray-400 text-[10px]">💬 38 comments</span>
        <span className="text-gray-400 text-[10px]">↗ 12 shares</span>
      </div>
    </div>
  );
}

function CalendarMockup() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  // Simulated dates 1–28 with colored dots on certain days
  const dates: { day: number; dots: string[] }[] = [
    { day: 1, dots: [] },
    { day: 2, dots: [] },
    { day: 3, dots: ["#00d4aa"] },
    { day: 4, dots: [] },
    { day: 5, dots: ["#008fff", "#00d4aa"] },
    { day: 6, dots: [] },
    { day: 7, dots: [] },
    { day: 8, dots: ["#008fff"] },
    { day: 9, dots: [] },
    { day: 10, dots: ["#00d4aa"] },
    { day: 11, dots: [] },
    { day: 12, dots: ["#f59e0b"] },
    { day: 13, dots: [] },
    { day: 14, dots: [] },
    { day: 15, dots: ["#008fff", "#f59e0b"] },
    { day: 16, dots: [] },
    { day: 17, dots: ["#00d4aa"] },
    { day: 18, dots: [] },
    { day: 19, dots: [] },
    { day: 20, dots: ["#008fff"] },
    { day: 21, dots: [] },
    { day: 22, dots: ["#00d4aa", "#f59e0b"] },
    { day: 23, dots: [] },
    { day: 24, dots: ["#008fff"] },
    { day: 25, dots: [] },
    { day: 26, dots: [] },
    { day: 27, dots: ["#00d4aa"] },
    { day: 28, dots: ["#008fff", "#00d4aa", "#f59e0b"] },
  ];

  return (
    <div className="absolute inset-0 bg-white flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <p className="text-xs font-bold text-gray-800">NOVEMBER 2026</p>
        <p className="text-[10px] text-gray-400">Content Calendar — 4 platforms</p>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 px-2 shrink-0">
        {days.map((d) => (
          <div key={d} className="text-center text-[9px] font-semibold text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>
      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-0.5 px-2 flex-1 content-start">
        {dates.map((d, i) => (
          <div key={i} className="flex flex-col items-center pt-0.5">
            <span className="text-[9px] text-gray-600 mb-0.5">{d.day}</span>
            <div className="flex gap-0.5">
              {d.dots.map((color, j) => (
                <span
                  key={j}
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: color }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 shrink-0">
        <span className="flex items-center gap-1 text-[8px] text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#008fff" }} /> FB
        </span>
        <span className="flex items-center gap-1 text-[8px] text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#00d4aa" }} /> IG
        </span>
        <span className="flex items-center gap-1 text-[8px] text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#f59e0b" }} /> TT
        </span>
      </div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden font-sans p-3" style={{ background: "#12171d" }}>
      {/* Header */}
      <p className="text-xs font-semibold text-gray-300 mb-3 shrink-0">📊 LIVE PERFORMANCE</p>
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2 mb-3 shrink-0">
        <div className="rounded-lg p-2" style={{ background: "rgba(0,143,255,0.1)" }}>
          <p className="text-[9px] text-gray-400">CPL</p>
          <p className="text-sm font-bold" style={{ color: "#00d4aa" }}>$28</p>
          <p className="text-[8px] text-gray-500">↓ $12 from Oct</p>
        </div>
        <div className="rounded-lg p-2" style={{ background: "rgba(0,212,170,0.1)" }}>
          <p className="text-[9px] text-gray-400">ROAS</p>
          <p className="text-sm font-bold" style={{ color: "#00d4aa" }}>3.4x</p>
          <p className="text-[8px] text-gray-500">↑ 0.8x</p>
        </div>
        <div className="rounded-lg p-2" style={{ background: "rgba(245,158,11,0.1)" }}>
          <p className="text-[9px] text-gray-400">Leads</p>
          <p className="text-sm font-bold" style={{ color: "#f59e0b" }}>147</p>
          <p className="text-[8px] text-gray-500">This month</p>
        </div>
      </div>
      {/* Mini bar chart */}
      <p className="text-[9px] text-gray-500 mb-1.5 shrink-0">Weekly Lead Volume</p>
      <div className="flex items-end gap-1.5 flex-1 min-h-0">
        {[40, 65, 52, 80, 72, 95, 62].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 justify-end h-full">
            <span className="text-[7px] text-gray-500">{h}</span>
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${h}%`,
                background: i === 5 ? "#00d4aa" : "#008fff",
                opacity: 0.7 + (i * 0.04),
              }}
            />
          </div>
        ))}
      </div>
      {/* X-axis labels */}
      <div className="flex gap-1.5 mt-1 shrink-0">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="flex-1 text-center text-[7px] text-gray-500">{d}</span>
        ))}
      </div>
    </div>
  );
}

function TikTokMockup() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden font-sans" style={{ background: "#12171d" }}>
      {/* Phone frame */}
      <div className="relative w-[45%] h-[85%] rounded-[16px] border-2 border-gray-600 overflow-hidden shadow-lg flex flex-col" style={{ background: "#000" }}>
        {/* For You label */}
        <div className="absolute top-3 left-0 right-0 flex justify-center gap-6 z-10">
          <span className="text-[9px] font-semibold text-gray-400">Following</span>
          <span className="text-[9px] font-bold text-white border-b-2 border-white pb-0.5">For You</span>
        </div>
        {/* Video area */}
        <div className="flex-1 bg-gradient-to-b from-gray-800 via-gray-700 to-gray-900 flex items-center justify-center relative">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <PlayIcon size={18} />
          </div>
        </div>
        {/* Right sidebar icons */}
        <div className="absolute right-2 bottom-16 flex flex-col items-center gap-4 z-10">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-white"><HeartIcon size={16} /></span>
            <span className="text-[9px] text-white">12.4K</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-white"><CommentIcon size={16} /></span>
            <span className="text-[9px] text-white">847</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-white"><ShareIcon size={16} /></span>
            <span className="text-[9px] text-white">2.3K</span>
          </div>
        </div>
        {/* Bottom caption */}
        <div className="absolute bottom-3 left-3 right-12 z-10">
          <p className="text-[9px] font-semibold text-white">@lumia.aesthetics</p>
          <p className="text-[9px] text-white leading-tight">The results speak for themselves ✨ #GlowUp #MedSpa</p>
          <p className="text-[8px] text-gray-400 mt-0.5">♫ original sound — lumia.aesthetics</p>
        </div>
      </div>
    </div>
  );
}

function CaseStudyMockup() {
  return (
    <div className="absolute inset-0 bg-white flex overflow-hidden font-sans">
      {/* Left: stat column */}
      <div className="w-[42%] flex flex-col justify-center items-center p-3" style={{ background: "#12171d" }}>
        <div className="text-center mb-3">
          <p className="text-[28px] font-black leading-none" style={{ color: "#00d4aa" }}>80%</p>
          <p className="text-[8px] text-gray-400 mt-0.5">Listing Win Rate</p>
        </div>
        <div className="text-center mb-3">
          <p className="text-[28px] font-black leading-none" style={{ color: "#008fff" }}>+175%</p>
          <p className="text-[8px] text-gray-400 mt-0.5">Seller Leads</p>
        </div>
        <div className="text-center">
          <p className="text-[28px] font-black leading-none" style={{ color: "#f59e0b" }}>2x</p>
          <p className="text-[8px] text-gray-400 mt-0.5">Buyer Leads</p>
        </div>
      </div>
      {/* Right: case details */}
      <div className="flex-1 p-3 flex flex-col justify-center">
        <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Case Study</p>
        <p className="text-xs font-bold text-gray-800 mb-2">The Keller Group</p>
        <p className="text-[9px] text-gray-500 leading-relaxed mb-2">Denver, CO · Real Estate</p>
        <ul className="space-y-1">
          <li className="flex items-start gap-1.5">
            <span className="text-[9px] mt-0.5" style={{ color: "#00d4aa" }}>●</span>
            <span className="text-[9px] text-gray-600">Multi-platform brand build</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-[9px] mt-0.5" style={{ color: "#00d4aa" }}>●</span>
            <span className="text-[9px] text-gray-600">Listing marketing + social</span>
          </li>
          <li className="flex items-start gap-1.5">
            <span className="text-[9px] mt-0.5" style={{ color: "#00d4aa" }}>●</span>
            <span className="text-[9px] text-gray-600">60% → 80% win rate in 4 months</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ── Map visual → mockup ── */

function renderMockup(visual: string) {
  switch (visual) {
    case "instagram":
      return <InstagramMockup />;
    case "ad-creative":
      return <MetaAdMockup />;
    case "calendar":
      return <CalendarMockup />;
    case "dashboard":
      return <DashboardMockup />;
    case "tiktok":
      return <TikTokMockup />;
    case "case-study":
      return <CaseStudyMockup />;
    default:
      return <InstagramMockup />;
  }
}

/* ── Main Component ── */

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
                  {/* Mockup visual — rendered based on item.visual */}
                  {renderMockup(item.visual)}

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
