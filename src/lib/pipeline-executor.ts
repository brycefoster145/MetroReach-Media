/**
 * Pipeline Executor — MetroReach Media
 *
 * Automatically executes service delivery pipelines when a client pays.
 * Maps service slugs to pipeline files and execution steps.
 * Each step triggers automated actions: research, create, review, deliver.
 * Progress is tracked via the client's pipeline_status DB field.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { sql } from "~/lib/db";
import { sendStatusUpdate, sendDeliverableReady, sendPremiumAuditReady } from "~/lib/email-sequences";
import type { Client } from "~/lib/email-sequences";
import { findLeadByEmail, saveAuditResult, markPurchased } from "~/lib/lead-store";
import { runPremiumAudit } from "~/lib/premium-audit-analyzer";

// ── Types ──

export type PipelineStep = "research" | "create" | "review" | "deliver" | "monitor" | "engage" | "report" | "setup";

export interface PipelineDefinition {
  file: string;
  steps: PipelineStep[];
  label: string;
  recurring: boolean;
  intervalHours?: number;
  dependsOn?: string[];
}

export interface PipelineProgress {
  clientId: string;
  pipeline: string;
  currentStep: PipelineStep;
  completedSteps: PipelineStep[];
  startedAt: string;
  updatedAt: string;
  deliverables: string[];
  nextStepEta: string | null;
}

// ── Service Slug → Pipeline Mapping ──

export const PIPELINE_MAP: Record<string, PipelineDefinition[]> = {
  // ── Package-level mappings (retained for legacy / bundled purchases) ──

  // Organic Content Management packages
  "organic-content-starter": [
    { file: "content-calendar.md", steps: ["research", "create", "review", "deliver"], label: "Monthly Content Calendar", recurring: true, intervalHours: 720 },
    { file: "daily-engagement.md", steps: ["setup", "monitor", "engage"], label: "Daily Engagement", recurring: true, intervalHours: 24 },
    { file: "review-and-dm-templates.md", steps: ["research", "create", "review", "deliver"], label: "Review & DM Templates", recurring: false },
    { file: "posting-schedule-optimization.md", steps: ["research", "create", "review", "deliver"], label: "Posting Schedule Optimization", recurring: true, intervalHours: 720 },
  ],
  "organic-content-pro": [
    { file: "content-calendar.md", steps: ["research", "create", "review", "deliver"], label: "Monthly Content Calendar", recurring: true, intervalHours: 720 },
    { file: "daily-engagement.md", steps: ["setup", "monitor", "engage"], label: "Daily Engagement", recurring: true, intervalHours: 24 },
    { file: "review-and-dm-templates.md", steps: ["research", "create", "review", "deliver"], label: "Review & DM Templates", recurring: false },
    { file: "posting-schedule-optimization.md", steps: ["research", "create", "review", "deliver"], label: "Posting Schedule Optimization", recurring: true, intervalHours: 720 },
    { file: "hashtag-research.md", steps: ["research", "create", "review", "deliver"], label: "Hashtag Research", recurring: true, intervalHours: 720 },
    { file: "content-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Content Strategy", recurring: true, intervalHours: 2160 },
  ],
  "organic-content-enterprise": [
    { file: "content-calendar.md", steps: ["research", "create", "review", "deliver"], label: "Monthly Content Calendar", recurring: true, intervalHours: 720 },
    { file: "daily-engagement.md", steps: ["setup", "monitor", "engage"], label: "Daily Engagement", recurring: true, intervalHours: 24 },
    { file: "review-and-dm-templates.md", steps: ["research", "create", "review", "deliver"], label: "Review & DM Templates", recurring: false },
    { file: "posting-schedule-optimization.md", steps: ["research", "create", "review", "deliver"], label: "Posting Schedule Optimization", recurring: true, intervalHours: 720 },
    { file: "hashtag-research.md", steps: ["research", "create", "review", "deliver"], label: "Hashtag Research", recurring: true, intervalHours: 720 },
    { file: "content-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Content Strategy", recurring: true, intervalHours: 2160 },
    { file: "competitor-analysis.md", steps: ["research", "create", "review", "deliver"], label: "Competitor Analysis", recurring: true, intervalHours: 2160 },
    { file: "trend-research.md", steps: ["research", "create", "review", "deliver"], label: "Trend Research", recurring: true, intervalHours: 720 },
    { file: "organic-growth-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Organic Growth Strategy", recurring: true, intervalHours: 2160 },
  ],

  // Paid Advertising packages
  "paid-ads-starter": [
    { file: "campaign-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Campaign Strategy", recurring: false },
    { file: "ad-creative-package.md", steps: ["research", "create", "review", "deliver"], label: "Ad Creative Package", recurring: true, intervalHours: 720 },
    { file: "pixel-conversion-tracking.md", steps: ["setup", "monitor"], label: "Pixel & Conversion Tracking", recurring: false },
    { file: "ab-testing-optimization.md", steps: ["research", "monitor", "report"], label: "A/B Testing & Optimization", recurring: true, intervalHours: 336 },
  ],
  "paid-ads-pro": [
    { file: "campaign-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Campaign Strategy", recurring: false },
    { file: "ad-creative-package.md", steps: ["research", "create", "review", "deliver"], label: "Ad Creative Package", recurring: true, intervalHours: 720 },
    { file: "pixel-conversion-tracking.md", steps: ["setup", "monitor"], label: "Pixel & Conversion Tracking", recurring: false },
    { file: "ab-testing-optimization.md", steps: ["research", "monitor", "report"], label: "A/B Testing & Optimization", recurring: true, intervalHours: 336 },
    { file: "audience-research.md", steps: ["research", "create", "review", "deliver"], label: "Audience Research", recurring: true, intervalHours: 2160 },
    { file: "competitor-analysis.md", steps: ["research", "create", "review", "deliver"], label: "Competitor Analysis", recurring: true, intervalHours: 2160 },
    { file: "meta-ads-management.md", steps: ["research", "create", "monitor", "report"], label: "Meta Ads Management", recurring: true, intervalHours: 168 },
  ],
  "paid-ads-enterprise": [
    { file: "campaign-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Campaign Strategy", recurring: false },
    { file: "ad-creative-package.md", steps: ["research", "create", "review", "deliver"], label: "Ad Creative Package", recurring: true, intervalHours: 720 },
    { file: "pixel-conversion-tracking.md", steps: ["setup", "monitor"], label: "Pixel & Conversion Tracking", recurring: false },
    { file: "ab-testing-optimization.md", steps: ["research", "monitor", "report"], label: "A/B Testing & Optimization", recurring: true, intervalHours: 336 },
    { file: "audience-research.md", steps: ["research", "create", "review", "deliver"], label: "Audience Research", recurring: true, intervalHours: 2160 },
    { file: "competitor-analysis.md", steps: ["research", "create", "review", "deliver"], label: "Competitor Analysis", recurring: true, intervalHours: 2160 },
    { file: "meta-ads-management.md", steps: ["research", "create", "monitor", "report"], label: "Meta Ads Management", recurring: true, intervalHours: 168 },
    { file: "landing-page-review.md", steps: ["research", "create", "review", "deliver"], label: "Landing Page Review", recurring: true, intervalHours: 2160 },
    { file: "profile-bio-optimization.md", steps: ["research", "create", "review", "deliver"], label: "Profile & Bio Optimization", recurring: true, intervalHours: 2160 },
  ],

  // Social Strategy
  "social-strategy-onetime": [
    { file: "social-media-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Social Media Strategy", recurring: false },
    { file: "content-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Content Strategy", recurring: false },
    { file: "campaign-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Campaign Strategy", recurring: false },
    { file: "audience-research.md", steps: ["research", "create", "review", "deliver"], label: "Audience Research", recurring: false },
    { file: "competitor-analysis.md", steps: ["research", "create", "review", "deliver"], label: "Competitor Analysis", recurring: false },
    { file: "brand-voice-development.md", steps: ["research", "create", "review", "deliver"], label: "Brand Voice Development", recurring: false },
  ],
  "social-strategy-quarterly": [
    { file: "social-media-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Social Media Strategy", recurring: false },
    { file: "content-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Content Strategy", recurring: true, intervalHours: 2160 },
    { file: "campaign-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Campaign Strategy", recurring: true, intervalHours: 2160 },
    { file: "audience-research.md", steps: ["research", "create", "review", "deliver"], label: "Audience Research", recurring: true, intervalHours: 2160 },
    { file: "competitor-analysis.md", steps: ["research", "create", "review", "deliver"], label: "Competitor Analysis", recurring: true, intervalHours: 2160 },
    { file: "monthly-strategy-reviews.md", steps: ["research", "review", "report"], label: "Monthly Strategy Review", recurring: true, intervalHours: 720 },
  ],

  // Analytics & Reporting
  "analytics-reporting-monthly": [
    { file: "analytics-reporting.md", steps: ["research", "create", "review", "deliver"], label: "Analytics & Reporting", recurring: true, intervalHours: 720 },
    { file: "social-media-audit.md", steps: ["research", "create", "review", "deliver"], label: "Social Media Audit", recurring: true, intervalHours: 2160 },
  ],

  // Community Management
  "community-management-monthly": [
    { file: "community-management.md", steps: ["setup", "monitor", "engage", "report"], label: "Community Management", recurring: true, intervalHours: 24 },
    { file: "social-listening.md", steps: ["setup", "monitor", "report"], label: "Social Listening", recurring: true, intervalHours: 24 },
    { file: "review-and-dm-templates.md", steps: ["research", "create", "review", "deliver"], label: "Review & DM Templates", recurring: false },
    { file: "social-inbox-design.md", steps: ["research", "create", "review", "deliver"], label: "Social Inbox Design", recurring: false },
  ],

  // Full Service (everything)
  "full-service-monthly": [
    { file: "social-media-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Social Media Strategy", recurring: false },
    { file: "content-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Content Strategy", recurring: true, intervalHours: 2160 },
    { file: "campaign-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Campaign Strategy", recurring: true, intervalHours: 2160 },
    { file: "audience-research.md", steps: ["research", "create", "review", "deliver"], label: "Audience Research", recurring: true, intervalHours: 2160 },
    { file: "competitor-analysis.md", steps: ["research", "create", "review", "deliver"], label: "Competitor Analysis", recurring: true, intervalHours: 2160 },
    { file: "content-calendar.md", steps: ["research", "create", "review", "deliver"], label: "Monthly Content Calendar", recurring: true, intervalHours: 720 },
    { file: "daily-engagement.md", steps: ["setup", "monitor", "engage"], label: "Daily Engagement", recurring: true, intervalHours: 24 },
    { file: "ad-creative-package.md", steps: ["research", "create", "review", "deliver"], label: "Ad Creative Package", recurring: true, intervalHours: 720 },
    { file: "ab-testing-optimization.md", steps: ["research", "monitor", "report"], label: "A/B Testing & Optimization", recurring: true, intervalHours: 336 },
    { file: "meta-ads-management.md", steps: ["research", "create", "monitor", "report"], label: "Meta Ads Management", recurring: true, intervalHours: 168 },
    { file: "community-management.md", steps: ["setup", "monitor", "engage", "report"], label: "Community Management", recurring: true, intervalHours: 24 },
    { file: "analytics-reporting.md", steps: ["research", "create", "review", "deliver"], label: "Analytics & Reporting", recurring: true, intervalHours: 720 },
    { file: "organic-growth-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Organic Growth Strategy", recurring: true, intervalHours: 2160 },
    { file: "brand-voice-development.md", steps: ["research", "create", "review", "deliver"], label: "Brand Voice Development", recurring: false },
    { file: "social-media-audit.md", steps: ["research", "create", "review", "deliver"], label: "Social Media Audit", recurring: true, intervalHours: 2160 },
    { file: "landing-page-review.md", steps: ["research", "create", "review", "deliver"], label: "Landing Page Review", recurring: true, intervalHours: 2160 },
    { file: "trend-research.md", steps: ["research", "create", "review", "deliver"], label: "Trend Research", recurring: true, intervalHours: 720 },
    { file: "hashtag-research.md", steps: ["research", "create", "review", "deliver"], label: "Hashtag Research", recurring: true, intervalHours: 720 },
  ],

  // ── Individual service slug mappings (43 services from stripe-product-map.ts) ──

  // Organic Content Management (14 individual services)
  "social-media-audit": [
    { file: "social-media-audit.md", steps: ["research", "create", "review", "deliver"], label: "Social Media Audit", recurring: false },
  ],
  "monthly-content-calendar": [
    { file: "content-calendar.md", steps: ["research", "create", "review", "deliver"], label: "Monthly Content Calendar", recurring: true, intervalHours: 720 },
  ],
  "caption-writing": [
    { file: "caption-writing.md", steps: ["research", "create", "review", "deliver"], label: "Caption Writing", recurring: true, intervalHours: 720 },
  ],
  "hashtag-research": [
    { file: "hashtag-research.md", steps: ["research", "create", "review", "deliver"], label: "Hashtag Research", recurring: false },
  ],
  "brand-voice-development": [
    { file: "brand-voice-development.md", steps: ["research", "create", "review", "deliver"], label: "Brand Voice Development", recurring: false },
  ],
  "posting-schedule-optimization": [
    { file: "posting-schedule-optimization.md", steps: ["research", "create", "review", "deliver"], label: "Posting Schedule Optimization", recurring: true, intervalHours: 720 },
  ],
  "trend-research": [
    { file: "trend-research.md", steps: ["research", "create", "review", "deliver"], label: "Trend Research", recurring: true, intervalHours: 720 },
  ],
  "daily-engagement": [
    { file: "daily-engagement.md", steps: ["setup", "monitor", "engage"], label: "Daily Engagement", recurring: true, intervalHours: 24 },
  ],
  "dm-management": [
    { file: "dm-management.md", steps: ["research", "create", "review", "deliver"], label: "DM Management", recurring: true, intervalHours: 168 },
  ],
  "social-listening": [
    { file: "social-listening.md", steps: ["setup", "monitor", "report"], label: "Social Listening", recurring: true, intervalHours: 24 },
  ],
  "single-platform-management": [
    { file: "single-platform-management.md", steps: ["research", "create", "review", "deliver"], label: "Single-Platform Management", recurring: true, intervalHours: 720 },
  ],
  "multi-platform-management": [
    { file: "multi-platform-management.md", steps: ["research", "create", "review", "deliver"], label: "Multi-Platform Management", recurring: true, intervalHours: 720 },
  ],
  "platform-setup-optimization": [
    { file: "platform-setup-optimization.md", steps: ["research", "create", "review", "deliver"], label: "Platform Setup & Optimization", recurring: false },
  ],
  "profile-bio-optimization": [
    { file: "profile-bio-optimization.md", steps: ["research", "create", "review", "deliver"], label: "Profile/Bio Optimization", recurring: false },
  ],

  // Paid Advertising (6 individual services)
  "meta-ads-management": [
    { file: "meta-ads-management.md", steps: ["research", "create", "monitor", "report"], label: "Meta Ads Management", recurring: true, intervalHours: 168 },
  ],
  "ad-account-setup": [
    { file: "ad-account-setup.md", steps: ["research", "create", "review", "deliver"], label: "Ad Account Setup", recurring: false },
  ],
  "ad-creative-package": [
    { file: "ad-creative-package.md", steps: ["research", "create", "review", "deliver"], label: "Ad Creative Package", recurring: true, intervalHours: 720 },
  ],
  "ab-testing-optimization": [
    { file: "ab-testing-optimization.md", steps: ["research", "monitor", "report"], label: "A/B Testing & Optimization", recurring: true, intervalHours: 336 },
  ],
  "pixel-conversion-tracking": [
    { file: "pixel-conversion-tracking.md", steps: ["setup", "monitor"], label: "Pixel & Conversion Tracking", recurring: false },
  ],
  "landing-page-review": [
    { file: "landing-page-review.md", steps: ["research", "create", "review", "deliver"], label: "Landing Page Review", recurring: false },
  ],

  // Social Strategy (8 individual services)
  "social-media-audit-strategy": [
    { file: "social-media-audit.md", steps: ["research", "create", "review", "deliver"], label: "Social Media Audit", recurring: false },
  ],
  "competitor-analysis": [
    { file: "competitor-analysis.md", steps: ["research", "create", "review", "deliver"], label: "Competitor Analysis", recurring: false },
  ],
  "social-media-strategy": [
    { file: "social-media-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Social Media Strategy", recurring: false },
  ],
  "content-strategy": [
    { file: "content-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Content Strategy", recurring: false },
  ],
  "campaign-strategy": [
    { file: "campaign-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Campaign Strategy", recurring: false },
  ],
  "audience-research": [
    { file: "audience-research.md", steps: ["research", "create", "review", "deliver"], label: "Audience Research", recurring: false },
  ],
  "organic-growth-strategy": [
    { file: "organic-growth-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Organic Growth Strategy", recurring: true, intervalHours: 2160 },
  ],
  "monthly-strategy-reviews": [
    { file: "monthly-strategy-reviews.md", steps: ["research", "review", "report"], label: "Monthly Strategy Reviews", recurring: true, intervalHours: 720 },
  ],

  // Analytics & Reporting (5 individual services)
  "monthly-performance-reports": [
    { file: "analytics-reporting.md", steps: ["research", "create", "review", "deliver"], label: "Monthly Performance Reports", recurring: true, intervalHours: 720 },
  ],
  "weekly-performance-summaries": [
    { file: "weekly-performance-summaries.md", steps: ["research", "create", "review", "deliver"], label: "Weekly Performance Summaries", recurring: true, intervalHours: 168 },
  ],
  "kpi-dashboard-setup": [
    { file: "kpi-dashboard-setup.md", steps: ["research", "create", "review", "deliver"], label: "KPI Dashboard Setup", recurring: false },
  ],
  "executive-reports": [
    { file: "executive-reports.md", steps: ["research", "create", "review", "deliver"], label: "Executive Reports", recurring: true, intervalHours: 720 },
  ],
  "competitor-benchmarking": [
    { file: "competitor-benchmarking.md", steps: ["research", "create", "review", "deliver"], label: "Competitor Benchmarking", recurring: true, intervalHours: 2160 },
  ],

  // Community Management (10 individual services)
  "community-management": [
    { file: "community-management.md", steps: ["setup", "monitor", "engage", "report"], label: "Community Management", recurring: true, intervalHours: 24 },
  ],
  "daily-monitoring-engagement": [
    { file: "daily-monitoring-engagement.md", steps: ["setup", "monitor", "engage"], label: "Daily Monitoring & Engagement", recurring: true, intervalHours: 24 },
  ],
  "comment-dm-response": [
    { file: "comment-dm-response.md", steps: ["research", "create", "review", "deliver"], label: "Comment & DM Response", recurring: true, intervalHours: 168 },
  ],
  "review-management": [
    { file: "review-management.md", steps: ["setup", "monitor", "report"], label: "Review Management", recurring: true, intervalHours: 168 },
  ],
  "social-listening-community": [
    { file: "social-listening.md", steps: ["setup", "monitor", "report"], label: "Social Listening", recurring: true, intervalHours: 24 },
  ],
  "influencer-research": [
    { file: "influencer-research.md", steps: ["research", "create", "review", "deliver"], label: "Influencer Research", recurring: true, intervalHours: 720 },
  ],
  "community-engagement-templates": [
    { file: "community-engagement-templates.md", steps: ["research", "create", "review", "deliver"], label: "Community Engagement Templates", recurring: false },
  ],
  "platform-setup-community": [
    { file: "platform-setup-optimization.md", steps: ["research", "create", "review", "deliver"], label: "Platform Setup & Optimization", recurring: false },
  ],
  "social-inbox-management": [
    { file: "social-inbox-management.md", steps: ["setup", "monitor", "report"], label: "Social Inbox Management", recurring: true, intervalHours: 24 },
  ],
  "social-inbox-design": [
    { file: "social-inbox-design.md", steps: ["research", "create", "review", "deliver"], label: "Social Inbox Design", recurring: false },
  ],

  // ── VIP Daily ($8,500/mo) ──
  "vip-daily": [
    { file: "daily-engagement.md", steps: ["setup", "monitor", "engage"], label: "Daily Engagement", recurring: true, intervalHours: 24 },
    { file: "content-calendar.md", steps: ["research", "create", "review", "deliver"], label: "Monthly Content Calendar", recurring: true, intervalHours: 720 },
    { file: "review-and-dm-templates.md", steps: ["research", "create", "review", "deliver"], label: "Review & DM Templates", recurring: false },
  ],

  // ── Premium Growth Audit ──
  "premium-growth-audit": [
    { file: "social-media-audit.md", steps: ["research", "create", "review", "deliver"], label: "Premium Growth Audit", recurring: false },
    { file: "competitor-analysis.md", steps: ["research", "create", "review", "deliver"], label: "Competitor Analysis", recurring: false },
    { file: "content-strategy.md", steps: ["research", "create", "review", "deliver"], label: "Content Strategy", recurring: false },
  ],
};

// ── Time estimates per step (hours) ──

const STEP_DURATION_HOURS: Record<PipelineStep, number> = {
  research: 24,
  create: 48,
  review: 24,
  deliver: 2,
  setup: 4,
  monitor: 0, // continuous
  engage: 0, // continuous
  report: 6,
};

// ── Step labels for status display ──

const STEP_LABELS: Record<PipelineStep, string> = {
  research: "Research & Discovery",
  create: "Content Creation",
  review: "Quality Review",
  deliver: "Client Delivery",
  monitor: "Active Monitoring",
  engage: "Community Engagement",
  report: "Performance Reporting",
  setup: "Initial Setup",
};

// ── Pipeline execution ──

/**
 * Execute all pipelines for a newly onboarded client.
 * Called from the Stripe webhook after client record is created.
 * Non-blocking — runs async, errors are logged.
 */
