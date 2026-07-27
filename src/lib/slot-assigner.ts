/**
 * Slot Auto-Fill System — src/lib/slot-assigner.ts
 *
 * Knows the full posting slot schedule and answers:
 * 1. "What's the next available slot for platform X?"
 * 2. "What empty slots exist in this date range?"
 * 3. "Fill this slot with content now."
 *
 * Reuses Eastern time helpers and SLOT_CONFIG from slot-utils.ts.
 * Queries the scheduled_posts table to determine slot occupancy.
 *
 * MetroReach Media
 */
import { randomBytes } from "node:crypto";
import { sql } from "~/lib/db";
import { getSiteUrl } from "~/lib/site-url";
import {
  SLOT_CONFIG,
  DAY_NAMES,
  getEasternInfo,
  computeSlotUtc,
} from "~/lib/slot-utils";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface SlotInfo {
  platform: string;
  estHour: number;
  estDayName: string;
  utcTimestamp: string; // ISO 8601
}

export interface PostResult {
  success: boolean;
  id?: string;
  platform: string;
  due_at?: string;
  message?: string;
  error?: string;
}

/** Max days forward to search for available slots */
const MAX_SEARCH_DAYS = 30;

/** Slot match window in seconds (± from exact UTC timestamp) */
const SLOT_MATCH_WINDOW_SECONDS = 90;

// ═══════════════════════════════════════════════════════════════════
// SLOT QUERY HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if a specific UTC slot time already has a pending post.
 * Uses the same ±90s window as post-scheduler.ts.
 */
async function isSlotOccupied(
  platform: string,
  utcTimestamp: string,
): Promise<boolean> {
  const slotMs = new Date(utcTimestamp).getTime();
  const slotWindowStart = new Date(
    slotMs - SLOT_MATCH_WINDOW_SECONDS * 1000,
  ).toISOString();
  const slotWindowEnd = new Date(
    slotMs + SLOT_MATCH_WINDOW_SECONDS * 1000,
  ).toISOString();

  const existing = await sql`
    SELECT id FROM scheduled_posts
    WHERE platform = ${platform}
      AND status = 'pending'
      AND due_at >= ${slotWindowStart}::timestamptz
      AND due_at < ${slotWindowEnd}::timestamptz
    LIMIT 1
  `;

  return existing.length > 0;
}

/**
 * Look up page_id / ig_user_id from the most recent post for a
 * platform+client combo. Used when the caller doesn't provide IDs.
 */
