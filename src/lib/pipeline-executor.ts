/**
 * Pipeline Executor — MetroReach Media
 *
 * Routes every paid service to a real, actionable task for the team.
 *
 * When a client pays, the Stripe webhook calls executePipeline(), which:
 *   1. Sets pipeline_status = 'received'        (payment confirmed)
 *   2. Determines the deliverable type from the service slug
 *   3. Writes a real task brief to /home/team/shared/tasks/{slug}-{clientId}.md
 *      with client details, the deliverable to produce, 48-hour deadline, and
 *      the assigned team members
 *   4. Sets pipeline_status = 'assigned'        (brief written)
 *   5. Notifies the team and sets pipeline_status = 'in_progress'
 *   6. 'delivered' is set when the deliverable is actually sent to the client
 *      (see markPipelineDelivered / executePremiumAuditPipeline)
 *
 * PIPELINE_MAP is retained as the source of truth for recurring delivery
 * scheduling (used by scheduler.ts and the pipeline status API) — it is NOT
 * used to generate hollow JSON briefs anymore.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "~/lib/db";
import { sendPremiumAuditReady } from "~/lib/email-sequences";
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
// Retained for scheduler.ts (recurring delivery scheduling) and the pipeline
// status API. Not used to fabricate deliverables.

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

// ── Deliverable type routing ──
// Every service slug maps to the type of work the team must actually produce.

export type DeliverableType =
  | "strategy-document"
  | "content-deliverable"
  | "ongoing-management"
  | "advertising"
  | "community-management"
  | "setup-reporting";

const DELIVERABLE_TYPE_MAP: Record<string, DeliverableType> = {
  // Strategy documents — PDF report delivered via email
  "social-media-audit": "strategy-document",
  "competitor-analysis": "strategy-document",
  "social-media-strategy": "strategy-document",
  "content-strategy": "strategy-document",
  "campaign-strategy": "strategy-document",
  "audience-research": "strategy-document",
  "brand-voice-development": "strategy-document",
  "hashtag-research": "strategy-document",
  "trend-research": "strategy-document",
  "organic-growth-strategy": "strategy-document",
  "landing-page-review": "strategy-document",
  "profile-bio-optimization": "strategy-document",
  "monthly-strategy-reviews": "strategy-document",
  "competitor-benchmarking": "strategy-document",
  "executive-reports": "strategy-document",
  "social-media-audit-strategy": "strategy-document",
  "premium-growth-audit": "strategy-document",

  // Content deliverables — spreadsheet/doc with captions & calendar
  "monthly-content-calendar": "content-deliverable",
  "caption-writing": "content-deliverable",
  "posting-schedule-optimization": "content-deliverable",

  // Ongoing management — content creation + Buffer posting + reporting
  "single-platform-management": "ongoing-management",
  "multi-platform-management": "ongoing-management",
  "vip-daily": "ongoing-management",
  starter: "ongoing-management",
  growth: "ongoing-management",
  scale: "ongoing-management",

  // Advertising setup/management
  "meta-ads-management": "advertising",
  "ad-account-setup": "advertising",
  "ad-creative-package": "advertising",
  "ab-testing-optimization": "advertising",
  "pixel-conversion-tracking": "advertising",

  // Community management — ongoing monitoring
  "community-management": "community-management",
  "daily-monitoring-engagement": "community-management",
  "comment-dm-response": "community-management",
  "review-management": "community-management",
  "social-listening": "community-management",
  "social-listening-community": "community-management",
  "dm-management": "community-management",
  "social-inbox-management": "community-management",

  // Setup / reporting deliverables
  "daily-engagement": "setup-reporting",
  "social-inbox-design": "setup-reporting",
  "community-engagement-templates": "setup-reporting",
  "influencer-research": "setup-reporting",
  "platform-setup-optimization": "setup-reporting",
  "platform-setup-community": "setup-reporting",
  "kpi-dashboard-setup": "setup-reporting",
  "monthly-performance-reports": "setup-reporting",
  "weekly-performance-summaries": "setup-reporting",
};

const DELIVERABLE_TYPE_LABELS: Record<DeliverableType, string> = {
  "strategy-document": "Strategy document (PDF report delivered via email)",
  "content-deliverable": "Content deliverable (spreadsheet/doc with captions & calendar)",
  "ongoing-management": "Ongoing management (content creation + Buffer posting + reporting)",
  advertising: "Advertising setup & management",
  "community-management": "Community management (ongoing monitoring)",
  "setup-reporting": "Setup / reporting deliverable",
};

// Team members assigned per deliverable type.
// Content Strategist leads research/strategy, Copywriter handles copy,
// Designer handles visuals; specialists own their disciplines.
const DELIVERABLE_TEAM: Record<DeliverableType, string[]> = {
  "strategy-document": ["Content Strategist", "Copywriter", "Designer"],
  "content-deliverable": ["Content Strategist", "Copywriter", "Designer"],
  "ongoing-management": ["Content Strategist", "Copywriter", "Designer"],
  advertising: ["Paid Ads Specialist", "Content Strategist", "Designer"],
  "community-management": ["Content Strategist"],
  "setup-reporting": ["Analytics & Watchdog", "Content Strategist", "Engineer"],
};

// Specific production instructions per deliverable type. Every instruction
// enforces the locked-in rules: 100% verifiable client facts (no fabricated
// statistics), premium human-written copy (never mention AI/automation), and
// correct "MetroReach Media" branding.
const DELIVERABLE_INSTRUCTIONS: Record<DeliverableType, string> = {
  "strategy-document": `Produce a complete strategy document as a branded PDF report and deliver it to the client by email.
1. Executive summary of findings and recommendations
2. Per-platform analysis for every platform the client is active on (Facebook, Instagram, LinkedIn, X)
3. Audience, competitor, and content-gap analysis grounded in the client's real accounts
4. Prioritized action plan with a 30/60/90-day roadmap
5. Measurable KPIs and success metrics tied to the client's goals
LOCKED-IN RULES: every statistic, claim, and benchmark must be 100% verifiable from the client's actual data or a cited source — no fabricated numbers, no generic "industry average" claims. Copy must read premium and human-written; never mention AI or automation. Brand must appear as "MetroReach Media" everywhere.`,
  "content-deliverable": `Produce the content deliverable as a spreadsheet/doc and deliver it to the client by email.
1. Platform-specific captions (per the package quantity) written in the client's brand voice
2. Hashtag sets per platform (Instagram 20-25 tags, Facebook 3-5, LinkedIn 3-5, X 1-2 — all include #MetroReachMedia)
3. A posting calendar with dates/times matched to the client's audience activity
4. Visual briefs for the Designer so every image is unique and original (zero recycled content)
LOCKED-IN RULES: only use 100% verifiable client facts — no fabricated claims or invented metrics. Copy must read premium and human-written; never mention AI or automation. Brand must appear as "MetroReach Media" everywhere.`,
  "ongoing-management": `Set up and run ongoing management for this client: content creation + Buffer scheduling/posting + reporting.
1. Onboard the client's platforms and confirm access
2. Produce and schedule original content on the committed cadence (unique original visuals per post — zero recycled content)
3. Post on schedule with 100% on-time delivery and zero downtime
4. Deliver monthly performance reporting with real client metrics (leads, engagement, growth)
LOCKED-IN RULES: every post uses a unique original image that visibly says "MetroReach Media"; every claim in reporting is 100% verifiable from the client's real numbers. Never mention AI or automation in client-facing materials. Brand must appear as "MetroReach Media" everywhere.`,
  advertising: `Set up and manage paid advertising for this client.
1. Ad account/pixel setup or campaign launch per the purchased service
2. Audience targeting, budget allocation, and structured A/B tests
3. Creative direction to the Designer for ad creatives
4. Ongoing optimization with clear CPL/ROAS targets and weekly performance reads
LOCKED-IN RULES: all targeting and performance claims must be verifiable from the client's real account data — no fabricated results. Client-facing copy must read premium and human-written; never mention AI or automation. Brand must appear as "MetroReach Media" everywhere.`,
  "community-management": `Run ongoing community management for this client (daily monitoring & engagement).
1. Monitor comments, DMs, and mentions across the client's platforms
2. Respond in the client's brand voice with on-brand, human copy (no AI/automation language)
3. Escalate and manage reviews per the client's review workflow
4. Report engagement and response metrics weekly with real numbers
LOCKED-IN RULES: responses must be truthful and verifiable — never impersonate or fabricate. Brand must appear as "MetroReach Media" everywhere.`,
  "setup-reporting": `Produce the setup/reporting deliverable and deliver it to the client by email.
1. Complete the setup (platform/profile/dashboard/templates) or produce the report (monthly/weekly performance, KPI dashboard, influencer research)
2. Use only real client data — every metric must trace back to an actual source
3. Present clearly with a summary of findings and recommended next actions
LOCKED-IN RULES: no fabricated statistics, no generic "industry average" claims without the client's actual numbers. Copy must read premium and human-written; never mention AI or automation. Brand must appear as "MetroReach Media" everywhere.`,
};

export function getDeliverableTypeForSlug(serviceSlug: string): DeliverableType | null {
  const direct = DELIVERABLE_TYPE_MAP[serviceSlug];
  if (direct) return direct;

  // Fallback for legacy/package slugs: any recurring schedule implies ongoing
  // management; otherwise treat as a strategy document.
  const pipelines = PIPELINE_MAP[serviceSlug];
  if (pipelines && pipelines.length > 0) {
    const hasRecurring = pipelines.some((p) => p.recurring);
    return hasRecurring ? "ongoing-management" : "strategy-document";
  }
  return null;
}

export function getDeliverableLabel(type: DeliverableType): string {
  return DELIVERABLE_TYPE_LABELS[type];
}

// ── Task briefs ──

const TASKS_DIR = "/home/team/shared/tasks";
const SLA_HOURS = 48; // 48-hour turnaround from purchase

export interface PipelineTask {
  id: string; client_id: string; service_slug: string; service_name: string;
  deliverable_type: string; client_name: string; client_email: string; company: string | null;
  task_brief: string; assigned_roles: string[]; deadline: string; status: string;
  created_at: string; updated_at: string;
}

interface TaskBrief {
  clientId: string;
  clientName: string;
  clientEmail: string;
  company: string;
  serviceName: string;
  serviceSlug: string;
  deliverableType: DeliverableType;
  deadline: string;
  assignedTeam: string[];
}

function buildTaskBrief(client: Client, deliverableType: DeliverableType): TaskBrief {
  return {
    clientId: client.id,
    clientName: client.name,
    clientEmail: client.email,
    company: client.company || "N/A",
    serviceName: client.service,
    serviceSlug: client.service_slug,
    deliverableType,
    deadline: new Date(Date.now() + SLA_HOURS * 3600 * 1000).toISOString(),
    assignedTeam: DELIVERABLE_TEAM[deliverableType],
  };
}

/**
 * Write the task brief to /home/team/shared/tasks/{service-slug}-{clientId}.md.
 * The brief is the team's actionable work order — every agent reads the shared
 * tasks directory. Returns the written path, or null if the write failed
 * (e.g. read-only serverless filesystem — DB statuses remain authoritative).
 */
