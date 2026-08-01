/**
 * Watchdog Monitoring System — MetroReach Media
 *
 * Continuous monitoring to prevent posting failures. Detects:
 * - Cron health issues (stale scheduler)
 * - Zero-posts-published alerts (24h window)
 * - Meta token expiration / invalidation
 * - Stale publishing posts (stuck > 5 min)
 * - Empty upcoming post windows
 * - Business pause / token revocation
 *
 * Designed to be called from:
 * - Hourly external cron (cron-job.org) → runs all checks
 * - Pre-window cron (10 min before IG slots) → runs window-specific checks
 * - GET /api/watchdog/status → on-demand health report
 */

import { sql } from "./db";
import { publishPost } from "./meta-poster";
import { publishToX } from "./x-poster";
import { publishToLinkedIn } from "./linkedin-poster";

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const META_TOKEN = process.env.META_ACCESS_TOKEN ?? "";
const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

/** Max seconds since last cron run before considered stale */
const CRON_STALE_THRESHOLD_S = 90;

/** Posts in 'publishing' status longer than this (seconds) are reset to 'pending' */
const PUBLISHING_STALE_THRESHOLD_S = 300; // 5 minutes

/** Instagram posting windows in EST (used for pre-window checks) */
const IG_WINDOWS_EST = [
  { hour: 13, label: "1pm EST" },
  { hour: 17, label: "5pm EST" },
  { hour: 21, label: "9pm EST" },
];

/** Pre-window: how many minutes before the hour to run pre-check */
const PRE_WINDOW_MINUTES = 10;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface WatchdogAlert {
  type: string;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: string;
}

export interface WatchdogCheckResult {
  name: string;
  ok: boolean;
  details: Record<string, unknown>;
  alerts: WatchdogAlert[];
}

export interface WatchdogStatusReport {
  status: "healthy" | "degraded" | "critical";
  server_time_utc: string;
  server_time_est: string;
  alerts: WatchdogAlert[];
  checks: Record<string, WatchdogCheckResult>;
  missed_slots: MissedSlotsCheckResult | null;
  last_post_published_utc: string | null;
  posts_published_24h: number;
  posts_failed_24h: number;
  upcoming_posts_2h: number;
  token_valid: boolean;
  business_paused: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// EASTERN TIME HELPERS
// ═══════════════════════════════════════════════════════════════════

function getEasternInfo(now: Date): {
  hour: number;
  minute: number;
  day: number;
  dateStr: string;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(now);
  const vals: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") vals[p.type] = p.value;
  }

  return {
    hour: parseInt(vals.hour),
    minute: parseInt(vals.minute),
    day: new Date(`${vals.year}-${vals.month}-${vals.day}T12:00:00`).getDay(),
    dateStr: `${vals.year}-${vals.month}-${vals.day}`,
  };
}

/**
 * Returns true if we are currently within 10 minutes before an Instagram
 * posting window. The window check is: hour matches an IG window hour,
 * and minute is between (60 - PRE_WINDOW_MINUTES) and 0 (exclusive).
 * So at 12:50-12:59 EST, we're in the 1pm pre-window.
 */
function getPreWindowStatus(now: Date): {
  inPreWindow: boolean;
  upcomingWindow: string | null;
} {
  const est = getEasternInfo(now);
  const minuteInHour = est.minute;
  const nextHour = est.hour + 1;

  // Check if next hour is an IG window and we're in the pre-window range
  for (const w of IG_WINDOWS_EST) {
    if (w.hour === nextHour) {
      // We're in pre-window if minute is between (60 - PRE_WINDOW_MINUTES) and 59
      if (minuteInHour >= 60 - PRE_WINDOW_MINUTES && minuteInHour <= 59) {
        return { inPreWindow: true, upcomingWindow: w.label };
      }
    }
  }

  // Also check 0-minute edge case: if nextHour wraps to midnight (e.g. 9pm → no next window)
  // and check if we're at minute 50-59 before an immediate window match
  for (const w of IG_WINDOWS_EST) {
    if (w.hour === est.hour && minuteInHour >= 60 - PRE_WINDOW_MINUTES) {
      return { inPreWindow: true, upcomingWindow: w.label };
    }
  }

  return { inPreWindow: false, upcomingWindow: null };
}

