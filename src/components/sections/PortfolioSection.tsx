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

/* ── Inline SVG icons ── */

function HeartIcon({ size = 14, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
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

function VerifiedBadge({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#3897F0">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function MusicNoteIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

function MoreIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function SendIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function ThumbsUpIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

function ChevronRight({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function BarChart3Icon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function TrendingUpIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function TrendingDownIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

function ZapIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

/* ── Mockup Components ── */

function InstagramMockup() {
  return (
    <div className="absolute inset-0 bg-white flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0">
        <div className="relative flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 via-purple-400 to-rose-400 p-[1.5px]">
            <div className="w-full h-full rounded-full bg-white" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-gray-900">lumia.aesthetics</span>
          <VerifiedBadge size={10} />
        </div>
        <span className="ml-auto text-gray-600"><MoreIcon size={13} /></span>
      </div>

      {/* Image area — luxury med spa visual */}
      <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-[#fdf2f7] via-[#faf5ff] to-[#fff5f5]">
        {/* Soft glowing orbs suggesting luxury treatment */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] aspect-square rounded-full bg-gradient-radial from-rose-200/70 via-pink-100/30 to-transparent blur-2xl" />
        <div className="absolute top-[30%] right-[25%] w-[25%] aspect-square rounded-full bg-gradient-radial from-purple-200/50 to-transparent blur-xl" />
        <div className="absolute bottom-[25%] left-[20%] w-[30%] aspect-square rounded-full bg-gradient-radial from-amber-100/40 to-transparent blur-xl" />

        {/* Abstract treatment-inspired curves */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="ig-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f9a8d4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="ig-grad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#e9d5ff" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#fce7f3" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <ellipse cx="200" cy="180" rx="140" ry="110" fill="url(#ig-grad1)" />
          <path d="M80 300 Q200 200 320 280" stroke="url(#ig-grad2)" strokeWidth="40" fill="none" opacity="0.4" />
          <path d="M60 200 Q180 120 340 220" stroke="#fbcfe8" strokeWidth="2" fill="none" opacity="0.3" strokeDasharray="4 6" />
          <circle cx="170" cy="160" r="3" fill="#c084fc" opacity="0.5" />
          <circle cx="240" cy="200" r="2" fill="#f9a8d4" opacity="0.4" />
          <circle cx="150" cy="240" r="2.5" fill="#e9d5ff" opacity="0.5" />
        </svg>

        {/* Subtle branded text overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-4">
            <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-purple-400/70 mb-1.5">Lumina Aesthetics</p>
            <p className="text-[13px] font-light italic text-gray-500/70">Where results glow</p>
          </div>
        </div>

        {/* Carousel dots */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0095f6]" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3.5 px-3 py-2.5 shrink-0">
        <span className="text-gray-900 hover:text-gray-500 transition-colors"><HeartIcon size={16} /></span>
        <span className="text-gray-900 hover:text-gray-500 transition-colors"><CommentIcon size={16} /></span>
        <span className="text-gray-900 hover:text-gray-500 transition-colors"><SendIcon size={15} /></span>
        <span className="ml-auto text-gray-900"><BookmarkIcon size={16} /></span>
      </div>

      {/* Likes */}
      <div className="px-3 shrink-0">
        <p className="text-[11px] font-semibold text-gray-900">2,847 likes</p>
      </div>

      {/* Caption */}
      <div className="px-3 pb-3 shrink-0">
        <p className="text-[10px] text-gray-800 leading-snug">
          <span className="font-semibold text-gray-900">lumia.aesthetics</span>{" "}
          Fresh results, every time. Your glow starts here. ✨
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
          #GlowUp #MedSpaResults #AestheticClinic #LuminaGlow #SelfCareRoutine
        </p>
        <p className="text-[9px] text-gray-400 mt-1">View all 14 comments</p>
        <p className="text-[8px] text-gray-300 mt-0.5">2 HOURS AGO</p>
      </div>
    </div>
  );
}

function MetaAdMockup() {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden font-sans" style={{ background: "#0f1724" }}>
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }} />

      {/* Top: page + sponsored */}
      <div className="relative flex items-center gap-2.5 px-4 pt-3.5 pb-2 shrink-0">
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1a3a5c, #0d2847)" }}>
          <span className="text-white text-[15px] font-bold">R</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[12px] font-semibold text-white leading-tight">Ridgeway Heating</p>
          </div>
          <div className="flex items-center gap-1">
            <p className="text-[9px] text-gray-500 leading-tight">Sponsored</p>
            <span className="text-[6px] text-gray-600">·</span>
            <span className="text-[9px] text-gray-500 flex items-center gap-0.5">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Paid for by
            </span>
          </div>
        </div>
        <span className="text-gray-600 self-start mt-0.5"><MoreIcon size={13} /></span>
      </div>

      {/* Ad creative area — subtle winter/heating visual */}
      <div className="relative flex-1 mx-3 rounded-lg overflow-hidden" style={{
        background: "linear-gradient(160deg, #162032 0%, #1a2d44 30%, #0f1d2e 100%)",
      }}>
        {/* Subtle geometric heat/warmth pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="ad-bg" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#008fff" />
              <stop offset="100%" stopColor="#00d4aa" />
            </linearGradient>
          </defs>
          <path d="M0 180 Q100 100 200 160 Q300 60 400 140" stroke="url(#ad-bg)" strokeWidth="1" fill="none" />
          <path d="M0 160 Q120 80 220 140 Q340 40 400 120" stroke="url(#ad-bg)" strokeWidth="0.5" fill="none" opacity="0.5" />
          {/* Warmth radiating lines */}
          {[20, 40, 60, 80, 100, 120, 140, 160].map((y, i) => (
            <line key={i} x1="0" y1={y} x2="400" y2={y} stroke="#008fff" strokeWidth="0.3" opacity={0.03 + i * 0.004} />
          ))}
        </svg>

        {/* Frosted overlay card */}
        <div className="absolute inset-4 rounded-xl flex flex-col justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(15,23,36,0.85), rgba(15,23,36,0.7))",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(0,143,255,0.12)",
          }}>
          <div className="px-4 py-3">
            {/* Small icon + label */}
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #008fff, #0066cc)" }}>
                <span className="text-white text-[9px]">🔥</span>
              </div>
              <span className="text-[9px] font-medium text-blue-300 uppercase tracking-wider">Winter Ready</span>
            </div>
            {/* Headline */}
            <h3 className="text-white font-bold text-[15px] leading-tight mb-2">
              Your Furnace Shouldn't<br />Surprise You This Winter.
            </h3>
            <p className="text-gray-300 text-[10px] leading-relaxed mb-4 max-w-[90%]">
              $89 tune-up. Same-day availability. Over 500 five-star reviews from your neighbors.
            </p>
            {/* Stars row */}
            <div className="flex items-center gap-0.5 mb-3">
              {[1,2,3,4,5].map(s => (
                <svg key={s} width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              ))}
              <span className="text-[9px] text-gray-400 ml-1">500+ reviews</span>
            </div>
            {/* CTA */}
            <button
              className="px-5 py-2 rounded-md text-[11px] font-semibold text-white transition-all"
              style={{
                background: "linear-gradient(135deg, #008fff, #0066cc)",
                boxShadow: "0 2px 12px rgba(0,143,255,0.25)",
              }}
            >
              Book Your Tune-Up →
            </button>
          </div>
        </div>
      </div>

      {/* Engagement bar */}
      <div className="relative flex items-center gap-4 px-4 py-2.5 shrink-0 border-t border-gray-800/60">
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1">
            <span className="w-4 h-4 rounded-full bg-[#008fff] text-[6px] flex items-center justify-center text-white font-bold ring-1 ring-[#0f1724]">👍</span>
            <span className="w-4 h-4 rounded-full bg-[#00d4aa] text-[6px] flex items-center justify-center text-white font-bold ring-1 ring-[#0f1724]">❤️</span>
          </div>
          <span className="text-[9px] text-gray-400">247</span>
        </div>
        <span className="text-[9px] text-gray-500">38 comments</span>
        <span className="text-[9px] text-gray-500">12 shares</span>
        <span className="ml-auto text-[9px] text-gray-600 flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </span>
      </div>
    </div>
  );
}

function CalendarMockup() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dates = [
    { day: 1, events: [] },
    { day: 2, events: [] },
    { day: 3, events: [{ label: "IG Carousel", color: "#00d4aa" }] },
    { day: 4, events: [] },
    { day: 5, events: [{ label: "FB Ad", color: "#008fff" }, { label: "IG Story", color: "#00d4aa" }] },
    { day: 6, events: [] },
    { day: 7, events: [] },
    { day: 8, events: [{ label: "Reel", color: "#008fff" }] },
    { day: 9, events: [] },
    { day: 10, events: [{ label: "Carousel", color: "#00d4aa" }] },
    { day: 11, events: [] },
    { day: 12, events: [{ label: "TikTok", color: "#f59e0b" }] },
    { day: 13, events: [] },
    { day: 14, events: [] },
    { day: 15, events: [{ label: "FB Post", color: "#008fff" }, { label: "TT Duet", color: "#f59e0b" }] },
    { day: 16, events: [] },
    { day: 17, events: [{ label: "Reel", color: "#00d4aa" }] },
    { day: 18, events: [] },
    { day: 19, events: [] },
    { day: 20, events: [{ label: "Ad Creative", color: "#008fff" }] },
    { day: 21, events: [] },
    { day: 22, events: [{ label: "Story", color: "#00d4aa" }, { label: "TT Post", color: "#f59e0b" }] },
    { day: 23, events: [] },
    { day: 24, events: [{ label: "FB Ad", color: "#008fff" }] },
    { day: 25, events: [] },
    { day: 26, events: [] },
    { day: 27, events: [{ label: "Carousel", color: "#00d4aa" }] },
    { day: 28, events: [{ label: "Reel", color: "#008fff" }, { label: "IG Story", color: "#00d4aa" }, { label: "TT", color: "#f59e0b" }] },
  ];

  // Placeholder empty cells at start (Nov 2026: starts on Sunday)
  const novStartsOnSunday = true;
  const leadingBlanks = novStartsOnSunday ? 0 : 0; // Simplified: grid starts at 1

  return (
    <div className="absolute inset-0 bg-white flex flex-col overflow-hidden font-sans">
      {/* Subtle top gradient accent */}
      <div className="h-[3px] shrink-0" style={{ background: "linear-gradient(90deg, #008fff, #00d4aa, #f59e0b)" }} />

      {/* Header */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-900">November 2026</p>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold text-[#00d4aa] bg-[#00d4aa]/10">30 posts</span>
          </div>
          <div className="flex gap-1">
            <span className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </span>
            <span className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </span>
          </div>
        </div>
        <p className="text-[10px] text-gray-400">Content Calendar — 4 platforms active</p>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-3 shrink-0 border-b border-gray-100 pb-2">
        {days.map((d) => (
          <div key={d} className="text-center text-[9px] font-semibold text-gray-400 uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-1 px-2 pt-1.5 flex-1 content-start">
        {dates.map((d, i) => (
          <div key={i} className={`flex flex-col items-center py-1 rounded-lg mx-0.5 ${
            d.day === 22 ? "ring-2 ring-[#008fff] ring-offset-1 bg-[#008fff]/5" : ""
          }`}>
            <span className={`text-[10px] font-medium mb-1 ${
              d.day === 22 ? "text-[#008fff] font-bold" : "text-gray-700"
            }`}>
              {d.day}
            </span>
            <div className="flex flex-col gap-0.5 w-full px-0.5">
              {d.events.map((ev, j) => (
                <span
                  key={j}
                  className="text-[7px] font-medium truncate px-1 py-[1px] rounded-sm"
                  style={{
                    background: `${ev.color}18`,
                    color: ev.color,
                    borderLeft: `2px solid ${ev.color}`,
                  }}
                >
                  {ev.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 shrink-0 bg-gray-50/50">
        <span className="flex items-center gap-1.5 text-[8px] text-gray-500 font-medium">
          <span className="w-2 h-2 rounded-sm" style={{ background: "#008fff" }} />
          Facebook
        </span>
        <span className="flex items-center gap-1.5 text-[8px] text-gray-500 font-medium">
          <span className="w-2 h-2 rounded-sm" style={{ background: "#00d4aa" }} />
          Instagram
        </span>
        <span className="flex items-center gap-1.5 text-[8px] text-gray-500 font-medium">
          <span className="w-2 h-2 rounded-sm" style={{ background: "#f59e0b" }} />
          TikTok
        </span>
        <span className="ml-auto text-[8px] text-gray-400 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-[#00d4aa]" /> 100% on schedule
        </span>
      </div>
    </div>
  );
}

function DashboardMockup() {
  const bars = [
    { label: "M", value: 40 },
    { label: "T", value: 65 },
    { label: "W", value: 52 },
    { label: "T", value: 80 },
    { label: "F", value: 72 },
    { label: "S", value: 95 },
    { label: "S", value: 62 },
  ];

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden font-sans p-4" style={{ background: "#0d1219" }}>
      {/* Subtle dot grid bg */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
        backgroundSize: "16px 16px",
      }} />

      {/* Header row */}
      <div className="relative flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #008fff, #00d4aa)" }}>
            <BarChart3Icon size={12} />
          </div>
          <p className="text-[11px] font-semibold text-gray-200 uppercase tracking-wider">Live Performance</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d4aa] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00d4aa]" />
          </span>
          <span className="text-[9px] font-medium text-[#00d4aa] uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* KPI row — glass cards */}
      <div className="relative grid grid-cols-3 gap-2.5 mb-4 shrink-0">
        {/* CPL Card */}
        <div className="rounded-xl p-2.5 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(0,143,255,0.08), rgba(0,143,255,0.02))",
            border: "1px solid rgba(0,143,255,0.15)",
          }}>
          <div className="absolute top-0 right-0 w-12 h-12 rounded-bl-2xl opacity-[0.06]"
            style={{ background: "linear-gradient(135deg, transparent, #008fff)" }} />
          <p className="text-[8px] font-medium text-gray-500 uppercase tracking-wider mb-1">Cost per Lead</p>
          <p className="text-lg font-bold text-[#00d4aa] leading-none mb-0.5">$28</p>
          <div className="flex items-center gap-1">
            <span className="text-[#00d4aa]"><TrendingDownIcon size={10} /></span>
            <span className="text-[8px] font-medium text-[#00d4aa]">↓ $12</span>
            <span className="text-[7px] text-gray-500 ml-0.5">vs Oct</span>
          </div>
        </div>

        {/* ROAS Card */}
        <div className="rounded-xl p-2.5 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(0,212,170,0.08), rgba(0,212,170,0.02))",
            border: "1px solid rgba(0,212,170,0.15)",
          }}>
          <div className="absolute top-0 right-0 w-12 h-12 rounded-bl-2xl opacity-[0.06]"
            style={{ background: "linear-gradient(135deg, transparent, #00d4aa)" }} />
          <p className="text-[8px] font-medium text-gray-500 uppercase tracking-wider mb-1">ROAS</p>
          <p className="text-lg font-bold text-[#00d4aa] leading-none mb-0.5">3.4<span className="text-xs font-normal">x</span></p>
          <div className="flex items-center gap-1">
            <span className="text-[#00d4aa]"><TrendingUpIcon size={10} /></span>
            <span className="text-[8px] font-medium text-[#00d4aa]">↑ 0.8x</span>
            <span className="text-[7px] text-gray-500 ml-0.5">vs Oct</span>
          </div>
        </div>

        {/* Leads Card */}
        <div className="rounded-xl p-2.5 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))",
            border: "1px solid rgba(245,158,11,0.15)",
          }}>
          <div className="absolute top-0 right-0 w-12 h-12 rounded-bl-2xl opacity-[0.06]"
            style={{ background: "linear-gradient(135deg, transparent, #f59e0b)" }} />
          <p className="text-[8px] font-medium text-gray-500 uppercase tracking-wider mb-1">Total Leads</p>
          <p className="text-lg font-bold text-[#f59e0b] leading-none mb-0.5">147</p>
          <div className="flex items-center gap-1">
            <span className="text-[#f59e0b]"><ZapIcon size={10} /></span>
            <span className="text-[8px] font-medium text-[#f59e0b]">This month</span>
          </div>
        </div>
      </div>

      {/* Chart section header */}
      <div className="relative flex items-center gap-2 mb-2.5 shrink-0">
        <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">Weekly Lead Volume</p>
        <span className="text-[8px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">This Week</span>
      </div>

      {/* Bar chart */}
      <div className="relative flex items-end gap-1.5 flex-1 min-h-0 px-1">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2, 3, 4].map((_, i) => (
            <div key={i} className="w-full border-t border-gray-800/40" style={{ height: "1px" }} />
          ))}
        </div>

        {bars.map((b, i) => {
          const isToday = i === 5;
          const gradientId = `bar-grad-${i}`;
          return (
            <div key={i} className="relative flex-1 flex flex-col items-center gap-1 justify-end h-full">
              {/* Value label */}
              <span className={`text-[8px] font-semibold ${isToday ? "text-[#00d4aa]" : "text-gray-500"}`}>
                {b.value}
              </span>
              {/* Bar */}
              <svg className="w-full" style={{ height: `${b.value}%`, minHeight: "4px" }} viewBox="0 0 40 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={isToday ? "#00d4aa" : "#008fff"} stopOpacity="0.95" />
                    <stop offset="100%" stopColor={isToday ? "#00d4aa" : "#008fff"} stopOpacity="0.3" />
                  </linearGradient>
                </defs>
                <rect
                  x="2" y="0" width="36" height="100" rx="4"
                  fill={`url(#${gradientId})`}
                />
                {/* Top highlight */}
                <rect x="2" y="0" width="36" height="3" rx="1.5" fill="white" opacity="0.15" />
              </svg>
              {/* Day label */}
              <span className={`text-[8px] font-medium ${isToday ? "text-white" : "text-gray-500"}`}>
                {b.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom summary */}
      <div className="relative flex items-center gap-3 mt-3 pt-2.5 border-t border-gray-800/50 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-400">Avg</span>
          <span className="text-[11px] font-bold text-white">66.6</span>
          <span className="text-[8px] text-[#00d4aa] flex items-center gap-0.5"><TrendingUpIcon size={9} />+12%</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[9px] text-gray-400">Peak</span>
          <span className="text-[11px] font-bold text-[#00d4aa]">95</span>
          <span className="text-[9px] text-gray-500">Sat</span>
        </div>
      </div>
    </div>
  );
}

function TikTokMockup() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden font-sans"
      style={{ background: "linear-gradient(180deg, #0d1219 0%, #121720 50%, #0d1219 100%)" }}>
      {/* Ambient glow behind phone */}
      <div className="absolute w-32 h-32 rounded-full bg-[#008fff]/10 blur-3xl" />

      {/* Phone frame */}
      <div className="relative w-[44%] h-[88%] rounded-[18px] overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: "#000",
          border: "2px solid #1e2530",
          boxShadow: "0 0 0 3px #0d1219, 0 0 0 5px #1e2530, 0 20px 60px rgba(0,0,0,0.5)",
        }}>
        {/* Notch */}
        <div className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-20 h-4 bg-black rounded-b-xl" />
        </div>

        {/* Status bar */}
        <div className="relative flex items-center justify-between px-5 pt-2 pb-1 z-20 shrink-0">
          <span className="text-[8px] font-semibold text-white">9:41</span>
          <div className="flex items-center gap-1">
            <span className="text-[6px] text-white">●●●●○</span>
            <span className="text-[7px] text-white font-medium">5G</span>
          </div>
        </div>

        {/* For You / Following tabs */}
        <div className="relative flex justify-center gap-8 z-20 shrink-0 pt-1 pb-2">
          <span className="text-[11px] font-medium text-gray-400">Following</span>
          <span className="text-[11px] font-bold text-white relative">
            For You
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-[2px] bg-white rounded-full" />
          </span>
        </div>

        {/* Video area */}
        <div className="flex-1 relative overflow-hidden mx-[2px]">
          {/* Dynamic gradient background */}
          <div className="absolute inset-0"
            style={{
              background: "linear-gradient(160deg, #1a1040 0%, #0f2040 30%, #102040 60%, #0a1030 100%)",
            }}>
            {/* Animated abstract shapes suggesting video content */}
            <div className="absolute top-[20%] left-[10%] w-[60%] aspect-square rounded-full bg-gradient-radial from-purple-500/15 to-transparent blur-2xl" />
            <div className="absolute top-[40%] right-[5%] w-[45%] aspect-square rounded-full bg-gradient-radial from-[#008fff]/12 to-transparent blur-2xl" />
            <div className="absolute bottom-[15%] left-[20%] w-[35%] aspect-square rounded-full bg-gradient-radial from-[#00d4aa]/10 to-transparent blur-xl" />

            {/* Visual content suggestion — abstract curves */}
            <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 300 500" preserveAspectRatio="xMidYMid slice">
              <defs>
                <linearGradient id="tt-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#008fff" />
                </linearGradient>
              </defs>
              <path d="M30 300 Q100 150 180 250 Q250 100 280 200" stroke="url(#tt-grad1)" strokeWidth="2" fill="none" opacity="0.6" />
              <path d="M20 350 Q120 200 200 300 Q250 180 290 250" stroke="url(#tt-grad1)" strokeWidth="1.5" fill="none" opacity="0.3" />
              <circle cx="150" cy="250" r="80" stroke="white" strokeWidth="0.5" fill="none" opacity="0.15" />
              <circle cx="150" cy="250" r="50" stroke="white" strokeWidth="0.5" fill="none" opacity="0.1" />
            </svg>
          </div>

          {/* Center play hint */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(4px)",
                border: "1.5px solid rgba(255,255,255,0.2)",
              }}>
              <PlayIcon size={20} />
            </div>
          </div>
        </div>

        {/* Right sidebar icons */}
        <div className="absolute right-2.5 bottom-20 flex flex-col items-center gap-5 z-20">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-white"><HeartIcon size={18} /></span>
            </div>
            <span className="text-[9px] font-medium text-white">12.4K</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-white"><CommentIcon size={18} /></span>
            </div>
            <span className="text-[9px] font-medium text-white">847</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-white"><ShareIcon size={18} /></span>
            </div>
            <span className="text-[9px] font-medium text-white">2.3K</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <BookmarkIcon size={18} />
            </div>
            <span className="text-[9px] font-medium text-white">Save</span>
          </div>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-3 left-3 right-14 z-20">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-bold text-white">@lumia.aesthetics</span>
            <span className="px-1.5 py-0.5 bg-[#008fff] text-[7px] font-bold text-white rounded">Follow</span>
          </div>
          <p className="text-[9px] text-white/90 leading-snug mb-1 pr-1">
            The results speak for themselves ✨ Your glow-up journey starts here. #GlowUp #MedSpa #Results
          </p>
          <div className="flex items-center gap-1">
            <MusicNoteIcon size={9} />
            <span className="text-[8px] text-gray-400 truncate">original sound — lumia.aesthetics</span>
          </div>
        </div>

        {/* Bottom nav bar */}
        <div className="relative flex items-center justify-around py-2.5 border-t border-gray-800/50 shrink-0 z-20 bg-black">
          <span className="text-white"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></span>
          <span className="text-gray-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
          <div className="w-10 h-6 rounded-md flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #00f2fe, #4facfe)" }}>
            <span className="text-white text-[18px] leading-none font-bold">+</span>
          </div>
          <span className="text-gray-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg></span>
          <span className="text-gray-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
        </div>
      </div>
    </div>
  );
}

