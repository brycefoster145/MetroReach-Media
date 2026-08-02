/**
 * Order Router — MetroReach Media
 *
 * Maps every verified service slug to the responsible team member(s),
 * generates deliverable descriptions, and calculates deadlines.
 *
 * Persists order records in the `orders` table only. Task briefs for the team
 * are written by the pipeline executor (src/lib/pipeline-executor.ts) to
 * /home/team/shared/tasks/ — this module no longer touches the filesystem.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { randomBytes } from "node:crypto";
import { sql } from "~/lib/db";

// ── Team member slugs ──
export const TEAM = {
  contentStrategist: "Content Strategist",
  copywriter: "Copywriter",
  designer: "Designer",
  paidAdsSpecialist: "Paid Ads Specialist",
  analyticsWatchdog: "Analytics & Watchdog",
  qaEngineer: "QA Engineer",
  engineer: "Engineer",
} as const;

type TeamKey = keyof typeof TEAM;

// ── Service → Team mapping ──
// Every verified service slug maps to one or more team members.
// New services must be added here when they're created in Stripe.

const SERVICE_TEAM_MAP: Record<string, TeamKey[]> = {
  // ── Organic Content ──
  "social-media-audit": ["contentStrategist"],
  "monthly-content-calendar": ["contentStrategist", "copywriter"],
  "caption-writing": ["contentStrategist", "copywriter"],
  "hashtag-research": ["contentStrategist"],
  "brand-voice-development": ["contentStrategist", "copywriter"],
  "posting-schedule-optimization": ["contentStrategist"],
  "trend-research": ["contentStrategist"],
  "daily-engagement": ["contentStrategist"],
  "dm-management": ["contentStrategist"],
  "social-listening": ["contentStrategist"],
  "single-platform-management": ["contentStrategist", "copywriter"],
  "multi-platform-management": ["contentStrategist", "copywriter"],
  "platform-setup-optimization": ["engineer"],
  "profile-bio-optimization": ["contentStrategist", "copywriter"],

  // ── Paid Advertising ──
  "meta-ads-management": ["paidAdsSpecialist"],
  "ad-account-setup": ["paidAdsSpecialist", "engineer"],
  "ad-creative-package": ["designer", "paidAdsSpecialist"],
  "ab-testing-optimization": ["paidAdsSpecialist"],
  "pixel-conversion-tracking": ["engineer", "paidAdsSpecialist"],
  "landing-page-review": ["qaEngineer"],

  // ── Social Strategy ──
  "social-media-audit-strategy": ["contentStrategist"],
  "competitor-analysis": ["contentStrategist", "analyticsWatchdog"],
  "social-media-strategy": ["contentStrategist"],
  "content-strategy": ["contentStrategist", "copywriter"],
  "campaign-strategy": ["contentStrategist", "paidAdsSpecialist"],
  "audience-research": ["contentStrategist", "analyticsWatchdog"],
  "organic-growth-strategy": ["contentStrategist"],
  "monthly-strategy-reviews": ["contentStrategist", "analyticsWatchdog"],

  // ── Analytics & Reporting ──
  "monthly-performance-reports": ["analyticsWatchdog"],
  "weekly-performance-summaries": ["analyticsWatchdog"],
  "kpi-dashboard-setup": ["analyticsWatchdog", "engineer"],
  "executive-reports": ["analyticsWatchdog"],
  "competitor-benchmarking": ["analyticsWatchdog"],

  // ── Community Management ──
  "community-management": ["contentStrategist"],
  "daily-monitoring-engagement": ["contentStrategist"],
  "comment-dm-response": ["contentStrategist"],
  "review-management": ["contentStrategist"],
  "social-listening-community": ["contentStrategist"],
  "influencer-research": ["contentStrategist"],
  "community-engagement-templates": ["contentStrategist", "copywriter"],
  "platform-setup-community": ["engineer"],
  "social-inbox-management": ["contentStrategist"],
  "social-inbox-design": ["designer"],

  // ── VIP Daily ($8,500/mo) ──
  "vip-daily": ["contentStrategist", "copywriter", "qaEngineer"],

  // ── Premium Audit ──
  "premium-growth-audit": ["contentStrategist", "analyticsWatchdog"],
};

// ── Deliverable descriptions ──

function generateDeliverableDescription(serviceName: string, serviceSlug: string): string {
  return `**${serviceName}** — deliverable for client.

### SLA
- **Phase 1 (24 hours):** Onboarding questionnaire sent, platform access requested, welcome email delivered
- **Phase 2 (48 hours):** Initial draft or first deliverable ready for review
- **Ongoing (monthly services):** Regular content/ads running on the standard posting schedule

### Delivery Checklist
- [ ] Onboarding questionnaire sent (immediate — handled by webhook)
- [ ] Platform access obtained from client
- [ ] Initial research/audit complete
- [ ] First deliverable created and internally reviewed
- [ ] Delivered to client with summary email
- [ ] Client feedback incorporated (if applicable)

### Notes
- Service slug: \`${serviceSlug}\`
- Standard turnaround: 48 hours from purchase for all initial deliverables
- Monthly services: content begins posting on next available scheduled slot after onboarding is complete`;
}

// ── Deadline calculation ──

function calculateDeadline(recurring: boolean): Date {
  const deadline = new Date();
  // 2 calendar days = 48 hours from purchase
  deadline.setDate(deadline.getDate() + 2);
  return deadline;
}

// ── Order record type ──

export interface OrderRecord {
  id: string;
  clientEmail: string;
  clientName?: string;
  serviceName: string;
  serviceSlug: string;
  amountCents: number;
  assignedTeam: string[];
  status: "pending" | "in_progress" | "delivered";
  deadline: Date;
  deliverableDescription: string;
  createdAt: Date;
}

// ── Main: create order from checkout session ──

export async function createOrder(params: {
  clientEmail: string;
  clientName?: string;
  serviceName: string;
  serviceSlug: string;
  amountCents: number;
  recurring: boolean;
  stripeSessionId?: string;
}): Promise<OrderRecord> {
  const {
    clientEmail,
    clientName,
    serviceName,
    serviceSlug,
    amountCents,
    recurring,
    stripeSessionId,
  } = params;

  const teamKeys = SERVICE_TEAM_MAP[serviceSlug] || ["contentStrategist"];
  const assignedTeam = teamKeys.map((k) => TEAM[k]);
  const deadline = calculateDeadline(recurring);
  const deliverableDescription = generateDeliverableDescription(serviceName, serviceSlug);
  const orderId = `ord-${randomBytes(8).toString("hex")}`;

  // ── 1. Insert into orders table ──
  await sql`
    INSERT INTO orders (
      id, client_email, client_name, service_name, service_slug,
      amount_cents, stripe_session_id, assigned_team_members,
      status, deadline, deliverable_description, created_at, updated_at
    ) VALUES (
      ${orderId}, ${clientEmail}, ${clientName || null}, ${serviceName}, ${serviceSlug},
      ${amountCents}, ${stripeSessionId || null},
      ${JSON.stringify(assignedTeam)},
      'pending', ${deadline.toISOString()}, ${deliverableDescription},
      NOW(), NOW()
    )
  `;

  // ── 2. Return the order record ──
  // Task briefs are handled by the pipeline executor, not written here.

  return {
    id: orderId,
    clientEmail,
    clientName,
    serviceName,
    serviceSlug,
    amountCents,
    assignedTeam,
    status: "pending",
    deadline,
    deliverableDescription,
    createdAt: new Date(),
  };
}

// ── Query helpers ──

export async function getOrdersByEmail(email: string) {
  const rows = await sql`
    SELECT * FROM orders WHERE client_email = ${email} ORDER BY created_at DESC
  `;
  return rows;
}

export async function getOrderById(id: string) {
  const rows = await sql`
    SELECT * FROM orders WHERE id = ${id}
  `;
  return rows[0] || null;
}

export async function updateOrderStatus(
  id: string,
  status: "pending" | "in_progress" | "delivered",
) {
  await sql`
    UPDATE orders SET status = ${status}, updated_at = NOW() WHERE id = ${id}
  `;
}

// ── Resolve team for a service slug (for external use) ──

export function getAssignedTeam(serviceSlug: string): string[] {
  const keys = SERVICE_TEAM_MAP[serviceSlug] || ["contentStrategist"];
  return keys.map((k) => TEAM[k]);
}

export function resolveTeamNames(keys: TeamKey[]): string[] {
  return keys.map((k) => TEAM[k]);
}
