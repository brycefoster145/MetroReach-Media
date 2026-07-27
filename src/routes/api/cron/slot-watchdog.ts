/**
 * Slot Watchdog — GET|POST /api/cron/slot-watchdog
 *
 * Runs every hour via Vercel cron ("0 * * * *" in vercel.json).
 * Proactively checks every upcoming posting slot for the next 24 hours
 * against the scheduled_posts table. If any slot is empty, it:
 *   1. Sends an email alert to contact@metroreachagency.com
 *   2. Sends a Telegram alert
 *   3. Triggers the auto-fill endpoint to generate and schedule content
 *
 * Only monitors live platforms: facebook, instagram, x.
 * LinkedIn, TikTok, Google are excluded until they are live.
 *
 * MetroReach Media
 */
import { createFileRoute } from "@tanstack/react-router";
import { getAllEmptySlots } from "~/lib/slot-assigner";
import { SLOT_CONFIG, getEasternInfo, computeSlotUtc } from "~/lib/slot-utils";
import { sendEmail } from "~/lib/email";
import { sendTelegramMessage } from "~/lib/telegram";
import { getSiteUrl } from "~/lib/site-url";

// ═══════════════════════════════════════════════════════════════════
// CONFIG — matches business plan locked posting times
// ═══════════════════════════════════════════════════════════════════

/** Only monitor platforms that are live and deliverable */
const ACTIVE_PLATFORMS = ["facebook", "instagram", "x"];

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface EmptySlot {
  platform: string;
  time_est: string;
  due_at_utc: string;
}

