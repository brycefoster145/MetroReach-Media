import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  CheckCircle,
  WarningCircle,
  Lightning,
  Medal,
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
  MapPin,
  ThumbsUp,
  SealCheck,
  Target,
  Article,
  ChatCircleText,
  Rocket,
  Heartbeat,
  DownloadSimple,
  TrendUp,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { runPremiumAudit, type PremiumAuditResult } from "~/lib/premium-audit-analyzer";
import { getLead, type LeadFormData } from "~/lib/lead-store";

// ---------------------------------------------------------------------------
// Server function — run premium audit on demand
// ---------------------------------------------------------------------------

const loadPremiumAudit = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const safeId = id.replace(/[^a-zA-Z0-9\-]/g, "");
    const lead = await getLead(safeId);
    if (!lead) return null;

    const result = await runPremiumAudit(lead.businessInfo, safeId);
    return result;
  });

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/premium-audit/report")({
  component: PremiumAuditReportPage,
});

// ---------------------------------------------------------------------------
// Shared Components
// ---------------------------------------------------------------------------

function ScoreBadge({ score }: { score: number }) {
  let color: string;
  let label: string;
  if (score >= 70) { color = "text-success"; label = "Strong"; }
  else if (score >= 40) { color = "text-warning"; label = "Needs Work"; }
  else { color = "text-error"; label = "Critical"; }
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${color}`}>
      <span className={`w-2 h-2 rounded-full ${score >= 70 ? "bg-success" : score >= 40 ? "bg-warning" : "bg-error"}`} />
      {label}
    </span>
  );
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = max > 0 ? score / max : 0;
  const barColor = pct >= 0.7 ? "bg-success" : pct >= 0.4 ? "bg-warning" : "bg-error";
  const textColor = pct >= 0.7 ? "text-success" : pct >= 0.4 ? "text-warning" : "text-error";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 rounded-full bg-bg-surface-high overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${Math.max(pct * 100, 2)}%` }} />
      </div>
      <span className={`text-sm font-bold font-heading tabular-nums min-w-[2rem] text-right ${textColor}`}>{score}</span>
    </div>
  );
}

