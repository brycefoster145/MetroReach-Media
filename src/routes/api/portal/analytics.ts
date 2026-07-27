/**
 * GET /api/portal/analytics — Client-Facing Analytics Dashboard
 *
 * Returns KPI summary, daily trend data, top posts, platform breakdown,
 * and period-over-period comparison. All data scoped to authenticated client.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";

// ── Response types ──

interface KpiSummary {
  totalImpressions: number;
  totalReach: number;
  totalEngagement: number;
  totalClicks: number;
  totalLeads: number;
  totalConversions: number;
  adSpendCents: number;
  cplCents: number | null;
  roasBasisPoints: number | null;
}

interface DailySnapshot {
  snapshot_date: string;
  total_impressions: number;
  total_reach: number;
  total_engagement: number;
  total_clicks: number;
  total_leads: number;
  total_conversions: number;
}

interface TopPost {
  post_id: string;
  platform: string;
  content_preview: string;
  impressions: number;
  engagement: number;
  clicks: number;
}

interface PlatformBreakdown {
  platform: string;
  impressions: number;
  engagement: number;
}

interface PeriodMetrics {
  impressions: number;
  engagement: number;
  leads: number;
  conversions: number;
}

interface PeriodChanges {
  impressions: number | null;
  engagement: number | null;
  leads: number | null;
  conversions: number | null;
}

interface AnalyticsResponse {
  kpiSummary: KpiSummary;
  dailySnapshots: DailySnapshot[];
  topPosts: TopPost[];
  platformBreakdown: PlatformBreakdown[];
  periodComparison: {
    current: PeriodMetrics;
    previous: PeriodMetrics;
    changes: PeriodChanges;
  };
}

// ── Helpers ──

function safeInt(val: unknown): number {
  return Number(val) || 0;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : null; // null = "can't calculate" — infinite increase
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ── Route ──

export const Route = createFileRoute("/api/portal/analytics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const client = getClientFromRequest(request);
        if (!client) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        const clientId = client.sub;

        try {
          // ── 1. KPI Summary: aggregate last 30 days ──
          const kpiRows = await sql`
            SELECT
              COALESCE(SUM(total_impressions), 0)::int AS total_impressions,
              COALESCE(SUM(total_reach), 0)::int AS total_reach,
              COALESCE(SUM(total_engagement), 0)::int AS total_engagement,
              COALESCE(SUM(total_clicks), 0)::int AS total_clicks,
              COALESCE(SUM(total_leads), 0)::int AS total_leads,
              COALESCE(SUM(total_conversions), 0)::int AS total_conversions,
              COALESCE(SUM(ad_spend_cents), 0)::int AS ad_spend_cents
            FROM daily_kpi_snapshot
            WHERE client_id = ${clientId}
              AND snapshot_date >= CURRENT_DATE - INTERVAL '29 days'
          `.catch(() => []);

          const kpiSummary: KpiSummary = {
            totalImpressions: safeInt(kpiRows[0]?.total_impressions),
            totalReach: safeInt(kpiRows[0]?.total_reach),
            totalEngagement: safeInt(kpiRows[0]?.total_engagement),
            totalClicks: safeInt(kpiRows[0]?.total_clicks),
            totalLeads: safeInt(kpiRows[0]?.total_leads),
            totalConversions: safeInt(kpiRows[0]?.total_conversions),
            adSpendCents: safeInt(kpiRows[0]?.ad_spend_cents),
            cplCents: null,
            roasBasisPoints: null,
          };

          // Compute CPL and ROAS from aggregate (more accurate than summing stored values)
          if (kpiSummary.adSpendCents > 0 && kpiSummary.totalLeads > 0) {
            kpiSummary.cplCents = Math.round(kpiSummary.adSpendCents / kpiSummary.totalLeads);
          }

          // For ROAS, get conversion value from conversion_events for period
          let conversionValueCents = 0;
          try {
            const convValRows = await sql`
              SELECT COALESCE(SUM(conversion_value_cents), 0)::int AS val
              FROM conversion_events
              WHERE client_id = ${clientId}
                AND attributed_at >= CURRENT_DATE - INTERVAL '29 days'
            `;
            conversionValueCents = safeInt(convValRows[0]?.val);
          } catch { /* conversion_events may not exist */ }

          if (kpiSummary.adSpendCents > 0 && conversionValueCents > 0) {
            kpiSummary.roasBasisPoints = Math.round((conversionValueCents / kpiSummary.adSpendCents) * 10000);
          }

          // ── 2. Daily Snapshots: last 30 days ──
          const dailyRows = await sql`
            SELECT
              snapshot_date,
              total_impressions,
              total_reach,
              total_engagement,
              total_clicks,
              total_leads,
              total_conversions
            FROM daily_kpi_snapshot
            WHERE client_id = ${clientId}
              AND snapshot_date >= CURRENT_DATE - INTERVAL '29 days'
            ORDER BY snapshot_date ASC
          `.catch(() => []);

          const dailySnapshots: DailySnapshot[] = (dailyRows as any[]).map((r) => ({
            snapshot_date: fmtDate(new Date(r.snapshot_date)),
            total_impressions: safeInt(r.total_impressions),
            total_reach: safeInt(r.total_reach),
            total_engagement: safeInt(r.total_engagement),
            total_clicks: safeInt(r.total_clicks),
            total_leads: safeInt(r.total_leads),
            total_conversions: safeInt(r.total_conversions),
          }));

          // ── 3. Top Posts: aggregate engagement last 30 days ──
          const topRows = await sql`
            SELECT
              pp.post_id,
              pp.platform,
              COALESCE(sp.content, '') AS content_preview,
              SUM(pp.impressions)::int AS impressions,
              SUM(pp.engagement)::int AS engagement,
              SUM(pp.clicks)::int AS clicks
            FROM post_performance pp
            LEFT JOIN scheduled_posts sp
              ON sp.meta_post_id = pp.post_id
                 AND sp.client_id = pp.client_id
            WHERE pp.client_id = ${clientId}
              AND pp.fetched_at >= CURRENT_DATE - INTERVAL '29 days'
            GROUP BY pp.post_id, pp.platform, sp.content
            ORDER BY SUM(pp.engagement) DESC
            LIMIT 10
          `.catch(() => []);

          const topPosts: TopPost[] = (topRows as any[]).map((r) => ({
            post_id: String(r.post_id || ""),
            platform: String(r.platform || ""),
            content_preview: String(r.content_preview || ""),
            impressions: safeInt(r.impressions),
            engagement: safeInt(r.engagement),
            clicks: safeInt(r.clicks),
          }));

          // ── 4. Platform Breakdown: aggregate last 30 days ──
          const platformRows = await sql`
            SELECT
              platform,
              SUM(impressions)::int AS impressions,
              SUM(engagement)::int AS engagement
            FROM post_performance
            WHERE client_id = ${clientId}
              AND fetched_at >= CURRENT_DATE - INTERVAL '29 days'
            GROUP BY platform
            ORDER BY SUM(engagement) DESC
          `.catch(() => []);

          const platformBreakdown: PlatformBreakdown[] = (platformRows as any[]).map((r) => ({
            platform: String(r.platform || ""),
            impressions: safeInt(r.impressions),
            engagement: safeInt(r.engagement),
          }));

          // ── 5. Period Comparison: current 30d vs previous 30d ──
          const periodRows = await sql`
            SELECT
              CASE
                WHEN snapshot_date >= CURRENT_DATE - INTERVAL '29 days' THEN 'current'
                WHEN snapshot_date >= CURRENT_DATE - INTERVAL '59 days'
                 AND snapshot_date < CURRENT_DATE - INTERVAL '29 days' THEN 'previous'
                ELSE 'older'
              END AS period,
              COALESCE(SUM(total_impressions), 0)::int AS impressions,
              COALESCE(SUM(total_engagement), 0)::int AS engagement,
              COALESCE(SUM(total_leads), 0)::int AS leads,
              COALESCE(SUM(total_conversions), 0)::int AS conversions
            FROM daily_kpi_snapshot
            WHERE client_id = ${clientId}
              AND snapshot_date >= CURRENT_DATE - INTERVAL '59 days'
              AND snapshot_date < CURRENT_DATE
            GROUP BY period
          `.catch(() => []);

          const current: PeriodMetrics = { impressions: 0, engagement: 0, leads: 0, conversions: 0 };
          const previous: PeriodMetrics = { impressions: 0, engagement: 0, leads: 0, conversions: 0 };

          for (const r of periodRows as any[]) {
            const metrics = {
              impressions: safeInt(r.impressions),
              engagement: safeInt(r.engagement),
              leads: safeInt(r.leads),
              conversions: safeInt(r.conversions),
            };
            if (r.period === "current") {
              current.impressions = metrics.impressions;
              current.engagement = metrics.engagement;
              current.leads = metrics.leads;
              current.conversions = metrics.conversions;
            } else if (r.period === "previous") {
              previous.impressions = metrics.impressions;
              previous.engagement = metrics.engagement;
              previous.leads = metrics.leads;
              previous.conversions = metrics.conversions;
            }
          }

          const changes: PeriodChanges = {
            impressions: percentChange(current.impressions, previous.impressions),
            engagement: percentChange(current.engagement, previous.engagement),
            leads: percentChange(current.leads, previous.leads),
            conversions: percentChange(current.conversions, previous.conversions),
          };

          const response: AnalyticsResponse = {
            kpiSummary,
            dailySnapshots,
            topPosts,
            platformBreakdown,
            periodComparison: {
              current,
              previous,
              changes,
            },
          };

          return new Response(
            JSON.stringify(response),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: any) {
          console.error("Portal analytics error:", err.message);
          return new Response(
            JSON.stringify({ error: "Failed to load analytics" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
