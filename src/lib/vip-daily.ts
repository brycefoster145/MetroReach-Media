/**
 * VIP Daily content pipeline — MetroReach Media
 *
 * Implements the $8,500/mo VIP Daily package:
 *   180 posts per 30-day service cycle = 90 Instagram + 90 Facebook
 *   (3 IG + 3 FB per day), 5 production batches of 18 IG + 18 FB each,
 *   all timestamps generated from the client's IANA timezone (DST-safe).
 *
 * What lives here:
 *   1. Onboarding validation — IANA timezone + client Buffer channel IDs
 *      are required before any scheduling work can start.
 *   2. Cycle + task generation — buildVipDailyTasks() produces the 12 tasks
 *      per cycle (1 onboarding/research, 5 content batches, 5 scheduling,
 *      1 reporting) with idempotency keys so re-runs never duplicate.
 *   3. Timezone-aware dueAt generation (luxon; DST-safe).
 *   4. Buffer GraphQL batch scheduling with preflight duplicate checks,
 *      60s-backoff retry, and post-batch reconciliation.
 *   5. IG asset uniqueness enforcement per cycle.
 *   6. Queue monitoring — alerts when scheduled coverage drops to ≤7 days.
 *
 * Hard rules carried through every brief:
 *   - Client's own Buffer channels only (never agency channels).
 *   - Client hashtags on client posts — never #MetroReachMedia.
 *   - Every IG post gets a distinct original asset (verified lockup, live URL).
 *   - Only verifiable, sourced claims — see Operating Principle #1.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DateTime } from "luxon";
import { sql } from "~/lib/db";
import { sendTelegramMessage } from "~/lib/telegram";
import type { Client } from "~/lib/email-sequences";

// ── Plan constants ──────────────────────────────────────────────────────────

export type VipDailyTaskKind =
  | "vip-onboarding-research"
  | "vip-content-batch"
  | "vip-scheduling"
  | "vip-reporting";

export interface VipDailyPlan {
  cycleDays: 30;
  instagramPosts: 90;
  facebookPosts: 90;
  batchCount: 5;
  igPostsPerBatch: 18;
  fbPostsPerBatch: 18;
  timezone: string; // required IANA timezone from onboarding
}

export function makeVipDailyPlan(timezone: string): VipDailyPlan {
  return {
    cycleDays: 30,
    instagramPosts: 90,
    facebookPosts: 90,
    batchCount: 5,
    igPostsPerBatch: 18,
    fbPostsPerBatch: 18,
    timezone,
  };
}

/** Default local-time slots. IG and FB deliberately differ so posts feel
 *  naturally distributed. Exact times are a documented hypothesis and must be
 *  adjusted only from the client's own audience/activity data. */
const DEFAULT_IG_SLOTS = ["09:00", "13:00", "17:00"];
const DEFAULT_FB_SLOTS = ["10:00", "14:30", "18:30"];

export type VipCategory =
  | "educational"
  | "behind_scenes"
  | "engagement"
  | "social_proof"
  | "promotional";

/** Daily slot/category mix from the 30-day editorial skeleton (design §1). */
const DAILY_CATEGORIES: Record<
  number,
  { ig: VipCategory[]; fb: VipCategory[] }
> = {
  1: { ig: ["educational", "behind_scenes", "engagement"], fb: ["educational", "behind_scenes", "social_proof"] },
  2: { ig: ["behind_scenes", "educational", "promotional"], fb: ["behind_scenes", "educational", "engagement"] },
  3: { ig: ["educational", "social_proof", "behind_scenes"], fb: ["educational", "social_proof", "promotional"] },
  4: { ig: ["engagement", "educational", "social_proof"], fb: ["engagement", "educational", "social_proof"] },
  5: { ig: ["promotional", "educational", "engagement"], fb: ["promotional", "educational", "behind_scenes"] },
  6: { ig: ["behind_scenes", "educational", "social_proof"], fb: ["behind_scenes", "educational", "promotional"] },
  7: { ig: ["educational", "promotional", "engagement"], fb: ["educational", "promotional", "behind_scenes"] },
  8: { ig: ["educational", "behind_scenes", "engagement"], fb: ["educational", "behind_scenes", "social_proof"] },
  9: { ig: ["behind_scenes", "educational", "promotional"], fb: ["behind_scenes", "educational", "engagement"] },
  10: { ig: ["educational", "social_proof", "behind_scenes"], fb: ["educational", "social_proof", "promotional"] },
  11: { ig: ["engagement", "educational", "social_proof"], fb: ["engagement", "educational", "social_proof"] },
  12: { ig: ["promotional", "educational", "engagement"], fb: ["promotional", "educational", "behind_scenes"] },
  13: { ig: ["behind_scenes", "educational", "social_proof"], fb: ["behind_scenes", "educational", "promotional"] },
  14: { ig: ["educational", "promotional", "engagement"], fb: ["educational", "promotional", "behind_scenes"] },
  15: { ig: ["educational", "behind_scenes", "engagement"], fb: ["educational", "behind_scenes", "social_proof"] },
  16: { ig: ["behind_scenes", "educational", "promotional"], fb: ["behind_scenes", "educational", "engagement"] },
  17: { ig: ["educational", "social_proof", "behind_scenes"], fb: ["educational", "social_proof", "promotional"] },
  18: { ig: ["engagement", "educational", "social_proof"], fb: ["engagement", "educational", "social_proof"] },
  19: { ig: ["promotional", "educational", "engagement"], fb: ["promotional", "educational", "behind_scenes"] },
  20: { ig: ["behind_scenes", "educational", "social_proof"], fb: ["behind_scenes", "educational", "promotional"] },
  21: { ig: ["educational", "promotional", "engagement"], fb: ["educational", "promotional", "behind_scenes"] },
  22: { ig: ["educational", "behind_scenes", "engagement"], fb: ["educational", "behind_scenes", "social_proof"] },
  23: { ig: ["behind_scenes", "educational", "promotional"], fb: ["behind_scenes", "educational", "engagement"] },
  24: { ig: ["educational", "social_proof", "behind_scenes"], fb: ["educational", "social_proof", "promotional"] },
  25: { ig: ["engagement", "educational", "social_proof"], fb: ["engagement", "educational", "social_proof"] },
  26: { ig: ["promotional", "educational", "engagement"], fb: ["promotional", "educational", "behind_scenes"] },
  27: { ig: ["behind_scenes", "educational", "social_proof"], fb: ["behind_scenes", "educational", "promotional"] },
  28: { ig: ["educational", "promotional", "engagement"], fb: ["educational", "promotional", "behind_scenes"] },
  29: { ig: ["educational", "behind_scenes", "engagement"], fb: ["educational", "behind_scenes", "promotional"] },
  30: { ig: ["social_proof", "educational", "engagement"], fb: ["social_proof", "educational", "behind_scenes"] },
};

// ── Timezone helpers (DST-safe via luxon) ───────────────────────────────────

/** Validate an IANA timezone name (e.g. "America/New_York"). Rejects junk and
 *  non-IANA values ("ET" is NOT accepted — that is the point of the rule). */
