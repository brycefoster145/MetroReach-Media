import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { Button } from "~/components/Button";
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
        join("/home/team/shared/audits", `${safeId}.json`),
        "utf-8"
      );
      return JSON.parse(raw) as AuditResult;
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
    pct >= 0.7
      ? "text-success"
      : pct >= 0.4
        ? "text-warning"
        : "text-error";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-bg-surface-high overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.max(pct * 100, 2)}%` }}
        />
      </div>
      <span className={`text-sm font-bold font-heading tabular-nums ${textColor}`}>
        {score}
      </span>
    </div>
  );
}

const categoryIcons: Record<string, React.ComponentType<{ size?: number; weight?: "fill"; className?: string }>> = {
  overallMarketing: ChartBar,
  socialMediaHealth: Users,
  branding: Star,
  contentQuality: Target,
  engagement: Lightning,
  website: Globe,
  localVisibility: MagnifyingGlass,
};

const categoryLabels: Record<string, string> = {
  overallMarketing: "Overall Marketing",
  socialMediaHealth: "Social Media Health",
  branding: "Branding",
  contentQuality: "Content Quality",
  engagement: "Engagement",
  website: "Website",
  localVisibility: "Local Visibility",
};

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
    if (!id) {
      setError("No audit ID provided.");
      setLoading(false);
      return;
    }
    loadAudit({ data: id })
      .then((data) => {
        if (!data) {
          setError("Report not found. It may have expired or the link is incorrect.");
        } else {
          setAudit(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load report. Please try again.");
        setLoading(false);
      });
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
    competitorSnapshot,
    estimatedGrowthPotential,
    timestamp,
  } = audit;

  const auditDate = new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const overallColor =
    scores.overall >= 70
      ? "text-success"
      : scores.overall >= 40
        ? "text-warning"
        : "text-error";

  return (
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
              Prepared by MetroReach Digital for
            </p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading text-text-primary tracking-tight mb-8">
              {formData.businessName}
            </h1>

            {/* Overall Score Card */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 rounded-2xl bg-bg-surface-raised border border-border-subtle">
              <div className="flex-shrink-0 text-center sm:text-left">
                <div
                  className={`text-6xl md:text-7xl font-bold font-heading ${overallColor} tabular-nums`}
                >
                  {scores.overall}
                </div>
                <p className="text-sm text-text-muted mt-1">out of 100</p>
              </div>
              <div className="flex-1 min-w-0">
                <ScoreBadge score={scores.overall} />
                <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                  {scores.overall >= 70
                    ? `${formData.businessName} has a strong digital marketing foundation. Our team's analysis shows you're ahead of most local competitors — the opportunity now is to scale and dominate your market.`
                    : scores.overall >= 40
                      ? `${formData.businessName} has the basics in place, but our analysis identified clear gaps that are costing you leads. Each gap represents an opportunity — close them, and your pipeline transforms.`
                      : `${formData.businessName}'s digital presence needs foundational work. Our team's review found significant gaps across key marketing dimensions. The upside: every improvement from here translates directly to more visibility, trust, and leads.`}
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Score Breakdown ── */}
      <section className="py-16 bg-bg-surface">
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold font-heading text-text-primary mb-8">
              Category Scores
            </h2>
            <div className="space-y-5">
              {scores.categories.map((cat) => {
                const Icon = categoryIcons[cat.name] || ChartBar;
                return (
                  <div
                    key={cat.name}
                    className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Icon
                        size={22}
                        weight="fill"
                        className="text-brand-primary flex-shrink-0"
                      />
                      <span className="text-sm font-medium text-text-secondary">
                        {cat.label}
                      </span>
                    </div>
                    <ScoreBar score={cat.score} />
                    <p className="text-sm text-text-secondary mt-3 leading-relaxed">
                      {cat.observation}
                    </p>
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
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                {website.observation}
              </p>
              {website.fetched && (
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
                        item.ok
                          ? "bg-success/10 text-success"
                          : "bg-error/10 text-error"
                      }`}
                    >
                      {item.ok ? "✓" : "✗"} {item.label}
                    </div>
                  ))}
                </div>
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
                  Top Strengths
                </h2>
                <div className="space-y-4">
                  {strengths.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-bg-surface-raised border border-border-subtle p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-success/15 flex items-center justify-center">
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
                  <WarningCircle
                    size={22}
                    weight="fill"
                    className="text-warning"
                  />
                  Priority Weaknesses
                </h2>
                <div className="space-y-4">
                  {weaknesses.map((w, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-bg-surface-raised border border-border-subtle p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-warning/15 flex items-center justify-center">
                          <WarningCircle
                            size={14}
                            weight="fill"
                            className="text-warning"
                          />
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

      {/* ── Competitor Snapshot ── */}
      <section className="py-16 bg-bg-root border-t border-border-subtle">
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
                <div
                  key={i}
                  className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                      <Lightning
                        size={20}
                        weight="fill"
                        className="text-brand-accent"
                      />
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
                        <span className="text-xs text-text-muted">
                          {win.timeEstimate}
                        </span>
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

      {/* ── Estimated Growth Potential ── */}
      <section className="py-16 bg-bg-root border-t border-border-subtle">
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold font-heading text-text-primary mb-6 flex items-center gap-2">
              <ChartBar size={22} weight="fill" className="text-brand-primary" />
              Estimated Growth Potential
            </h2>
            <div className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6">
              <p className="text-sm text-text-secondary leading-relaxed">
                {estimatedGrowthPotential}
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Service Recommendations ── */}
      <section className="py-16 bg-bg-surface border-t border-border-subtle">
        <Container>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold font-heading text-text-primary mb-2">
              Recommended Service Package
            </h2>
            <p className="text-text-secondary mb-8">
              Based on our team's analysis of your scores and gaps, here's what we
              recommend to move the needle fastest.
            </p>

            <div className="space-y-6">
              {serviceRecommendations.map((rec, i) => (
                <div
                  key={i}
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
                      <ShoppingCart
                        size={20}
                        weight="fill"
                        className="text-brand-primary"
                      />
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
                        What's Wrong
                      </p>
                      <p className="text-sm text-text-secondary">{rec.whatIsWrong}</p>
                    </div>
                    <div className="rounded-xl bg-bg-surface p-4">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
                        Why It Matters
                      </p>
                      <p className="text-sm text-text-secondary">{rec.whyItMatters}</p>
                    </div>
                    <div className="rounded-xl bg-bg-surface p-4">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1 flex items-center gap-1.5">
                        <Clock size={12} weight="fill" /> Timeline
                      </p>
                      <p className="text-sm text-text-secondary">
                        {rec.estimatedTimeline}
                      </p>
                    </div>
                    <div className="rounded-xl bg-bg-surface p-4">
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1 flex items-center gap-1.5">
                        <CurrencyDollar size={12} weight="fill" /> Investment
                      </p>
                      <p className="text-sm font-semibold text-text-primary">
                        {rec.monthlyInvestment}
                      </p>
                    </div>
                  </div>

                  <div className="ml-14 mt-5">
                    <p className="text-sm text-text-secondary">
                      <span className="font-semibold text-text-primary">
                        Service:
                      </span>{" "}
                      {rec.whichService}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 bg-bg-root border-t border-border-subtle">
        <Container>
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-bold font-heading text-text-primary mb-4">
              Ready to implement these recommendations?
            </h2>
            <p className="text-text-secondary mb-8">
              MetroReach Digital can handle this for you. Our team of specialists
              manages every dimension of social media — strategy, creative, posting,
              engagement, and analytics — so you get the results without the overhead.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button href="/contact">
                Start My Growth Plan
                <ArrowRight size={18} weight="bold" />
              </Button>
              <Button href="/services" variant="ghost">
                Compare All Service Packages
              </Button>
            </div>
            <p className="text-xs text-text-muted mt-8 pt-8 border-t border-border-subtle">
              Prepared by MetroReach Digital. Questions?{" "}
              <a
                href="/contact"
                className="text-brand-primary hover:text-brand-accent transition-colors"
              >
                Contact us
              </a>
              .
            </p>
          </div>
        </Container>
      </section>
    </main>
  );
}