function renderTaskBrief(brief: TaskBrief): string {
  const markdown = [
    `# Task: ${brief.serviceName}`,
    "",
    `> **Deliverable type:** ${DELIVERABLE_TYPE_LABELS[brief.deliverableType]}  `,
    `> **Deadline:** ${brief.deadline} (${SLA_HOURS}-hour SLA from purchase)  `,
    `> **Status:** assigned → in_progress → delivered`,
    "",
    "---",
    "",
    "## Client",
    `- **Name:** ${brief.clientName}`,
    `- **Email:** ${brief.clientEmail}`,
    `- **Company:** ${brief.company}`,
    `- **Client ID:** ${brief.clientId}`,
    "",
    "## Service",
    `- **Service:** ${brief.serviceName}`,
    `- **Slug:** \`${brief.serviceSlug}\``,
    "",
    "## Assigned Team",
    brief.assignedTeam.map((member) => `- ${member}`).join("\n"),
    "",
    "## What To Produce",
    DELIVERABLE_INSTRUCTIONS[brief.deliverableType],
    "",
    "---",
    "",
    "### Delivery",
    `- Produce the deliverable, run internal QA (accuracy, branding, no AI/automation language), and email it to the client at ${brief.clientEmail} before the deadline.`,
    `- After the deliverable is sent, update the client's pipeline_status to "delivered" (markPipelineDelivered in src/lib/pipeline-executor.ts).`,
    "",
    `*Generated by MetroReach Media pipeline executor — ${new Date().toISOString()}*`,
  ].join("\n");
  return markdown;
}

