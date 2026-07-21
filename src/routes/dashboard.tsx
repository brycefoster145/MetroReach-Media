import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUp,
  ArrowDown,
  DownloadSimple,
  CaretDown,
  Heartbeat,
  Lightning,
  ChatCircleText,
  Target,
  Megaphone,
  PaintBrush,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { dashboardPage } from "~/data/pages";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: dashboardPage.title },
      { name: "description", content: dashboardPage.description },
    ],
  }),
  component: Dashboard,
});

// ── Mock data ──────────────────────────────────────────────────────────

const metrics = [
  {
    label: "Leads Generated",
    value: "47",
    change: "+21%",
    direction: "up" as const,
    sub: "vs prior month",
  },
  {
    label: "Cost Per Lead",
    value: "$38.00",
    change: "-16%",
    direction: "down" as const,
    sub: "improving",
  },
  {
    label: "ROAS",
    value: "4.2x",
    change: "+17%",
    direction: "up" as const,
    sub: "vs prior month",
  },
  {
    label: "Ad Spend",
    value: "$1,250",
    change: "On budget",
    direction: "neutral" as const,
    sub: "of $1,250 planned",
  },
];

const leadWeeks = [
  { week: "Week 1", leads: 10 },
  { week: "Week 2", leads: 12 },
  { week: "Week 3", leads: 11 },
  { week: "Week 4", leads: 14 },
];

const platformData = [
  {
    platform: "Facebook",
    leads: 22,
    cpl: "$13.20",
    spend: "$290",
    color: "brand-primary",
    icon: Megaphone,
  },
  {
    platform: "Instagram",
    leads: 11,
    cpl: "$11.80",
    spend: "$130",
    color: "brand-accent",
    icon: PaintBrush,
  },
  {
    platform: "Google",
    leads: 14,
    cpl: "$10.50",
    spend: "$830",
    color: "brand-primary-glow",
    icon: Target,
  },
];

const topPosts = [
  {
    title: "5 signs your AC is about to fail",
    platform: "Facebook",
    engagements: 847,
    reach: 4200,
    icon: Lightning,
  },
  {
    title: "Before & after: Ridgeway coil cleaning",
    platform: "Instagram",
    engagements: 623,
    reach: 3100,
    icon: PaintBrush,
  },
  {
    title: "Why we recommend seasonal inspections",
    platform: "Facebook",
    engagements: 512,
    reach: 2800,
    icon: ChatCircleText,
  },
];

const activity = [
  {
    action: "Ad campaign 'AC Tune-Up Special' — bid adjusted",
    time: "Today, 10:23 AM",
    icon: Target,
  },
  {
    action: "New post published: 'Summer energy saving tips'",
    time: "Today, 8:15 AM",
    icon: PaintBrush,
  },
  {
    action: "Google campaign 'Emergency AC Repair' — CPL improved 18%",
    time: "Yesterday, 4:42 PM",
    icon: Target,
  },
  {
    action: "Weekly performance summary generated",
    time: "Yesterday, 9:00 AM",
    icon: Heartbeat,
  },
  {
    action: "Facebook lead form conversion rate — new high: 14.3%",
    time: "Jun 28, 2:30 PM",
    icon: Megaphone,
  },
  {
    action: "Instagram Story campaign creative refreshed",
    time: "Jun 27, 11:45 AM",
    icon: PaintBrush,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────

function formatReach(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Sub-components ─────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  change,
  direction,
  sub,
}: (typeof metrics)[number]) {
  const changeColor =
    direction === "up"
      ? "text-brand-accent"
      : direction === "down"
        ? "text-brand-accent"
        : "text-text-secondary";

  const ArrowIcon =
    direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : null;

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 flex flex-col gap-1 card-hover">
      <p className="text-sm text-text-muted font-medium">{label}</p>
      <p className="text-4xl font-bold font-heading text-text-primary tracking-tight">
        {value}
      </p>
      <div className="flex items-center gap-1.5 mt-1">
        <span
          className={`inline-flex items-center gap-0.5 text-sm font-semibold ${changeColor}`}
        >
          {ArrowIcon && <ArrowIcon size={14} weight="bold" />}
          {change}
        </span>
        <span className="text-sm text-text-muted">{sub}</span>
      </div>
    </div>
  );
}