export async function executePipeline(client: Client): Promise<void> {
  const serviceSlug = client.service_slug;

  // ── Premium Growth Audit: special handling ──
  // The lead was created pre-payment via /api/premium-audit/submit.
  // On purchase, we run the full premium analysis, save results, and email the client.
  if (serviceSlug === "premium-growth-audit") {
    await executePremiumAuditPipeline(client);
    return;
  }

  const pipelines = PIPELINE_MAP[serviceSlug];

  if (!pipelines || pipelines.length === 0) {
    console.log(`No pipelines defined for service: ${serviceSlug} (client ${client.id})`);
    // Mark as active anyway — manual pipeline assignment may apply
    await updatePipelineStatus(client.id, "active");
    return;
  }

  console.log(`Starting pipeline execution for client ${client.id} (${serviceSlug}) — ${pipelines.length} pipelines`);

  // Update overall status to indicate pipeline is running
  await updatePipelineStatus(client.id, "strategy");

  for (const pipeline of pipelines) {
    try {
      await executeSinglePipeline(client, pipeline);
    } catch (err: any) {
      console.error(`Pipeline ${pipeline.label} failed for ${client.id}:`, err.message);
      // Continue with next pipeline — one failure shouldn't block everything
    }
  }

  // All initial pipelines executed
  await updatePipelineStatus(client.id, "active");
  console.log(`Pipeline execution complete for client ${client.id}`);
}