function GaugeRing({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const dims = size === "sm" ? 80 : 120;
  const r = size === "sm" ? 36 : 54;
  const sw = size === "sm" ? 6 : 8;
  const circumference = 2 * Math.PI * r;
  const pct = score / 100;
  const dashOffset = circumference * (1 - pct);
  const color = pct >= 0.7 ? "#06D6A0" : pct >= 0.4 ? "#F59E0B" : "#EF4444";
  const textSize = size === "sm" ? "text-xl" : "text-3xl";

  return (
    <div className={`relative ${size === "sm" ? "w-20 h-20" : "w-36 h-36"}`}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${dims} ${dims}`}>
        <circle cx={dims / 2} cy={dims / 2} r={r} fill="none" stroke="#1B2433" strokeWidth={sw} />
        <circle cx={dims / 2} cy={dims / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset} className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${textSize} font-bold font-heading tabular-nums`} style={{ color }}>{score}</span>
        {size !== "sm" && <span className="text-xs text-text-muted">out of 100</span>}
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: "high" | "moderate" | "limited" | "High" | "Moderate" | "Limited" }) {
  const c = typeof confidence === "string" ? confidence.toLowerCase() as "high" | "moderate" | "limited" : confidence;
  const config = {
    high: { color: "bg-success/15 text-success border-success/30", label: "High Confidence" },
    moderate: { color: "bg-warning/15 text-warning border-warning/30", label: "Moderate Confidence" },
    limited: { color: "bg-text-muted/15 text-text-muted border-text-muted/30", label: "Limited Data" },
  };
  const cfg = config[c] || config.limited;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

const categoryIcons: Record<string, React.ComponentType<{ size?: number; weight?: "fill"; className?: string }>> = {
  overallMarketing: ChartBar,
  businessHealth: Heartbeat,
  brandIdentity: Star,
  websiteAnalysis: Globe,
  socialMediaAnalysis: Users,
  contentStrategy: Article,
  localMarketing: MapPin,
  searchVisibility: MagnifyingGlass,
  reputationAnalysis: ThumbsUp,
  competitorAnalysis: Buildings,
  leadGeneration: Target,
  advertisingReadiness: Rocket,
};

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, string> = {
    Critical: "bg-error/15 text-error border-error/30",
    High: "bg-warning/15 text-warning border-warning/30",
    Medium: "bg-brand-primary/15 text-brand-primary border-brand-primary/30",
    Low: "bg-text-muted/15 text-text-muted border-text-muted/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${config[priority] || config.Low}`}>
      {priority}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function PremiumAuditReportPage() {
  const [audit, setAudit] = useState<PremiumAuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("lead");
    if (!id) {
      setError("No report ID provided. Please complete the Premium Audit purchase first.");
      setLoading(false);
      return;
    }
    loadPremiumAudit({ data: id })
      .then((data) => {
        if (!data) {
          setError("Report not found. Please complete your purchase or contact us for assistance.");
        } else {
          setAudit(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("We couldn't generate your report. Please try again or contact us.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center bg-bg-root">
        <Spinner size={32} weight="bold" className="animate-spin text-brand-primary" />
        <p className="text-text-secondary">Metro Reach Media is analyzing your business...</p>
        <p className="text-sm text-text-muted">Generating your complete premium growth blueprint</p>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-6 px-6 text-center bg-bg-root">
        <h1 className="text-4xl md:text-5xl font-bold font-heading text-text-primary">Report Not Available</h1>
        <p className="text-lg text-text-secondary max-w-md">{error || "This report doesn't exist."}</p>
        <a href="/premium-audit" className="inline-flex items-center gap-2 rounded-full bg-brand-primary text-text-primary px-8 py-3.5 text-base font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent transition-all duration-200">
          Purchase Premium Audit →
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
    priorityMatrix,
    growthRoadmap,
    quickWins,
    serviceRecommendations,
    recommendationConfidence,
    confidenceExplanation,
    competitorSnapshot,
    executiveSummary,
    dataConfidence,
    timestamp,
  } = audit;

  const auditDate = new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const overall = scores.overall;
  const health = scores.businessHealth;
  const primaryRec = serviceRecommendations[0];

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0.75in; size: letter; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          header, nav, footer, .no-print, button { display: none !important; }
          main { padding: 0 !important; }
          section { break-inside: avoid; page-break-inside: avoid; }
          .rounded-2xl, .rounded-xl, .rounded-full { border-radius: 8px !important; }
          .print-only { display: block !important; }
          .text-text-primary { color: #111827 !important; }
          .text-text-secondary { color: #374151 !important; }
          .text-text-muted { color: #6b7280 !important; }
          .bg-bg-root, .bg-bg-surface, .bg-bg-surface-raised { background: #ffffff !important; border-color: #e5e7eb !important; }
          svg { max-width: 100%; }
        }
      `}</style>

    <main>
      {/* ── Header ── */}
      <section className="relative py-16 lg:py-24 bg-bg-root overflow-hidden border-b border-border-subtle">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_500px_at_50%_50%,rgba(59,130,246,0.06),transparent)] pointer-events-none" />
        <Container className="relative z-10">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-medium text-text-muted uppercase tracking-widest mb-4">
              Premium Growth Audit &bull; {auditDate}
            </p>
            <p className="text-sm text-text-secondary mb-2">Prepared by Metro Reach Media for</p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading text-text-primary tracking-tight mb-8">
              {formData.businessName}
            </h1>

            {/* Dual Score Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 rounded-2xl bg-bg-surface-raised border border-brand-primary/20">
                <GaugeRing score={overall} size="sm" />
                <div className="text-center sm:text-left">
                  <p className="text-sm font-semibold text-text-primary mb-1">Overall Marketing Score</p>
                  <ScoreBadge score={overall} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 rounded-2xl bg-bg-surface-raised border border-brand-accent/20">
                <GaugeRing score={health} size="sm" />
                <div className="text-center sm:text-left">
                  <p className="text-sm font-semibold text-text-primary mb-1">Business Health Rating</p>
                  <ScoreBadge score={health} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-3">
              <ConfidenceBadge confidence={recommendationConfidence} />
              <ConfidenceBadge confidence={dataConfidence} />
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{executiveSummary}</p>
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
              Metro Reach Media analyzed {formData.businessName} across {scores.categories.length} marketing dimensions. Each score is based on evidence found during our comprehensive review.
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
                          <span className={`text-sm font-bold tabular-nums ${cat.score >= 70 ? "text-success" : cat.score >= 40 ? "text-warning" : "text-error"}`}>
                            {cat.score}/100
                          </span>
                        </div>
                      </div>
                    </div>
                    <ScoreBar score={cat.score} />
                    <p className="text-sm text-text-secondary mt-3 leading-relaxed">{cat.observation}</p>

                    {/* Sub-scores for Social Media */}
                    {cat.subScores && cat.subScores.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border-subtle">
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Per-Platform Breakdown</p>
                        <div className="grid grid-cols-2 gap-2">
                          {cat.subScores.map((ss) => (
                            <div key={ss.label} className="flex items-center justify-between text-xs">
                              <span className="text-text-muted">{ss.label}</span>
                              <span className={`font-semibold ${ss.score > 0 ? "text-success" : "text-error"}`}>
                                {ss.score > 0 ? `✓ ${ss.score}` : "✗ Missing"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evidence */}
                    {cat.evidence && cat.evidence.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border-subtle">
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">Evidence</p>
                        <ul className="space-y-1">
                          {cat.evidence.map((e, i) => (
                            <li key={i} className="text-xs text-text-muted flex items-start gap-1.5">
                              <span className="text-brand-primary mt-0.5">•</span> {e}
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

      {/* ── Strengths & Weaknesses ── */}
      <section className="py-16 bg-bg-root border-t border-border-subtle">
        <Container>
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-xl font-bold font-heading text-text-primary mb-6 flex items-center gap-2">
                  <Medal size={22} weight="fill" className="text-brand-accent" />
                  Biggest Strengths
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
              <div>
                <h2 className="text-xl font-bold font-heading text-text-primary mb-6 flex items-center gap-2">
                  <WarningCircle size={22} weight="fill" className="text-warning" />
                  Highest-Priority Issues
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

      {/* ── Priority Matrix ── */}
      <section className="py-16 bg-bg-surface border-t border-border-subtle">
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold font-heading text-text-primary mb-2">
              Priority Matrix
            </h2>
            <p className="text-text-secondary mb-8">
              Every issue ranked by Business Impact × Implementation Difficulty. Critical items should be addressed first.
            </p>
            <div className="space-y-3">
              {priorityMatrix.slice(0, 6).map((item, i) => (
                <div key={i} className={`rounded-2xl border p-5 ${item.priority === "Critical" ? "bg-bg-surface-raised border-error/30" : "bg-bg-surface-raised border-border-subtle"}`}>
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold font-heading ${
                      item.priority === "Critical" ? "bg-error/15 text-error" :
                      item.priority === "High" ? "bg-warning/15 text-warning" :
                      "bg-brand-primary/15 text-brand-primary"
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <span className="text-sm font-semibold text-text-primary">{item.category}</span>
                        <PriorityBadge priority={item.priority} />
                      </div>
                      <p className="text-sm text-text-secondary mb-3">{item.issue}</p>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-xs text-text-muted mb-1">Business Impact</p>
                          <div className="h-1.5 rounded-full bg-bg-surface-high overflow-hidden">
                            <div className="h-full rounded-full bg-brand-primary" style={{ width: `${item.businessImpact}%` }} />
                          </div>
                          <span className="text-xs text-text-muted mt-0.5">{item.businessImpact}/100</span>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted mb-1">Implementation Difficulty</p>
                          <div className="h-1.5 rounded-full bg-bg-surface-high overflow-hidden">
                            <div className="h-full rounded-full bg-text-muted" style={{ width: `${item.implementationDifficulty}%` }} />
                          </div>
                          <span className="text-xs text-text-muted mt-0.5">{item.implementationDifficulty}/100</span>
                        </div>
                      </div>
                      <p className="text-xs text-text-secondary">
                        <span className="font-semibold">Recommendation:</span> {item.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── Growth Roadmap ── */}
      <section className="py-16 bg-bg-root border-t border-border-subtle">
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold font-heading text-text-primary mb-2 flex items-center gap-2">
              <TrendUp size={22} weight="fill" className="text-brand-accent" />
              Growth Roadmap
            </h2>
            <p className="text-text-secondary mb-8">
              A phased plan to take {formData.businessName} from current state to market leadership.
            </p>
            <div className="space-y-4">
              {growthRoadmap.map((phase, i) => (
                <div key={i} className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-primary/15 flex items-center justify-center">
                      <span className="text-sm font-bold font-heading text-brand-primary">{i + 1}</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold font-heading text-text-primary">{phase.phase}</h3>
                      <p className="text-xs text-text-muted">{phase.timeframe}</p>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-4">
                    {phase.actions.map((action, j) => (
                      <li key={j} className="text-sm text-text-secondary flex items-start gap-2">
                        <span className="text-brand-accent mt-0.5">•</span> {action}
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-xl bg-bg-surface p-3">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Expected Outcome</p>
                    <p className="text-sm text-text-secondary">{phase.expectedOutcome}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── Quick Wins ── */}
      <section className="py-16 bg-bg-surface border-t border-border-subtle">
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
                        <span className="text-sm font-semibold text-text-primary">Quick Win #{i + 1}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${win.impactLevel === "High" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                          {win.impactLevel} Impact
                        </span>
                        <span className="text-xs text-text-muted">{win.timeEstimate}</span>
                      </div>
                      <p className="text-sm text-text-secondary mb-3">
                        <span className="font-semibold text-text-primary">Issue:</span> {win.issue}
                      </p>
                      <p className="text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Fix:</span> {win.fix}
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
      <section className="py-16 bg-bg-root border-t border-border-subtle">
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold font-heading text-text-primary mb-6 flex items-center gap-2">
              <Buildings size={22} weight="fill" className="text-brand-primary" />
              Competitive Position
            </h2>
            <div className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6">
              <p className="text-sm text-text-secondary leading-relaxed">{competitorSnapshot}</p>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Recommended Services ── */}
      <section className="py-16 bg-bg-surface border-t border-border-subtle">
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold font-heading text-text-primary mb-2">
              Recommended Growth Plan
            </h2>
            <p className="text-text-secondary mb-2">
              Based on Metro Reach Media's comprehensive premium analysis of {formData.businessName}, here are the services we recommend.
            </p>
            <div className="mb-8">
              <ConfidenceBadge confidence={recommendationConfidence} />
              <p className="text-xs text-text-muted mt-2">{confidenceExplanation}</p>
            </div>

            <div className="space-y-6">
              {serviceRecommendations.map((rec, i) => (
                <div key={rec.slug} className={`rounded-2xl border p-6 ${i === 0 ? "bg-bg-surface-raised border-brand-primary/30 ring-1 ring-brand-primary/10" : "bg-bg-surface-raised border-border-subtle"}`}>
                  {i === 0 && (
                    <div className="mb-4">
                      <span className="inline-block bg-brand-primary text-text-primary text-xs font-semibold rounded-full px-3 py-1">Recommended</span>
                    </div>
                  )}
                  <div className="flex items-start gap-4 mb-5">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                      <ShoppingCart size={20} weight="fill" className="text-brand-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold font-heading text-text-primary mb-1">{rec.name}</h3>
                      <p className="text-sm text-text-secondary leading-relaxed">{rec.reason}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ml-14">
                    <div className="rounded-xl bg-bg-surface p-4">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Problems Addressed</p>
                      <ul className="space-y-1">
                        {rec.problemsAddressed.map((p, j) => (
                          <li key={j} className="text-sm text-text-secondary flex items-start gap-1.5">
                            <span className="text-brand-primary mt-0.5">•</span> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl bg-bg-surface p-4">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Deliverables</p>
                      <ul className="space-y-1">
                        {rec.deliverables.map((d, j) => (
                          <li key={j} className="text-sm text-text-secondary flex items-start gap-1.5">
                            <span className="text-brand-primary mt-0.5">•</span> {d}
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
                  <div className="ml-14 mt-5">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">After Purchase</p>
                    <p className="text-sm text-text-secondary">{rec.postPurchase}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── CTAs ── */}
      <section className="py-16 bg-bg-root border-t border-border-subtle no-print">
        <Container>
          <div className="max-w-xl mx-auto text-center">
            {/* PDF Download */}
            <div className="mb-8">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-brand-primary transition-colors duration-200 border border-border-subtle rounded-full px-6 py-3 hover:border-brand-primary/40"
              >
                <DownloadSimple size={16} weight="bold" />
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
              Metro Reach Media can execute this entire growth roadmap — strategy, creative, posting,
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
                <a
                  href="/contact"
                  className="inline-flex items-center gap-2 font-semibold transition-all duration-200 ease-out bg-brand-primary text-text-primary rounded-full px-8 py-3.5 text-base hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:scale-[1.02]"
                >
                  Start My Growth Plan
                  <ArrowRight size={18} weight="bold" />
                </a>
              )}
              <a
                href="/services"
                className="border border-border-emphasis text-text-primary rounded-full px-6 py-2.5 text-sm hover:border-brand-primary hover:text-brand-primary inline-flex items-center gap-2 font-semibold transition-all duration-200"
              >
                Build My Custom Marketing Plan
              </a>
            </div>
            <p className="text-xs text-text-muted mt-8 pt-8 border-t border-border-subtle">
              Prepared by Metro Reach Media. Questions?{" "}
              <a href="/contact" className="text-brand-primary hover:text-brand-accent transition-colors">Contact us</a>.
            </p>
          </div>
        </Container>
      </section>

      {/* Print-only footer */}
      <div className="print-only hidden">
        <p style={{ fontSize: "10px", color: "#6b7280", textAlign: "center", marginTop: "40px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
          Premium Growth Audit prepared by Metro Reach Media &bull; metroreachagency.com &bull; {auditDate}
        </p>
      </div>
    </main>
    </>
  );
}