export function isValidIanaTimezone(tz: string | null | undefined): boolean {
  if (!tz || typeof tz !== "string") return false;
  const candidate = tz.trim();
  if (!candidate) return false;
  try {
    const dt = DateTime.now().setZone(candidate);
    return dt.isValid && dt.zoneName !== undefined && dt.zoneName.length > 0;
  } catch {
    return false;
  }
}

/** Convert a local wall-clock time (YYYY-MM-DD + HH:mm in the client's IANA
 *  zone) to a UTC ISO timestamp for Buffer. luxon applies the zone's DST
 *  offset for that specific date — never a fixed hour subtraction. */
export function localToUtcIso(localDate: string, localTime: string, timezone: string): string {
  const dt = DateTime.fromISO(`${localDate}T${localTime}`, { zone: timezone });
  if (!dt.isValid) {
    throw new Error(`[vip-daily] Invalid local time "${localDate}T${localTime}" in ${timezone}: ${dt.invalidReason ?? "unknown"}`);
  }
  return dt.toUTC().toISO()!;
}

/** Add n days to a YYYY-MM-DD date in the given zone, returning YYYY-MM-DD. */
export function addLocalDays(date: string, days: number, timezone: string): string {
  return DateTime.fromISO(date, { zone: timezone }).plus({ days }).toISODate()!;
}

// ── Occurrence generation ───────────────────────────────────────────────────

export type VipPlatform = "instagram" | "facebook";

export interface VipPostOccurrence {
  clientId: string;
  cycleId: string;
  localDate: string; // YYYY-MM-DD (client-local)
  timezone: string;
  platform: VipPlatform;
  slot: number; // 1..3
  localTime: string; // HH:mm (client-local)
  dueAtUtc: string; // ISO 8601 UTC for Buffer
  category: VipCategory;
  day: number; // 1..30
  batchNumber: number; // 1..5
  assetId: string | null;
  claimSourceIds: string[];
}

/** Build all 180 occurrences (90 IG + 90 FB) for a 30-day cycle. Every dueAt
 *  is generated from the client's IANA timezone; DST is handled by luxon. */
export function generateVipOccurrences(params: {
  clientId: string;
  cycleId: string;
  cycleStart: string; // YYYY-MM-DD
  timezone: string;
  igSlots?: string[];
  fbSlots?: string[];
}): VipPostOccurrence[] {
  const { clientId, cycleId, cycleStart, timezone } = params;
  if (!isValidIanaTimezone(timezone)) {
    throw new Error(`[vip-daily] Invalid IANA timezone "${timezone}" — cannot generate occurrences`);
  }
  const igSlots = params.igSlots ?? DEFAULT_IG_SLOTS;
  const fbSlots = params.fbSlots ?? DEFAULT_FB_SLOTS;
  if (igSlots.length !== 3 || fbSlots.length !== 3) {
    throw new Error("[vip-daily] Exactly 3 IG and 3 FB slots are required per day");
  }
  const occurrences: VipPostOccurrence[] = [];
  for (let day = 1; day <= 30; day++) {
    const localDate = addLocalDays(cycleStart, day - 1, timezone);
    const batchNumber = Math.ceil(day / 6);
    const cats = DAILY_CATEGORIES[day];
    for (let slot = 1; slot <= 3; slot++) {
      const igTime = igSlots[slot - 1];
      occurrences.push({
        clientId,
        cycleId,
        localDate,
        timezone,
        platform: "instagram",
        slot,
        localTime: igTime,
        dueAtUtc: localToUtcIso(localDate, igTime, timezone),
        category: cats.ig[slot - 1],
        day,
        batchNumber,
        assetId: null,
        claimSourceIds: [],
      });
      const fbTime = fbSlots[slot - 1];
      occurrences.push({
        clientId,
        cycleId,
        localDate,
        timezone,
        platform: "facebook",
        slot,
        localTime: fbTime,
        dueAtUtc: localToUtcIso(localDate, fbTime, timezone),
        category: cats.fb[slot - 1],
        day,
        batchNumber,
        assetId: null,
        claimSourceIds: [],
      });
    }
  }
  return occurrences;
}

// ── Client Buffer channels (never agency channels) ──────────────────────────

export interface VipChannelInfo {
  platform: VipPlatform;
  bufferChannelId: string;
}

/** Agency channels are references only and can never be used for client work. */
const AGENCY_CHANNEL_IDS = new Set([
  "6a6156cee2638b94d7b9abf0", // agency Instagram
  "6a615653e2638b94d7b9aa6f", // agency Facebook
]);

/** Look up the client's own active Buffer channels (IG + FB). Returns [] when
 *  none are linked yet. */
export async function getClientVipChannels(client: Client): Promise<VipChannelInfo[]> {
  try {
    const rows = await sql`
      SELECT buffer_channel_id, platform FROM client_channels
      WHERE status = 'active'
        AND buffer_channel_id IS NOT NULL
        AND platform IN ('instagram', 'facebook')
        AND (
          ${client.stripe_customer_id ?? null} IS NOT NULL AND stripe_customer_id = ${client.stripe_customer_id ?? null}
          OR LOWER(customer_email) = LOWER(${client.email})
        )
    `;
    const channels: VipChannelInfo[] = [];
    for (const row of rows as Array<{ buffer_channel_id: string; platform: string }>) {
      if (AGENCY_CHANNEL_IDS.has(row.buffer_channel_id)) continue;
      if (row.platform !== "instagram" && row.platform !== "facebook") continue;
      channels.push({ platform: row.platform, bufferChannelId: row.buffer_channel_id });
    }
    return channels;
  } catch (err: any) {
    console.error(`[vip-daily] client_channels lookup failed for ${client.id}:`, err.message);
    return [];
  }
}

/** Extract the client's IANA timezone from onboarding_data. Accepts both a
 *  top-level `timezone` field and `businessInfo.timezone`. Returns null if
 *  absent or not a valid IANA zone. */
export function getClientTimezone(client: Client): string | null {
  const data = (client.onboarding_data ?? {}) as Record<string, any>;
  const candidates = [
    data.timezone,
    (data.businessInfo as Record<string, any> | undefined)?.timezone,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && isValidIanaTimezone(candidate)) {
      return candidate.trim();
    }
  }
  return null;
}

// ── Onboarding validation ───────────────────────────────────────────────────

export interface VipOnboardingValidation {
  ok: boolean;
  timezone: string | null;
  channels: VipChannelInfo[];
  missing: string[];
}

/** Validate that a VIP client can start scheduling work: a real IANA timezone
 *  AND active client Buffer channels for both Instagram and Facebook. */
export async function validateVipOnboarding(client: Client): Promise<VipOnboardingValidation> {
  const timezone = getClientTimezone(client);
  const channels = await getClientVipChannels(client);
  const missing: string[] = [];
  if (!timezone) missing.push("timezone (IANA, e.g. America/New_York — not 'ET')");
  const hasIg = channels.some((c) => c.platform === "instagram");
  const hasFb = channels.some((c) => c.platform === "facebook");
  if (!hasIg) missing.push("active client Instagram Buffer channel (buffer_channel_id linked)");
  if (!hasFb) missing.push("active client Facebook Buffer channel (buffer_channel_id linked)");
  return { ok: missing.length === 0, timezone, channels, missing };
}