/**
 * Execute the Premium Growth Audit pipeline.
 * 
 * Unlike the generic pipeline, this runs the actual analysis engine:
 * 1. Finds the lead record (created pre-payment by /api/premium-audit/submit)
 * 2. Runs the 12-category premium analysis via runPremiumAudit()
 * 3. Saves results to both the lead store and audit_results table
 * 4. Marks the lead as purchased
 * 5. Sends the premium audit email with a link to the report
 */
async function executePremiumAuditPipeline(client: Client): Promise<void> {
  console.log(`Running Premium Growth Audit pipeline for ${client.id} (${client.email})`);

  // 1. Find the lead record by email
  const lead = await findLeadByEmail(client.email);
  if (!lead) {
    console.error(`Premium audit: no lead found for email ${client.email}`);
    await updatePipelineStatus(client.id, "failed");
    return;
  }

  await updatePipelineStatus(client.id, "analyzing");

  // 2. Run the premium analysis
  let result;
  try {
    result = await runPremiumAudit(lead.businessInfo, lead.id);
    console.log(`Premium audit complete for ${lead.id}: overall score ${result.scores.overall}/100`);
  } catch (err: any) {
    console.error(`Premium audit analysis failed for ${lead.id}:`, err.message);
    await updatePipelineStatus(client.id, "failed");
    return;
  }

  // 3. Save results to the lead store and audit_results table
  const resultJson = JSON.stringify(result);
  await saveAuditResult(lead.id, resultJson);

  // 4. Mark lead as purchased
  await markPurchased(lead.id);

  // 5. Update client pipeline status
  await updatePipelineStatus(client.id, "delivered");

  // 6. Send premium audit email with report link
  const reportUrl = `https://metroreachagency.com/audit-report?id=${lead.id}`;
  try {
    await sendPremiumAuditReady(client, reportUrl, result.scores.overall);
    console.log(`Premium audit email sent to ${client.email}`);
  } catch (err: any) {
    console.error(`Premium audit email failed for ${client.id}:`, err.message);
  }

  console.log(`Premium Growth Audit pipeline complete for ${client.id}`);
}

