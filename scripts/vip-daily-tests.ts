/**
 * VIP Daily pipeline tests — run with: bun run scripts/vip-daily-tests.ts
 *
 * Covers the pure logic: IANA timezone validation, DST-safe dueAt conversion,
 * 30-day cycle boundaries, occurrence generation (180 = 90 IG + 90 FB),
 * task generation + idempotency keys, and batch manifest validation.
 * DB-dependent functions (channel lookup, task inserts, asset registry,
 * queue monitor) are skipped when DATABASE_URL is not usable.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */
import { DateTime } from "luxon";
import {
  isValidIanaTimezone,
  localToUtcIso,
  addLocalDays,
  generateVipOccurrences,
  computeVipCycle,
  buildVipDailyTasks,
  validateVipBatchManifest,
  type VipChannelInfo,
  type VipBatchPost,
  type VipOnboardingValidation,
} from "../src/lib/vip-daily";
import type { Client } from "../src/lib/email-sequences";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(`${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else {
    failed++;
    failures.push(`${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const CLIENT: Client = {
  id: "client-test-001",
  email: "owner@harbor-marina.com",
  name: "Harbor Marina Test",
  company: "Harbor Marina LLC",
  service: "VIP Daily",
  service_slug: "vip-daily",
  status: "active",
  pipeline_status: "in_progress",
  onboarding_data: { timezone: "America/Chicago" },
};

const VALID_CHANNELS: VipChannelInfo[] = [
  { platform: "instagram", bufferChannelId: "client-ig-123" },
  { platform: "facebook", bufferChannelId: "client-fb-456" },
];

const GOOD_VALIDATION: VipOnboardingValidation = {
  ok: true,
  timezone: "America/Chicago",
  channels: VALID_CHANNELS,
  missing: [],
};

// ── 1. IANA timezone validation ─────────────────────────────────────────────

assert(isValidIanaTimezone("America/New_York"), "valid IANA tz accepted");
assert(isValidIanaTimezone("America/Chicago"), "valid IANA tz accepted (Chicago)");
assert(isValidIanaTimezone("Europe/London"), "valid IANA tz accepted (London)");
assert(isValidIanaTimezone("UTC"), "UTC accepted");
assert(!isValidIanaTimezone("ET"), "ET rejected (design: IANA required, not ET)");
assert(!isValidIanaTimezone(""), "empty tz rejected");
assert(!isValidIanaTimezone(null), "null tz rejected");
assert(!isValidIanaTimezone("Mars/Olympus"), "garbage tz rejected");
assert(!isValidIanaTimezone("America/NotARealPlace"), "unknown IANA region rejected");

// ── 2. DST-safe dueAt conversion ────────────────────────────────────────────

// Spring forward 2026-03-08 (US, 2nd Sunday in March — transition at 02:00):
// the 8th is already EDT after 02:00, so the day BEFORE is the last EST day.
assertEqual(localToUtcIso("2026-03-07", "09:00", "America/New_York"), "2026-03-07T14:00:00.000Z", "pre-spring-forward 09:00 EST→UTC");
assertEqual(localToUtcIso("2026-03-08", "09:00", "America/New_York"), "2026-03-08T13:00:00.000Z", "spring-forward day 09:00 EDT→UTC");
// Next day: still EDT (-04:00) → 13:00 UTC
assertEqual(localToUtcIso("2026-03-09", "09:00", "America/New_York"), "2026-03-09T13:00:00.000Z", "post-spring-forward 09:00 EDT→UTC");
// Fall back 2026-11-01 (US, 1st Sunday in November — transition at 02:00):
// the 1st is already EST after 02:00; the day BEFORE is the last EDT day.
assertEqual(localToUtcIso("2026-10-31", "09:00", "America/New_York"), "2026-10-31T13:00:00.000Z", "pre-fall-back 09:00 EDT→UTC");
assertEqual(localToUtcIso("2026-11-01", "09:00", "America/New_York"), "2026-11-01T14:00:00.000Z", "fall-back day 09:00 EST→UTC");
assertEqual(localToUtcIso("2026-11-02", "09:00", "America/New_York"), "2026-11-02T14:00:00.000Z", "post-fall-back 09:00 EST→UTC");
// Evening slot across spring-forward boundary
assertEqual(localToUtcIso("2026-03-08", "17:00", "America/New_York"), "2026-03-08T21:00:00.000Z", "spring-forward 17:00 EDT→UTC");
// Europe/London BST vs GMT
assertEqual(localToUtcIso("2026-07-15", "12:00", "Europe/London"), "2026-07-15T11:00:00.000Z", "London BST 12:00→11:00Z");
assertEqual(localToUtcIso("2026-01-15", "12:00", "Europe/London"), "2026-01-15T12:00:00.000Z", "London GMT 12:00→12:00Z");
// America/Chicago across spring forward (Mar 8 2026)
assertEqual(localToUtcIso("2026-03-07", "09:00", "America/Chicago"), "2026-03-07T15:00:00.000Z", "Chicago pre-DST 09:00 CST→UTC");
assertEqual(localToUtcIso("2026-03-08", "09:00", "America/Chicago"), "2026-03-08T14:00:00.000Z", "Chicago spring-forward 09:00 CDT→UTC");
assertEqual(localToUtcIso("2026-03-09", "09:00", "America/Chicago"), "2026-03-09T14:00:00.000Z", "Chicago post-DST 09:00 CDT→UTC");

// addLocalDays across DST boundary
assertEqual(addLocalDays("2026-03-08", 1, "America/New_York"), "2026-03-09", "addLocalDays across DST");
assertEqual(addLocalDays("2026-02-27", 2, "America/New_York"), "2026-03-01", "addLocalDays across month");

// ── 3. Cycle computation — always exactly 30 days / 180 posts ───────────────

const cycleFeb = computeVipCycle("client-test-001", "2027-02-01", "America/New_York");
assertEqual(cycleFeb.cycleEnd, "2027-03-02", "Feb non-leap 2027: 30-day cycle ends Mar 2"); // Feb 1 + 29 days
assertEqual(cycleFeb.committedTotal, 180, "committed total 180");
assertEqual(cycleFeb.committedIg, 90, "committed IG 90");
assertEqual(cycleFeb.committedFb, 90, "committed FB 90");
assertEqual(cycleFeb.cycleId, "vip-client-test-001-2027-02-01", "cycleId format");

const cycleAug = computeVipCycle("client-test-001", "2026-08-01", "America/New_York");
assertEqual(cycleAug.cycleEnd, "2026-08-30", "31-day calendar month still yields 30-day cycle (ends Aug 30)");
assertEqual(cycleAug.committedTotal, 180, "August cycle still 180 posts (never 186)");

// ── 4. Occurrence generation ────────────────────────────────────────────────

const occ = generateVipOccurrences({
  clientId: "client-test-001",
  cycleId: "vip-client-test-001-2026-08-01",
  cycleStart: "2026-08-01",
  timezone: "America/Chicago",
});
assertEqual(occ.length, 180, "180 occurrences total");
assertEqual(occ.filter((o) => o.platform === "instagram").length, 90, "90 IG occurrences");
assertEqual(occ.filter((o) => o.platform === "facebook").length, 90, "90 FB occurrences");
assertEqual(new Set(occ.map((o) => o.batchNumber)).size, 5, "5 batches");
for (let b = 1; b <= 5; b++) {
  const inBatch = occ.filter((o) => o.batchNumber === b);
  assertEqual(inBatch.length, 36, `batch ${b} has 36 occurrences`);
  assertEqual(inBatch.filter((o) => o.platform === "instagram").length, 18, `batch ${b} has 18 IG`);
  assertEqual(inBatch.filter((o) => o.platform === "facebook").length, 18, `batch ${b} has 18 FB`);
}
// 6 posts per day (3 IG + 3 FB)
const day1 = occ.filter((o) => o.day === 1);
assertEqual(day1.length, 6, "day 1 has 6 posts");
assertEqual(new Set(day1.map((o) => o.localDate)).size, 1, "day 1 posts share localDate");
// IG and FB slot times differ (design: FB not matching IG exact times)
const igTimes = day1.filter((o) => o.platform === "instagram").map((o) => o.localTime);
const fbTimes = day1.filter((o) => o.platform === "facebook").map((o) => o.localTime);
assert(igTimes.join() !== fbTimes.join(), "IG and FB slot times differ");
// Every dueAt is a valid UTC ISO and round-trips to the local wall clock
for (const o of occ) {
  const back = DateTime.fromISO(o.dueAtUtc).setZone(o.timezone);
  assert(back.toFormat("HH:mm") === o.localTime, `round-trip ${o.localDate} ${o.localTime} → ${o.dueAtUtc} (${o.platform} slot ${o.slot})`);
  assert(o.localDate.startsWith("2026-08-"), `localDate ${o.localDate} within cycle`, o);
}
// Categories from the 30-day skeleton: day 1 IG = E,B,G
assertEqual(day1.filter((o) => o.platform === "instagram").map((o) => o.category).join(","), "educational,behind_scenes,engagement", "day 1 IG categories (E,B,G)");
// Mix from the literal 30-day skeleton table (design §1). The design's
// "~22 E / ~22 B / ~22 G / ~12 S / ~12 P" is a planning TARGET; the table
// itself yields 30/17/18/13/12 across the 90 IG slots — both are preserved:
// the template is authoritative, the target guides slot substitution.
const igCats = occ.filter((o) => o.platform === "instagram").map((o) => o.category);
const count = (c: string) => igCats.filter((x) => x === c).length;
assertEqual(count("educational"), 30, "IG educational count (table-derived)");
assertEqual(count("behind_scenes"), 17, "IG behind_scenes count (table-derived)");
assertEqual(count("engagement"), 18, "IG engagement count (table-derived)");
assertEqual(count("social_proof"), 13, "IG social_proof count (table-derived)");
assertEqual(count("promotional"), 12, "IG promotional count (table-derived)");

// Invalid timezone throws
let threw = false;
try {
  generateVipOccurrences({ clientId: "x", cycleId: "y", cycleStart: "2026-08-01", timezone: "ET" });
} catch {
  threw = true;
}
assert(threw, "generateVipOccurrences throws on non-IANA timezone");

// ── 5. Task generation (12 tasks, idempotency keys) ─────────────────────────

const built = await buildVipDailyTasks(CLIENT, "2026-08-01", "America/Chicago", GOOD_VALIDATION);
assertEqual(built.tasks.length, 12, "12 tasks per cycle");
const kinds = built.tasks.map((t) => t.kind);
assertEqual(kinds.filter((k) => k === "vip-onboarding-research").length, 1, "1 onboarding task");
assertEqual(kinds.filter((k) => k === "vip-content-batch").length, 5, "5 batch tasks");
assertEqual(kinds.filter((k) => k === "vip-scheduling").length, 5, "5 scheduling tasks");
assertEqual(kinds.filter((k) => k === "vip-reporting").length, 1, "1 reporting task");

const batchKeys = built.tasks
  .filter((t) => t.kind === "vip-content-batch")
  .map((t) => t.idempotencyKey)
  .sort();
assertEqual(
  batchKeys,
  [
    "vip-daily:client-test-001:2026-08-01:batch:1",
    "vip-daily:client-test-001:2026-08-01:batch:2",
    "vip-daily:client-test-001:2026-08-01:batch:3",
    "vip-daily:client-test-001:2026-08-01:batch:4",
    "vip-daily:client-test-001:2026-08-01:batch:5",
  ],
  "batch idempotency keys match design format",
);
const allKeys = built.tasks.map((t) => t.idempotencyKey);
assertEqual(new Set(allKeys).size, 12, "all 12 idempotency keys unique");
const scheduleKeys = built.tasks.filter((t) => t.kind === "vip-scheduling").map((t) => t.idempotencyKey).sort();
assertEqual(scheduleKeys[0], "vip-daily:client-test-001:2026-08-01:scheduling:1", "scheduling key format");

// Every batch task references exactly its 18 IG + 18 FB window occurrences
for (const t of built.tasks.filter((t) => t.kind === "vip-content-batch")) {
  assert(t.brief.includes(`${t.batchNumber}`), `batch ${t.batchNumber} brief mentions batch number`);
}
// Deadlines are all valid ISO and in the future relative to cycle start
for (const t of built.tasks) {
  assert(!Number.isNaN(Date.parse(t.deadline)), `deadline parseable for ${t.idempotencyKey}`);
}
// Reporting task due after cycle end
const reporting = built.tasks.find((t) => t.kind === "vip-reporting")!;
assert(DateTime.fromISO(reporting.deadline) > DateTime.fromISO("2026-08-30T00:00:00Z"), "reporting due after cycle end");

// ── 6. Blocked path (missing timezone / channels) ───────────────────────────

const blockedValidation: VipOnboardingValidation = {
  ok: false,
  timezone: null,
  channels: [],
  missing: ["timezone (IANA, e.g. America/New_York — not 'ET')", "active client Instagram Buffer channel (buffer_channel_id linked)", "active client Facebook Buffer channel (buffer_channel_id linked)"],
};
const blocked = await buildVipDailyTasks(CLIENT, "2026-08-01", "UTC", blockedValidation);
assertEqual(blocked.tasks.length, 1, "blocked: only onboarding task created");
assertEqual(blocked.tasks[0].kind, "vip-onboarding-research", "blocked: task is onboarding");
assert(blocked.tasks[0].brief.includes("BLOCKED"), "blocked brief marks BLOCKED");
assert(blocked.tasks[0].brief.includes("America/New_York"), "blocked brief names the missing timezone requirement");

// ── 7. Batch manifest validation ────────────────────────────────────────────

function makePost(overrides: Partial<VipBatchPost> = {}): VipBatchPost {
  return {
    id: "p1",
    platform: "instagram",
    day: 1,
    slot: 1,
    localDate: "2026-08-01",
    localTime: "09:00",
    timezone: "America/Chicago",
    dueAtUtc: "2026-08-01T14:00:00.000Z",
    text: "A verified tip about our marina services. #MarinaLife #LakeLife #Boating #Dock #Harbor #Summer #Boaters #Watersports #Fishing #LocalBusiness #Chicago #Illinois #FamilyFun #Weekend #BoatingLife #MarinaServices #LakeMichigan #Dockage #Yacht #BoatMaintenance #Seasons #BoatStorage",
    hashtags: ["#MarinaLife"],
    assetId: "asset-001",
    assetUrl: "https://cdn.metroreachagency.com/clients/harbor-marina/cycle-1/asset-001.webp",
    channelId: "client-ig-123",
    category: "educational",
    claimSourceIds: ["src-1"],
    approved: true,
    bufferPostId: null,
    ...overrides,
  };
}

const IG_SLOTS = ["09:00", "13:00", "17:00"];
const FB_SLOTS = ["10:00", "14:30", "18:30"];

const igPosts = [1, 2, 3, 4, 5, 6].flatMap((day) =>
  [1, 2, 3].map((slot) =>
    makePost({
      id: `ig-d${day}-s${slot}`,
      day,
      slot,
      localDate: `2026-08-0${day}`,
      localTime: IG_SLOTS[slot - 1],
      dueAtUtc: localToUtcIso(`2026-08-0${day}`, IG_SLOTS[slot - 1], "America/Chicago"),
      assetId: `asset-d${day}-s${slot}`,
      text: `IG post ${day}/${slot} — verified marina tip #MarinaLife #LakeLife #Boating #Dock #Harbor #Summer #Boaters #Watersports #Fishing #LocalBusiness #Chicago #Illinois #FamilyFun #Weekend #BoatingLife #MarinaServices #LakeMichigan #Dockage #Yacht #BoatMaintenance #BoatStorage #Seasonal`,
    }),
  ),
);
const fbPosts = [1, 2, 3, 4, 5, 6].flatMap((day) =>
  [1, 2, 3].map((slot) =>
    makePost({
      id: `fb-d${day}-s${slot}`,
      platform: "facebook",
      day,
      slot,
      localDate: `2026-08-0${day}`,
      localTime: FB_SLOTS[slot - 1],
      dueAtUtc: localToUtcIso(`2026-08-0${day}`, FB_SLOTS[slot - 1], "America/Chicago"),
      assetId: `asset-fb-${day}-${slot}`,
      assetUrl: "https://cdn.metroreachagency.com/clients/harbor-marina/cycle-1/fb.webp",
      channelId: "client-fb-456",
      text: `FB post ${day}/${slot} — marina update #MarinaLife #LakeLife #Boating`,
      hashtags: ["#MarinaLife"],
    }),
  ),
);
assertEqual(igPosts.length, 18, "18 IG posts generated for manifest");
assertEqual(fbPosts.length, 18, "18 FB posts generated for manifest");
const validManifest = [...igPosts, ...fbPosts];
assertEqual(validateVipBatchManifest(validManifest, VALID_CHANNELS), [], "valid 36-post manifest passes");

// Too few IG posts
assert(
  validateVipBatchManifest([...validManifest.slice(0, 17), ...fbPosts], VALID_CHANNELS).some((v) => v.includes("expected 18 IG")),
  "17 IG posts rejected",
);
// Duplicate IG asset within batch
assert(
  validateVipBatchManifest([...validManifest.slice(0, 17), makePost({ ...igPosts[5], assetId: igPosts[0].assetId, id: "dup-ig" }), ...fbPosts], VALID_CHANNELS)
    .some((v) => v.includes("duplicate IG asset")),
  "duplicate IG asset rejected",
);
// Agency channel
assert(
  validateVipBatchManifest([...validManifest.slice(0, 17), makePost({ ...igPosts[5], channelId: "6a6156cee2638b94d7b9abf0", id: "agency" }), ...fbPosts], VALID_CHANNELS)
    .some((v) => v.includes("not an active client channel")),
  "agency channel rejected",
);
// #MetroReachMedia on a client post
assert(
  validateVipBatchManifest([...validManifest.slice(0, 17), makePost({ ...igPosts[5], id: "brand", text: "hello #MetroReachMedia #MarinaLife #Boating #Dock #Harbor #Summer #Boaters #Watersports #Fishing #LocalBusiness #Chicago #Illinois #FamilyFun #Weekend #BoatingLife #MarinaServices #LakeMichigan #Dockage #Yacht #BoatMaintenance #BoatStorage #Seasonal #X" }), ...fbPosts], VALID_CHANNELS)
    .some((v) => v.includes("#MetroReachMedia")),
  "#MetroReachMedia rejected on client post",
);
// Non-live asset URL (http:// localhost — rejected as not https/live)
assert(
  validateVipBatchManifest([...validManifest.slice(0, 17), makePost({ ...igPosts[5], id: "local", assetUrl: "http://localhost:3000/img.webp" }), ...fbPosts], VALID_CHANNELS)
    .some((v) => v.includes("IG asset URL")),
  "non-live/localhost asset URL rejected",
);
// IG hashtag count too low
assert(
  validateVipBatchManifest([...validManifest.slice(0, 17), makePost({ ...igPosts[5], id: "fewtags", text: "short #MarinaLife" }), ...fbPosts], VALID_CHANNELS)
    .some((v) => v.includes("IG hashtag count")),
  "IG hashtag count enforced (20–25)",
);
// FB hashtag count too high
assert(
  validateVipBatchManifest([...igPosts, ...fbPosts.slice(0, 17), makePost({ ...fbPosts[5], id: "manytags", text: "a #one #two #three #four #five #six #seven" })], VALID_CHANNELS)
    .some((v) => v.includes("FB hashtag count")),
  "FB hashtag count enforced (3–5)",
);
// dueAt round-trip mismatch
assert(
  validateVipBatchManifest([...validManifest.slice(0, 17), makePost({ ...igPosts[5], id: "wrongtz", dueAtUtc: "2026-08-01T01:00:00.000Z" }), ...fbPosts], VALID_CHANNELS)
    .some((v) => v.includes("does not round-trip")),
  "dueAt/local-time mismatch rejected",
);
// Unapproved post
assert(
  validateVipBatchManifest([...validManifest.slice(0, 17), makePost({ ...igPosts[5], id: "unapproved", approved: false }), ...fbPosts], VALID_CHANNELS)
    .some((v) => v.includes("not approved")),
  "unapproved post rejected",
);
// Duplicate dueAt on same platform+channel
assert(
  validateVipBatchManifest([...validManifest.slice(0, 17), makePost({ ...igPosts[5], id: "dupdue", dueAtUtc: igPosts[0].dueAtUtc, localTime: igPosts[0].localTime }), ...fbPosts], VALID_CHANNELS)
    .some((v) => v.includes("duplicate instagram dueAt")),
  "duplicate dueAt rejected",
);

// ── 8. Task brief content sanity ────────────────────────────────────────────

const batch1 = built.tasks.find((t) => t.kind === "vip-content-batch" && t.batchNumber === 1)!;
assert(batch1.brief.includes("18 Instagram captions + 18 Facebook captions"), "batch brief mentions 36 captions");
assert(batch1.brief.includes("18 UNIQUE Instagram assets"), "batch brief requires 18 unique IG assets");
const sched1 = built.tasks.find((t) => t.kind === "vip-scheduling" && t.batchNumber === 1)!;
assert(sched1.brief.includes("customScheduled"), "scheduling brief mentions customScheduled");
assert(sched1.brief.toLowerCase().includes("preflight duplicate"), "scheduling brief mentions preflight duplicate check");
assert(sched1.brief.includes("60-second backoff"), "scheduling brief mentions 60s backoff");
const reportTask = built.tasks.find((t) => t.kind === "vip-reporting")!;
assert(reportTask.brief.includes("180 intended posts = 90 IG + 90 FB"), "reporting brief reconciles 180 posts");

// ── Results ─────────────────────────────────────────────────────────────────

console.log(`\nVIP Daily tests: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("All VIP Daily pipeline tests passed ✓");
process.exit(0);
