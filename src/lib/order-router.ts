/**
 * Order Router — MetroReach Media
 *
 * Maps every verified service slug to the responsible team member(s),
 * generates deliverable descriptions, and calculates deadlines.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
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
};

// ── Deliverable descriptions ──

function generateDeliverableDescription(serviceName: string, serviceSlug: string): string {
  return `**${serviceName}** — deliverable for client.

### Scope
- Complete delivery of the ${serviceName} service as described on metroreachagency.com
- Follow the standard MetroReach Media quality bar for all deliverables
- Coordinate with other team members as needed

### Delivery Checklist
- [ ] Initial research/audit complete
- [ ] Draft created and internally reviewed
- [ ] Client-ready version prepared
- [ ] Delivered to client with summary email
- [ ] Client feedback incorporated (if applicable)

### Notes
- Service slug: \`${serviceSlug}\`
- Standard turnaround: 5 business days for one-time services
- Monthly services: first deliverables within 5 business days, then recurring monthly`;
}

// ── Deadline calculation ──

function calculateDeadline(recurring: boolean): Date {
  const deadline = new Date();
  // 5 business days = 7 calendar days (covers weekend)
  deadline.setDate(deadline.getDate() + 7);
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

  // ── 2. Write order file to shared directory ──
  await writeOrderFile({
    id: orderId,
    clientEmail,
    clientName,
    serviceName,
    serviceSlug,
    amountCents,
    assignedTeam,
    deadline,
    deliverableDescription,
  });

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

// ── Write order markdown file ──

const ORDERS_DIR = "/home/team/shared/orders";

async function writeOrderFile(order: {
  id: string;
  clientEmail: string;
  clientName?: string;
  serviceName: string;
  serviceSlug: string;
  amountCents: number;
  assignedTeam: string[];
  deadline: Date;
  deliverableDescription: string;
}): Promise<void> {
  try {
    mkdirSync(ORDERS_DIR, { recursive: true });
  } catch {
    // Directory exists — ok
  }

  const amountDisplay = `$${(order.amountCents / 100).toFixed(2)}`;
  const teamList = order.assignedTeam.map((t) => `- **${t}**`).join("\n");
  const deadlineStr = order.deadline.toISOString().split("T")[0];
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  const markdown = [
    `# Order: ${order.id}`,
    "",
    `> **Status:** pending  `,
    `> **Created:** ${now} UTC`,
    "",
    "---",
    "",
    "## Client",
    `- **Email:** ${order.clientEmail}`,
    `- **Name:** ${order.clientName || "N/A"}`,
    "",
    "## Service",
    `- **Name:** ${order.serviceName}`,
    `- **Slug:** \`${order.serviceSlug}\``,
    `- **Amount:** ${amountDisplay}`,
    `- **Deadline:** ${deadlineStr}`,
    "",
    "## Assigned Team",
    teamList,
    "",
    "## Deliverable",
    order.deliverableDescription
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n"),
    "",
    "---",
    "",
    "### Instructions for Lead",
    "1. Review the assigned team members above",
    "2. Delegate this order to the appropriate team member(s) via the task board",
    "3. Monitor progress — status should move: `pending → in_progress → delivered`",
    "4. File should be moved to `/home/team/shared/orders/completed/` once delivered",
    "",
    `*Generated by MetroReach Media delivery pipeline*`,
  ].join("\n");

  writeFileSync(join(ORDERS_DIR, `${order.id}.md`), markdown, "utf-8");
  console.log(`Order file written: ${ORDERS_DIR}/${order.id}.md`);
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