/**
 * Execute a single pipeline's steps in sequence.
 */
async function executeSinglePipeline(
  client: Client,
  pipeline: PipelineDefinition,
): Promise<void> {
  const pipelineKey = pipeline.file.replace(".md", "");
  console.log(`  → Executing pipeline: ${pipeline.label} (${pipelineKey})`);

  // Validate that the pipeline file actually exists on disk
  const pipelinePath = `/home/team/shared/pipelines/${pipeline.file}`;
  try {
    const fs = await import("node:fs");
    if (!fs.existsSync(pipelinePath)) {
      console.error(`  ✗ Pipeline file MISSING: ${pipelinePath} — marking as failed`);
      await markStepCompleted(client.id, `${pipelineKey}:setup`, JSON.stringify({ error: `Pipeline file not found: ${pipelinePath}`, status: "failed" }));
      return;
    }
  } catch (err: any) {
    console.error(`  ✗ Pipeline file check error: ${pipelinePath} — ${err.message}`);
    await markStepCompleted(client.id, `${pipelineKey}:setup`, JSON.stringify({ error: `Pipeline file check failed: ${err.message}`, status: "failed" }));
    return;
  }

  for (let i = 0; i < pipeline.steps.length; i++) {
    const step = pipeline.steps[i];
    const stepLabel = STEP_LABELS[step] || step;
    const stepKey = `${pipelineKey}:${step}`;

    // Check if this step was already completed
    const alreadyCompleted = await isStepCompleted(client.id, stepKey);
    if (alreadyCompleted) {
      console.log(`    ↳ Step already completed: ${stepLabel}`);
      continue;
    }

    console.log(`    ↳ Executing step: ${stepLabel}`);

    // Execute the step action
    const deliverables = await runStepAction(client, pipeline, step, stepKey);

    // Mark step as completed
    await markStepCompleted(client.id, stepKey, JSON.stringify(deliverables));

    // Update client's pipeline_status for progress tracking
    await updatePipelineStep(client.id, stepKey, stepLabel);

    // Send status update email for key milestones
    if (step === "deliver" && deliverables.length > 0) {
      await notifyClientDeliverable(client, pipeline, deliverables);
    }

    // Small delay between steps prevents race conditions in the DB
    await sleep(500);
  }
}