// ── Cycle computation ───────────────────────────────────────────────────────

export interface VipCycleInfo {
  cycleId: string;
  cycleStart: string; // YYYY-MM-DD
  cycleEnd: string; // YYYY-MM-DD (cycleStart + 29 days — always a 30-day cycle)
  committedIg: number;
  committedFb: number;
  committedTotal: number;
}

export function computeVipCycle(clientId: string, cycleStart: string, timezone: string): VipCycleInfo {
  const cycleEnd = addLocalDays(cycleStart, 29, timezone);
  return {
    cycleId: `vip-${clientId}-${cycleStart}`,
    cycleStart,
    cycleEnd,
    committedIg: 90,
    committedFb: 90,
    committedTotal: 180,
  };
}

/** Default cycle start: today in the client's timezone. */
export function defaultVipCycleStart(timezone: string): string {
  return DateTime.now().setZone(timezone).toISODate()!;
}

// ── Task generation ─────────────────────────────────────────────────────────

export interface VipDailyTaskDescriptor {
  kind: VipDailyTaskKind;
  cycleId: string;
  batchNumber: number | null;
  timezone: string;
  idempotencyKey: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  company: string | null;
  serviceName: string;
  deliverableType: string;
  assignedRoles: string[];
  deadline: string; // ISO UTC
  brief: string;
}

const VIP_TASKS_DIR = "/home/team/shared/tasks/vip";

function formatOccurrenceRows(rows: VipPostOccurrence[]): string {
  return rows
    .map(
      (o) =>
        `| ${o.day} | ${o.platform} | ${o.slot} | ${o.localTime} | ${o.dueAtUtc} | ${o.category} |`,
    )
    .join("\n");
}

function buildVipBrief(params: {
  kind: VipDailyTaskKind;
  client: Client;
  cycle: VipCycleInfo;
  timezone: string;
  batchNumber: number | null;
  occurrences: VipPostOccurrence[];
  deadline: string;
  missing: string[];
}): string {
  const { kind, client, cycle, timezone, batchNumber, occurrences, deadline, missing } = params;
  const clientLine = [
    `# VIP Daily — ${kind}`,
    "",
    `> **Client:** ${client.name}${client.company ? ` (${client.company})` : ""}  `,
    `> **Client ID:** ${client.id}  `,
    `> **Email:** ${client.email}  `,
    `> **Cycle:** ${cycle.cycleStart} → ${cycle.cycleEnd} (30 days, committed ${cycle.committedTotal} posts = ${cycle.committedIg} IG + ${cycle.committedFb} FB)  `,
    `> **Timezone:** ${timezone} (IANA — every local time converts to UTC via the client's zone, DST-safe)  `,
    `> **Deadline:** ${deadline}  `,
    `> **Cycle ID:** \`${cycle.cycleId}\``,
    "",
    "---",
  ].join("\n");

  if (kind === "vip-onboarding-research") {
    const missingBlock =
      missing.length > 0
        ? [
            "",
            "## ⚠️ BLOCKED — onboarding incomplete",
            "",
            "Scheduling cannot begin until ALL of the following are confirmed:",
            ...missing.map((m) => `- **${m}**`),
            "",
            "Unblock steps: 1) set `timezone` (IANA) on the client's onboarding_data; 2) link the client's",
            "Instagram + Facebook Buffer channel IDs (status `active`) in `client_channels`; 3) re-run",
            "`POST /api/admin/run-vip-tasks` with this client_id. Task generation is idempotent — re-running",
            "never duplicates tasks.",
            "",
          ].join("\n")
        : [
            "",
            "## Scope",
            "",
            "Confirm before any content or scheduling work:",
            "- **Timezone** — IANA name stored on onboarding_data (e.g. `America/New_York`, never `ET`).",
            "- **Channel IDs** — client's own active Buffer channel IDs for Instagram AND Facebook (never agency channels `6a6156…`).",
            "- **Access** — publishing permissions on both channels verified.",
            "- **Brand voice** — approved voice/tone document, do-not-say list, emoji policy.",
            "- **Approved services/offers** — what is actually available to promote this cycle, with terms.",
            "- **Source registry** — every number, review, testimonial, certification, result, or comparison",
            "  must have a named source before it can appear in any post.",
            "- **Testimonial permissions** — written permission for each review/testimonial used.",
            "- **Posting constraints** — client holidays, no-go dates, content blacklist.",
            "- **Daily slots** — confirm the 3 IG + 3 FB local times (hypothesis, adjusted later from results).",
            "",
            "Output: a completed onboarding record. Then re-run `POST /api/admin/run-vip-tasks` so the",
            "5 batch + 5 scheduling + 1 reporting tasks are generated for the cycle.",
            "",
          ].join("\n");
    return [
      clientLine,
      missingBlock,
      "## Why this task exists",
      "",
      "The VIP Daily commitment (180 posts/cycle) cannot start without a client-local timezone and the",
      "client's own Buffer channels. This task confirms both and everything else the accuracy gate needs.",
      "",
      "**LOCKED-IN RULES:** every claim must be verifiable; client hashtags only (never",
      "#MetroReachMedia on client posts); human-written copy; no AI/automation language in client-facing",
      "material.",
      "",
      `*Generated by MetroReach Media VIP pipeline — ${new Date().toISOString()}*`,
    ].join("\n");
  }

  const windowRows = occurrences.length ? formatOccurrenceRows(occurrences) : "";
  const windowBlock =
    kind === "vip-content-batch" || kind === "vip-scheduling"
      ? [
          "",
          `## Post window (Batch ${batchNumber})`,
          "",
          "| Day | Platform | Slot | Local time | dueAt (UTC) | Category |",
          "|---:|---|---:|---|---|---|",
          windowRows,
          "",
        ].join("\n")
      : "";

  const instructions =
    kind === "vip-content-batch"
      ? [
          "## Instructions",
          "",
          `Produce Batch ${batchNumber} (days ${(batchNumber! - 1) * 6 + 1}–${batchNumber! * 6} of the cycle).`,
          "",
          "1. **Research** the client's actual business and approved facts for this window — every claim",
          "   (service detail, number, review, testimonial, certification, result, comparison, availability)",
          "   must trace to a named source in the source registry. Remove anything unverifiable.",
          "2. **Write 18 Instagram captions + 18 Facebook captions** (3 per platform per day) in the",
          "   client's approved voice, following the category mix above.",
          "3. **Create/receive 18 UNIQUE Instagram assets** — each a distinct original 1024×1024",
          "   PNG/WebP with the client's brand lockup (never a template variation). One original per IG",
          "   post; no duplicates within this batch or anywhere else in this cycle.",
          "4. **Attach** asset IDs, concept notes, CDN URLs, and claim source IDs to every post.",
          "5. **QA** — accuracy, brand lockup (visual inspection by reviewer), hashtag counts",
          "   (IG 20–25, FB 3–5, client-specific — never #MetroReachMedia), rights clearance.",
          "6. **Hand off a complete manifest** (18 IG + 18 FB rows with local dates/times, dueAt UTC,",
          "   text, hashtags, asset IDs + live URLs, claim source IDs) to the scheduling task.",
          "",
          "**Acceptance criteria:** 36 posts (18 IG + 18 FB), 18 unique IG asset IDs, every IG asset",
          "visually verified and live on CDN, every claim sourced, hashtag counts correct, all text",
          "human-written in the client's voice.",
          "",
        ].join("\n")
      : kind === "vip-scheduling"
        ? [
            "## Instructions",
            "",
            `Validate and schedule Batch ${batchNumber} (days ${(batchNumber! - 1) * 6 + 1}–${batchNumber! * 6}) on the CLIENT's own Buffer channels.`,
            "",
            "1. **Validate the batch manifest**: exactly 18 IG + 18 FB posts, 18 unique IG assets with live",
            "   HTTPS CDN URLs, correct channel IDs (client's, never agency), valid IANA timezone, dueAt",
            "   conversions correct (each local wall-clock time → UTC via the client's zone — DST-safe,",
            "   never a fixed hour offset), hashtag counts (IG 20–25, FB 3–5), claim source IDs, and",
            "   approval state.",
            "2. **Preflight duplicate check** — query the client's channels for existing scheduled posts;",
            "   skip anything already scheduled for the same text + dueAt.",
            "3. **Create posts** via Buffer GraphQL `createPost` with `mode: customScheduled`,",
            "   `schedulingType: automatic`, `dueAt` (UTC ISO), and `assets: [{ image: { url } }]` for IG.",
            "4. **Retry** Buffer rate-limit responses with a 60-second backoff (durable request log).",
            "5. **Reconcile** — re-query scheduled posts after the batch; record Buffer post IDs; report any",
            "   missing/errored posts as visible, assigned items (never silently dropped).",
            "6. Keep at least the next 7 days scheduled at all times.",
            "",
          ].join("\n")
        : [
            "## Instructions",
            "",
            "Produce the cycle report after the final day's data is available.",
            "",
            "1. **Pull actual data only** — scheduled/sent/error counts from Buffer, and real client",
            "   metrics (leads, engagement, growth). Label every metric with its source; clearly mark",
            "   missing data as missing. Never estimate or invent.",
            "2. **Reconcile the commitment**: 180 intended posts = 90 IG + 90 FB; report delivered vs",
            "   missed per day and per batch.",
            "3. **Document misses and causes** (rate limits, asset delays, client holds) — each must be",
            "   resolved or explicitly reported.",
            "4. **Deliver a factual report** to the client and archive a copy for the team.",
            "",
          ].join("\n");

  return [
    clientLine,
    windowBlock,
    instructions,
    "## Commitment",
    `- ${cycle.committedIg} IG posts (3/day) each with a unique original asset — this batch: 18 unique IG assets.`,
    `- ${cycle.committedFb} FB posts (3/day), each reusing an approved IG asset or original creative.`,
    "- Client's own Buffer channels only. Client hashtags only (IG 20–25, FB 3–5) — never",
    "  #MetroReachMedia on client posts.",
    "- Every claim has a source or is removed (accuracy gate, Operating Principle #1).",
    "",
    "**LOCKED-IN RULES:** 100% verifiable client facts; unique original IG creative; human-written",
    "copy; no AI/automation language in client-facing material.",
    "",
    `*Generated by MetroReach Media VIP pipeline — ${new Date().toISOString()}*`,
  ].join("\n");
}

