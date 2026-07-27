/**
 * Automated email sequences for MetroReach Media client delivery pipeline.
 * MetroReach Media
 *
 * Uses the existing sendEmail() from ~/lib/email (SendGrid primary, Graph API fallback).
 * All templates are premium, human-crafted — no AI/automation language in client-facing copy.
 */

import { sendEmail } from "~/lib/email";

// ── Types ──

export interface Client {
  id: string;
  email: string;
  name: string;
  company?: string;
  service: string;
  service_slug: string;
  status: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  pipeline_status: string;
  portal_token?: string;
  onboarding_data?: Record<string, unknown>;
}

export type PipelineStage =
  | "onboarding"
  | "strategy"
  | "content_creation"
  | "review"
  | "launch"
  | "active"
  | "reporting";

const STAGE_LABELS: Record<PipelineStage, string> = {
  onboarding: "Account Setup & Onboarding",
  strategy: "Strategy Development",
  content_creation: "Content Creation",
  review: "Review & Approval",
  launch: "Campaign Launch",
  active: "Active Management",
  reporting: "Performance Reporting",
};

const CONTACT_ADDRESS = "contact@metroreachagency.com";
const SUPPORT_ADDRESS = "support@metroreachagency.com";
const REPORTS_ADDRESS = "reports@metroreachagency.com";

// ── Helpers ──

/**
 * Returns true if the service slug represents a one-time deliverable
 * (audit, strategy doc, setup, template, research, profile work, landing page review)
 * rather than an ongoing/recurring service.
 */
function isOneTimeService(slug: string): boolean {
  const oneTimeSlugs = [
    // Audits
    "social-media-audit", "social-media-audit-strategy", "premium-audit",
    // Strategy docs
    "social-media-strategy", "content-strategy", "campaign-strategy",
    // Setup services
    "platform-setup-optimization", "platform-setup-community",
    "ad-account-setup", "pixel-conversion-tracking",
    "kpi-dashboard-setup",
    // Templates
    "community-engagement-templates",
    // Research
    "hashtag-research", "audience-research", "competitor-analysis",
    // Profile work
    "brand-voice-development", "profile-bio-optimization",
    // Landing page reviews
    "landing-page-review",
    // Other one-time design/setup
    "social-inbox-design",
  ];
  return oneTimeSlugs.includes(slug);
}