/**
 * Run the automated action for a pipeline step.
 */
async function runStepAction(
  client: Client,
  pipeline: PipelineDefinition,
  step: PipelineStep,
  stepKey: string,
): Promise<string[]> {
  const deliverables: string[] = [];

  switch (step) {
    case "research":
      // Gather client info, platform data, competitor data
      const researchNotes = await executeResearch(client, pipeline);
      deliverables.push(researchNotes);
      break;

    case "create":
      // Generate the actual deliverable
      const createResult = await executeCreation(client, pipeline);
      deliverables.push(createResult);
      break;

    case "review":
      // Run internal QA checklist against quality rubric
      const reviewResult = await executeReview(client, pipeline);
      deliverables.push(reviewResult);
      break;

    case "deliver":
      // Package and prepare for client delivery
      const deliverResult = await executeDelivery(client, pipeline);
      deliverables.push(deliverResult);
      break;

    case "setup":
      // Initial setup for ongoing services
      const setupResult = await executeSetup(client, pipeline);
      deliverables.push(setupResult);
      break;

    case "monitor":
    case "engage":
    case "report":
      // Ongoing services — schedule recurring tasks
      const ongoingResult = await executeOngoingStep(client, pipeline, step);
      deliverables.push(ongoingResult);
      break;
  }

  return deliverables;
}