/** Clamp a deadline so it never lands before the cycle start (first-cycle
 *  batches are produced immediately after onboarding, not on a prior cycle's
 *  rhythm). */
function clampDeadline(computed: string, earliest: string): string {
  const computedDt = DateTime.fromISO(computed);
  const earliestDt = DateTime.fromISO(earliest);
  return computedDt < earliestDt ? earliestDt.toISO()! : computedDt.toISO()!;
}

function buildTaskDeadline(
  cycleStart: string,
  timezone: string,
  kind: VipDailyTaskKind,
  batchNumber: number | null,
): string {
  const noon = (offsetDays: number) =>
    localToUtcIso(addLocalDays(cycleStart, offsetDays, timezone), "12:00", timezone);
  switch (kind) {
    case "vip-onboarding-research":
      return clampDeadline(noon(2), localToUtcIso(addLocalDays(cycleStart, 1, timezone), "12:00", timezone));
    case "vip-content-batch": {
      // Design §2 cadence: batch N brief due (N-1)*6 - 5 days into the cycle
      // (batch 1 before cycle start). Clamp to cycleStart+2d for first cycles.
      const computed = noon((batchNumber! - 1) * 6 - 5);
      return clampDeadline(computed, noon(2));
    }
    case "vip-scheduling": {
      // Scheduling due at the window start, never earlier than cycleStart+4d.
      const computed = noon((batchNumber! - 1) * 6);
      return clampDeadline(computed, noon(4));
    }
    case "vip-reporting":
      return localToUtcIso(addLocalDays(cycleStart, 32, timezone), "12:00", timezone);
  }
}

/**
 * Build all VIP Daily tasks for one 30-day cycle (12 tasks):
 *   1 onboarding/research, 5 content batches (18 IG + 18 FB each),
 *   5 scheduling tasks (one per batch), 1 reporting task.
 * The returned descriptors are inserted idempotently by insertVipDailyTask().
 * `validationOverride` is for tests/pure callers that already know the
 * onboarding state; production callers omit it and validation runs against
 * the DB.
 */
