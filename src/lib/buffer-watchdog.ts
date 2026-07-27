/**
 * Buffer Watchdog — monitors posting queue health.
 *
 * Counts pending posts per platform and calculates days of coverage remaining.
 * Sends Telegram alerts when buffers run low.
 *
 * POSTS PER DAY (from business plan):
 *   Facebook:  2/day (Mon–Sun)
 *   Instagram: 3/day (Mon–Sun)
 *   X/Twitter: 3/day (Mon–Fri = weekdays only)
 *   LinkedIn:  1/day (Mon–Fri = weekdays only)
 *
 * MetroReach Media
 */
import { sql } from "~/lib/db";
import { sendTelegramMessage } from "~/lib/telegram";

// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

/** Only monitor platforms that are live and deliverable */
const ACTIVE_PLATFORMS = ["facebook", "instagram", "x"];

interface PlatformWatchConfig {
  postsPerDay: number;
  weekdayOnly: boolean;
  label: string;
}

const WATCH_CONFIG: Record<string, PlatformWatchConfig> = {
  facebook:  { postsPerDay: 2, weekdayOnly: false, label: "Facebook" },
  instagram: { postsPerDay: 3, weekdayOnly: false, label: "Instagram" },
  x:         { postsPerDay: 3, weekdayOnly: true,  label: "X (Twitter)" },
  linkedin:  { postsPerDay: 1, weekdayOnly: true,  label: "LinkedIn" },
};

/** Alert: send warning when coverage drops below this many days */
const WARNING_DAYS = 3;

/** Alert: send urgent when coverage drops below this many days */
const URGENT_DAYS = 1;

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface PlatformBufferStatus {
  platform: string;
  label: string;
  pending: number;
  postsPerDay: number;
  weekdayOnly: boolean;
  daysRemaining: number;
  level: "ok" | "warning" | "urgent";
}

export interface WatchdogReport {
  server_time_utc: string;
  platforms: PlatformBufferStatus[];
  alerts_sent: number;
}

// ═══════════════════════════════════════════════════════════════════
// CORE
// ═══════════════════════════════════════════════════════════════════

export async function runBufferWatchdog(): Promise<WatchdogReport> {
  const platforms: PlatformBufferStatus[] = [];
  let alertsSent = 0;

  for (const [platform, config] of Object.entries(WATCH_CONFIG)) {
    // Skip platforms that are not live/deliverable
    if (!ACTIVE_PLATFORMS.includes(platform)) {
      continue;
    }

    try {
      const rows = await sql`
        SELECT COUNT(*)::int AS count
        FROM scheduled_posts
        WHERE platform = ${platform}
          AND status = 'pending'
      `;
      const pending: number = rows[0]?.count ?? 0;
      const daysRemaining = config.postsPerDay > 0
        ? pending / config.postsPerDay
        : 0;

      let level: "ok" | "warning" | "urgent" = "ok";
      if (daysRemaining < URGENT_DAYS) {
        level = "urgent";
      } else if (daysRemaining < WARNING_DAYS) {
        level = "warning";
      }

      platforms.push({
        platform,
        label: config.label,
        pending,
        postsPerDay: config.postsPerDay,
        weekdayOnly: config.weekdayOnly,
        daysRemaining: Math.round(daysRemaining * 10) / 10, // 1 decimal
        level,
      });

      // ── Send alerts ──
      if (level === "urgent") {
        const weekdayNote = config.weekdayOnly ? " (weekdays)" : "";
        await sendTelegramMessage(
          `🚨 <b>[MetroReach] BUFFER URGENT: ${config.label} has only ${pending} post(s) remaining — ~${Math.round(daysRemaining * 10) / 10} day(s)${weekdayNote} of coverage!</b>\n\n` +
          `Platform: ${config.label}\n` +
          `Pending posts: ${pending}\n` +
          `Daily rate: ${config.postsPerDay}/day${weekdayNote}\n` +
          `Action: Content Strategist must fill slots immediately.`
        );
        alertsSent++;
      } else if (level === "warning") {
        const weekdayNote = config.weekdayOnly ? " (weekdays)" : "";
        await sendTelegramMessage(
          `⚠️ <b>[MetroReach] BUFFER LOW: ${config.label} has ~${Math.round(daysRemaining * 10) / 10} day(s)${weekdayNote} remaining</b>\n\n` +
          `Platform: ${config.label}\n` +
          `Pending posts: ${pending}\n` +
          `Daily rate: ${config.postsPerDay}/day${weekdayNote}\n` +
          `Action: Content Strategist should schedule more content soon.`
        );
        alertsSent++;
      }
    } catch (err: any) {
      console.error(`[buffer-watchdog] Error checking ${platform}: ${err.message}`);
      platforms.push({
        platform,
        label: config.label,
        pending: -1,
        postsPerDay: config.postsPerDay,
        weekdayOnly: config.weekdayOnly,
        daysRemaining: 0,
        level: "ok",
      });
    }
  }

  return {
    server_time_utc: new Date().toISOString(),
    platforms,
    alerts_sent: alertsSent,
  };
}
