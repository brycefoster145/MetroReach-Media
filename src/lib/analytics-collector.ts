/**
 * Analytics Data Collection Pipeline — MetroReach Media
 *
 * Pulls real performance data from the Meta Graph API for published posts
 * and aggregates into daily KPI snapshots. Designed to be called by the
 * Vercel cron endpoint at /api/cron/collect-analytics.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { sql } from "~/lib/db";

// ══════════════════════════════════════════════════════════════════
// Config
// ══════════════════════════════════════════════════════════════════

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

/** Posts newer than this are skipped — Meta needs ~24h for insights. */
const MIN_POST_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Max number of posts to process in a single run (prevents runaway). */
const MAX_POSTS_PER_RUN = 200;

/** Delay between Meta API calls to respect rate limits. */
const RATE_LIMIT_DELAY_MS = 500;

// ══════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════

export interface CollectResult {
  clients_processed: number;
  posts_checked: number;
  posts_updated: number;
  posts_skipped: number;
  snapshots_created: number;
  errors: string[];
}

interface MetaInsightsResponse {
  data?: Array<{
    name: string;
    period: string;
    values: Array<{ value: number }>;
    title: string;
    description: string;
  }>;
  error?: {
    message: string;
    type?: string;
    code?: number;
  };
}

interface ScheduledPost {
  id: string;
  client_id: string;
  platform: string;
  page_id: string;
  meta_post_id: string;
  posted_at: string;
}

// ══════════════════════════════════════════════════════════════════
// Meta Graph API helpers
// ══════════════════════════════════════════════════════════════════

function getMetaToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error("META_ACCESS_TOKEN is not set — cannot fetch Meta insights");
  }
  return token;
}

/**
 * Fetch post-level insights from the Meta Graph API.
 * Returns metric values keyed by metric name.
 */
async function fetchPostInsights(
  postId: string,
): Promise<Record<string, number>> {
  const token = getMetaToken();
  const metrics = "post_impressions,post_impressions_unique,post_engaged_users,post_clicks";

  const url = new URL(`${GRAPH_API_BASE}/${postId}/insights`);
  url.searchParams.set("metric", metrics);
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  const json = (await res.json()) as MetaInsightsResponse;

  if (json.error) {
    throw new Error(
      `Meta API error for post ${postId}: ${json.error.message} (code ${json.error.code})`,
    );
  }

  const result: Record<string, number> = {};
  if (json.data) {
    for (const metric of json.data) {
      if (metric.values && metric.values.length > 0) {
        result[metric.name] = metric.values[0].value;
      }
    }
  }

  return result;
}

// ══════════════════════════════════════════════════════════════════
// Core collection logic
// ══════════════════════════════════════════════════════════════════

/**
 * Fetch insights for a single post and store in post_performance.
 * Returns true if new data was stored, false if skipped (already cached today).
 */
async function collectPostInsights(
  post: ScheduledPost,
  result: CollectResult,
): Promise<boolean> {
  // Check if we already have a snapshot for today (belt-and-suspenders —
  // the UNIQUE index also enforces this, but early check avoids API calls)
  try {
    const existing = await sql`
      SELECT id FROM post_performance
      WHERE post_id = ${post.meta_post_id}
        AND fetched_at::date = CURRENT_DATE
      LIMIT 1
    `;
    if (existing.length > 0) {
      result.posts_skipped++;
      return false;
    }
  } catch {
    // Table might not exist yet — continue
  }

  // Fetch from Meta
  let metrics: Record<string, number>;
  try {
    metrics = await fetchPostInsights(post.meta_post_id);
    // Respect rate limits between calls
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
  } catch (err: any) {
    result.errors.push(
      `Post ${post.id} (Meta: ${post.meta_post_id}): ${err.message}`,
    );
    return false;
  }

  const impressions = Math.round(metrics.post_impressions ?? 0);
  const reach = Math.round(metrics.post_impressions_unique ?? 0);
  const engagement = Math.round(metrics.post_engaged_users ?? 0);
  const clicks = Math.round(metrics.post_clicks ?? 0);

  // Store in post_performance
  try {
    await sql`
      INSERT INTO post_performance
        (client_id, platform, post_id, posted_at, impressions, reach, engagement, clicks, fetched_at)
      VALUES
        (${post.client_id}, ${post.platform}, ${post.meta_post_id},
         ${post.posted_at ? new Date(post.posted_at).toISOString() : null}::timestamptz,
         ${impressions}, ${reach}, ${engagement}, ${clicks}, NOW())
      ON CONFLICT (post_id, (fetched_at::date)) DO UPDATE
      SET impressions = EXCLUDED.impressions,
          reach = EXCLUDED.reach,
          engagement = EXCLUDED.engagement,
          clicks = EXCLUDED.clicks
    `;
    result.posts_updated++;
    return true;
  } catch (err: any) {
    result.errors.push(
      `Failed to store post_performance for ${post.meta_post_id}: ${err.message}`,
    );
    return false;
  }
}