export async function buildVipDailyTasks(
  client: Client,
  cycleStart: string,
  timezone: string,
  validationOverride?: VipOnboardingValidation,
): Promise<{ tasks: VipDailyTaskDescriptor[]; occurrences: VipPostOccurrence[]; cycle: VipCycleInfo }> {
  const validation = validationOverride ?? (await validateVipOnboarding(client));
  const effectiveTz = validation.timezone ?? timezone;
  const cycle = computeVipCycle(client.id, cycleStart, effectiveTz);
  const occurrences = generateVipOccurrences({
    clientId: client.id,
    cycleId: cycle.cycleId,
    cycleStart,
    timezone: effectiveTz,
  });
  const tasks: VipDailyTaskDescriptor[] = [];

  const push = (t: Omit<VipDailyTaskDescriptor, "clientId" | "clientName" | "clientEmail" | "company" | "serviceName" | "deliverableType">) => {
    tasks.push({ ...t, clientId: client.id, clientName: client.name, clientEmail: client.email, company: client.company ?? null, serviceName: "VIP Daily — 180 posts/cycle (90 IG + 90 FB)", deliverableType: t.kind });
  };

  // 1. Onboarding/research task — always created (even when blocked).
  push({
    kind: "vip-onboarding-research",
    cycleId: cycle.cycleId,
    batchNumber: null,
    timezone: effectiveTz,
    idempotencyKey: `vip-daily:${client.id}:${cycleStart}:onboarding`,
    assignedRoles: ["Content Strategist", "Engineer"],
    deadline: buildTaskDeadline(cycleStart, effectiveTz, "vip-onboarding-research", null),
    brief: buildVipBrief({
      kind: "vip-onboarding-research",
      client,
      cycle,
      timezone: effectiveTz,
      batchNumber: null,
      occurrences: [],
      deadline: buildTaskDeadline(cycleStart, effectiveTz, "vip-onboarding-research", null),
      missing: validation.ok ? [] : validation.missing,
    }),
  });

  // Batch + scheduling + reporting tasks require timezone + channels.
  if (!validation.ok) {
    console.warn(
      `[vip-daily] Onboarding incomplete for ${client.id} — only onboarding task created. Missing: ${validation.missing.join("; ")}`,
    );
    return { tasks, occurrences, cycle };
  }

  for (let batch = 1; batch <= 5; batch++) {
    const windowOccurrences = occurrences.filter((o) => o.batchNumber === batch);
    // 2. Batch task (18 IG + 18 FB)
    push({
      kind: "vip-content-batch",
      cycleId: cycle.cycleId,
      batchNumber: batch,
      timezone: effectiveTz,
      idempotencyKey: `vip-daily:${client.id}:${cycleStart}:batch:${batch}`,
      assignedRoles: ["Content Strategist", "Copywriter", "Designer"],
      deadline: buildTaskDeadline(cycleStart, effectiveTz, "vip-content-batch", batch),
      brief: buildVipBrief({
        kind: "vip-content-batch",
        client,
        cycle,
        timezone: effectiveTz,
        batchNumber: batch,
        occurrences: windowOccurrences,
        deadline: buildTaskDeadline(cycleStart, effectiveTz, "vip-content-batch", batch),
        missing: [],
      }),
    });
    // 3. Scheduling task (one per batch)
    push({
      kind: "vip-scheduling",
      cycleId: cycle.cycleId,
      batchNumber: batch,
      timezone: effectiveTz,
      idempotencyKey: `vip-daily:${client.id}:${cycleStart}:scheduling:${batch}`,
      assignedRoles: ["Content Strategist", "Engineer"],
      deadline: buildTaskDeadline(cycleStart, effectiveTz, "vip-scheduling", batch),
      brief: buildVipBrief({
        kind: "vip-scheduling",
        client,
        cycle,
        timezone: effectiveTz,
        batchNumber: batch,
        occurrences: windowOccurrences,
        deadline: buildTaskDeadline(cycleStart, effectiveTz, "vip-scheduling", batch),
        missing: [],
      }),
    });
  }

  // 4. Reporting task
  push({
    kind: "vip-reporting",
    cycleId: cycle.cycleId,
    batchNumber: null,
    timezone: effectiveTz,
    idempotencyKey: `vip-daily:${client.id}:${cycleStart}:reporting`,
    assignedRoles: ["Analytics & Watchdog", "Content Strategist"],
    deadline: buildTaskDeadline(cycleStart, effectiveTz, "vip-reporting", null),
    brief: buildVipBrief({
      kind: "vip-reporting",
      client,
      cycle,
      timezone: effectiveTz,
      batchNumber: null,
      occurrences: [],
      deadline: buildTaskDeadline(cycleStart, effectiveTz, "vip-reporting", null),
      missing: [],
    }),
  });

  return { tasks, occurrences, cycle };
}

// ── Persistence (idempotent) ────────────────────────────────────────────────

/** Insert a VIP task into pipeline_tasks, skipping if its idempotency key
 *  already exists (re-runs never duplicate). */
export async function insertVipDailyTask(task: VipDailyTaskDescriptor): Promise<boolean> {
  try {
    await sql`
      INSERT INTO pipeline_tasks (
        client_id, service_slug, service_name, deliverable_type,
        client_name, client_email, company, task_brief, assigned_roles,
        deadline, task_kind, cycle_id, batch_number, timezone, idempotency_key
      ) VALUES (
        ${task.clientId}, 'vip-daily', ${task.serviceName}, ${task.deliverableType},
        ${task.clientName}, ${task.clientEmail}, ${task.company}, ${task.brief},
        ${task.assignedRoles}, ${task.deadline},
        ${task.kind}, ${task.cycleId}, ${task.batchNumber}, ${task.timezone},
        ${task.idempotencyKey}
      )
      ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
    `;
    return true;
  } catch (err: any) {
    console.error(`[vip-daily] insert failed for ${task.idempotencyKey}:`, err.message);
    return false;
  }
}

/** Write a VIP task brief file for team visibility (best-effort — the DB row
 *  is authoritative). Returns the path or null. */
export function writeVipTaskBrief(task: VipDailyTaskDescriptor): string | null {
  const dir = join(VIP_TASKS_DIR, task.cycleId);
  const filename = `${task.kind}${task.batchNumber ? `-${task.batchNumber}` : ""}.md`;
  const path = join(dir, filename);
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, task.brief, "utf-8");
    return path;
  } catch (err: any) {
    console.error(`[vip-daily] brief write failed ${path}:`, err.message);
    return null;
  }
}

/** Upsert the vip_cycles row for this client+cycle (status reflects whether
 *  onboarding is complete enough to schedule). */
export async function upsertVipCycle(params: {
  clientId: string;
  cycle: VipCycleInfo;
  timezone: string;
  blocked: boolean;
}): Promise<void> {
  try {
    await sql`
      INSERT INTO vip_cycles (
        client_id, cycle_start, cycle_end, timezone,
        committed_ig_posts, committed_fb_posts, committed_total, status
      ) VALUES (
        ${params.clientId}, ${params.cycle.cycleStart}, ${params.cycle.cycleEnd}, ${params.timezone},
        ${params.cycle.committedIg}, ${params.cycle.committedFb}, ${params.cycle.committedTotal},
        ${params.blocked ? "blocked_onboarding" : "planned"}
      )
      ON CONFLICT (client_id, cycle_start) DO UPDATE SET
        timezone = EXCLUDED.timezone,
        cycle_end = EXCLUDED.cycle_end,
        status = CASE
          WHEN ${params.blocked} THEN vip_cycles.status
          ELSE 'planned'
        END,
        updated_at = NOW()
    `;
  } catch (err: any) {
    console.error(`[vip-daily] vip_cycles upsert failed for ${params.clientId}:`, err.message);
  }
}

// ── Orchestration entrypoint (used by pipeline-executor + admin re-run) ─────

export interface VipGenerationResult {
  blocked: boolean;
  missing: string[];
  timezone: string | null;
  cycleId: string | null;
  tasksCreated: number;
  briefsWritten: number;
  occurrences: number;
}

/** Resolve the cycle start for a client: explicit onboarding_data.cycle_start
 *  (YYYY-MM-DD) or today in the client's timezone (UTC fallback when the
 *  timezone is missing — date only). */
function resolveCycleStart(client: Client, timezone: string | null): string {
  const data = (client.onboarding_data ?? {}) as Record<string, any>;
  const explicit = data.cycle_start;
  if (typeof explicit === "string" && /^\d{4}-\d{2}-\d{2}$/.test(explicit)) {
    return explicit;
  }
  return defaultVipCycleStart(timezone ?? "UTC");
}

/**
 * Run VIP task generation for a client (idempotent — safe to call from the
 * Stripe webhook, the admin re-run endpoint, or a monitor after onboarding
 * completes). Always creates the onboarding task; creates the full 12-task
 * set only when timezone + client channels are present.
 */
