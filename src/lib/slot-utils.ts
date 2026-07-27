/**
 * Slot Utilities — shared timezone, slot config, and helpers.
 *
 * Used by the post-scheduler cron, slot-assigner, and auto-fill systems.
 * All times are Eastern (America/New_York). UTC computed via getEasternInfo().
 *
 * MetroReach Media
 */

// ═══════════════════════════════════════════════════════════════════
// TIME SLOT DEFINITIONS (EST/EDT, America/New_York)
// ═══════════════════════════════════════════════════════════════════

export interface SlotConfig {
  /** Hours in Eastern time (24h) when posting is allowed */
  hours: number[];
  /** Days of week (0=Sunday, 6=Saturday) when posting is allowed */
  days: number[];
}

export const SLOT_CONFIG: Record<string, SlotConfig> = {
  facebook:  { hours: [14, 20],       days: [0, 1, 2, 3, 4, 5, 6] },
  instagram: { hours: [13, 17, 21],   days: [0, 1, 2, 3, 4, 5, 6] },
  x:         { hours: [9, 12, 17],    days: [1, 2, 3, 4, 5] },
  linkedin:  { hours: [12],           days: [1, 2, 3, 4, 5] },
};

/** Names for day-of-week indices (0=Sunday) */
export const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

/** Grace window in minutes: the cron will publish a slot's post if it
 * fires within this many minutes after the top of the hour.
 *
 * Set to 15 so the every-60s cron gets ~15 attempts per slot.
 * Vercel cold starts can easily miss a 2-minute window. */
export const SLOT_GRACE_MINUTES = 15;

/** Missed threshold: pending posts whose due_at is this many minutes
 * in the past are marked 'missed' rather than published late. */
export const MISSED_THRESHOLD_MINUTES = 15;

// ═══════════════════════════════════════════════════════════════════
// EASTERN TIME HELPERS
// ═══════════════════════════════════════════════════════════════════

export interface EasternTimeInfo {
  hour: number;
  minute: number;
  day: number; // 0=Sun, 6=Sat
  dateStr: string; // "YYYY-MM-DD"
  offsetHours: number; // UTC offset of Eastern time (e.g. -4 for EDT, -5 for EST)
}

export function getEasternInfo(now: Date): EasternTimeInfo {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  });

  const parts = fmt.formatToParts(now);
  const vals: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") vals[p.type] = p.value;
  }

  let offsetHours = -5; // default EST
  if (vals.timeZoneName) {
    const m = vals.timeZoneName.match(/GMT([+-]\d+)/);
    if (m) offsetHours = parseInt(m[1]);
  }

  return {
    hour: parseInt(vals.hour),
    minute: parseInt(vals.minute),
    day: new Date(`${vals.year}-${vals.month}-${vals.day}T12:00:00`).getDay(),
    dateStr: `${vals.year}-${vals.month}-${vals.day}`,
    offsetHours,
  };
}

/**
 * Compute the UTC ISO timestamp for "today at {estHour}:00 Eastern time".
 */
export function computeSlotUtc(
  estDateStr: string,
  estHour: number,
  estOffsetHours: number,
): string {
  const [year, month, day] = estDateStr.split("-").map(Number);
  const utcTotalMinutes = (estHour - estOffsetHours) * 60;
  const baseUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  const slotUtcMs = baseUtcMs + utcTotalMinutes * 60 * 1000;
  return new Date(slotUtcMs).toISOString();
}