function emailShell(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;background:#fafafa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:32px 32px 8px;">
        <p style="font-size:13px;font-weight:600;color:#7c3aed;letter-spacing:0.05em;text-transform:uppercase;margin:0;">MetroReach Media</p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 32px 32px;">
        <h2 style="color:#1a1a1a;font-size:22px;font-weight:700;margin:0 0 16px;line-height:1.3;">${title}</h2>
        ${content}
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;background:#f5f3ff;font-size:13px;color:#6b7280;border-top:1px solid #e5e0f0;">
        <p style="margin:0 0 4px;">MetroReach Media — Premium Social Media Marketing</p>
        <p style="margin:0;">Need help? Reply to this email or reach us at ${SUPPORT_ADDRESS}</p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

// ── Sequence 1: Welcome (sent immediately after payment) ──

export async function sendWelcomeEmail(client: Client): Promise<void> {
  const isOneTime = isOneTimeService(client.service_slug);

  const timelineItems = isOneTime
    ? `<ol style="font-size:15px;line-height:1.8;color:#374151;margin:0 0 16px;padding-left:20px;">
  <li>You'll receive an onboarding form within the next hour — this helps us understand your business goals and requirements.</li>
  <li>Once we have your details, our team begins work on your deliverable within 24 hours.</li>
  <li>Your deliverable will be ready within 48 hours.</li>
</ol>`
    : `<ol style="font-size:15px;line-height:1.8;color:#374151;margin:0 0 16px;padding-left:20px;">
  <li>You'll receive an onboarding form within the next hour — this helps us gather access to your platforms and understand your business goals.</li>
  <li>Once we have your details, our strategy team builds your custom plan within 2 business days.</li>
  <li>Content creation begins immediately after strategy approval.</li>
  <li>Your first campaign goes live within 5-7 business days.</li>
</ol>`;

  const content = `
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  Hi ${escapeHtml(client.name)},
</p>
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  Welcome to MetroReach Media. Your ${escapeHtml(client.service)} package is now active, and our team is preparing your account for onboarding.
</p>
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  Here's what happens next:
</p>
${timelineItems}
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  We'll keep you updated at every stage. If you have questions before then, just reply to this email — our team monitors this inbox directly.
</p>
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0;">
  — The MetroReach Team
</p>`;

  await sendEmail({
    to: client.email,
    from: CONTACT_ADDRESS,
    subject: `Welcome to MetroReach — ${client.service}`,
    body: emailShell(`Welcome to MetroReach`, content),
  });
}

// ── Sequence 2: Onboarding Request ──

export async function sendOnboardingRequest(client: Client): Promise<void> {
  const onboardingUrl = client.portal_token
    ? `https://metroreachagency.com/portal?token=${client.portal_token}`
    : `https://metroreachagency.com/portal`;

  const isOneTime = isOneTimeService(client.service_slug);

  const platformAccessItem = isOneTime
    ? ""
    : `<li>Social media account logins or admin access (Facebook, Instagram, TikTok, etc.)</li>`;

  const content = `
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  Hi ${escapeHtml(client.name)},
</p>
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  To get your ${escapeHtml(client.service)} package up and running, we need a few details. Please complete the onboarding form below — it takes about 5 minutes.
</p>
<div style="text-align:center;margin:24px 0;">
  <a href="${onboardingUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:14px 32px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px;">Complete Onboarding →</a>
</div>
<p style="font-size:14px;line-height:1.6;color:#6b7280;margin:0 0 16px;">
  You'll need:
</p>
<ul style="font-size:14px;line-height:1.8;color:#6b7280;margin:0 0 16px;padding-left:20px;">
  ${platformAccessItem}
  <li>Your brand guidelines or logo files (if available)</li>
  <li>Any existing marketing materials or past campaign data</li>
  <li>A brief overview of your top 3 business goals for this quarter</li>
</ul>
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0;">
  Once submitted, our strategy team reviews everything and reaches out within 24 hours with your custom plan.
</p>`;

  await sendEmail({
    to: client.email,
    from: SUPPORT_ADDRESS,
    subject: `Next step: Complete your onboarding — MetroReach`,
    body: emailShell(`Let's get you set up`, content),
  });
}

// ── Sequence 3: Status Update ──

export async function sendStatusUpdate(
  client: Client,
  stage: PipelineStage,
  detail?: string,
): Promise<void> {
  const stageLabel = STAGE_LABELS[stage] || stage;
  const detailHtml = detail
    ? `<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">${escapeHtml(detail)}</p>`
    : "";

  const content = `
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  Hi ${escapeHtml(client.name)},
</p>
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  Your ${escapeHtml(client.service)} package has moved to the next stage:
</p>
<div style="background:#f5f3ff;border-radius:12px;padding:20px;margin:16px 0;text-align:center;">
  <p style="font-size:14px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">Current Stage</p>
  <p style="font-size:20px;font-weight:700;color:#1a1a1a;margin:0;">${escapeHtml(stageLabel)}</p>
</div>
${detailHtml}
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0;">
  We'll notify you as soon as the next stage begins. No action needed from you right now — our team is handling everything.
</p>`;

  await sendEmail({
    to: client.email,
    from: SUPPORT_ADDRESS,
    subject: `Update: ${stageLabel} — MetroReach`,
    body: emailShell(`Your project: ${stageLabel}`, content),
  });
}

// ── Sequence 4: Deliverable Ready ──

export async function sendDeliverableReady(
  client: Client,
  url: string,
  description?: string,
): Promise<void> {
  const descriptionHtml = description
    ? `<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">${escapeHtml(description)}</p>`
    : "";

  const content = `
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  Hi ${escapeHtml(client.name)},
</p>
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  Your latest deliverable from MetroReach Media is ready for review.
</p>
${descriptionHtml}
<div style="text-align:center;margin:24px 0;">
  <a href="${url}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:14px 32px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px;">View Deliverable →</a>
</div>
<p style="font-size:14px;line-height:1.6;color:#6b7280;margin:0 0 16px;">
  Review it at your convenience. If you'd like any revisions, just reply to this email with your feedback. Our typical revision turnaround is 24-48 hours.
</p>
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0;">
  — The MetroReach Team
</p>`;

  await sendEmail({
    to: client.email,
    from: REPORTS_ADDRESS,
    subject: `Your deliverable is ready — MetroReach`,
    body: emailShell(`Your deliverable is ready`, content),
  });
}

// ── Purchase confirmation (sent immediately after payment) ──

export async function sendPurchaseConfirmation(client: Client, amountCents: number): Promise<void> {
  const amountDisplay = `${(amountCents / 100).toFixed(2)}`;
  const orderDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const content = `
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  Hi ${escapeHtml(client.name)},
</p>
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  Thank you for your purchase. Your order for <strong>${escapeHtml(client.service)}</strong> has been received and is now being processed.
</p>
<div style="background:#f5f3ff;border-radius:12px;padding:20px;margin:16px 0;">
  <table style="font-size:14px;color:#374151;border-collapse:collapse;width:100%;">
    <tr><td style="padding:4px 0;font-weight:600;color:#6b7280;width:100px;">Service</td><td>${escapeHtml(client.service)}</td></tr>
    <tr><td style="padding:4px 0;font-weight:600;color:#6b7280;">Amount</td><td>${amountDisplay}</td></tr>
    <tr><td style="padding:4px 0;font-weight:600;color:#6b7280;">Date</td><td>${orderDate}</td></tr>
    <tr><td style="padding:4px 0;font-weight:600;color:#6b7280;">Order ID</td><td style="font-family:monospace;">${escapeHtml(client.id)}</td></tr>
  </table>
</div>
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0 0 16px;">
  Our team will reach out within the next hour with your onboarding details. You'll receive a separate email with next steps shortly.
</p>
<p style="font-size:15px;line-height:1.6;color:#374151;margin:0;">
  If you have any questions in the meantime, reply to this email and we'll get back to you right away.
</p>`;

  await sendEmail({
    to: client.email,
    from: CONTACT_ADDRESS,
    subject: `Purchase confirmed: ${client.service} — MetroReach`,
    body: emailShell(`Your purchase is confirmed`, content),
  });
}

// ── Internal notification: new client alert ──

export async function sendInternalNewClientAlert(client: Client): Promise<void> {
  const content = `
<div style="background:#fef3c7;border-radius:12px;padding:16px;margin:16px 0;">
  <p style="font-size:15px;font-weight:600;color:#92400e;margin:0 0 8px;">New Client — ${escapeHtml(client.service)}</p>
  <table style="font-size:14px;color:#374151;border-collapse:collapse;">
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;">Name</td><td>${escapeHtml(client.name)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;">Email</td><td>${escapeHtml(client.email)}</td></tr>
    ${client.company ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;">Company</td><td>${escapeHtml(client.company)}</td></tr>` : ""}
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;">Service</td><td>${escapeHtml(client.service)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;font-weight:600;white-space:nowrap;">Status</td><td>${escapeHtml(client.status)}</td></tr>
  </table>
</div>
<p style="font-size:14px;color:#6b7280;margin:8px 0 0;">Client ID: ${escapeHtml(client.id)}</p>
${client.portal_token ? `<p style="font-size:14px;color:#6b7280;margin:8px 0 0;"><a href="https://metroreachagency.com/portal?token=${escapeHtml(client.portal_token)}">View Client Portal →</a></p>` : ""}`;

  await sendEmail({
    to: "bryce@metroreachagency.com",
    from: SUPPORT_ADDRESS,
    subject: `New Client: ${client.name} — ${client.service}`,
    body: emailShell(`New client onboarded`, content),
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