export async function runVipTaskGeneration(client: Client): Promise<VipGenerationResult> {
  const validation = await validateVipOnboarding(client);
  const timezone = validation.timezone;
  const cycleStart = resolveCycleStart(client, timezone);
  const { tasks, occurrences, cycle } = await buildVipDailyTasks(client, cycleStart, timezone ?? "UTC");
  await upsertVipCycle({
    clientId: client.id,
    cycle,
    timezone: timezone ?? "UTC",
    blocked: !validation.ok,
  });
  let inserted = 0;
  let written = 0;
  for (const task of tasks) {
    const ok = await insertVipDailyTask(task);
    if (ok) inserted++;
    if (writeVipTaskBrief(task)) written++;
  }
  if (validation.ok) {
    console.log(
      `[vip-daily] Cycle ${cycle.cycleId} ready for ${client.id}: ${tasks.length} tasks (${inserted} inserted, ${written} briefs), ${occurrences.length} occurrences in ${timezone}`,
    );
  } else {
    await sendTelegramMessage([
      "<b>⚠️ VIP Daily onboarding blocked</b>",
      `Client: ${client.name} (${client.id})`,
      `Missing: ${validation.missing.join("; ")}`,
      "Only the onboarding/research task was created. Link timezone + client Buffer channels, then re-run POST /api/admin/run-vip-tasks.",
    ].join("\n")).catch(() => {});
  }
  return {
    blocked: !validation.ok,
    missing: validation.missing,
    timezone,
    cycleId: cycle.cycleId,
    tasksCreated: inserted,
    briefsWritten: written,
    occurrences: occurrences.length,
  };
}

// ── Batch manifest validation ───────────────────────────────────────────────

export interface VipBatchPost {
  id: string;
  platform: VipPlatform;
  day: number; // 1..30
  slot: number; // 1..3
  localDate: string;
  localTime: string;
  timezone: string;
  dueAtUtc: string;
  text: string;
  hashtags: string[];
  assetId: string | null; // required for IG
  assetUrl: string | null; // live CDN URL — required for IG
  channelId: string;
  category: VipCategory;
  claimSourceIds: string[];
  approved: boolean;
  bufferPostId: string | null;
}

const IG_HASHTAG_MIN = 20;
const IG_HASHTAG_MAX = 25;
const FB_HASHTAG_MIN = 3;
const FB_HASHTAG_MAX = 5;

function countHashtags(text: string, hashtags: string[]): number {
  const inline = text.match(/#[\w]+/g) ?? [];
  return new Set([...inline, ...hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`))]).size;
}

/**
 * Validate a batch manifest (18 IG + 18 FB for one batch). Returns a list of
 * violation strings — an empty array means the manifest is schedulable.
 */
export function validateVipBatchManifest(posts: VipBatchPost[], channels: VipChannelInfo[]): string[] {
  const violations: string[] = [];
  if (!Array.isArray(posts)) return ["manifest is not an array"];
  const ig = posts.filter((p) => p.platform === "instagram");
  const fb = posts.filter((p) => p.platform === "facebook");
  if (ig.length !== 18) violations.push(`expected 18 IG posts, got ${ig.length}`);
  if (fb.length !== 18) violations.push(`expected 18 FB posts, got ${fb.length}`);

  const channelIds = new Set(channels.map((c) => c.bufferChannelId));
  const igAssetIds = new Set<string>();
  const seenDueAt = new Set<string>();
  const sorted = [...posts].sort((a, b) => a.day - b.day || a.platform.localeCompare(b.platform) || a.slot - b.slot);

  for (const post of sorted) {
    if (post.platform !== "instagram" && post.platform !== "facebook") {
      violations.push(`${post.id}: invalid platform "${post.platform}"`);
      continue;
    }
    if (!post.text || post.text.trim().length < 1) violations.push(`${post.id}: empty caption`);
    if (!isValidIanaTimezone(post.timezone)) violations.push(`${post.id}: invalid timezone "${post.timezone}"`);
    if (!post.dueAtUtc || Number.isNaN(Date.parse(post.dueAtUtc))) {
      violations.push(`${post.id}: unparseable dueAtUtc "${post.dueAtUtc}"`);
    } else {
      // Round-trip: dueAtUtc must convert back to the intended local wall clock.
      const back = DateTime.fromISO(post.dueAtUtc).setZone(post.timezone);
      if (!back.isValid || back.toFormat("HH:mm") !== post.localTime) {
        violations.push(`${post.id}: dueAtUtc ${post.dueAtUtc} does not round-trip to local ${post.localTime} in ${post.timezone} (got ${back.isValid ? back.toFormat("HH:mm") : "invalid"})`);
      }
    }
    if (!channelIds.has(post.channelId)) {
      violations.push(`${post.id}: channelId ${post.channelId} is not an active client channel`);
    }
    if (post.approved !== true) violations.push(`${post.id}: not approved`);
    if (!Array.isArray(post.claimSourceIds)) violations.push(`${post.id}: claimSourceIds must be an array`);

    const hashtagCount = countHashtags(post.text, post.hashtags ?? []);
    if (post.platform === "instagram" && (hashtagCount < IG_HASHTAG_MIN || hashtagCount > IG_HASHTAG_MAX)) {
      violations.push(`${post.id}: IG hashtag count ${hashtagCount} (must be ${IG_HASHTAG_MIN}–${IG_HASHTAG_MAX})`);
    }
    if (post.platform === "facebook" && (hashtagCount < FB_HASHTAG_MIN || hashtagCount > FB_HASHTAG_MAX)) {
      violations.push(`${post.id}: FB hashtag count ${hashtagCount} (must be ${FB_HASHTAG_MIN}–${FB_HASHTAG_MAX})`);
    }
    const allHashtags = [...(post.hashtags ?? []), ...(post.text.match(/#[\w]+/g) ?? [])];
    if (allHashtags.some((h) => h.toLowerCase().includes("metroreachmedia"))) {
      violations.push(`${post.id}: client posts must NOT include #MetroReachMedia`);
    }

    if (post.platform === "instagram") {
      if (!post.assetId) violations.push(`${post.id}: IG post missing assetId`);
      else {
        if (igAssetIds.has(post.assetId)) violations.push(`${post.id}: duplicate IG asset "${post.assetId}" within batch`);
        igAssetIds.add(post.assetId);
      }
      if (!post.assetUrl || !/^https:\/\//.test(post.assetUrl)) {
        violations.push(`${post.id}: IG asset URL must be a live https:// URL (got "${post.assetUrl}")`);
      } else if (/localhost|127\.0\.0\.1/.test(post.assetUrl)) {
        violations.push(`${post.id}: IG asset URL must be publicly reachable (got "${post.assetUrl}")`);
      }
    }
    const dueKey = `${post.platform}:${post.channelId}:${post.dueAtUtc}`;
    if (seenDueAt.has(dueKey)) violations.push(`${post.id}: duplicate ${post.platform} dueAt ${post.dueAtUtc} on channel ${post.channelId}`);
    seenDueAt.add(dueKey);
  }
  return violations;
}

// ── IG asset uniqueness (DB-backed) ─────────────────────────────────────────

export interface VipAssetRecord {
  assetId: string;
  day: number;
  igSlot: number;
  concept?: string;
  cdnUrl?: string;
  status: string;
}

/** Register assets for a cycle; returns any asset_ids that were duplicates
 *  (either repeated within this call or already registered in this cycle from
 *  an earlier batch). Duplicate rows are never inserted. */
export async function registerCycleIgAssets(
  clientId: string,
  cycleId: string,
  assets: VipAssetRecord[],
): Promise<string[]> {
  const duplicates: string[] = [];
  const seen = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.assetId)) {
      if (!duplicates.includes(asset.assetId)) duplicates.push(asset.assetId);
      continue;
    }
    seen.add(asset.assetId);
    try {
      const existing = await sql`
        SELECT 1 FROM vip_assets
        WHERE client_id = ${clientId} AND cycle_id = ${cycleId} AND asset_id = ${asset.assetId}
        LIMIT 1
      `;
      if (existing.length) {
        if (!duplicates.includes(asset.assetId)) duplicates.push(asset.assetId);
        continue;
      }
      await sql`
        INSERT INTO vip_assets (client_id, cycle_id, day, ig_slot, asset_id, concept, cdn_url, status)
        VALUES (${clientId}, ${cycleId}, ${asset.day}, ${asset.igSlot}, ${asset.assetId}, ${asset.concept ?? null}, ${asset.cdnUrl ?? null}, ${asset.status})
      `;
    } catch (err: any) {
      console.error(`[vip-daily] asset insert failed ${asset.assetId}:`, err.message);
    }
  }
  return duplicates;
}