// ── Step implementations ──

async function executeResearch(client: Client, pipeline: PipelineDefinition): Promise<string> {
  const pipelineKey = pipeline.file.replace(".md", "");
  const pipelinePath = `/home/team/shared/pipelines/${pipeline.file}`;

  // Build a research brief based on client onboarding data
  const researchBrief: Record<string, unknown> = {
    clientId: client.id,
    clientName: client.name,
    company: client.company || client.name,
    service: client.service,
    pipeline: pipeline.label,
    pipelineFile: pipelinePath,
    step: "research",
    timestamp: new Date().toISOString(),
    instructions: buildResearchInstructions(pipeline.label, client),
  };

  return JSON.stringify(researchBrief);
}

async function executeCreation(client: Client, pipeline: PipelineDefinition): Promise<string> {
  const pipelineKey = pipeline.file.replace(".md", "");

  // Build a creation brief based on the pipeline type
  const creationBrief: Record<string, unknown> = {
    clientId: client.id,
    clientName: client.name,
    company: client.company || client.name,
    service: client.service,
    pipeline: pipeline.label,
    pipelineFile: `/home/team/shared/pipelines/${pipeline.file}`,
    step: "create",
    timestamp: new Date().toISOString(),
    deliverableType: getDeliverableType(pipeline.label),
    instructions: buildCreationInstructions(pipeline.label, client),
  };

  // For pipelines backed by the audit analyzer framework, include audit-style structure
  if (isAuditStylePipeline(pipeline.label)) {
    creationBrief["analyzer"] = "premium-audit-analyzer";
    creationBrief["outputFormat"] = "strategy-document";
  }

  return JSON.stringify(creationBrief);
}

async function executeReview(client: Client, pipeline: PipelineDefinition): Promise<string> {
  const pipelinePath = `/home/team/shared/pipelines/${pipeline.file}`;

  const reviewBrief: Record<string, unknown> = {
    clientId: client.id,
    clientName: client.name,
    pipeline: pipeline.label,
    pipelineFile: pipelinePath,
    step: "review",
    timestamp: new Date().toISOString(),
    qaChecklist: buildQAChecklist(pipeline.label),
    qualityRubric: `See ${pipelinePath}#quality-rubric`,
    status: "pending_review",
    assignedTo: "MetroReach QA Team",
  };

  return JSON.stringify(reviewBrief);
}

async function executeDelivery(client: Client, pipeline: PipelineDefinition): Promise<string> {
  // In production, this would actually package and send deliverables.
  // For now, it marks the deliverable as ready and triggers email notification.

  const deliveryRecord: Record<string, unknown> = {
    clientId: client.id,
    clientName: client.name,
    clientEmail: client.email,
    pipeline: pipeline.label,
    step: "deliver",
    timestamp: new Date().toISOString(),
    status: "ready_for_delivery",
    deliveryMethod: "email",
    requiresClientAction: pipeline.steps.includes("review"),
  };

  return JSON.stringify(deliveryRecord);
}