function CaseStudyMockup() {
  return (
    <div className="absolute inset-0 bg-white flex overflow-hidden font-sans">
      {/* Left: monumental stats panel */}
      <div className="w-[44%] flex flex-col justify-center items-center relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0d1219 0%, #12171d 40%, #0d1219 100%)" }}>
        {/* Subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }} />

        {/* Accent line left edge */}
        <div className="absolute left-0 top-[15%] bottom-[15%] w-[2px] rounded-full"
          style={{ background: "linear-gradient(180deg, transparent, #008fff, #00d4aa, transparent)" }} />

        <div className="relative space-y-6 z-10 px-3">
          {/* Stat 1 */}
          <div className="text-center">
            <p className="text-[32px] font-black leading-none tracking-tight"
              style={{
                background: "linear-gradient(135deg, #00d4aa, #4ade80)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
              80%
            </p>
            <p className="text-[8px] font-medium text-gray-400 uppercase tracking-[0.12em] mt-1">Listing Win Rate</p>
            <div className="mt-1.5 h-[2px] w-8 mx-auto rounded-full" style={{ background: "linear-gradient(90deg, #00d4aa, transparent)" }} />
          </div>

          {/* Stat 2 */}
          <div className="text-center">
            <p className="text-[32px] font-black leading-none tracking-tight"
              style={{
                background: "linear-gradient(135deg, #33a8ff, #008fff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
              +175%
            </p>
            <p className="text-[8px] font-medium text-gray-400 uppercase tracking-[0.12em] mt-1">Seller Leads</p>
            <div className="mt-1.5 h-[2px] w-8 mx-auto rounded-full" style={{ background: "linear-gradient(90deg, #008fff, transparent)" }} />
          </div>

          {/* Stat 3 */}
          <div className="text-center">
            <p className="text-[32px] font-black leading-none tracking-tight"
              style={{
                background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
              2<span className="text-[20px]">×</span>
            </p>
            <p className="text-[8px] font-medium text-gray-400 uppercase tracking-[0.12em] mt-1">Buyer Leads</p>
            <div className="mt-1.5 h-[2px] w-8 mx-auto rounded-full" style={{ background: "linear-gradient(90deg, #f59e0b, transparent)" }} />
          </div>
        </div>
      </div>

      {/* Right: editorial case details */}
      <div className="flex-1 flex flex-col justify-center p-5 bg-gray-50/80">
        <div className="mb-4">
          <span className="inline-block text-[8px] font-bold text-[#008fff] uppercase tracking-[0.2em] bg-[#008fff]/8 px-2 py-1 rounded">
            Case Study
          </span>
        </div>

        <h4 className="text-sm font-bold text-gray-900 mb-1">The Keller Group</h4>
        <p className="text-[10px] text-gray-400 mb-4">Denver, CO · Real Estate Team</p>

        {/* Divider */}
        <div className="h-px w-12 bg-gray-200 mb-4" />

        <div className="space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0"
              style={{ background: "rgba(0,212,170,0.12)" }}>
              <span className="text-[7px] text-[#00d4aa] font-bold">1</span>
            </div>
            <div>
              <p className="text-[9px] font-semibold text-gray-800">Multi-Platform Brand Build</p>
              <p className="text-[8px] text-gray-400">Instagram, Facebook, LinkedIn — unified presence</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0"
              style={{ background: "rgba(0,143,255,0.12)" }}>
              <span className="text-[7px] text-[#008fff] font-bold">2</span>
            </div>
            <div>
              <p className="text-[9px] font-semibold text-gray-800">Listing Marketing + Social</p>
              <p className="text-[8px] text-gray-400">Every listing gets content. Sellers notice.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0"
              style={{ background: "rgba(245,158,11,0.12)" }}>
              <span className="text-[7px] text-[#f59e0b] font-bold">3</span>
            </div>
            <div>
              <p className="text-[9px] font-semibold text-gray-800">60% → 80% Win Rate</p>
              <p className="text-[8px] text-gray-400">Achieved in 4 months. Sustained since.</p>
            </div>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="mt-5 flex items-center gap-2">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-[8px] font-semibold text-[#00d4aa] uppercase tracking-wider">Verified Results</span>
        </div>
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
    <section id="portfolio" ref={ref} className="py-32 lg:py-40 bg-bg-surface relative overflow-hidden">
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