interface WatchdogResponse {
  slots_checked: number;
  slots_empty: number;
  empty_slots: EmptySlot[];
  alerts_sent: number;
  server_time_utc: string;
  window: {
    from: string;
    to: string;
    hours: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Count all posting slots (filled + empty) for active platforms
 * within a date range. Mirrors getAllEmptySlots' iteration but
 * counts every slot instead of checking occupancy.
 */
function countTotalSlots(from: Date, to: Date): number {
  let total = 0;

  for (const platform of ACTIVE_PLATFORMS) {
    const config = SLOT_CONFIG[platform];
    if (!config) continue;

    const cursor = new Date(from);
    cursor.setUTCHours(0, 0, 0, 0);

    while (cursor <= to) {
      const est = getEasternInfo(cursor);

      if (config.days.includes(est.day)) {
        for (const hour of config.hours) {
          const utcTimestamp = computeSlotUtc(
            est.dateStr,
            hour,
            est.offsetHours,
          );
          const slotDate = new Date(utcTimestamp);

          if (slotDate >= from && slotDate <= to) {
            total++;
          }
        }
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return total;
}

/**
 * Trigger the auto-fill endpoint via internal fetch.
 * Includes CRON_SECRET auth header for production.
 */
async function triggerAutoFill(): Promise<{ slots_filled: number; error?: string }> {
  try {
    const siteUrl = getSiteUrl();
    const cronSecret = process.env.CRON_SECRET;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (cronSecret) {
      headers["Authorization"] = `Bearer ${cronSecret}`;
    }

    const response = await fetch(`${siteUrl}/api/cron/auto-fill`, {
      method: "POST",
      headers,
    });

    const result = await response.json();
    return {
      slots_filled: result.slots_filled ?? result.posts_created ?? 0,
      error: response.ok ? undefined : (result.error ?? `HTTP ${response.status}`),
    };
  } catch (err: any) {
    return { slots_filled: 0, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// CORE
// ═══════════════════════════════════════════════════════════════════

async function handleWatchdog(): Promise<Response> {
  const now = new Date();
  const twentyFourHours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    // ── Count total slots for the window (before filtering to empty) ──
    const totalSlots = countTotalSlots(now, twentyFourHours);

    // ── Find all empty slots ──
    const allEmptySlots = await getAllEmptySlots(now, twentyFourHours);

    // Filter to active (live) platforms only
    const emptySlots = allEmptySlots.filter(
      (s) => ACTIVE_PLATFORMS.includes(s.platform),
    );

    const formattedSlots: EmptySlot[] = emptySlots.map((s) => ({
      platform: s.platform,
      time_est: `${s.estDayName} ${String(s.estHour).padStart(2, "0")}:00 EST`,
      due_at_utc: s.utcTimestamp,
    }));

    let alertsSent = 0;

    // ── Alert + auto-fill if empty slots found ──
    if (emptySlots.length > 0) {
      const slotList = formattedSlots
        .map((s) => `• ${s.platform}: ${s.time_est}`)
        .join("\n");

      console.log(
        `[slot-watchdog] ⚠️ Found ${emptySlots.length} empty slot(s) in next 24h:\n${slotList}`,
      );

      // 📧 Email alert
      try {
        const emailBody = [
          `<h2>⚠️ MetroReach Media — Empty Posting Slots Detected</h2>`,
          `<p>The slot watchdog found <strong>${emptySlots.length} empty slot(s)</strong> in the next 24 hours:</p>`,
          `<pre>${slotList}</pre>`,
          `<p>Auto-fill has been triggered to generate and schedule content for these slots.</p>`,
          `<p><em>— MetroReach Media Watchdog</em></p>`,
        ].join("\n");

        await sendEmail({
          to: "contact@metroreachagency.com",
          from: "contact@metroreachagency.com",
          subject: `⚠️ MetroReach: ${emptySlots.length} Empty Posting Slot(s) — Auto-Fill Triggered`,
          body: emailBody,
        });
        alertsSent++;
        console.log(
          `[slot-watchdog] 📧 Alert email sent for ${emptySlots.length} empty slots`,
        );
      } catch (err: any) {
        console.error(`[slot-watchdog] ❌ Email alert failed: ${err.message}`);
      }

      // 📱 Telegram alert
      try {
        await sendTelegramMessage(
          `⚠️ <b>[MetroReach] SLOT WATCHDOG: ${emptySlots.length} empty slot(s) found!</b>\n\n` +
            slotList +
            `\n\nAuto-fill has been triggered to fill these slots.`,
        );
        alertsSent++;
        console.log(`[slot-watchdog] 📱 Telegram alert sent`);
      } catch (err: any) {
        console.error(
          `[slot-watchdog] ❌ Telegram alert failed: ${err.message}`,
        );
      }

      // 🔧 Trigger auto-fill
      const autoFillResult = await triggerAutoFill();
      if (autoFillResult.error) {
        console.error(
          `[slot-watchdog] ❌ Auto-fill trigger failed: ${autoFillResult.error}`,
        );
      } else {
        console.log(
          `[slot-watchdog] 🔧 Auto-fill completed: ${autoFillResult.slots_filled} slots filled`,
        );
      }
    } else {
      console.log(
        "[slot-watchdog] ✅ No empty slots — all platforms covered for next 24h",
      );
    }

    const body: WatchdogResponse = {
      slots_checked: totalSlots,
      slots_empty: emptySlots.length,
      empty_slots: formattedSlots,
      alerts_sent: alertsSent,
      server_time_utc: now.toISOString(),
      window: {
        from: now.toISOString(),
        to: twentyFourHours.toISOString(),
        hours: 24,
      },
    };

    return new Response(JSON.stringify(body), {
      status: emptySlots.length > 0 ? 207 : 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[slot-watchdog] ❌ Fatal error: ${err.message}`);

    return new Response(
      JSON.stringify({
        slots_checked: 0,
        slots_empty: 0,
        empty_slots: [],
        alerts_sent: 0,
        server_time_utc: now.toISOString(),
        window: {
          from: now.toISOString(),
          to: twentyFourHours.toISOString(),
          hours: 24,
        },
        error: err.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// ROUTE
// ═══════════════════════════════════════════════════════════════════

export const Route = createFileRoute("/api/cron/slot-watchdog")({
  server: {
    handlers: {
      GET: async () => {
        console.log("[slot-watchdog] ⏰ Cron triggered (GET)");
        return handleWatchdog();
      },
      POST: async () => {
        console.log("[slot-watchdog] ⏰ Manual trigger (POST)");
        return handleWatchdog();
      },
    },
  },
});