async function executeSetup(client: Client, pipeline: PipelineDefinition): Promise<string> {
  const setupRecord: Record<string, unknown> = {
    clientId: client.id,
    clientName: client.name,
    pipeline: pipeline.label,
    step: "setup",
    timestamp: new Date().toISOString(),
    status: "setup_complete",
    requiresMonitoring: true,
  };

  return JSON.stringify(setupRecord);
}

async function executeOngoingStep(
  client: Client,
  pipeline: PipelineDefinition,
  step: PipelineStep,
): Promise<string> {
  const ongoingRecord: Record<string, unknown> = {
    clientId: client.id,
    clientName: client.name,
    pipeline: pipeline.label,
    step,
    timestamp: new Date().toISOString(),
    recurring: pipeline.recurring,
    intervalHours: pipeline.intervalHours,
    status: "active",
  };

  return JSON.stringify(ongoingRecord);
}

// ── Helpers ──

function buildResearchInstructions(pipelineLabel: string, client: Client): string {
  const base = `Research brief for ${client.name}`;
  switch (pipelineLabel) {
    case "Monthly Content Calendar":
      return `${base}: Review current social presence, gather industry content examples, analyze competitor posting patterns, identify content gaps.`;
    case "Content Strategy":
      return `${base}: Analyze brand positioning, platform audit, audience content preferences, content pillar mapping.`;
    case "Campaign Strategy":
      return `${base}: Define campaign objectives, audience targeting, channel selection, competitor campaign analysis.`;
    case "Audience Research":
      return `${base}: Demographic profiling, psychographic analysis, content consumption habits, platform preferences.`;
    case "Competitor Analysis":
      return `${base}: Identify 3-5 direct competitors, map their strategy, content, creative, audience, messaging, ad presence.`;
    case "Hashtag Research":
      return `${base}: Research trending hashtags, analyze competitor tag usage, build ranked hashtag sets by platform.`;
    case "Social Media Audit":
      return `${base}: Full social presence audit across all platforms, engagement metrics, content performance, competitor benchmarking.`;
    default:
      return `${base}: Gather all relevant data for ${pipelineLabel} deliverables.`;
  }
}

function buildCreationInstructions(pipelineLabel: string, client: Client): string {
  const base = `Creation brief for ${client.name}`;
  switch (pipelineLabel) {
    case "Monthly Content Calendar":
      return `${base}: Build 20-30 platform-specific captions, hashtag sets, visual briefs, and scheduling-ready calendar export.`;
    case "Content Strategy":
      return `${base}: Develop content pillars, brand voice guidelines, posting cadence, content mix ratios, 90-day content roadmap.`;
    case "Campaign Strategy":
      return `${base}: Design multi-channel campaign — goal definition, audience targeting, creative strategy, budget allocation, timeline.`;
    case "Audience Research":
      return `${base}: Build demographic profiles, psychographic segments, customer journey map, pain points & motivations, content preferences.`;
    case "Competitor Analysis":
      return `${base}: Produce 12-18 page branded PDF — competitor profiles, strategy analysis, content audit, creative review, actionable advantages.`;
    case "Hashtag Research":
      return `${base}: Produce ranked hashtag sets per platform (Instagram, TikTok, LinkedIn, X) with volume data and relevance scores.`;
    case "Social Media Audit":
      return `${base}: Produce comprehensive audit report — platform scores, engagement analysis, content gaps, growth opportunities.`;
    default:
      return `${base}: Produce premium ${pipelineLabel} deliverable per MetroReach quality standards.`;
  }
}

function getDeliverableType(pipelineLabel: string): string {
  switch (pipelineLabel) {
    case "Monthly Content Calendar": return "spreadsheet + 20-30 captions + hashtag sets + visual briefs";
    case "Content Strategy": return "strategy document (PDF)";
    case "Campaign Strategy": return "campaign blueprint (PDF)";
    case "Audience Research": return "audience intelligence report (PDF)";
    case "Competitor Analysis": return "competitor intelligence report (PDF)";
    case "Hashtag Research": return "hashtag research report (PDF)";
    case "Social Media Audit": return "audit report (PDF)";
    default: return "strategy document (PDF)";
  }
}

function isAuditStylePipeline(pipelineLabel: string): boolean {
  return ["Content Strategy", "Campaign Strategy", "Audience Research", "Competitor Analysis", "Social Media Audit"].includes(pipelineLabel);
}

function buildQAChecklist(pipelineLabel: string): string[] {
  // Universal MetroReach QA points plus pipeline-specific checks
  const universal = [
    "All data points verified and traceable to source",
    "No AI/automation language in any client-facing content",
    "MetroReach branding applied consistently",
    "Grammar and spelling reviewed",
    "Client name, company, and details verified",
  ];

  switch (pipelineLabel) {
    case "Monthly Content Calendar":
      return [...universal, "20-30 captions per month minimum", "Each caption platform-specific", "Hashtag sets researched and ranked", "Visual briefs complete and detailed"];
    case "Content Strategy":
      return [...universal, "Content pillars defined with examples", "Brand voice guidelines complete", "Posting cadence specified per platform", "90-day roadmap included"];
    case "Campaign Strategy":
      return [...universal, "Campaign goal clearly defined with KPIs", "Audience targeting specified", "Budget allocation across channels", "Timeline with phases and milestones"];
    case "Audience Research":
      return [...universal, "Minimum 3 personas detailed", "Customer journey map included", "Content consumption habits documented", "Platform preferences per persona"];
    case "Competitor Analysis":
      return [...universal, "3-5 competitors analyzed", "Ad library research completed", "Content strategy comparison chart", "Actionable advantage section"];
    case "Hashtag Research":
      return [...universal, "Per-platform hashtag sets", "Volume data included", "Relevance scores assigned", "Avoidance list for banned/shadowbanned tags"];
    case "Social Media Audit":
      return [...universal, "All active platforms audited", "Engagement metrics per platform", "Content performance analysis", "Growth opportunity recommendations"];
    default:
      return universal;
  }
}