/** Check whether any of the given asset_ids already exist in the cycle's
 *  registry (cross-batch duplicate detection for the scheduling task). */
export async function findCycleIgAssetDuplicates(
  clientId: string,
  cycleId: string,
  assetIds: string[],
): Promise<string[]> {
  if (!assetIds.length) return [];
  try {
    const rows = await sql`
      SELECT asset_id FROM vip_assets
      WHERE client_id = ${clientId} AND cycle_id = ${cycleId}
        AND asset_id = ANY(${assetIds})
    `;
    return (rows as Array<{ asset_id: string }>).map((r) => r.asset_id);
  } catch (err: any) {
    console.error(`[vip-daily] duplicate lookup failed for ${clientId}/${cycleId}:`, err.message);
    return [];
  }
}

// ── Buffer GraphQL scheduling ───────────────────────────────────────────────

const BUFFER_API = "https://api.buffer.com/graphql";
const DEFAULT_ORGANIZATION_ID = "6a603e49b90c45bdaab82cee";
const RETRY_BACKOFF_MS = 60_000;
const MAX_RETRIES = 5;

function getBufferOrganizationId(): string {
  return process.env.BUFFER_ORGANIZATION_ID ?? DEFAULT_ORGANIZATION_ID;
}

async function bufferGraphql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) throw new Error("[vip-daily] BUFFER_ACCESS_TOKEN is not set");
  const res = await fetch(BUFFER_API, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let json: { data?: T; errors?: Array<{ message?: string; extensions?: { code?: string } }> };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`[vip-daily] Buffer returned non-JSON (status ${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok || json.errors?.length) {
    const err = json.errors?.[0];
    const code = err?.extensions?.code ?? "";
    const wrapped = new Error(
      `Buffer GraphQL error: ${err?.message ?? `HTTP ${res.status}`} (${code || "unknown"})`,
    ) as Error & { bufferCode?: string };
    wrapped.bufferCode = code;
    throw wrapped;
  }
  if (json.data === undefined) throw new Error("[vip-daily] Buffer GraphQL response missing data");
  return json.data as T;
}

interface BufferScheduledPost {
  id: string;
  status: string;
  dueAt: string | null;
  text: string | null;
}

/** Query scheduled posts on the given channels (preflight + reconciliation). */
async function getScheduledPosts(channelIds: string[]): Promise<BufferScheduledPost[]> {
  const data = await bufferGraphql<{ posts: { edges: Array<{ node: BufferScheduledPost }> } }>(
    `query GetScheduled($input: PostsInput!, $first: Int) {
      posts(input: $input, first: $first) {
        edges { node { id status dueAt text } }
      }
    }`,
    {
      input: {
        organizationId: getBufferOrganizationId(),
        filter: { channelIds, status: ["scheduled"] },
      },
      first: 200,
    },
  );
  return data.posts.edges.map((e) => e.node);
}

export interface VipScheduleResult {
  batchNumber: number;
  created: number;
  skippedDuplicates: number;
  failed: Array<{ id: string; error: string }>;
  reconciled: number;
  bufferPostIds: string[];
}

/**
 * Schedule one VIP batch (18 IG + 18 FB) on the client's own Buffer channels.
 *   1. Preflight — query existing scheduled posts; skip text+dueAt matches.
 *   2. createPost mutations (mode: customScheduled, schedulingType: automatic)
 *      with 60s backoff retry on rate limits.
 *   3. Reconciliation — re-query and count matches.
 */
export async function scheduleVipBatch(params: {
  client: Client;
  cycleId: string;
  batchNumber: number;
  posts: VipBatchPost[];
  channels: VipChannelInfo[];
  maxRetries?: number;
}): Promise<VipScheduleResult> {
  const { client, cycleId, batchNumber, posts, channels } = params;
  const result: VipScheduleResult = {
    batchNumber,
    created: 0,
    skippedDuplicates: 0,
    failed: [],
    reconciled: 0,
    bufferPostIds: [],
  };
  if (!process.env.BUFFER_ACCESS_TOKEN) {
    result.failed.push({ id: "all", error: "BUFFER_ACCESS_TOKEN is not set" });
    return result;
  }
  const violations = validateVipBatchManifest(posts, channels);
  if (violations.length) {
    result.failed.push({ id: "all", error: `manifest invalid: ${violations.slice(0, 5).join(" | ")}` });
    return result;
  }
  const maxRetries = params.maxRetries ?? MAX_RETRIES;

  // Preflight duplicate check
  const channelIds = [...new Set(channels.map((c) => c.bufferChannelId))];
  let existing: BufferScheduledPost[] = [];
  try {
    existing = await getScheduledPosts(channelIds);
  } catch (err: any) {
    console.error(`[vip-daily] preflight query failed for ${client.id}:`, err.message);
    // Continue — duplicates are re-checked per post below via retry semantics.
  }
  const existingKeys = new Set(
    existing.filter((p) => p.dueAt && p.text).map((p) => `${p.text!.trim()}|${p.dueAt!}`),
  );

  for (const post of posts) {
    const key = `${post.text.trim()}|${post.dueAtUtc}`;
    if (existingKeys.has(key)) {
      result.skippedDuplicates++;
      continue;
    }
    const input: Record<string, unknown> = {
      channelId: post.channelId,
      text: post.text,
      dueAt: post.dueAtUtc,
      assets:
        post.platform === "instagram" && post.assetUrl
          ? [{ image: { url: post.assetUrl } }]
          : [],
      mode: "customScheduled",
      needsApproval: false,
      schedulingType: "automatic",
    };
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const data = await bufferGraphql<{ createPost: { post?: { id: string } } }>(
          `mutation CreateVipPost($input: CreatePostInput!) {
            createPost(input: $input) {
              ... on PostActionSuccess { post { id } }
            }
          }`,
          { input },
        );
        const postId = data.createPost?.post?.id;
        if (!postId) throw new Error("createPost returned no post id");
        result.bufferPostIds.push(postId);
        result.created++;
        console.log(`[vip-daily] scheduled ${post.platform} ${post.id} → ${postId} (${post.dueAtUtc})`);
        break;
      } catch (err: any) {
        const isRateLimit =
          /RATE_LIMIT|429|rate limit/i.test(String(err?.message ?? "")) ||
          err?.bufferCode === "RATE_LIMIT";
        if (isRateLimit && attempt < maxRetries - 1) {
          console.warn(`[vip-daily] rate limited (${post.id}) — retrying in ${RETRY_BACKOFF_MS / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
          continue;
        }
        result.failed.push({ id: post.id, error: String(err?.message ?? err) });
        break;
      }
    }
  }

  // Reconciliation: re-query and count how many of our dueAt/text pairs landed.
  try {
    const after = await getScheduledPosts(channelIds);
    const afterKeys = new Set(after.filter((p) => p.dueAt && p.text).map((p) => `${p.text!.trim()}|${p.dueAt!}`));
    result.reconciled = posts.filter((p) => afterKeys.has(`${p.text.trim()}|${p.dueAtUtc}`)).length;
  } catch (err: any) {
    console.error(`[vip-daily] reconciliation query failed for ${client.id}:`, err.message);
  }

  if (result.failed.length) {
    await sendTelegramMessage([
      "<b>⚠️ VIP Daily batch scheduling — partial failure</b>",
      `Client: ${client.name} (${client.id})`,
      `Cycle: ${cycleId} · Batch ${batchNumber}`,
      `Created: ${result.created} · Skipped (dupes): ${result.skippedDuplicates} · Failed: ${result.failed.length}`,
      ...result.failed.slice(0, 5).map((f) => `• ${f.id}: ${f.error}`),
    ].join("\n")).catch(() => {});
  }

  console.log(
    `[vip-daily] batch ${batchNumber} done for ${client.id}: created=${result.created} dupes=${result.skippedDuplicates} failed=${result.failed.length} reconciled=${result.reconciled}`,
  );
  return result;
}