async function lookupPostIdentifiers(
  platform: string,
  clientId: string,
): Promise<{ page_id: string; ig_user_id: string | null } | null> {
  const rows = await sql`
    SELECT page_id, ig_user_id FROM scheduled_posts
    WHERE platform = ${platform}
      AND client_id = ${clientId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  return {
    page_id: rows[0].page_id as string,
    ig_user_id: (rows[0].ig_user_id as string) || null,
  };
}

// ═══════════════════════════════════════════════════════════════════
// UTM LINK GENERATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a UTM-tagged click-tracking link for a scheduled post.
 *
 * Pattern: /go/{clientSlug}/{postId}?utm_source={platform}&utm_medium=social&utm_campaign={clientSlug}&utm_content={postId}
 *
 * Returns null if the client cannot be found.
 */
async function generateUtmLink(
  clientId: string,
  postId: string,
  platform: string,
): Promise<string | null> {
  try {
    const clientRows = await sql`
      SELECT service_slug FROM clients WHERE id = ${clientId} LIMIT 1
    `;
    if (clientRows.length === 0) return null;

    const clientSlug = (clientRows[0].service_slug as string) || clientId;
    const baseUrl = getSiteUrl();
    const params = new URLSearchParams({
      utm_source: platform,
      utm_medium: "social",
      utm_campaign: clientSlug,
      utm_content: postId,
    });
    return `${baseUrl}/go/${encodeURIComponent(clientSlug)}/${encodeURIComponent(postId)}?${params.toString()}`;
  } catch (err: any) {
    console.error("[slot-assigner] UTM link generation error:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

/**
 * Find the next available (unfilled) posting slot for a platform.
 *
 * Starts searching from `afterDate` (default: now). Walks forward
 * day-by-day for up to MAX_SEARCH_DAYS checking each configured slot hour.
 * Returns the first slot that has no pending scheduled_posts entry.
 *
 * Returns null if all slots for the next 30 days are filled or the
 * platform has no slot configuration.
 */
export async function getNextAvailableSlot(
  platform: string,
  afterDate?: Date,
): Promise<SlotInfo | null> {
  const config = SLOT_CONFIG[platform];
  if (!config) return null;

  const now = afterDate || new Date();
  const nowEst = getEasternInfo(now);

  for (let dayOffset = 0; dayOffset < MAX_SEARCH_DAYS; dayOffset++) {
    const targetDate = new Date(now);
    targetDate.setUTCDate(targetDate.getUTCDate() + dayOffset);

    const targetEst = getEasternInfo(targetDate);

    // Skip days this platform doesn't post on
    if (!config.days.includes(targetEst.day)) continue;

    // Determine which hours to check. For today, skip hours that have
    // already passed (including the current hour).
    let candidateHours: number[];
    if (dayOffset === 0) {
      candidateHours = config.hours.filter((h) => h > nowEst.hour);
    } else {
      candidateHours = config.hours;
    }

    for (const hour of candidateHours) {
      const utcTimestamp = computeSlotUtc(
        targetEst.dateStr,
        hour,
        targetEst.offsetHours,
      );

      // Skip slots that are still in the past (guard for same-day edge cases)
      if (new Date(utcTimestamp).getTime() <= now.getTime()) continue;

      // Check occupancy
      const occupied = await isSlotOccupied(platform, utcTimestamp);
      if (!occupied) {
        return {
          platform,
          estHour: hour,
          estDayName: DAY_NAMES[targetEst.day],
          utcTimestamp,
        };
      }
    }
  }

  return null;
}

/**
 * Return ALL empty slots within a date range, sorted chronologically.
 *
 * Used by the daily audit (GET /api/cron/auto-fill) and other
 * monitoring tools to report upcoming gaps.
 */
export async function getAllEmptySlots(
  fromDate: Date,
  toDate: Date,
): Promise<SlotInfo[]> {
  const emptySlots: SlotInfo[] = [];

  for (const [platform, config] of Object.entries(SLOT_CONFIG)) {
    const cursor = new Date(fromDate);
    // Reset to midnight of fromDate so day iteration is clean
    cursor.setUTCHours(0, 0, 0, 0);

    while (cursor <= toDate) {
      const est = getEasternInfo(cursor);

      if (config.days.includes(est.day)) {
        for (const hour of config.hours) {
          const utcTimestamp = computeSlotUtc(
            est.dateStr,
            hour,
            est.offsetHours,
          );
          const slotDate = new Date(utcTimestamp);

          // Skip if outside requested range
          if (slotDate < fromDate || slotDate > toDate) continue;

          const occupied = await isSlotOccupied(platform, utcTimestamp);
          if (!occupied) {
            emptySlots.push({
              platform,
              estHour: hour,
              estDayName: DAY_NAMES[est.day],
              utcTimestamp,
            });
          }
        }
      }

      // Advance one day
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  // Sort chronologically
  emptySlots.sort(
    (a, b) =>
      new Date(a.utcTimestamp).getTime() -
      new Date(b.utcTimestamp).getTime(),
  );

  return emptySlots;
}

/**
 * Fill the next available slot for a platform with the given content.
 *
 * Auto-resolves page_id / ig_user_id from existing posts if not provided.
 * Returns the created post details or an error if no slots are available.
 *
 * Uses the same INSERT pattern as schedule-post.ts.
 */
export async function fillSlot(
  platform: string,
  content: string,
  hashtags: string,
  clientId: string,
  pageId?: string,
  igUserId?: string,
): Promise<PostResult> {
  // Find the next available slot
  const slot = await getNextAvailableSlot(platform);
  if (!slot) {
    return {
      success: false,
      platform,
      error: `No available slots for ${platform} in the next ${MAX_SEARCH_DAYS} days`,
    };
  }

  // Resolve page identifiers
  let resolvedPageId = pageId;
  let resolvedIgUserId = igUserId;

  if (!resolvedPageId) {
    const ids = await lookupPostIdentifiers(platform, clientId);
    if (!ids) {
      return {
        success: false,
        platform,
        error: `No page_id available for ${platform}. Schedule at least one post manually first, or provide page_id.`,
      };
    }
    resolvedPageId = ids.page_id;
    resolvedIgUserId = resolvedIgUserId || ids.ig_user_id;
  }

  // Insert the post
  const id = `post-${randomBytes(8).toString("hex")}`;

  // Generate UTM-tagged click-tracking link
  const utmLink = await generateUtmLink(clientId, id, platform);

  try {
    await sql`
      INSERT INTO scheduled_posts (
        id, client_id, platform, page_id, ig_user_id,
        content, media_urls, hashtags, due_at, status, utm_link
      ) VALUES (
        ${id},
        ${clientId},
        ${platform},
        ${resolvedPageId},
        ${resolvedIgUserId || null},
        ${content},
        ${JSON.stringify([])}::jsonb,
        ${hashtags},
        ${slot.utcTimestamp}::timestamptz,
        'pending',
        ${utmLink || null}
      )
    `;

    return {
      success: true,
      id,
      platform,
      due_at: slot.utcTimestamp,
      message: `Post "${id}" scheduled for ${platform} at ${slot.estDayName} ${String(slot.estHour).padStart(2, "0")}:00 EST (${slot.utcTimestamp})`,
    };
  } catch (err: any) {
    return {
      success: false,
      platform,
      error: `Insert failed: ${err.message}`,
    };
  }
}