/**
 * Compute and store daily KPI snapshot for a single client.
 * Aggregates today's post_performance data + lead/conversion data.
 */
async function computeDailySnapshot(
  clientId: string,
  result: CollectResult,
): Promise<void> {
  // Check if snapshot already exists for today
  const existing = await sql`
    SELECT id FROM daily_kpi_snapshot
    WHERE client_id = ${clientId}
      AND snapshot_date = CURRENT_DATE
    LIMIT 1
  `;
  if (existing.length > 0) {
    // Already computed today — skip
    return;
  }

  // ── Aggregate post performance for today ──
  let totalImpressions = 0;
  let totalReach = 0;
  let totalEngagement = 0;
  let totalClicks = 0;

  try {
    const aggRows = await sql`
      SELECT
        COALESCE(SUM(impressions), 0) AS sum_impressions,
        COALESCE(SUM(reach), 0) AS sum_reach,
        COALESCE(SUM(engagement), 0) AS sum_engagement,
        COALESCE(SUM(clicks), 0) AS sum_clicks
      FROM post_performance
      WHERE client_id = ${clientId}
        AND fetched_at::date = CURRENT_DATE
    `;
    if (aggRows.length > 0) {
      const r = aggRows[0];
      totalImpressions = Number(r.sum_impressions) || 0;
      totalReach = Number(r.sum_reach) || 0;
      totalEngagement = Number(r.sum_engagement) || 0;
      totalClicks = Number(r.sum_clicks) || 0;
    }
  } catch (err: any) {
    // post_performance may be empty — that's fine, use zeros
  }

  // ── Count today's leads ──
  let totalLeads = 0;
  try {
    const leadRows = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM client_leads
      WHERE client_id = ${clientId}
        AND created_at::date = CURRENT_DATE
    `;
    if (leadRows.length > 0) {
      totalLeads = Number(leadRows[0].cnt) || 0;
    }
  } catch {
    // client_leads may not have data yet
  }

  // ── Sum today's conversions ──
  let totalConversions = 0;
  let conversionValueCents = 0;
  try {
    const convRows = await sql`
      SELECT
        COUNT(*)::int AS cnt,
        COALESCE(SUM(conversion_value_cents), 0) AS total_value
      FROM conversion_events
      WHERE client_id = ${clientId}
        AND attributed_at::date = CURRENT_DATE
    `;
    if (convRows.length > 0) {
      totalConversions = Number(convRows[0].cnt) || 0;
      conversionValueCents = Number(convRows[0].total_value) || 0;
    }
  } catch {
    // conversion_events may not have data yet
  }

  // ── Get ad spend for today ──
  // For now, ad spend is pulled from conversion_events (commission_cents)
  // or from a future Meta Ads API insight collector. Default to 0.
  let adSpendCents = 0;
  try {
    const spendRows = await sql`
      SELECT COALESCE(SUM(commission_cents), 0) AS total_spend
      FROM conversion_events
      WHERE client_id = ${clientId}
        AND attributed_at::date = CURRENT_DATE
        AND source_type = 'ad'
    `;
    if (spendRows.length > 0) {
      adSpendCents = Number(spendRows[0].total_spend) || 0;
    }
  } catch {
    // No ad spend data yet
  }

  // ── Compute derived KPIs ──
  // CPL: total_spend / total_leads (cents, stored as INTEGER)
  let cplCents: number | null = null;
  if (adSpendCents > 0 && totalLeads > 0) {
    cplCents = Math.round(adSpendCents / totalLeads);
  }

  // ROAS: conversion_value / spend, stored in basis points (× 10,000)
  // e.g., 3.5x ROAS = 35000 basis points
  let roasBasisPoints: number | null = null;
  if (adSpendCents > 0 && conversionValueCents > 0) {
    roasBasisPoints = Math.round((conversionValueCents / adSpendCents) * 10000);
  }

  // ── Insert snapshot ──
  try {
    await sql`
      INSERT INTO daily_kpi_snapshot
        (client_id, snapshot_date, total_impressions, total_reach,
         total_engagement, total_clicks, total_leads, total_conversions,
         ad_spend_cents, cpl_cents, roas_basis_points)
      VALUES
        (${clientId}, CURRENT_DATE,
         ${totalImpressions}, ${totalReach}, ${totalEngagement}, ${totalClicks},
         ${totalLeads}, ${totalConversions},
         ${adSpendCents}, ${cplCents ?? null}, ${roasBasisPoints ?? null})
    `;
    result.snapshots_created++;
  } catch (err: any) {
    result.errors.push(
      `Failed to store daily_kpi_snapshot for ${clientId}: ${err.message}`,
    );
  }
}

// ══════════════════════════════════════════════════════════════════
// Main export
// ══════════════════════════════════════════════════════════════════

/**
 * Collect analytics data from Meta Graph API and compute daily KPI snapshots.
 *
 * @param clientId - Optional. If provided, only collect for this client.
 *                   If omitted, collects for all active clients.
 * @returns Summary of what was processed.
 */
export async function collectAnalytics(
  clientId?: string,
): Promise<CollectResult> {
  const result: CollectResult = {
    clients_processed: 0,
    posts_checked: 0,
    posts_updated: 0,
    posts_skipped: 0,
    snapshots_created: 0,
    errors: [],
  };

  // ── Verify META_ACCESS_TOKEN is set ──
  if (!process.env.META_ACCESS_TOKEN) {
    throw new Error(
      "META_ACCESS_TOKEN is not set. Analytics collection requires a valid Meta access token.",
    );
  }

  // ── Determine which clients to process ──
  let clientIds: string[];

  if (clientId) {
    clientIds = [clientId];
  } else {
    // Fetch all active clients
    try {
      const rows = await sql`
        SELECT id FROM clients WHERE status = 'active' ORDER BY id
      `;
      clientIds = rows.map((r: any) => r.id as string);
    } catch (err: any) {
      result.errors.push(`Failed to fetch active clients: ${err.message}`);
      return result;
    }
  }

  if (clientIds.length === 0) {
    return result; // No active clients — nothing to do
  }

  // ── For each client, collect post insights ──
  const cutoffTime = new Date(Date.now() - MIN_POST_AGE_MS).toISOString();

  for (const cid of clientIds) {
    result.clients_processed++;

    // Fetch posted Meta-platform posts for this client
    let posts: ScheduledPost[] = [];
    try {
      const rows = await sql`
        SELECT id, client_id, platform, page_id, meta_post_id, posted_at
        FROM scheduled_posts
        WHERE client_id = ${cid}
          AND platform IN ('facebook', 'instagram')
          AND status = 'posted'
          AND meta_post_id IS NOT NULL
          AND posted_at IS NOT NULL
          AND posted_at < ${cutoffTime}::timestamptz
        ORDER BY posted_at DESC
        LIMIT ${MAX_POSTS_PER_RUN}
      `;
      posts = rows.map((r: any) => ({
        id: r.id as string,
        client_id: r.client_id as string,
        platform: r.platform as string,
        page_id: r.page_id as string,
        meta_post_id: r.meta_post_id as string,
        posted_at: r.posted_at as string,
      }));
    } catch (err: any) {
      result.errors.push(
        `Failed to fetch posts for client ${cid}: ${err.message}`,
      );
      continue; // Skip to next client
    }

    result.posts_checked += posts.length;

    if (posts.length === 0) {
      // No posts to collect insights for — still compute snapshot
      // (may have leads/conversions without post data)
      await computeDailySnapshot(cid, result);
      continue;
    }

    // Collect insights for each post
    for (const post of posts) {
      await collectPostInsights(post, result);
    }

    // Compute the daily snapshot for this client
    await computeDailySnapshot(cid, result);
  }

  return result;
}