// ═══════════════════════════════════════════════════════════════════
// 1. CRON HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════

export async function checkCronHealth(): Promise<WatchdogCheckResult> {
  const alerts: WatchdogAlert[] = [];
  const now = new Date();

  try {
    const rows = await sql`
      SELECT run_at, posts_found, posts_succeeded, posts_failed
      FROM cron_runs
      ORDER BY run_at DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      alerts.push({
        type: "cron_never_run",
        severity: "critical",
        message: "CRITICAL: Cron has never run — zero records in cron_runs table. Posts will not publish.",
        timestamp: now.toISOString(),
      });
      return { name: "cron_health", ok: false, details: { last_run: null }, alerts };
    }

    const lastRun = rows[0].run_at as Date;
    const secondsAgo = Math.round((now.getTime() - lastRun.getTime()) / 1000);
    const stale = secondsAgo > CRON_STALE_THRESHOLD_S;

    if (stale) {
      alerts.push({
        type: "cron_stale",
        severity: secondsAgo > 300 ? "critical" : "warning",
        message: `Cron is stale — last run ${secondsAgo}s ago (threshold: ${CRON_STALE_THRESHOLD_S}s). Posts may be delayed.`,
        timestamp: now.toISOString(),
      });
    }

    return {
      name: "cron_health",
      ok: !stale,
      details: {
        last_run_utc: lastRun.toISOString(),
        seconds_ago: secondsAgo,
        threshold_s: CRON_STALE_THRESHOLD_S,
        posts_succeeded_last_run: Number(rows[0].posts_succeeded ?? 0),
        posts_failed_last_run: Number(rows[0].posts_failed ?? 0),
      },
      alerts,
    };
  } catch (err: any) {
    alerts.push({
      type: "cron_health_error",
      severity: "critical",
      message: `Failed to check cron health: ${err.message}`,
      timestamp: now.toISOString(),
    });
    return { name: "cron_health", ok: false, details: { error: err.message }, alerts };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. POST SUCCESS CHECK (24h window)
// ═══════════════════════════════════════════════════════════════════

export async function checkPostSuccess(): Promise<WatchdogCheckResult> {
  const alerts: WatchdogAlert[] = [];
  const now = new Date();

  try {
    // Count posts succeeded in last 24 hours
    const successRows = await sql`
      SELECT COALESCE(SUM(posts_succeeded), 0) as total_succeeded,
             COALESCE(SUM(posts_failed), 0) as total_failed
      FROM cron_runs
      WHERE run_at >= NOW() - INTERVAL '24 hours'
    `;

    const totalSucceeded = Number(successRows[0]?.total_succeeded ?? 0);
    const totalFailed = Number(successRows[0]?.total_failed ?? 0);

    // Also check posted status directly from scheduled_posts
    const postedRows = await sql`
      SELECT id, platform, posted_at
      FROM scheduled_posts
      WHERE status = 'posted'
        AND posted_at >= NOW() - INTERVAL '24 hours'
      ORDER BY posted_at DESC
    `;

    const postedCount = postedRows.length;
    const lastPosted = postedRows[0] ?? null;

    // Determine alert severity
    let ok = true;
    if (postedCount === 0 && totalSucceeded === 0) {
      ok = false;
      alerts.push({
        type: "no_posts_24h",
        severity: "critical",
        message: "CRITICAL: Zero posts published in the last 24 hours. Posting pipeline is down or no content is scheduled.",
        timestamp: now.toISOString(),
      });
    } else if (postedCount === 0 && totalSucceeded > 0) {
      // cron_runs says posts succeeded but scheduled_posts doesn't show posted — DB inconsistency
      alerts.push({
        type: "db_inconsistency",
        severity: "warning",
        message: `WARNING: cron_runs reports ${totalSucceeded} succeeded in 24h but scheduled_posts shows 0 posted. Possible DB inconsistency.`,
        timestamp: now.toISOString(),
      });
    }

    return {
      name: "post_success_24h",
      ok,
      details: {
        posts_succeeded_24h: postedCount,
        cron_reported_succeeded_24h: totalSucceeded,
        cron_reported_failed_24h: totalFailed,
        last_post_published_utc: lastPosted ? String(lastPosted.posted_at) : null,
        last_post_platform: lastPosted ? lastPosted.platform : null,
      },
      alerts,
    };
  } catch (err: any) {
    alerts.push({
      type: "post_success_check_error",
      severity: "critical",
      message: `Failed to check post success: ${err.message}`,
      timestamp: now.toISOString(),
    });
    return { name: "post_success_24h", ok: false, details: { error: err.message }, alerts };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. META TOKEN VALIDATION
// ═══════════════════════════════════════════════════════════════════

async function validateMetaToken(): Promise<WatchdogCheckResult> {
  const alerts: WatchdogAlert[] = [];
  const now = new Date();
  let tokenValid = false;
  let pagesCount = 0;
  let errorDetail: string | null = null;

  try {
    if (!META_TOKEN) {
      errorDetail = "META_ACCESS_TOKEN environment variable is not set";
    } else {
      const url = new URL(`${GRAPH_API_BASE}/me/accounts`);
      url.searchParams.set("access_token", META_TOKEN);
      url.searchParams.set("fields", "id,name,category");

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

      const json = await res.json();

      if ((json as any).error) {
        const err = (json as any).error;
        errorDetail = `Meta API error: ${err.message} (code ${err.code}, subcode ${err.error_subcode ?? "N/A"})`;
        // Check for token expiration
        if (err.code === 190 || err.error_subcode === 463) {
          tokenValid = false;
        }
      } else {
        tokenValid = true;
        pagesCount = (json as any).data?.length ?? 0;
      }
    }
  } catch (err: any) {
    errorDetail = `Network error validating token: ${err.message}`;
  }

  if (!tokenValid) {
    const severity = errorDetail?.includes("expired") || errorDetail?.includes("190")
      ? "critical"
      : "critical";
    alerts.push({
      type: "meta_token_invalid",
      severity,
      message: `CRITICAL: Meta access token is invalid or expired. ${errorDetail ?? "No token configured."} Instagram and Facebook posts cannot publish.`,
      timestamp: now.toISOString(),
    });
  } else if (pagesCount === 0) {
    alerts.push({
      type: "meta_no_pages",
      severity: "warning",
      message: "WARNING: Meta token is valid but returns zero pages. Possible permission change or token scope issue.",
      timestamp: now.toISOString(),
    });
  }

  return {
    name: "meta_token",
    ok: tokenValid && pagesCount > 0,
    details: {
      token_valid: tokenValid,
      pages_count: pagesCount,
      error: errorDetail,
    },
    alerts,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 4. STALE PUBLISHING POST DETECTION + AUTO-RESET
// ═══════════════════════════════════════════════════════════════════

async function detectStalePublishing(): Promise<WatchdogCheckResult> {
  const alerts: WatchdogAlert[] = [];
  const now = new Date();
  let resetCount = 0;

  try {
    // Find posts stuck in 'publishing' status for > 5 minutes
    const staleRows = await sql`
      SELECT id, platform, client_id
      FROM scheduled_posts
      WHERE status = 'publishing'
        AND posted_at IS NOT NULL
        AND posted_at < NOW() - INTERVAL '300 seconds'
    `;

    if (staleRows.length > 0) {
      // Auto-reset each stale post back to 'pending'
      for (const row of staleRows) {
        await sql`
          UPDATE scheduled_posts
          SET status = 'pending', posted_at = NULL
          WHERE id = ${row.id}
        `;
        resetCount++;
        console.log(`[watchdog] 🔄 Reset stale publishing post ${row.id} (${row.platform}) → pending`);
      }

      alerts.push({
        type: "stale_publishing_reset",
        severity: "warning",
        message: `WARNING: ${resetCount} post(s) were stuck in 'publishing' status > ${PUBLISHING_STALE_THRESHOLD_S / 60} min and have been auto-reset to 'pending' for retry.`,
        timestamp: now.toISOString(),
      });
    }

    // Also check for any posts currently in 'publishing' (even if not yet stale)
    const publishingCount = await sql`
      SELECT COUNT(*) as cnt FROM scheduled_posts WHERE status = 'publishing'
    `;
    const currentPublishing = Number(publishingCount[0]?.cnt ?? 0);

    if (currentPublishing > 0 && resetCount === 0) {
      return {
        name: "stale_publishing",
        ok: true,
        details: {
          stale_reset: 0,
          currently_publishing: currentPublishing,
          message: `${currentPublishing} post(s) in publishing state — not yet stale`,
        },
        alerts: [],
      };
    }

    return {
      name: "stale_publishing",
      ok: resetCount === 0,
      details: {
        stale_reset: resetCount,
        currently_publishing: currentPublishing - resetCount,
        threshold_seconds: PUBLISHING_STALE_THRESHOLD_S,
      },
      alerts,
    };
  } catch (err: any) {
    alerts.push({
      type: "stale_publishing_error",
      severity: "warning",
      message: `Failed to check stale publishing posts: ${err.message}`,
      timestamp: now.toISOString(),
    });
    return { name: "stale_publishing", ok: false, details: { error: err.message }, alerts };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 5. UPCOMING POSTS CHECK (next 2 hours)
// ═══════════════════════════════════════════════════════════════════

async function checkUpcomingPosts(): Promise<WatchdogCheckResult> {
  const alerts: WatchdogAlert[] = [];
  const now = new Date();

  try {
    // Active platforms only
    const activePlatforms = ["facebook", "instagram", "x", "linkedin"];

    // Count pending posts due in next 2 hours
    const upcomingRows = await sql`
      SELECT platform, COUNT(*) as cnt
      FROM scheduled_posts
      WHERE status = 'pending'
        AND due_at >= NOW()
        AND due_at <= NOW() + INTERVAL '2 hours'
        AND platform = ANY(${activePlatforms})
      GROUP BY platform
    `;

    const totalUpcoming = upcomingRows.reduce(
      (sum: number, r: any) => sum + Number(r.cnt),
      0,
    );

    // Check specifically for Instagram upcoming posts
    const igUpcoming = upcomingRows.find((r: any) => r.platform === "instagram");
    const igCount = igUpcoming ? Number(igUpcoming.cnt) : 0;

    // Also check if we're in a pre-window for IG
    const preWindow = getPreWindowStatus(now);

    if (preWindow.inPreWindow && igCount === 0) {
      alerts.push({
        type: "ig_prewindow_empty",
        severity: "warning",
        message: `WARNING: Instagram pre-window check for ${preWindow.upcomingWindow} — NO Instagram posts scheduled in the next 2 hours. The upcoming window may be empty.`,
        timestamp: now.toISOString(),
      });
    }

    return {
      name: "upcoming_posts",
      ok: true, // informational — alerts generated but not a failure
      details: {
        total_upcoming_2h: totalUpcoming,
        platforms: Object.fromEntries(
          upcomingRows.map((r: any) => [r.platform, Number(r.cnt)]),
        ),
        instagram_upcoming: igCount,
        in_pre_window: preWindow.inPreWindow,
        upcoming_ig_window: preWindow.upcomingWindow,
      },
      alerts,
    };
  } catch (err: any) {
    alerts.push({
      type: "upcoming_posts_error",
      severity: "warning",
      message: `Failed to check upcoming posts: ${err.message}`,
      timestamp: now.toISOString(),
    });
    return { name: "upcoming_posts", ok: false, details: { error: err.message }, alerts };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 6. BUSINESS PAUSED CHECK
// ═══════════════════════════════════════════════════════════════════

async function checkBusinessPaused(): Promise<WatchdogCheckResult> {
  const alerts: WatchdogAlert[] = [];
  const now = new Date();
  let businessPaused = true;

  try {
    if (!META_TOKEN) {
      businessPaused = true;
    } else {
      const url = new URL(`${GRAPH_API_BASE}/me/accounts`);
      url.searchParams.set("access_token", META_TOKEN);
      url.searchParams.set("fields", "id,name");

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

      const json = await res.json();

      if ((json as any).error) {
        businessPaused = true;
      } else {
        const data = (json as any).data;
        businessPaused = !data || data.length === 0;
      }
    }

    if (businessPaused) {
      alerts.push({
        type: "business_paused",
        severity: "critical",
        message: "CRITICAL: Meta business appears paused or inaccessible. No pages returned from /me/accounts. Token may be revoked or permissions changed.",
        timestamp: now.toISOString(),
      });
    }

    return {
      name: "business_paused",
      ok: !businessPaused,
      details: { business_paused: businessPaused },
      alerts,
    };
  } catch (err: any) {
    alerts.push({
      type: "business_paused_check_error",
      severity: "critical",
      message: `Failed to check business status: ${err.message}`,
      timestamp: now.toISOString(),
    });
    return { name: "business_paused", ok: false, details: { error: err.message, business_paused: true }, alerts };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 7. MISSED SLOTS — AUTO-FAILOVER PUBLISH
// ═══════════════════════════════════════════════════════════════════

/** Active platforms that support direct API publishing */
const ACTIVE_PLATFORMS = ["facebook", "instagram", "x", "linkedin"];

/** How long after due_at before a pending post is considered missed */
const MISSED_SLOT_THRESHOLD_MINUTES = 10;

/** Max retries before giving up on auto-failover */
const MISSED_SLOT_MAX_RETRIES = 3;

interface MissedSlotResult {
  post_id: string;
  platform: string;
  outcome: "auto_published" | "failed" | "skipped";
  detail?: string;
}

interface MissedSlotsCheckResult {
  name: string;
  ok: boolean;
  details: {
    checked: number;
    auto_published: number;
    failed: number;
    skipped: number;
    results: MissedSlotResult[];
  };
  alerts: WatchdogAlert[];
}

/**
 * Auto-failover: publish any post that is 10+ minutes past due_at
 * and still stuck in 'pending' status. This catches posts the main
 * scheduler missed (e.g., cron gap, cold-start delay, DB blip).
 */
export async function checkMissedSlots(): Promise<MissedSlotsCheckResult> {
  // AUTO-PUBLISH DISABLED 2026-08-01 — all posts must go through manual review.
  // This watchdog was auto-publishing unchecked content to production Instagram.
  return {
    name: "missed_slots",
    ok: true,
    details: { checked: 0, auto_published: 0, failed: 0, skipped: 0, results: [] },
    alerts: [],
  };

  const alerts: WatchdogAlert[] = [];
  const results: MissedSlotResult[] = [];
  const now = new Date();
  let autoPublished = 0;
  let failed = 0;
  let skipped = 0;
  let rows: any[] = [];

  try {
    // Find posts 10+ min past due, still pending, not yet exhausted retries
    rows = await sql`
      SELECT id, platform, page_id, ig_user_id, client_id,
             content, media_urls, hashtags, retry_count
      FROM scheduled_posts
      WHERE status = 'pending'
        AND due_at < NOW() - INTERVAL '10 minutes'
        AND platform IN ('facebook', 'instagram', 'x', 'linkedin')
        AND retry_count < 3
      ORDER BY due_at ASC
      LIMIT 5
    `;

    if (rows.length === 0) {
      return {
        name: "missed_slots",
        ok: true,
        details: { checked: 0, auto_published: 0, failed: 0, skipped: 0, results: [] },
        alerts: [],
      };
    }

    console.log(`[watchdog] 🔍 checkMissedSlots: ${rows.length} missed post(s) found — attempting auto-failover`);

    for (const row of rows as any[]) {
      const postId = row.id as string;
      const platform = (row.platform as string).toLowerCase();
      const pageId = (row.page_id as string) || "";
      const igUserId = row.ig_user_id as string | undefined;
      const clientId = (row.client_id as string) || "metroreach";
      const content = row.content as string;
      const mediaUrls: string[] = Array.isArray(row.media_urls) ? (row.media_urls as string[]) : [];
      const hashtags = row.hashtags as string | undefined;
      const retryCount = (row.retry_count as number) || 0;
      const fullText = hashtags ? `${content}\n\n${hashtags}` : content;

      // ── Build publisher dispatch ──
      try {
        let postResult: { post_id: string };

        switch (platform) {
          case "facebook":
            postResult = await publishPost({
              platform: "facebook",
              pageId: pageId,
              text: fullText,
              mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
            });
            break;
          case "instagram":
            // Instagram requires media — skip if none
            if (mediaUrls.length === 0) {
              console.warn(`[watchdog] ⏭️ Skipping Instagram post ${postId} — no media_urls`);
              skipped++;
              results.push({ post_id: postId, platform, outcome: "skipped", detail: "No media_urls" });
              continue;
            }
            if (!igUserId) {
              console.warn(`[watchdog] ⏭️ Skipping Instagram post ${postId} — no ig_user_id`);
              skipped++;
              results.push({ post_id: postId, platform, outcome: "skipped", detail: "No ig_user_id" });
              continue;
            }
            postResult = await publishPost({
              platform: "instagram",
              pageId: pageId,
              igUserId: igUserId,
              text: fullText,
              mediaUrls: mediaUrls,
            });
            break;
          case "x":
            postResult = await publishToX(clientId, pageId, fullText);
            break;
          case "linkedin":
            postResult = await publishToLinkedIn(clientId, fullText);
            break;
          default:
            skipped++;
            results.push({ post_id: postId, platform, outcome: "skipped", detail: `Unsupported platform: ${platform}` });
            continue;
        }

        // ── Success: update status to posted ──
        await sql`
          UPDATE scheduled_posts
          SET status = 'posted', meta_post_id = ${postResult.post_id}, posted_at = NOW(), retry_count = 0
          WHERE id = ${postId}
        `;
        autoPublished++;
        results.push({ post_id: postId, platform, outcome: "auto_published", detail: postResult.post_id });
        console.log(`[watchdog] ✅ Auto-published ${platform} post ${postId} → ${postResult.post_id}`);

        // Log to watchdog_alerts
        await sql`
          INSERT INTO watchdog_alerts (alert_type, severity, message, checks_data)
          VALUES ('missed_slot_auto_published', 'info', ${`Auto-published missed ${platform} post ${postId} (${MISSED_SLOT_THRESHOLD_MINUTES}min past due)`}, ${JSON.stringify({ post_id: postId, platform, meta_post_id: postResult.post_id })})
        `.catch(() => {});

      } catch (err: any) {
        const newRetryCount = retryCount + 1;
        console.error(`[watchdog] ❌ Auto-publish failed for ${platform} post ${postId}: ${err.message}`);

        if (newRetryCount >= MISSED_SLOT_MAX_RETRIES) {
          // Exhausted retries — mark as failed
          await sql`
            UPDATE scheduled_posts
            SET status = 'failed', error_message = ${err.message || String(err)}, retry_count = ${newRetryCount}
            WHERE id = ${postId}
          `;
          failed++;
          results.push({ post_id: postId, platform, outcome: "failed", detail: err.message });

          alerts.push({
            type: "missed_slot_failed_permanent",
            severity: "critical",
            message: `CRITICAL: Missed post ${postId} (${platform}) failed auto-failover after ${newRetryCount} attempts: ${err.message}`,
            timestamp: now.toISOString(),
          });
        } else {
          // Increment retry count but leave pending for another attempt
          await sql`
            UPDATE scheduled_posts
            SET retry_count = ${newRetryCount}, error_message = ${err.message || String(err)}
            WHERE id = ${postId}
          `;
          console.log(`[watchdog] 🔄 Post ${postId} retry ${newRetryCount}/${MISSED_SLOT_MAX_RETRIES} — leaving pending`);

          alerts.push({
            type: "missed_slot_retry",
            severity: "warning",
            message: `WARNING: Missed post ${postId} (${platform}) auto-failover attempt ${newRetryCount}/${MISSED_SLOT_MAX_RETRIES} failed: ${err.message}`,
            timestamp: now.toISOString(),
          });
        }

        // Log to watchdog_alerts
        await sql`
          INSERT INTO watchdog_alerts (alert_type, severity, message, checks_data)
          VALUES ('missed_slot_publish_failed', ${newRetryCount >= MISSED_SLOT_MAX_RETRIES ? 'critical' : 'warning'}, ${`Auto-failover failed for ${platform} post ${postId}: ${err.message}`}, ${JSON.stringify({ post_id: postId, platform, retry_count: newRetryCount, error: err.message })})
        `.catch(() => {});
      }
    }
  } catch (err: any) {
    console.error(`[watchdog] ❌ checkMissedSlots query/loop error: ${err.message}`);
    alerts.push({
      type: "missed_slots_check_error",
      severity: "warning",
      message: `Failed to run missed-slots check: ${err.message}`,
      timestamp: now.toISOString(),
    });
    return {
      name: "missed_slots",
      ok: false,
      details: { checked: 0, auto_published: autoPublished, failed, skipped, results },
      alerts,
    };
  }

  return {
    name: "missed_slots",
    ok: failed === 0,
    details: {
      checked: rows.length ?? 0,
      auto_published: autoPublished,
      failed,
      skipped,
      results,
    },
    alerts,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MASTER: RUN ALL WATCHDOG CHECKS
// ═══════════════════════════════════════════════════════════════════

export async function runWatchdogChecks(): Promise<WatchdogStatusReport> {
  const now = new Date();
  const est = getEasternInfo(now);
  const estTimeStr = `${est.dateStr} ${String(est.hour).padStart(2, "0")}:${String(est.minute).padStart(2, "0")} EST`;

  console.log(`[watchdog] 🐕 Running all checks at ${now.toISOString()} (${estTimeStr})`);

  // Run all checks in parallel
  const [cronHealth, postSuccess, metaToken, stalePublishing, upcomingPosts, businessPaused, missedSlots] =
    await Promise.all([
      checkCronHealth(),
      checkPostSuccess(),
      validateMetaToken(),
      detectStalePublishing(),
      checkUpcomingPosts(),
      checkBusinessPaused(),
      checkMissedSlots(),
    ]);

  // Collect all alerts
  const allAlerts: WatchdogAlert[] = [
    ...cronHealth.alerts,
    ...postSuccess.alerts,
    ...metaToken.alerts,
    ...stalePublishing.alerts,
    ...upcomingPosts.alerts,
    ...businessPaused.alerts,
    ...missedSlots.alerts,
  ];

  // Determine overall status
  const criticalAlerts = allAlerts.filter((a) => a.severity === "critical");
  const warningAlerts = allAlerts.filter((a) => a.severity === "warning");

  let status: "healthy" | "degraded" | "critical";
  if (criticalAlerts.length > 0) {
    status = "critical";
  } else if (warningAlerts.length > 0) {
    status = "degraded";
  } else {
    status = "healthy";
  }

  // Log critical alerts to console for immediate visibility
  for (const alert of criticalAlerts) {
    console.error(`[watchdog] 🚨 CRITICAL: ${alert.message}`);
  }
  for (const alert of warningAlerts) {
    console.warn(`[watchdog] ⚠️ WARNING: ${alert.message}`);
  }

  // Persist critical alerts to watchdog_alerts table
  if (criticalAlerts.length > 0 || warningAlerts.length > 0) {
    try {
      for (const alert of [...criticalAlerts, ...warningAlerts]) {
        await sql`
          INSERT INTO watchdog_alerts (alert_type, severity, message, checks_data)
          VALUES (${alert.type}, ${alert.severity}, ${alert.message}, ${JSON.stringify({
            status,
            alert_count: allAlerts.length,
          })})
        `.catch(() => {
          // Table might not exist yet — non-fatal
        });
      }
    } catch {
      // Non-fatal — alert persistence failure shouldn't block the report
    }
  }

  if (status !== "healthy") {
    console.log(`[watchdog] Status: ${status.toUpperCase()} — ${criticalAlerts.length} critical, ${warningAlerts.length} warning`);
  } else {
    console.log(`[watchdog] ✅ Status: HEALTHY`);
  }

  return {
    status,
    server_time_utc: now.toISOString(),
    server_time_est: estTimeStr,
    alerts: allAlerts,
    checks: {
      cron_health: cronHealth,
      post_success_24h: postSuccess,
      meta_token: metaToken,
      stale_publishing: stalePublishing,
      upcoming_posts: upcomingPosts,
      business_paused: businessPaused,
    },
    missed_slots: missedSlots,
    last_post_published_utc: postSuccess.details.last_post_published_utc as string | null,
    posts_published_24h: postSuccess.details.posts_succeeded_24h as number,
    posts_failed_24h: postSuccess.details.cron_reported_failed_24h as number,
    upcoming_posts_2h: upcomingPosts.details.total_upcoming_2h as number,
    token_valid: metaToken.details.token_valid as boolean,
    business_paused: businessPaused.details.business_paused as boolean,
  };
}

/**
 * Lightweight pre-window check. Runs only Meta token validation
 * and upcoming post verification for the Instagram window.
 * Designed for pre-window cron calls (10 min before each IG slot).
 */
export async function runPreWindowCheck(): Promise<{
  inPreWindow: boolean;
  upcomingWindow: string | null;
  tokenOk: boolean;
  igPostsReady: boolean;
  alerts: WatchdogAlert[];
}> {
  const now = new Date();
  const preWindow = getPreWindowStatus(now);

  if (!preWindow.inPreWindow) {
    return {
      inPreWindow: false,
      upcomingWindow: null,
      tokenOk: true,
      igPostsReady: true,
      alerts: [],
    };
  }

  console.log(`[watchdog] 🔔 Pre-window check for ${preWindow.upcomingWindow}`);

  const [metaToken, upcomingPosts] = await Promise.all([
    validateMetaToken(),
    checkUpcomingPosts(),
  ]);

  const alerts: WatchdogAlert[] = [
    ...metaToken.alerts,
    ...upcomingPosts.alerts,
  ];

  const igPostsReady = (upcomingPosts.details.instagram_upcoming as number) > 0;

  if (!metaToken.ok) {
    console.error(`[watchdog] 🚨 Pre-window: Meta token invalid before ${preWindow.upcomingWindow}!`);
  }
  if (!igPostsReady) {
    console.warn(`[watchdog] ⚠️ Pre-window: NO Instagram posts ready for ${preWindow.upcomingWindow}!`);
  }

  return {
    inPreWindow: true,
    upcomingWindow: preWindow.upcomingWindow,
    tokenOk: metaToken.ok,
    igPostsReady,
    alerts,
  };
}