// ── Queue monitoring ────────────────────────────────────────────────────────

const QUEUE_ALERT_WINDOW_DAYS = 7;
const QUEUE_ALERT_DEDUPE_HOURS = 12;

/** Per client+channel: furthest-out scheduled dueAt, or null if none. */
async function getFurthestScheduledDueAt(channelId: string): Promise<string | null> {
  try {
    const data = await bufferGraphql<{ posts: { edges: Array<{ node: { dueAt: string | null } }> } }>(
      `query FurthestScheduled($input: PostsInput!, $first: Int) {
        posts(input: $input, first: $first) {
          edges { node { dueAt } }
        }
      }`,
      {
        input: {
          organizationId: getBufferOrganizationId(),
          filter: { channelIds: [channelId], status: ["scheduled"] },
        },
        first: 200,
      },
    );
    const dueAts = data.posts.edges
      .map((e) => e.node.dueAt)
      .filter((d): d is string => !!d)
      .sort();
    return dueAts.length ? dueAts[dueAts.length - 1] : null;
  } catch (err: any) {
    console.error(`[vip-daily] scheduled-posts query failed for channel ${channelId}:`, err.message);
    return null;
  }
}

/**
 * Check every planned/active VIP cycle's Buffer queue. Alerts (Telegram) when
 * the furthest scheduled post is ≤7 days out (or nothing is scheduled at all).
 * Deduped per cycle via vip_cycles.queue_alerted_at.
 */
export async function checkVipQueueHealth(): Promise<{
  ok: boolean;
  checked: number;
  alerts: Array<{ clientId: string; cycleId: string; detail: string }>;
}> {
  const alerts: Array<{ clientId: string; cycleId: string; detail: string }> = [];
  let checked = 0;
  try {
    const cycles = await sql`
      SELECT vc.client_id, vc.id AS cycle_id, vc.cycle_start, vc.cycle_end, vc.timezone, vc.queue_alerted_at
      FROM vip_cycles vc
      WHERE vc.status IN ('planned', 'active')
    `;
    for (const cycle of cycles as Array<{
      client_id: string;
      cycle_id: string;
      cycle_start: string;
      timezone: string;
      queue_alerted_at: string | null;
    }>) {
      // Only monitor clients that still have active channels (churn cancels them).
      const channelRows = await sql`
        SELECT buffer_channel_id FROM client_channels
        WHERE status = 'active' AND buffer_channel_id IS NOT NULL
          AND platform IN ('instagram', 'facebook')
          AND (
            customer_email IN (SELECT email FROM clients WHERE id = ${cycle.client_id})
            OR stripe_customer_id IN (SELECT stripe_customer_id FROM clients WHERE id = ${cycle.client_id} AND stripe_customer_id IS NOT NULL)
          )
      `;
      const channelIds = (channelRows as Array<{ buffer_channel_id: string }>)
        .map((r) => r.buffer_channel_id)
        .filter((id) => !AGENCY_CHANNEL_IDS.has(id));
      if (!channelIds.length) continue; // churned / channels not linked — skip
      checked++;

      const dueAts: string[] = [];
      for (const channelId of channelIds) {
        const furthest = await getFurthestScheduledDueAt(channelId);
        if (furthest) dueAts.push(furthest);
      }
      const furthest = dueAts.sort().pop() ?? null;
      const now = DateTime.now().toUTC();
      let detail: string | null = null;
      if (!furthest) {
        detail = "no scheduled posts found on client channels";
      } else {
        const daysRemaining = DateTime.fromISO(furthest).diff(now, "days").days;
        if (daysRemaining <= QUEUE_ALERT_WINDOW_DAYS) {
          detail = `scheduled coverage ends ${furthest} (~${daysRemaining.toFixed(1)} days out) — below the ${QUEUE_ALERT_WINDOW_DAYS}-day minimum`;
        }
      }
      if (detail) {
        const lastAlerted = cycle.queue_alerted_at ? DateTime.fromISO(cycle.queue_alerted_at) : null;
        const dedupeOk =
          !lastAlerted ||
          now.diff(lastAlerted, "hours").hours >= QUEUE_ALERT_DEDUPE_HOURS;
        if (dedupeOk) {
          alerts.push({ clientId: cycle.client_id, cycleId: cycle.cycle_id, detail });
          await sendTelegramMessage([
            "<b>⚠️ VIP Daily queue low (≤7 days)</b>",
            `Client: ${cycle.client_id}`,
            `Cycle: ${cycle.cycle_id} (${cycle.cycle_start} →)`,
            detail,
            "Action: create the next content batch immediately (pipeline rule: never let the queue drop to ≤1 week).",
          ].join("\n")).catch(() => {});
          await sql`
            UPDATE vip_cycles SET queue_alerted_at = NOW(), updated_at = NOW() WHERE id = ${cycle.cycle_id}
          `;
        }
      }
    }
    return { ok: alerts.length === 0, checked, alerts };
  } catch (err: any) {
    console.error("[vip-daily] queue health check failed:", err.message);
    return { ok: false, checked, alerts };
  }
}
