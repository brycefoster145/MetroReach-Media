import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getAuditResult } from "~/lib/lead-store";
import {
  ArrowRight,
  CheckCircle,
  WarningCircle,
  Lightning,
  Medal,
  Target,
  ShoppingCart,
  ChartBar,
  Globe,
  Users,
  Star,
  MagnifyingGlass,
  Spinner,
  Buildings,
  Clock,
  CurrencyDollar,
  ChatCircleText,
  Article,
  MapPin,
  ThumbsUp,
  SealCheck,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import type { AuditResult } from "~/lib/audit-analyzer";

// ---------------------------------------------------------------------------
// Server function to load stored audit
// ---------------------------------------------------------------------------

const loadAudit = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const safeId = id.replace(/[^a-zA-Z0-9\-]/g, "");
    try {
      const raw = await readFile(
        join("/home/team/shared/data/audits", `${safeId}.json`),
        "utf-8"
      );
      return JSON.parse(raw) as AuditResult;
    } catch {
      return null;
    }
  });

// Fallback: load audit from the lead store (works across Vercel serverless instances
// where the filesystem-based loadAudit can't find files written in a different invocation).
const loadAuditFromStore = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const safeId = id.replace(/[^a-zA-Z0-9\-]/g, "");
    try {
      const raw = await getAuditResult(safeId);
      if (!raw) return null;
      return raw as unknown as AuditResult;
    } catch {
      return null;
    }
  });

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/free-audit/report")({
  component: FreeAuditReportPage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ScoreBadge({ score }: { score: number }) {
  let color: string;
  let label: string;
  if (score >= 70) {
    color = "text-success";
    label = "Strong";
  } else if (score >= 40) {
    color = "text-warning";
    label = "Needs Work";
  } else {
    color = "text-error";
    label = "Critical";
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${color}`}>
      <span
        className={`w-2 h-2 rounded-full ${
          score >= 70 ? "bg-success" : score >= 40 ? "bg-warning" : "bg-error"
        }`}
      />
      {label}
    </span>
  );
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = max > 0 ? score / max : 0;
  const barColor =
    pct >= 0.7 ? "bg-success" : pct >= 0.4 ? "bg-warning" : "bg-error";
  const textColor =
    pct >= 0.7 ? "text-success" : pct >= 0.4 ? "text-warning" : "text-error";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 rounded-full bg-bg-surface-high overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.max(pct * 100, 2)}%` }}
        />
      </div>
      <span className={`text-sm font-bold font-heading tabular-nums min-w-[2rem] text-right ${textColor}`}>
        {score}
      </span>
    </div>
  );
}

function GaugeRing({ score }: { score: number }) {
  const pct = score / 100;
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference * (1 - pct);
  const color =
    pct >= 0.7 ? "#06D6A0" : pct >= 0.4 ? "#F59E0B" : "#EF4444";

  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60" cy="60" r="54"
          fill="none"
          stroke="#1B2433"
          strokeWidth="8"
        />
        <circle
          cx="60" cy="60" r="54"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-3xl font-bold font-heading tabular-nums"
          style={{ color }}
        >
          {score}
        </span>
        <span className="text-xs text-text-muted">out of 100</span>
      </div>
    </div>
  );
}

const categoryIcons: Record<string, React.ComponentType<{ size?: number; weight?: "fill"; className?: string }>> = {
  overallMarketing: ChartBar,
  socialPresence: Users,
  branding: Star,
  contentQuality: Article,
  postingConsistency: Clock,
  engagement: ChatCircleText,
  profileOptimization: SealCheck,
  website: Globe,
  localVisibility: MapPin,
  reputation: ThumbsUp,
};