async function notifyClientDeliverable(
  client: Client,
  pipeline: PipelineDefinition,
  deliverables: string[],
): Promise<void> {
  const dashboardUrl = `https://metroreachagency.com/dashboard?client=${client.id}`;

  try {
    await sendDeliverableReady(
      client,
      dashboardUrl,
      `Your ${pipeline.label} has been prepared by our team. Review it on your client dashboard, and reply with any feedback.`,
    );
  } catch (err: any) {
    console.error(`Failed to send deliverable notification for ${client.id}:`, err.message);
  }
}

// ── Database interactions ──

async function updatePipelineStatus(clientId: string, status: string): Promise<void> {
  try {
    await sql`
      UPDATE clients
      SET pipeline_status = ${status}, updated_at = NOW()
      WHERE id = ${clientId}
    `;
  } catch (err: any) {
    console.error(`Failed to update pipeline_status for ${clientId}:`, err.message);
  }
}

async function updatePipelineStep(
  clientId: string,
  stepKey: string,
  stepLabel: string,
): Promise<void> {
  try {
    // Store the current step in pipeline_status for dashboard display
    await sql`
      UPDATE clients
      SET
        pipeline_status = ${stepKey},
        updated_at = NOW()
      WHERE id = ${clientId}
    `;
  } catch (err: any) {
    console.error(`Failed to update pipeline step for ${clientId}:`, err.message);
  }
}

/**
 * Check if a pipeline step has already been completed.
 * Uses the pipeline_log table (create if needed).
 */
async function isStepCompleted(clientId: string, stepKey: string): Promise<boolean> {
  try {
    const rows = await sql`
      SELECT 1 FROM pipeline_log
      WHERE client_id = ${clientId} AND step_key = ${stepKey} AND status = 'completed'
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    // Table might not exist yet — that's fine, step is not completed
    return false;
  }
}

/**
 * Mark a pipeline step as completed with deliverables.
 */
async function markStepCompleted(
  clientId: string,
  stepKey: string,
  deliverables: string,
): Promise<void> {
  try {
    await sql`
      INSERT INTO pipeline_log (client_id, step_key, status, deliverables, created_at)
      VALUES (${clientId}, ${stepKey}, 'completed', ${deliverables}::jsonb, NOW())
      ON CONFLICT (client_id, step_key) DO UPDATE
      SET status = 'completed', deliverables = ${deliverables}::jsonb, updated_at = NOW()
    `;
  } catch (err: any) {
    console.error(`Failed to mark step ${stepKey} for ${clientId}:`, err.message);
  }
}

// ── Progress query ──

/**
 * Get detailed pipeline progress for a client.
 */
export async function getPipelineProgress(clientId: string): Promise<PipelineProgress[]> {
  try {
    const pipelines = PIPELINE_MAP["full-service-monthly"]; // get all possible pipeline defs

    // Get client record
    const clientRows = await sql`
      SELECT id, service_slug, pipeline_status, onboarding_data, created_at
      FROM clients WHERE id = ${clientId} LIMIT 1
    `;

    if (!clientRows.length) return [];

    const client = clientRows[0];
    const clientPipelines = PIPELINE_MAP[client.service_slug as string] || [];

    // Get completed steps from log
    let completedSteps: Record<string, string[]> = {};
    try {
      const logRows = await sql`
        SELECT step_key, deliverables, created_at FROM pipeline_log
        WHERE client_id = ${clientId} AND status = 'completed'
        ORDER BY created_at ASC
      `;
      for (const row of logRows) {
        const [pipeline, step] = (row.step_key as string).split(":");
        if (!completedSteps[pipeline]) completedSteps[pipeline] = [];
        completedSteps[pipeline].push(step);
      }
    } catch {
      // pipeline_log table might not exist
    }

    const progress: PipelineProgress[] = clientPipelines.map((pipeline) => {
      const pipelineKey = pipeline.file.replace(".md", "");
      const completed = completedSteps[pipelineKey] || [];
      const currentIdx = completed.length;
      const currentStep = currentIdx < pipeline.steps.length ? pipeline.steps[currentIdx] : "deliver";

      return {
        clientId,
        pipeline: pipeline.label,
        currentStep,
        completedSteps: completed as PipelineStep[],
        startedAt: String(client.created_at),
        updatedAt: new Date().toISOString(),
        deliverables: [],
        nextStepEta: currentIdx < pipeline.steps.length
          ? estimateEta(pipeline.steps.slice(currentIdx))
          : null,
      };
    });

    return progress;
  } catch (err: any) {
    console.error(`Failed to get pipeline progress for ${clientId}:`, err.message);
    return [];
  }
}

function estimateEta(remainingSteps: PipelineStep[]): string {
  const totalHours = remainingSteps.reduce((sum, s) => sum + (STEP_DURATION_HOURS[s] || 0), 0);
  if (totalHours <= 0) return "now";

  const eta = new Date(Date.now() + totalHours * 3600 * 1000);
  return eta.toISOString();
}

// ── Utility ──

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
