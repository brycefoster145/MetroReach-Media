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
const TASKS_DIR = "/home/team/shared/tasks";

// Map team member names to their agent usernames for delegation
const TEAM_MEMBER_TO_AGENT: Record<string, string> = {
  "Content Strategist": "agent-content-strategist",
  "Copywriter": "agent-copywriter",
  "Designer": "agent-designer",
  "Paid Ads Specialist": "agent-paid-ads-specialist",
  "Analytics & Watchdog": "agent-analytics-watchdog",
  "QA Engineer": "agent-qa-engineer",
  "Engineer": "agent-engineer",
};

async function writeSpecialistTaskFiles(order: {
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
  const deadlineStr = order.deadline.toISOString().split("T")[0];
  const clientLabel = order.clientName || order.clientEmail;

  for (const specialist of order.assignedTeam) {
    const agentUser = TEAM_MEMBER_TO_AGENT[specialist];
    if (!agentUser) {
      console.log(`[order-router] No agent mapping for specialist: ${specialist}`);
      continue;
    }

    const taskDir = join(TASKS_DIR, agentUser);
    try {
      mkdirSync(taskDir, { recursive: true });
    } catch {
      // Directory exists — ok
    }

    const taskMarkdown = [
      `# Task: ${order.serviceName}`,
      "",
      `> **Order:** ${order.id}  `,
      `> **Assigned to:** ${specialist}  `,
      `> **Deadline:** ${deadlineStr} (48-hour SLA)  `,
      "",
      "---",
      "",
      "## Client",
      `- **Name:** ${clientLabel}`,
      `- **Email:** ${order.clientEmail}`,
      "",
      "## Your Role",
      `As **${specialist}**, deliver your portion of the ${order.serviceName} service.`,
      "Coordinate with other assigned team members as needed.",
      "",
      "## Deliverable Scope",
      order.deliverableDescription
        .split("\n")
        .map((l) => l.trimEnd())
        .join("\n"),
      "",
      "---",
      "",
      "### Auto-Delegation Metadata",
      `- specialist: ${specialist}`,
      `- agent: ${agentUser}`,
      `- order: ${order.id}`,
      `- service: ${order.serviceSlug}`,
      "",
      `*Generated by MetroReach Media auto-delegation pipeline*`,
    ].join("\n");

    writeFileSync(join(taskDir, `${order.id}.md`), taskMarkdown, "utf-8");
    console.log(`[order-router] Task file written: ${taskDir}/${order.id}.md → ${specialist}`);
  }
}

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
    "1. **URGENT — 48-hour SLA.** Review and delegate within 1 hour of order creation",
    "2. Assign to the team members listed above",
    "3. Phase 1 (first 24h): onboarding, platform access, welcome",
    "4. Phase 2 (48h): first deliverable ready for client review",
    "5. Monitor progress — status should move: `pending → in_progress → delivered`",
    "6. File should be moved to `/home/team/shared/orders/completed/` once delivered",
    "",
    `*Generated by MetroReach Media delivery pipeline*`,
  ].join("\n");

  writeFileSync(join(ORDERS_DIR, `${order.id}.md`), markdown, "utf-8");
  console.log(`Order file written: ${ORDERS_DIR}/${order.id}.md`);

  // ── Write per-specialist task files for auto-delegation ──
  await writeSpecialistTaskFiles(order);
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