function ConfidenceBadge({ confidence }: { confidence: "high" | "moderate" | "limited" }) {
  const config = {
    high: { color: "bg-success/15 text-success border-success/30", label: "High Confidence", icon: CheckCircle },
    moderate: { color: "bg-warning/15 text-warning border-warning/30", label: "Moderate Confidence", icon: WarningCircle },
    limited: { color: "bg-text-muted/15 text-text-muted border-text-muted/30", label: "Limited Data", icon: WarningCircle },
  };
  const c = config[confidence];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${c.color}`}>
      <Icon size={14} weight="fill" />
      {c.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function FreeAuditReportPage() {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    // ── Priority 1: sessionStorage (works across Vercel serverless instances) ──
    try {
      const cached = sessionStorage.getItem("audit-result");
      if (cached) {
        const parsed = JSON.parse(cached) as AuditResult;
        // Verify the ID matches (defense against stale cache)
        if (!id || parsed.id === id) {
          // Keep the cached data in sessionStorage so page refreshes still work.
          // Only clear if the ID doesn't match (stale data from a different audit).
          setAudit(parsed);
          setLoading(false);
          return;
        }
        // ID mismatch — clear stale cache and fall through
        sessionStorage.removeItem("audit-result");
      }
    } catch {
      // sessionStorage unavailable (SSR, etc.) — fall through
    }

    // ── Priority 2: server-side file loader (works on localhost, fails on Vercel) ──
    if (!id) {
      setError("No report ID provided.");
      setLoading(false);
      return;
    }

    const tryLoad = async () => {
      // Try filesystem first (works locally)
      let data: AuditResult | null = null;
      try {
        data = await loadAudit({ data: id });
      } catch {
        // Fall through to lead store
      }

      // ── Priority 3: lead store fallback (works across Vercel instances) ──
      if (!data) {
        try {
          data = await loadAuditFromStore({ data: id });
        } catch {
          // Both methods failed
        }
      }

      if (!data) {
        setError("Report not found. It may have expired or the link is incorrect.");
      } else {
        setAudit(data);
      }
      setLoading(false);
    };

    tryLoad();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center bg-bg-root">
        <Spinner size={32} weight="bold" className="animate-spin text-brand-primary" />
        <p className="text-text-secondary">Loading your audit report...</p>
      </div>
    );
  }

  // Error state
  if (error || !audit) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6 text-center bg-bg-root">
        <h1 className="text-4xl md:text-5xl font-bold font-heading text-text-primary">
          Report Not Found
        </h1>
        <p className="text-lg text-text-secondary max-w-md">
          {error || "This report doesn't exist or has expired."}
        </p>
        <a
          href="/free-audit"
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary text-text-primary px-8 py-3.5 text-base font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent transition-all duration-200"
        >
          Run a new audit →
        </a>
      </div>
    );
  }

  const {
    formData,
    website,
    scores,
    strengths,
    weaknesses,
    quickWins,
    serviceRecommendations,
    recommendationConfidence,
    confidenceExplanation,
    competitorSnapshot,
    executiveSummary,
    timestamp,
  } = audit;

  const auditDate = new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const overall = scores.overall;
  const overallColor =
    overall >= 70 ? "text-success" : overall >= 40 ? "text-warning" : "text-error";

  // Find top recommendation
  const primaryRec = serviceRecommendations[0];

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 0.75in; size: letter; }
          body { 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          header, nav, footer, .no-print, button, a[href="/services"], a[href="/contact"] {
            display: none !important;
          }
          /* Hide CTA section */
          section.bg-bg-surface:last-of-type,
          section:has(.no-print) {
            display: none !important;
          }
          /* Ensure report content is visible */
          main { padding: 0 !important; }
          section { break-inside: avoid; page-break-inside: avoid; }
          h1, h2, h3 { break-after: avoid; page-break-after: avoid; }
          .rounded-2xl, .rounded-xl, .rounded-full { 
            border-radius: 8px !important; 
          }
          /* Show print-only elements */
          .print-only { display: block !important; }
          /* Ensure text is readable on white paper */
          .text-text-primary { color: #111827 !important; }
          .text-text-secondary { color: #374151 !important; }
          .text-text-muted { color: #6b7280 !important; }
          .bg-bg-root, .bg-bg-surface, .bg-bg-surface-raised, .bg-bg-surface-high {
            background: #ffffff !important;
            border-color: #e5e7eb !important;
          }
          /* Ensure gauge and score bars render */
          svg { max-width: 100%; }
        }
      `}</style>
      <main>
      {/* ── Header ── */}
      <section className="relative py-16 lg:py-24 bg-bg-root overflow-hidden border-b border-border-subtle">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_500px_at_50%_50%,rgba(59,130,246,0.04),transparent)] pointer-events-none" />
        <Container className="relative z-10">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-medium text-text-muted uppercase tracking-widest mb-4">
              Social Media Audit &bull; {auditDate}
            </p>
            <p className="text-sm text-text-secondary mb-2">
              Prepared by Metro Reach Media for
            </p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading text-text-primary tracking-tight mb-8">
              {formData.businessName}
            </h1>

            {/* Overall Score Card */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 rounded-2xl bg-bg-surface-raised border border-border-subtle">
              <GaugeRing score={overall} />
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="flex flex-wrap items-center gap-3 mb-2 justify-center sm:justify-start">
                  <ScoreBadge score={overall} />
                  <ConfidenceBadge confidence={recommendationConfidence} />
                </div>
                <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                  {executiveSummary}
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Category Scores ── */}
      <section className="py-16 bg-bg-surface">
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold font-heading text-text-primary mb-2">
              Category Scores
            </h2>
            <p className="text-text-secondary mb-8">
              Metro Reach Media analyzed {formData.businessName} across 9 marketing dimensions.
              Each score is based on evidence found during our review.
            </p>
            <div className="space-y-4">
              {scores.categories.map((cat) => {
                const Icon = categoryIcons[cat.name] || ChartBar;
                return (
                  <div key={cat.name} className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Icon size={22} weight="fill" className="text-brand-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-text-secondary">{cat.label}</span>
                          <span className={`text-sm font-bold tabular-nums ${
                            cat.score >= 70 ? "text-success" : cat.score >= 40 ? "text-warning" : "text-error"
                          }`}>
                            {cat.score}/100
                          </span>
                        </div>
                      </div>
                    </div>
                    <ScoreBar score={cat.score} />
                    <p className="text-sm text-text-secondary mt-3 leading-relaxed">
                      {cat.observation}
                    </p>
                    {cat.evidence && cat.evidence.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border-subtle">
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Evidence</p>
                        <ul className="space-y-1">
                          {cat.evidence.map((e, i) => (
                            <li key={i} className="text-xs text-text-muted flex items-start gap-1.5">
                              <span className="text-brand-primary mt-0.5">•</span>
                              {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Container>
      </section>

      {/* ── Website Analysis ── */}
      <section className="py-16 bg-bg-root border-t border-border-subtle">
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold font-heading text-text-primary mb-6 flex items-center gap-2">
              <Globe size={22} weight="fill" className="text-brand-primary" />
              Website Analysis
            </h2>
            <div className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6">
              {website.fetched ? (
                <>
                  <p className="text-sm text-text-secondary leading-relaxed mb-4">
                    Metro Reach Media successfully analyzed {formData.websiteUrl || "your website"}.
                    We found {website.title ? `a page title ("${website.title.slice(0, 80)}${website.title.length > 80 ? "..." : ""}"), ` : "no page title, "}
                    {website.description ? "a meta description, " : "no meta description, "}
                    and approximately {website.wordCount.toLocaleString()} words of content.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Page Title", ok: !!website.title },
                      { label: "Meta Description", ok: !!website.description },
                      { label: "HTTPS Secure", ok: website.hasHttps },
                      { label: "Open Graph Tags", ok: website.hasOpenGraph },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`text-xs font-medium px-3 py-2 rounded-lg ${
                          item.ok ? "bg-success/10 text-success" : "bg-error/10 text-error"
                        }`}
                      >
                        {item.ok ? "✓" : "✗"} {item.label}
                      </div>
                    ))}
                  </div>
                </>
              ) : formData.websiteUrl?.trim() ? (
                <div className="text-center py-4">
                  <WarningCircle size={24} weight="fill" className="text-warning mx-auto mb-3" />
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Metro Reach Media attempted to analyze {formData.websiteUrl} but was unable to reach the site.
                    This could mean the site is down, the URL is incorrect, or security settings are blocking external review.
                  </p>
                  <p className="text-sm text-text-secondary mt-2">
                    If potential customers experience the same issue, they'll leave immediately.
                  </p>
                  <a href="/free-audit" className="inline-block mt-4 text-sm text-brand-primary hover:text-brand-accent transition-colors">
                    Try again with a different URL →
                  </a>
                </div>
              ) : (
                <p className="text-sm text-text-secondary text-center py-4">
                  No website URL was provided. A website is often the first place customers go after discovering your business.
                </p>
              )}
            </div>
          </div>
        </Container>
      </section>

      {/* ── Strengths & Weaknesses ── */}
      <section className="py-16 bg-bg-surface border-t border-border-subtle">
        <Container>
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Strengths */}
              <div>
                <h2 className="text-xl font-bold font-heading text-text-primary mb-6 flex items-center gap-2">
                  <Medal size={22} weight="fill" className="text-brand-accent" />
                  What You're Doing Well
                </h2>
                <div className="space-y-3">
                  {strengths.map((s, i) => (
                    <div key={i} className="rounded-xl bg-bg-surface-raised border border-border-subtle p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-success/15 flex items-center justify-center mt-0.5">
                          <CheckCircle size={14} weight="fill" className="text-success" />
                        </span>
                        <p className="text-sm text-text-secondary leading-relaxed">{s}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weaknesses */}
              <div>
                <h2 className="text-xl font-bold font-heading text-text-primary mb-6 flex items-center gap-2">
                  <WarningCircle size={22} weight="fill" className="text-warning" />
                  Highest-Priority Opportunities
                </h2>
                <div className="space-y-3">
                  {weaknesses.map((w, i) => (
                    <div key={i} className="rounded-xl bg-bg-surface-raised border border-border-subtle p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-warning/15 flex items-center justify-center mt-0.5">
                          <WarningCircle size={14} weight="fill" className="text-warning" />
                        </span>
                        <p className="text-sm text-text-secondary leading-relaxed">{w}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Quick Wins ── */}
      <section className="py-16 bg-bg-root border-t border-border-subtle">
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold font-heading text-text-primary mb-2">
              Quick Wins
            </h2>
            <p className="text-text-secondary mb-8">
              Specific actions you can implement today — no budget required.
            </p>
            <div className="space-y-4">
              {quickWins.map((win, i) => (
                <div key={i} className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                      <Lightning size={20} weight="fill" className="text-brand-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="text-sm font-semibold text-text-primary">
                          Quick Win #{i + 1}
                        </span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            win.impactLevel === "High"
                              ? "bg-success/15 text-success"
                              : "bg-warning/15 text-warning"
                          }`}
                        >
                          {win.impactLevel} Impact
                        </span>
                        <span className="text-xs text-text-muted">{win.timeEstimate}</span>
                      </div>
                      <p className="text-sm text-text-secondary mb-3">
                        <span className="font-semibold text-text-primary">Issue:</span>{" "}
                        {win.issue}
                      </p>
                      <p className="text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Fix:</span>{" "}
                        {win.fix}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── Competitor Snapshot ── */}
      <section className="py-16 bg-bg-surface border-t border-border-subtle">
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold font-heading text-text-primary mb-6 flex items-center gap-2">
              <Buildings size={22} weight="fill" className="text-brand-primary" />
              Competitor Snapshot
            </h2>
            <div className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6">
              <p className="text-sm text-text-secondary leading-relaxed">
                {competitorSnapshot}
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Recommended Service ── */}
      <section className="py-16 bg-bg-root border-t border-border-subtle">
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold font-heading text-text-primary mb-2">
              Your Recommended Growth Plan
            </h2>
            <p className="text-text-secondary mb-2">
              Based on Metro Reach Media's analysis of {formData.businessName}'s scores and identified gaps,
              here is the service we recommend to move the needle fastest.
            </p>
            <div className="mb-8">
              <ConfidenceBadge confidence={recommendationConfidence} />
              <p className="text-xs text-text-muted mt-2">{confidenceExplanation}</p>
            </div>

            <div className="space-y-6">
              {serviceRecommendations.map((rec, i) => (
                <div
                  key={rec.slug}
                  className={`rounded-2xl border p-6 ${
                    i === 0
                      ? "bg-bg-surface-raised border-brand-primary/30 ring-1 ring-brand-primary/10"
                      : "bg-bg-surface-raised border-border-subtle"
                  }`}
                >
                  {i === 0 && (
                    <div className="mb-4">
                      <span className="inline-block bg-brand-primary text-text-primary text-xs font-semibold rounded-full px-3 py-1">
                        Recommended
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-4 mb-5">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                      <ShoppingCart size={20} weight="fill" className="text-brand-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold font-heading text-text-primary mb-1">
                        {rec.name}
                      </h3>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {rec.reason}
                      </p>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ml-14">
                    <div className="rounded-xl bg-bg-surface p-4">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                        Problems Addressed
                      </p>
                      <ul className="space-y-1">
                        {rec.problemsAddressed.map((p, j) => (
                          <li key={j} className="text-sm text-text-secondary flex items-start gap-1.5">
                            <span className="text-brand-primary mt-0.5">•</span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl bg-bg-surface p-4">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                        Deliverables
                      </p>
                      <ul className="space-y-1">
                        {rec.deliverables.map((d, j) => (
                          <li key={j} className="text-sm text-text-secondary flex items-start gap-1.5">
                            <span className="text-brand-primary mt-0.5">•</span>
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl bg-bg-surface p-4">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1 flex items-center gap-1.5">
                        <Clock size={12} weight="fill" /> Timeline
                      </p>
                      <p className="text-sm text-text-secondary">{rec.estimatedTimeline}</p>
                    </div>
                    <div className="rounded-xl bg-bg-surface p-4">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1 flex items-center gap-1.5">
                        <CurrencyDollar size={12} weight="fill" /> Investment
                      </p>
                      <p className="text-sm font-semibold text-text-primary">
                        {rec.price}{rec.billingFrequency ? `/${rec.billingFrequency}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Post-purchase */}
                  <div className="ml-14 mt-5">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                      After Purchase
                    </p>
                    <p className="text-sm text-text-secondary">{rec.postPurchase}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 bg-bg-surface border-t border-border-subtle no-print">
        <Container>
          <div className="max-w-xl mx-auto text-center">
            {/* PDF Download */}
            <div className="mb-8">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-brand-primary transition-colors duration-200 border border-border-subtle rounded-full px-6 py-3 hover:border-brand-primary/40"
                title="Download or print this report as PDF"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6V2h8v4M2 10h12v4H2v-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Download PDF
              </button>
              <p className="text-xs text-text-muted mt-2">
                Opens your browser's print dialog — select "Save as PDF" to download.
              </p>
            </div>

            <h2 className="text-2xl font-bold font-heading text-text-primary mb-4">
              Ready to implement these recommendations?
            </h2>
            <p className="text-text-secondary mb-8">
              Metro Reach Media can handle this for you. Our team of specialists
              manages every dimension of social media — strategy, creative, posting,
              engagement, and analytics — so you get the results without the overhead.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {primaryRec?.stripeLink ? (
                <a
                  href={primaryRec.stripeLink}
                  className="inline-flex items-center gap-2 font-semibold transition-all duration-200 ease-out bg-brand-primary text-text-primary rounded-full px-8 py-3.5 text-base hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:scale-[1.02]"
                >
                  Start My Growth Plan
                  <ArrowRight size={18} weight="bold" />
                </a>
              ) : (
                <div className="w-full sm:w-auto">
                  <a
                    href="/contact"
                    className="inline-flex items-center gap-2 font-semibold transition-all duration-200 ease-out bg-brand-primary text-text-primary rounded-full px-8 py-3.5 text-base hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:scale-[1.02]"
                  >
                    Start My Growth Plan
                    <ArrowRight size={18} weight="bold" />
                  </a>
                  {primaryRec && (
                    <p className="text-xs text-text-muted mt-3 max-w-sm mx-auto leading-relaxed">
                      We're preparing {primaryRec.name.toLowerCase()} for instant checkout. 
                      In the meantime, our team will reach out within 24 hours to discuss your 
                      personalized growth plan.
                    </p>
                  )}
                </div>
              )}
              <a
                href="/services"
                className="border border-border-emphasis text-text-primary rounded-full px-6 py-2.5 text-sm hover:border-brand-primary hover:text-brand-primary inline-flex items-center gap-2 font-semibold transition-all duration-200"
              >
                Compare All Services
              </a>
            </div>
            <p className="text-xs text-text-muted mt-8 pt-8 border-t border-border-subtle">
              Want a deeper analysis?{" "}
              <a href="/premium-audit" className="text-brand-primary hover:text-brand-accent transition-colors font-semibold">
                Upgrade to our Premium Growth Audit
              </a>{" "}
              — 12 categories, priority matrix, growth roadmap, and more.
            </p>
            <p className="text-xs text-text-muted mt-3">
              Prepared by Metro Reach Media. Questions?{" "}
              <a href="/contact" className="text-brand-primary hover:text-brand-accent transition-colors">
                Contact us
              </a>
              .
            </p>
          </div>
        </Container>
      </section>

      {/* ── Print-only footer ── */}
      <div className="print-only hidden">
        <p style={{ fontSize: "10px", color: "#6b7280", textAlign: "center", marginTop: "40px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
          Prepared by Metro Reach Media &bull; metroreachagency.com &bull; {auditDate}
        </p>
      </div>
    </main>
    </>
  );
}