function LeadChart() {
  const maxLeads = Math.max(...leadWeeks.map((w) => w.leads));

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
      <h3 className="text-lg font-semibold font-heading text-text-primary mb-6">
        Leads Over Time
      </h3>
      <div className="flex items-end justify-between gap-4 h-48 px-2">
        {leadWeeks.map((w) => {
          const heightPct = Math.round((w.leads / maxLeads) * 100);
          return (
            <div
              key={w.week}
              className="flex flex-col items-center gap-2 flex-1"
            >
              <span className="text-sm font-semibold text-text-primary">
                {w.leads}
              </span>
              <div className="w-full max-w-[64px] relative flex-1 flex items-end">
                <div
                  className="w-full rounded-t-lg transition-all duration-700 ease-out"
                  style={{
                    height: `${heightPct}%`,
                    background:
                      "linear-gradient(180deg, #3B82F6 0%, rgba(59,130,246,0.3) 100%)",
                  }}
                />
              </div>
              <span className="text-xs text-text-muted mt-2">{w.week}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlatformTable() {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
      <h3 className="text-lg font-semibold font-heading text-text-primary mb-5">
        Platform Breakdown
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="pb-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                Platform
              </th>
              <th className="pb-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">
                Leads
              </th>
              <th className="pb-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">
                CPL
              </th>
              <th className="pb-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">
                Spend
              </th>
            </tr>
          </thead>
          <tbody>
            {platformData.map((p) => {
              const Icon = p.icon;
              return (
                <tr
                  key={p.platform}
                  className="border-b border-border-subtle/50 last:border-0"
                >
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-bg-surface-raised flex items-center justify-center">
                        <Icon
                          size={16}
                          className={`text-${p.color}`}
                          weight="fill"
                        />
                      </div>
                      <span className="text-sm font-medium text-text-primary">
                        {p.platform}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 text-right text-sm font-semibold text-text-primary">
                    {p.leads}
                  </td>
                  <td className="py-3.5 text-right text-sm text-text-secondary font-mono">
                    {p.cpl}
                  </td>
                  <td className="py-3.5 text-right text-sm text-text-secondary font-mono">
                    {p.spend}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-emphasis">
              <td className="pt-3.5 text-sm font-semibold text-text-primary">
                Total
              </td>
              <td className="pt-3.5 text-right text-sm font-bold text-text-primary">
                47
              </td>
              <td className="pt-3.5 text-right text-sm font-bold text-text-primary font-mono">
                $38.00
              </td>
              <td className="pt-3.5 text-right text-sm font-bold text-text-primary font-mono">
                $1,250
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function TopPosts() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold font-heading text-text-primary">
        Top Performing Posts
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topPosts.map((post, i) => {
          const Icon = post.icon;
          return (
            <div
              key={i}
              className="bg-bg-surface border border-border-subtle rounded-2xl p-5 card-hover flex flex-col gap-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-bg-surface-raised flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className="text-brand-primary" weight="fill" />
                </div>
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  {post.platform}
                </span>
              </div>
              <p className="text-sm font-medium text-text-primary leading-snug flex-1">
                &ldquo;{post.title}&rdquo;
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                <div className="text-center">
                  <p className="text-lg font-bold font-heading text-text-primary">
                    {post.engagements.toLocaleString()}
                  </p>
                  <p className="text-xs text-text-muted">Engagements</p>
                </div>
                <div className="w-px h-8 bg-border-subtle" />
                <div className="text-center">
                  <p className="text-lg font-bold font-heading text-text-primary">
                    {formatReach(post.reach)}
                  </p>
                  <p className="text-xs text-text-muted">Reach</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityFeed() {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
      <h3 className="text-lg font-semibold font-heading text-text-primary mb-5">
        Recent Activity
      </h3>
      <div className="space-y-0">
        {activity.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className={`flex items-start gap-3 py-3 ${
                i < activity.length - 1 ? "border-b border-border-subtle/50" : ""
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-bg-surface-raised border border-border-subtle flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon size={12} className="text-text-muted" weight="fill" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-secondary leading-relaxed">
                  {item.action}
                </p>
                <p className="text-xs text-text-muted mt-1 font-mono">
                  {item.time}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

function Dashboard() {
  return (
    <main className="min-h-dvh bg-bg-root">
      <Container className="py-10">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl md:text-3xl font-bold font-heading text-text-primary">
                {dashboardPage.clientName}
              </h1>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-accent bg-brand-accent/10 px-2.5 py-1 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent" />
                </span>
                Live
              </span>
            </div>
            <p className="text-sm text-text-secondary">
              Growth tier &middot; {dashboardPage.month}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-secondary border border-border-subtle rounded-xl bg-bg-surface hover:border-border-emphasis transition-colors"
            >
              {dashboardPage.month}
              <CaretDown size={14} />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-text-primary bg-brand-primary rounded-xl hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent transition-all duration-200"
            >
              <DownloadSimple size={16} />
              Download Report
            </button>
          </div>
        </div>

        {/* ── Key Metrics ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {metrics.map((m) => (
            <MetricCard key={m.label} {...m} />
          ))}
        </div>

        {/* ── Leads Chart + Platform Table ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <LeadChart />
          <PlatformTable />
        </div>

        {/* ── Top Posts ───────────────────────────────────────────── */}
        <div className="mb-10">
          <TopPosts />
        </div>

        {/* ── Activity Feed ───────────────────────────────────────── */}
        <div>
          <ActivityFeed />
        </div>
      </Container>
    </main>
  );
}