function writeTaskBrief(brief: TaskBrief, markdown: string): string | null {
  const filename = `${brief.serviceSlug}-${brief.clientId}.md`;
  const path = join(TASKS_DIR, filename);
  try {
    mkdirSync(TASKS_DIR, { recursive: true });
    writeFileSync(path, markdown, "utf-8");
    console.log(`[pipeline-executor] Task brief written: ${path}`);
    return path;
  } catch (err: any) {
    console.error(`[pipeline-executor] Failed to write task brief ${path}:`, err.message);
    return null;
  }
}
/** Insert a task into the database queue. Returns false so the caller can use the file fallback. */
function toRoleSlug(role: string): string {
  return role.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function insertPipelineTask(brief: TaskBrief, taskBrief: string): Promise<boolean> {
  try {
    await sql`INSERT INTO pipeline_tasks
      (client_id, service_slug, service_name, deliverable_type, client_name, client_email, company, task_brief, assigned_roles, deadline, status)
      VALUES (${brief.clientId}, ${brief.serviceSlug}, ${brief.serviceName}, ${brief.deliverableType}, ${brief.clientName}, ${brief.clientEmail}, ${brief.company}, ${taskBrief}, ${brief.assignedTeam.map(toRoleSlug)}, ${brief.deadline}::timestamptz, 'pending')`;
    return true;
  } catch (err: any) {
    console.error(`[pipeline-executor] Failed to insert pipeline task for ${brief.clientId}:`, err.message);
    return false;
  }
}

export async function getPendingTasks(): Promise<PipelineTask[]> {
  const rows = await sql`SELECT * FROM pipeline_tasks WHERE status = 'pending' ORDER BY created_at ASC`;
  return rows as unknown as PipelineTask[];
}

export async function claimTask(taskId: string): Promise<boolean> {
  const rows = await sql`UPDATE pipeline_tasks SET status = 'in_progress', updated_at = NOW() WHERE id = ${taskId} AND status = 'pending' RETURNING id`;
  return rows.length > 0;
}

// ── Pipeline execution ──

/**
 * Execute the delivery pipeline for a newly purchased service.
 * Called from the Stripe webhook after the client record is created.
 *
 * Milestones (pipeline_status): received → assigned → in_progress → delivered
 * - received:     payment confirmed (this function)
 * - assigned:     task brief written to /home/team/shared/tasks/
 * - in_progress:  team notified (brief visible in shared tasks directory)
 * - delivered:    deliverable sent to client (see markPipelineDelivered /
 *                 executePremiumAuditPipeline)
 */
export async function executePipeline(client: Client): Promise<void> {
  const serviceSlug = client.service_slug;

  // ── Premium Growth Audit: special handling ──
  // The lead was created pre-payment via /api/premium-audit/submit.
  // On purchase, we run the full premium analysis, save results, and email the
  // client the completed report (its own received→…→delivered flow).
  if (serviceSlug === "premium-growth-audit") {
    await executePremiumAuditPipeline(client);
    return;
  }

  // Milestone 1: received — payment confirmed
  await updatePipelineStatus(client.id, "received");

  // Route to the real deliverable type for this service
  const deliverableType = getDeliverableTypeForSlug(serviceSlug);
  if (!deliverableType) {
    console.error(`No deliverable mapping for service "${serviceSlug}" (client ${client.id}) — marking failed`);
    await updatePipelineStatus(client.id, "failed");
    return;
  }

  // Milestone 2: assigned — write the real task brief for the team
  const brief = buildTaskBrief(client, deliverableType);
  const markdown = renderTaskBrief(brief);
  const inserted = await insertPipelineTask(brief, markdown);
  // The shared file is a resilience fallback only; DB is authoritative.
  const briefPath = inserted ? `${TASKS_DIR}/${brief.serviceSlug}-${brief.clientId}.md` : writeTaskBrief(brief, markdown);
  if (!inserted && !briefPath) {
    console.error(`Task brief could not be persisted for ${client.id} (${serviceSlug}) — marking failed`);
    await updatePipelineStatus(client.id, "failed");
    return;
  }

  // Record the assignment in pipeline_log for the status API / dashboards
  await logAssignment(client.id, brief, briefPath);

  await updatePipelineStatus(client.id, "assigned");

  // Milestone 3: in_progress — team notified (brief is in the shared tasks dir)
  await updatePipelineStatus(client.id, "in_progress");

  console.log(
    `Pipeline routed for client ${client.id} (${serviceSlug}): ${DELIVERABLE_TYPE_LABELS[deliverableType]} — team: ${brief.assignedTeam.join(", ")} — brief: ${briefPath}`,
  );
}

/**
 * Mark a client's pipeline as delivered. Call this when the deliverable has
 * actually been sent to the client (e.g. from the delivery/email step).
 */
export async function markPipelineDelivered(clientId: string): Promise<void> {
  await updatePipelineStatus(clientId, "delivered");
  console.log(`Pipeline marked delivered for ${clientId}`);
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
    const sent = await sendPremiumAuditReady(client, reportUrl, result.scores.overall);
    if (sent && sent.success) {
      console.log(`Premium audit email sent to ${client.email}`);
    } else {
      console.error(`Premium audit email reported failure for ${client.id}:`, sent?.error || "unknown");
    }
  } catch (err: any) {
    console.error(`Premium audit email failed for ${client.id}:`, err.message);
  }

  console.log(`Premium Growth Audit pipeline complete for ${client.id}`);
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

/**
 * Log the assignment in pipeline_log so the status API and dashboards can show
 * where the brief lives and which team owns it.
 */
async function logAssignment(clientId: string, brief: TaskBrief, briefPath: string): Promise<void> {
  const payload = JSON.stringify({
    status: "assigned",
    deliverableType: brief.deliverableType,
    deliverableLabel: DELIVERABLE_TYPE_LABELS[brief.deliverableType],
    assignedTeam: brief.assignedTeam,
    deadline: brief.deadline,
    taskBrief: briefPath,
  });
  try {
    await sql`
      INSERT INTO pipeline_log (client_id, step_key, status, deliverables, created_at)
      VALUES (${clientId}, 'assignment', 'assigned', ${payload}::jsonb, NOW())
      ON CONFLICT (client_id, step_key) DO UPDATE
      SET status = 'assigned', deliverables = ${payload}::jsonb, updated_at = NOW()
    `;
  } catch (err: any) {
    console.error(`Failed to log pipeline assignment for ${clientId}:`, err.message);
  }
}

// ── Progress query ──

/**
 * Get detailed pipeline progress for a client.
 */
export async function getPipelineProgress(clientId: string): Promise<PipelineProgress[]> {
  try {
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
