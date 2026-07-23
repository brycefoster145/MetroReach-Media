/**
 * Social Media Audit API endpoint.
 * POST /api/audit — accepts form data, pulls real profile data from Buffer,
 * runs scoring algorithm, generates observations, stores result, returns report ID.
 */

import { createFileRoute } from "@tanstack/react-router";
import { randomBytes } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditFormData {
  businessName: string;
  websiteUrl: string;
  industry: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  linkedinUrl: string;
  name: string;
  email: string;
  phone: string;
  goals: string;
}

interface BufferChannel {
  id: string;
  name: string;
  service: string;
  displayName?: string;
  avatar?: string;
  isDisconnected?: boolean;
}

interface PostMetric {
  type: string;
  name: string;
  description?: string;
  value: number;
  unit: string;
}

interface BufferPost {
  id: string;
  text: string;
  status: string;
  dueAt: string | null;
  metrics?: PostMetric[];
}

interface PlatformProfile {
  platform: string;
  url: string;
  handle: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  websiteUrl: string | null;
  coverImage: string | null;
  category: string | null;
  followerCount: number;
  followingCount: number;
  postCount30d: number;
  posts: BufferPost[];
  metrics: PostMetric[];
  hasEngagement: boolean;
  hasReplies: boolean;
  hasStories: boolean;
  hasReels: boolean;
  hasReviews: boolean;
  isVerified: boolean;
}

interface ProfileScore {
  profilePicture: { score: number; observation: string };
  bio: { score: number; observation: string };
  bioLength: { score: number; observation: string };
  websiteLink: { score: number; observation: string };
  coverImage: { score: number; observation: string };
  category: { score: number; observation: string };
  total: number;
}

interface ConsistencyScore {
  postCount: number;
  score: number;
  gaps: number;
  gapPenalty: number;
  total: number;
  observation: string;
}

interface EngagementScore {
  hasEngagement: boolean;
  hasReplies: boolean;
  total: number;
  observation: string;
}

interface CompetitiveScore {
  hasReviews: boolean;
  hasStories: boolean;
  hasReels: boolean;
  total: number;
  observation: string;
}

interface ServiceRecommendation {
  slug: string;
  name: string;
  reason: string;
}

interface AuditResult {
  id: string;
  formData: AuditFormData;
  platforms: PlatformProfile[];
  scores: {
    profileCompleteness: { total: number; breakdown: Record<string, ProfileScore> };
    postingConsistency: { total: number; breakdown: Record<string, ConsistencyScore> };
    brandCohesion: { total: number; observation: string };
    engagementHealth: { total: number; breakdown: Record<string, EngagementScore> };
    competitiveSignal: { total: number; breakdown: Record<string, CompetitiveScore> };
    overall: number;
  };
  strengths: string[];
  weaknesses: string[];
  quickWins: QuickWin[];
  serviceRecommendations: ServiceRecommendation[];
  timestamp: string;
}

interface QuickWin {
  issue: string;
  fix: string;
  timeEstimate: string;
  impactLevel: "High" | "Medium";
}

// ---------------------------------------------------------------------------
// Helper: call Buffer MCP internally
// ---------------------------------------------------------------------------

async function bufferRpc(method: string, params?: Record<string, unknown>): Promise<any> {
  const res = await fetch("http://localhost:3000/api/mcp/buffer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (res.status === 204) return null;

  const json = await res.json() as any;
  if (json.error) {
    throw new Error(`Buffer RPC error (${method}): ${json.error.message}`);
  }

  // Parse the text content from MCP response
  const content = json.result?.content;
  if (content?.[0]?.text) {
    try {
      return JSON.parse(content[0].text);
    } catch {
      return content[0].text;
    }
  }
  return json.result;
}

// ---------------------------------------------------------------------------
// Helper: extract handle from URL
// ---------------------------------------------------------------------------

function extractHandle(url: string): string {
  if (!url) return "";
  // Remove trailing slash and query params
  const clean = url.replace(/\/+$/, "").split("?")[0];
  const parts = clean.split("/");
  return parts[parts.length - 1] || parts[parts.length - 2] || "";
}

// ---------------------------------------------------------------------------
// Helper: normalize service name
// ---------------------------------------------------------------------------

function normalizeService(service: string): string {
  const map: Record<string, string> = {
    twitter: "x",
    facebook: "facebook",
    instagram: "instagram",
    tiktok: "tiktok",
    linkedin: "linkedin",
    youtube: "youtube",
  };
  return map[service?.toLowerCase()] || service?.toLowerCase() || "unknown";
}

// ---------------------------------------------------------------------------
// Helper: generate a unique report ID
// ---------------------------------------------------------------------------

function generateId(): string {
  return `metro-${randomBytes(4).toString("hex")}`;
}

// ---------------------------------------------------------------------------
// Helper: count posts in last 30 days
// ---------------------------------------------------------------------------

function countPostsLast30Days(posts: BufferPost[]): number {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return posts.filter((p) => {
    if (!p.dueAt) return false;
    return new Date(p.dueAt).getTime() >= thirtyDaysAgo;
  }).length;
}

// ---------------------------------------------------------------------------
// Helper: find gaps in posting schedule
// ---------------------------------------------------------------------------

function countLargeGaps(posts: BufferPost[]): number {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const dates = posts
    .filter((p) => p.dueAt && new Date(p.dueAt).getTime() >= thirtyDaysAgo)
    .map((p) => new Date(p.dueAt!).getTime())
    .sort((a, b) => a - b);

  if (dates.length < 2) return 0;

  let gaps = 0;
  for (let i = 1; i < dates.length; i++) {
    const gapDays = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
    if (gapDays > 7) gaps++;
  }
  return gaps;
}

// ---------------------------------------------------------------------------
// Helper: check if total engagement (likes + comments) exists
// ---------------------------------------------------------------------------

function hasEngagementActivity(metrics: PostMetric[]): boolean {
  const engagementMetrics = metrics.filter((m) =>
    ["likes", "comments", "reactions", "engagement"].some((t) =>
      m.type?.toLowerCase().includes(t) || m.name?.toLowerCase().includes(t)
    )
  );
  const total = engagementMetrics.reduce((sum, m) => sum + m.value, 0);
  return total > 0;
}

function hasReplyActivity(metrics: PostMetric[]): boolean {
  const replyMetrics = metrics.filter((m) =>
    ["reply", "replies", "response"].some((t) =>
      m.type?.toLowerCase().includes(t) || m.name?.toLowerCase().includes(t)
    )
  );
  const total = replyMetrics.reduce((sum, m) => sum + m.value, 0);
  return total > 0;
}

// ---------------------------------------------------------------------------
// SCORING: Profile Completeness (0-25 points per platform, averaged)
// ---------------------------------------------------------------------------

function scoreProfileCompleteness(
  profile: PlatformProfile,
  platformLabel: string
): ProfileScore {
  const observations: ProfileScore = {
    profilePicture: { score: 0, observation: "" },
    bio: { score: 0, observation: "" },
    bioLength: { score: 0, observation: "" },
    websiteLink: { score: 0, observation: "" },
    coverImage: { score: 0, observation: "" },
    category: { score: 0, observation: "" },
    total: 0,
  };

  // Profile picture
  if (profile.avatar) {
    observations.profilePicture = {
      score: 5,
      observation: `Your ${platformLabel} profile picture is set. It looks professional and helps customers recognize your brand instantly.`,
    };
  } else {
    observations.profilePicture = {
      score: 0,
      observation: `Your ${platformLabel} profile is missing a profile picture. Businesses without a profile photo lose credibility — customers are 14x more likely to view a profile with a photo. Add your logo or a professional headshot.`,
    };
  }

  // Bio/description
  const bioText = profile.bio || "";
  if (bioText.length > 0) {
    observations.bio = {
      score: 5,
      observation: `Your ${platformLabel} bio is filled in — good. It reads: "${bioText.slice(0, 120)}${bioText.length > 120 ? "..." : ""}"`,
    };
    // Bio length check
    const optimalMin = platformLabel === "Instagram" ? 125 : platformLabel === "Facebook" ? 100 : 80;
    if (bioText.length >= optimalMin) {
      observations.bioLength = {
        score: 3,
        observation: `Your ${platformLabel} bio is ${bioText.length} characters — within the optimal range to convey value and include a CTA.`,
      };
    } else {
      observations.bioLength = {
        score: 0,
        observation: `Your ${platformLabel} bio is only ${bioText.length} characters. The optimal range is ${optimalMin}+ characters to include your value proposition and a clear call-to-action. Currently, it reads "${bioText}" — this tells people what you do but not why they should choose you.`,
      };
    }
  } else {
    observations.bio = {
      score: 0,
      observation: `Your ${platformLabel} bio is empty. This is one of the first things potential customers see. A blank bio signals neglect. Fill it with your value proposition, location, and a clear next step.`,
    };
    observations.bioLength = {
      score: 0,
      observation: `No bio to evaluate on ${platformLabel}.`,
    };
  }

  // Website link
  if (profile.websiteUrl) {
    observations.websiteLink = {
      score: 4,
      observation: `Your ${platformLabel} profile links to ${profile.websiteUrl} — this gives customers a clear path to learn more or contact you.`,
    };
  } else {
    observations.websiteLink = {
      score: 0,
      observation: `No website link on your ${platformLabel} profile. Every social profile should direct people to your website or booking page. Without a link, you're sending interested prospects into a dead end.`,
    };
  }

  // Cover/banner image
  if (profile.coverImage) {
    observations.coverImage = {
      score: 4,
      observation: `Your ${platformLabel} cover image is in place. It contributes to a polished, professional first impression.`,
    };
  } else {
    observations.coverImage = {
      score: 4,
      observation: `No cover/banner image on ${platformLabel}. The header area is prime real estate — use it to showcase your work, a current offer, or your brand tagline.`,
    };
    // Still give points if avatar exists? No — the spec says cover image present = +4, not present = 0
    observations.coverImage.score = 0;
  }

  // Business category
  if (profile.category) {
    observations.category = {
      score: 4,
      observation: `Your ${platformLabel} business category is set to "${profile.category}" — this helps the platform show your profile to the right audience.`,
    };
  } else {
    observations.category = {
      score: 0,
      observation: `No business category set on ${platformLabel}. Categories determine who the platform shows your profile to. If you're a contractor and the category isn't set, you won't appear in relevant local searches.`,
    };
  }

  observations.total =
    observations.profilePicture.score +
    observations.bio.score +
    observations.bioLength.score +
    observations.websiteLink.score +
    observations.coverImage.score +
    observations.category.score;

  return observations;
}

// ---------------------------------------------------------------------------
// SCORING: Posting Consistency (0-25 points)
// ---------------------------------------------------------------------------

function scorePostingConsistency(
  posts: BufferPost[],
  platformLabel: string
): ConsistencyScore {
  const postCount = countPostsLast30Days(posts);
  let score: number;
  let scoreLabel: string;

  if (postCount >= 8) {
    score = 25;
    scoreLabel = "strong";
  } else if (postCount >= 4) {
    score = 18;
    scoreLabel = "moderate";
  } else if (postCount >= 1) {
    score = 10;
    scoreLabel = "weak";
  } else {
    score = 0;
    scoreLabel = "inactive";
  }

  const gaps = countLargeGaps(posts);
  const gapPenalty = gaps * 5;
  const finalScore = Math.max(0, score - gapPenalty);

  let observation: string;
  if (postCount === 0) {
    observation = `Zero posts in the last 30 days on ${platformLabel}. This is a dead channel — and it's hurting your brand. Potential customers who check your profile and see no recent activity will assume you're out of business or unreliable.`;
  } else if (postCount < 4) {
    observation = `Only ${postCount} post${postCount === 1 ? "" : "s"} in the last 30 days on ${platformLabel}. Your competitors who post daily are capturing the attention you're leaving on the table. At this cadence, the platform algorithm won't prioritize your content, meaning even your few posts reach a fraction of your audience.`;
  } else if (postCount < 8) {
    observation = `${postCount} posts in the last 30 days on ${platformLabel} — getting there. Consistency matters more than volume, and you're building a rhythm.`;
  } else {
    observation = `${postCount} posts in the last 30 days on ${platformLabel}. You're maintaining a solid publishing cadence that signals reliability to both the algorithm and your audience.`;
  }

  if (gaps > 0) {
    observation += ` We also found ${gaps} gap${gaps === 1 ? "" : "s"} of more than 7 days between posts. Long gaps cause your audience engagement to reset — the algorithm treats you like a new account after each silence.`;
  }

  return { postCount, score, gaps, gapPenalty, total: finalScore, observation };
}

// ---------------------------------------------------------------------------
// SCORING: Engagement Health (0-15 points)
// ---------------------------------------------------------------------------

function scoreEngagementHealth(
  metrics: PostMetric[],
  platformLabel: string
): EngagementScore {
  const hasEng = hasEngagementActivity(metrics);
  const hasRep = hasReplyActivity(metrics);
  const total = (hasEng ? 10 : 0) + (hasRep ? 5 : 0);

  let observation: string;
  if (hasEng && hasRep) {
    observation = `Your ${platformLabel} profile shows active engagement and you're responding to your audience. This two-way interaction builds trust and signals to the platform that your content has value.`;
  } else if (hasEng && !hasRep) {
    observation = `Your ${platformLabel} posts are getting engagement — people are commenting and reacting. But we didn't detect responses from your account. Unanswered comments tell customers their input doesn't matter. Even a quick "Thanks!" goes a long way.`;
  } else if (!hasEng && hasRep) {
    observation = `Limited engagement on ${platformLabel}, but you're making an effort to interact — that's the right instinct. The gap is in content that provokes a response. Ask questions. Run polls. Share takes that people react to.`;
  } else {
    observation = `No detectable engagement activity on ${platformLabel}. This usually means one of two things: your content isn't prompting a response, or your audience isn't large enough yet to generate interactions. Fix the content first — people engage when posts give them a reason to.`;
  }

  return { hasEngagement: hasEng, hasReplies: hasRep, total, observation };
}

// ---------------------------------------------------------------------------
// SCORING: Competitive Signal (0-15 points)
// ---------------------------------------------------------------------------

function scoreCompetitiveSignal(
  profile: PlatformProfile,
  platformLabel: string
): CompetitiveScore {
  const total =
    (profile.hasReviews ? 8 : 0) +
    (profile.hasStories ? 4 : 0) +
    (profile.hasReels ? 3 : 0);

  let observationParts: string[] = [];

  if (profile.hasReviews) {
    observationParts.push(`Reviews are active on ${platformLabel} — this is one of the strongest trust signals available.`);
  } else {
    observationParts.push(`No reviews/recommendations visible on ${platformLabel}.`);
  }

  if (profile.hasStories) {
    observationParts.push(`You're using Stories — these keep your brand in front of people between feed posts.`);
  } else {
    observationParts.push(`No Story/Highlight content detected. Stories are the first thing users see when they open the app. Without them, you're invisible in the most prominent position on the platform.`);
  }

  if (profile.hasReels) {
    observationParts.push(`Video/Reel content is present — this format consistently outperforms static posts for reach.`);
  } else {
    observationParts.push(`No video or Reel content detected on ${platformLabel}. Video is the platform's highest-reach format. Your competitors using Reels are getting 2–3x the reach of your best static posts.`);
  }

  return {
    hasReviews: profile.hasReviews,
    hasStories: profile.hasStories,
    hasReels: profile.hasReels,
    total,
    observation: observationParts.join(" "),
  };
}

// ---------------------------------------------------------------------------
// SCORING: Brand Cohesion (0-20 points, cross-platform)
// ---------------------------------------------------------------------------

function scoreBrandCohesion(platforms: PlatformProfile[]): { total: number; observation: string } {
  if (platforms.length <= 1) {
    return {
      total: platforms.length === 1 ? 6 : 0,
      observation: platforms.length === 0
        ? "No platforms to evaluate for brand cohesion."
        : "Only one platform with profile data available for brand cohesion analysis. Consistency across platforms is a strength when you expand to additional channels.",
    };
  }

  // Same profile picture?
  const avatars = platforms.map((p) => p.avatar).filter(Boolean);
  const uniqueAvatars = new Set(avatars);
  const sameAvatar = uniqueAvatars.size <= 1;
  const avatarScore = sameAvatar ? 7 : 0;

  // Consistent business name format?
  const names = platforms.map((p) => p.displayName).filter(Boolean);
  const nameLower = names.map((n) => n.toLowerCase().trim());
  const uniqueNames = new Set(nameLower);
  const sameName = uniqueNames.size <= 1;
  const nameScore = sameName ? 6 : 0;

  // Consistent bio messaging?
  const bios = platforms.map((p) => p.bio).filter(Boolean);
  let bioScore = 0;
  if (bios.length >= 2) {
    // Check for common keywords across bios
    const bioWords = bios.map((b) => {
      const words = b!.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      return new Set(words);
    });
    const commonWords = [...bioWords[0]].filter((w) => bioWords.slice(1).every((s) => s.has(w)));
    bioScore = commonWords.length >= 3 ? 7 : commonWords.length >= 1 ? 4 : 0;
  }

  const total = avatarScore + nameScore + bioScore;

  let observation = "";
  if (sameAvatar && sameName && bioScore >= 4) {
    observation = "Your brand is presented consistently across platforms — same profile image, same business name, and aligned messaging. This builds recognition and trust. Customers who find you on one platform will recognize you on another.";
  } else {
    const issues: string[] = [];
    if (!sameAvatar) issues.push("profile pictures differ across platforms");
    if (!sameName) issues.push(`business name appears differently (${names.join(", ")})`);
    if (bioScore < 4) issues.push("bio messaging is inconsistent — each platform tells a different story about your business");
    observation = `Brand cohesion needs work: ${issues.join("; ")}. When your visual identity and messaging vary across platforms, it fragments your brand recognition. Every platform should present the same business — not different versions of it.`;
  }

  return { total, observation };
}

// ---------------------------------------------------------------------------
// Generate service recommendations based on scores
// ---------------------------------------------------------------------------

function generateServiceRecommendations(
  scores: AuditResult["scores"],
  formData: AuditFormData
): ServiceRecommendation[] {
  const recommendations: ServiceRecommendation[] = [];

  // Average posting consistency across platforms
  const pcBreakdown = scores.postingConsistency.breakdown;
  const pcTotal = scores.postingConsistency.total;
  const pcMaxPerPlatform = 25;
  // Normalize to 25 for threshold checks
  const pcPlatforms = Object.keys(pcBreakdown);
  const avgPc = pcPlatforms.length > 0
    ? pcPlatforms.reduce((sum, k) => sum + pcBreakdown[k].total, 0) / pcPlatforms.length
    : 0;

  // Profile completeness average
  const pfBreakdown = scores.profileCompleteness.breakdown;
  const pfPlatforms = Object.keys(pfBreakdown);
  const avgPf = pfPlatforms.length > 0
    ? pfPlatforms.reduce((sum, k) => sum + pfBreakdown[k].total, 0) / pfPlatforms.length
    : 0;

  // Engagement health average
  const ehBreakdown = scores.engagementHealth.breakdown;
  const ehPlatforms = Object.keys(ehBreakdown);
  const avgEh = ehPlatforms.length > 0
    ? ehPlatforms.reduce((sum, k) => sum + ehBreakdown[k].total, 0) / ehPlatforms.length
    : 0;

  // Competitive signal average
  const csBreakdown = scores.competitiveSignal.breakdown;
  const csPlatforms = Object.keys(csBreakdown);
  const avgCs = csPlatforms.length > 0
    ? csPlatforms.reduce((sum, k) => sum + csBreakdown[k].total, 0) / csPlatforms.length
    : 0;

  // Rule: posting consistency < 15/25 → content calendar + caption writing
  if (avgPc < 15) {
    recommendations.push({
      slug: "monthly-content-calendar",
      name: "Monthly Content Calendar + Caption Writing",
      reason: `Based on your posting consistency score of ${Math.round(avgPc)}/25 (averaging ${pcPlatforms.map(k => `${pcBreakdown[k].postCount} post${pcBreakdown[k].postCount === 1 ? "" : "s"} on ${k}`).join(", ")} in the last 30 days), a Monthly Content Calendar would transform your posting from reactive to strategic. We plan every post around your business goals, seasonality, and audience behavior — then our caption writers make sure every post has a hook, value, and CTA.`,
    });
    recommendations.push({
      slug: "posting-schedule-optimization",
      name: "Posting Schedule Optimization",
      reason: `Your posting cadence is inconsistent. We'll analyze your audience's active hours and build a schedule that the platform algorithm rewards — so every post reaches the maximum number of potential customers.`,
    });
  }

  // Rule: profile completeness < 15/25 → platform setup + bio optimization
  if (avgPf < 15) {
    recommendations.push({
      slug: "platform-setup-optimization",
      name: "Platform Setup & Optimization",
      reason: `Your profile completeness score averaged ${Math.round(avgPf)}/25. Several elements — profile pictures, bios, cover images, or categories — are incomplete across your platforms. Our Platform Setup service configures every setting, every bio, and every visual element so your profiles look like a business customers can trust — not a side project.`,
    });
    recommendations.push({
      slug: "profile-bio-optimization",
      name: "Profile & Bio Optimization",
      reason: `Your bios are missing key elements: clear value proposition, location, and call-to-action. We'll rewrite every bio to immediately communicate who you are, who you serve, and what to do next — tailored to each platform's character limits and user behavior.`,
    });
  }

  // Rule: engagement health < 8/15 → community management
  if (avgEh < 8) {
    recommendations.push({
      slug: "daily-monitoring-engagement",
      name: "Community Management Bundle (Daily Engagement + DM Management)",
      reason: `Your engagement health score is ${Math.round(avgEh)}/15. Comments, DMs, and interactions are happening — or they would be, if someone was managing them. Our Community Management team handles daily engagement and DM responses so every customer interaction gets a reply, and your audience feels heard.`,
    });
  }

  // Rule: competitive signal < 8/15 → strategy + competitor analysis
  if (avgCs < 8) {
    recommendations.push({
      slug: "social-media-strategy",
      name: "Social Media Strategy",
      reason: `Your competitive signal score of ${Math.round(avgCs)}/15 means you're missing key formats that build authority — Stories, Reels, and review content. A Social Media Strategy maps out exactly which formats, content pillars, and campaigns will close the gap between you and your competitors.`,
    });
    recommendations.push({
      slug: "competitor-analysis",
      name: "Competitor Analysis",
      reason: `Your competitors are using formats you're not — video, Stories, review showcases. We'll analyze what's working for them, where they're vulnerable, and exactly what you need to build to get ahead.`,
    });
  }

  // Rule: overall < 40 → audit + strategy
  if (scores.overall < 40) {
    // Only add if not already present
    if (!recommendations.some((r) => r.slug === "social-media-audit")) {
      recommendations.push({
        slug: "social-media-audit",
        name: "Social Media Audit (Professional)",
        reason: `Your overall score of ${scores.overall}/100 indicates foundational gaps across multiple dimensions of your social presence. A professional Social Media Audit goes deeper than this free assessment — we'll review your content, audience, competitors, and conversion paths in detail, then deliver a prioritized action plan.`,
      });
    }
    if (!recommendations.some((r) => r.slug === "social-media-strategy")) {
      recommendations.push({
        slug: "social-media-strategy",
        name: "Social Media Strategy",
        reason: `With an overall score of ${scores.overall}/100, a comprehensive Social Media Strategy is the fastest path from where you are to where your competitors are. We'll define your platforms, content pillars, messaging framework, and 90-day roadmap.`,
      });
    }
  }

  // If somehow no recommendations generated, add a default
  if (recommendations.length === 0) {
    recommendations.push({
      slug: "monthly-content-calendar",
      name: "Monthly Content Calendar",
      reason: `Your presence is solid, but consistency at scale is what separates good from dominant. A Monthly Content Calendar ensures you never miss a posting day and every piece of content serves a strategic purpose.`,
    });
  }

  // Deduplicate by slug
  const seen = new Set<string>();
  return recommendations.filter((r) => {
    if (seen.has(r.slug)) return false;
    seen.add(r.slug);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Generate strengths from scores
// ---------------------------------------------------------------------------

function generateStrengths(scores: AuditResult["scores"], platforms: PlatformProfile[]): string[] {
  const strengths: string[] = [];

  // Check profile completeness
  const pfBreakdown = scores.profileCompleteness.breakdown;
  for (const [platform, pf] of Object.entries(pfBreakdown)) {
    if (pf.total >= 18) {
      strengths.push(`Your ${platform} profile is well-maintained (${pf.total}/25 completeness) — prospects who find you here see a credible, professional business.`);
    }
    if (pf.profilePicture.score === 5) {
      // Already covered by completeness, but add specifics if unique
    }
  }

  // Check posting consistency
  const pcBreakdown = scores.postingConsistency.breakdown;
  for (const [platform, pc] of Object.entries(pcBreakdown)) {
    if (pc.score >= 18) {
      strengths.push(`Your ${platform} posting consistency (${pc.postCount} posts in 30 days) signals an active, reliable business — exactly what customers look for before contacting you.`);
    }
  }

  // Check brand cohesion
  if (scores.brandCohesion.total >= 14) {
    strengths.push(`Your brand is presented consistently across platforms — same visuals, same name, same message. This unified presence builds trust faster than scattered branding.`);
  }

  // Check competitive signals
  const csBreakdown = scores.competitiveSignal.breakdown;
  for (const [platform, cs] of Object.entries(csBreakdown)) {
    if (cs.hasReviews) {
      strengths.push(`Reviews are active on ${platform} — social proof is live and working for your business 24/7.`);
    }
  }

  // If no strengths, find something genuine
  if (strengths.length === 0 && platforms.length > 0) {
    strengths.push(`You're present on ${platforms.length} platform${platforms.length === 1 ? "" : "s"} — having an established presence is the first step. Most small businesses don't even get this far.`);
  } else if (strengths.length === 0) {
    strengths.push("You're taking the right first step by requesting this audit. Awareness is the foundation of improvement.");
  }

  return strengths.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Generate weaknesses from scores
// ---------------------------------------------------------------------------

function generateWeaknesses(scores: AuditResult["scores"], platforms: PlatformProfile[]): string[] {
  const weaknesses: string[] = [];

  const pcBreakdown = scores.postingConsistency.breakdown;
  for (const [platform, pc] of Object.entries(pcBreakdown)) {
    if (pc.total <= 10) {
      weaknesses.push(`Your ${platform} posting has stalled — ${pc.postCount} post${pc.postCount === 1 ? "" : "s"} in 30 days. When potential customers check your profile and see inactivity, they move on to a competitor who looks active.`);
    }
  }

  const pfBreakdown = scores.profileCompleteness.breakdown;
  for (const [platform, pf] of Object.entries(pfBreakdown)) {
    if (pf.total <= 10) {
      weaknesses.push(`Your ${platform} profile is incomplete (${pf.total}/25). Missing elements like bios, cover images, or category settings make your business look less established than it actually is.`);
    }
  }

  if (scores.brandCohesion.total <= 10 && Object.keys(pcBreakdown).length > 1) {
    weaknesses.push(`Brand presentation is inconsistent across platforms — different profile images, bios, or business names fragment your recognition. A customer who finds you on Instagram should see the same brand they saw on Facebook.`);
  }

  const csBreakdown = scores.competitiveSignal.breakdown;
  for (const [platform, cs] of Object.entries(csBreakdown)) {
    if (!cs.hasReels && !cs.hasStories) {
      weaknesses.push(`No video or Story content on ${platform}. These are the platform's highest-reach formats — your competitors using them are capturing the attention you're not.`);
      break; // One platform mention is enough
    }
  }

  const ehBreakdown = scores.engagementHealth.breakdown;
  for (const [platform, eh] of Object.entries(ehBreakdown)) {
    if (!eh.hasReplies && eh.hasEngagement) {
      weaknesses.push(`Comments on your ${platform} posts are going unanswered. When customers take the time to engage and get silence back, they're less likely to engage again — and less likely to trust you with their business.`);
      break;
    }
  }

  if (weaknesses.length === 0) {
    weaknesses.push("While your foundation is solid, there's always room to refine. The platforms change their algorithms constantly — staying ahead requires continuous optimization.");
  }

  return weaknesses.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Generate quick wins
// ---------------------------------------------------------------------------

function generateQuickWins(
  scores: AuditResult["scores"],
  platforms: PlatformProfile[],
  formData: AuditFormData
): QuickWin[] {
  const wins: QuickWin[] = [];

  // Bio improvements
  const pfBreakdown = scores.profileCompleteness.breakdown;
  for (const [platform, pf] of Object.entries(pfBreakdown)) {
    if (pf.bioLength.score === 0 && pf.bio.score === 5) {
      wins.push({
        issue: `Your ${platform} bio is too short at its current length to include both a value proposition and a call-to-action.`,
        fix: `Expand your ${platform} bio to include: [what you do] + [who you serve] + [why choose you] + [what to do next]. Example: "Austin's trusted roofing contractor. 15 years. 500+ roofs. Free inspections → [link]"`,
        timeEstimate: "10 min",
        impactLevel: "High",
      });
    } else if (pf.bio.score === 0) {
      wins.push({
        issue: `Your ${platform} bio is empty — this is the most visible piece of text on your profile.`,
        fix: `Write a ${platform} bio today. Include: your service, your location, one credibility point, and a call-to-action. Example: "Phoenix HVAC — licensed, insured, 24/7 emergency service. Call or DM to schedule."`,
        timeEstimate: "10 min",
        impactLevel: "High",
      });
    }
    if (pf.websiteLink.score === 0) {
      wins.push({
        issue: `No website link on your ${platform} profile.`,
        fix: `Add ${formData.websiteUrl || "your website URL"} to your ${platform} profile. If you don't have a booking page, link to your contact page. Give people a clear next step.`,
        timeEstimate: "2 min",
        impactLevel: "High",
      });
    }
    if (pf.category.score === 0) {
      wins.push({
        issue: `No business category set on ${platform}.`,
        fix: `Go to your ${platform} settings and set your business category to "${formData.industry}". This tells the platform who to show your profile to in search and recommendations.`,
        timeEstimate: "3 min",
        impactLevel: "Medium",
      });
    }
  }

  // Posting gap quick win
  const pcBreakdown = scores.postingConsistency.breakdown;
  for (const [platform, pc] of Object.entries(pcBreakdown)) {
    if (pc.gaps > 0 && pc.postCount > 0) {
      wins.push({
        issue: `You have ${pc.gaps} gap${pc.gaps === 1 ? "" : "s"} of more than 7 days between posts on ${platform}.`,
        fix: `Schedule your next 2 weeks of ${platform} posts in one sitting. Even 3 posts per week — Monday, Wednesday, Friday — eliminates the gaps that cause audience drop-off. Use your phone's calendar or a free tool like Meta Business Suite to schedule ahead.`,
        timeEstimate: "30 min",
        impactLevel: "High",
      });
    }
  }

  // Engagement quick win
  const ehBreakdown = scores.engagementHealth.breakdown;
  for (const [platform, eh] of Object.entries(ehBreakdown)) {
    if (!eh.hasReplies && eh.hasEngagement) {
      wins.push({
        issue: `Comments on ${platform} are going unanswered.`,
        fix: `Set aside 10 minutes each morning to reply to every comment from the previous day. Even a "Thank you!" or "Great question — DM us!" shows customers there's a real person behind the account.`,
        timeEstimate: "10 min/day",
        impactLevel: "High",
      });
    }
  }

  // Cover image win
  for (const [platform, pf] of Object.entries(pfBreakdown)) {
    if (pf.coverImage.score === 0) {
      wins.push({
        issue: `No cover/banner image on ${platform}.`,
        fix: `Upload a cover image to ${platform}. Use a high-quality photo of your work, your team, or your storefront — something that immediately communicates what you do. Dimensions: Facebook 820x312, LinkedIn 1128x191, Twitter/X 1500x500.`,
        timeEstimate: "5 min",
        impactLevel: "Medium",
      });
      break; // Only one cover image quick win needed
    }
  }

  // Deduplicate and limit
  const seen = new Set<string>();
  const unique = wins.filter((w) => {
    const key = w.issue.slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/api/audit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let formData: AuditFormData;
        try {
          formData = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Validate required fields
        if (!formData.businessName?.trim() || !formData.name?.trim() || !formData.email?.trim()) {
          return new Response(
            JSON.stringify({ error: "Business name, your name, and email are required." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // -------------------------------------------------------------------
        // Step 1: Pull real profile data from Buffer
        // -------------------------------------------------------------------
        let channels: BufferChannel[] = [];
        try {
          const profilesResult = await bufferRpc("tools/call", {
            name: "buffer_list_profiles",
            arguments: {},
          });
          channels = profilesResult?.channels || [];
        } catch (err: any) {
          console.error("Buffer list_profiles error:", err.message);
          // Continue with empty channels — we'll build reports from what we have
        }

        // Map provided URLs to platforms
        const urlMap: Record<string, { url: string; platform: string }> = {};
        if (formData.facebookUrl) urlMap["facebook"] = { url: formData.facebookUrl, platform: "Facebook" };
        if (formData.instagramUrl) urlMap["instagram"] = { url: formData.instagramUrl, platform: "Instagram" };
        if (formData.tiktokUrl) urlMap["tiktok"] = { url: formData.tiktokUrl, platform: "TikTok" };
        if (formData.linkedinUrl) urlMap["linkedin"] = { url: formData.linkedinUrl, platform: "LinkedIn" };

        // For each platform with a URL, try to match a Buffer channel and pull analytics
        const platforms: PlatformProfile[] = [];

        for (const [service, { url, platform }] of Object.entries(urlMap)) {
          const handle = extractHandle(url);
          // Find matching channel
          const channel = channels.find(
            (c) => normalizeService(c.service) === service && !c.isDisconnected
          );

          let posts: BufferPost[] = [];
          let metrics: PostMetric[] = [];
          let followerCount = 0;
          let followingCount = 0;

          if (channel) {
            try {
              const analyticsResult = await bufferRpc("tools/call", {
                name: "buffer_get_analytics",
                arguments: { profile_id: channel.id },
              });

              if (analyticsResult?.posts?.edges) {
                posts = analyticsResult.posts.edges.map((e: any) => e.node);
              }
              if (analyticsResult?.aggregatedPostMetrics?.metrics) {
                metrics = analyticsResult.aggregatedPostMetrics.metrics;
              }
              // Extract follower/following from metrics
              for (const m of metrics) {
                if (m.type?.toLowerCase().includes("follower") || m.name?.toLowerCase().includes("follower")) {
                  if (m.name?.toLowerCase().includes("following") || m.type?.toLowerCase().includes("following")) {
                    followingCount = m.value;
                  } else {
                    followerCount = m.value;
                  }
                }
              }
            } catch (err: any) {
              console.error(`Buffer analytics error for ${platform}:`, err.message);
            }
          }

          // Determine competitive signals from available data
          // These would ideally come from Buffer, but Buffer's GraphQL API may not expose them directly
          // We infer from what we have
          const hasReels = posts.some((p) =>
            p.text?.toLowerCase().includes("reel") ||
            p.text?.toLowerCase().includes("#reel") ||
            p.text?.toLowerCase().includes("video")
          );
          const hasStories = posts.some((p) =>
            p.text?.toLowerCase().includes("story") ||
            p.text?.toLowerCase().includes("#story")
          );

          // Check if there are reviews/recommendations by looking for review-related metrics
          const hasReviews = metrics.some((m) =>
            m.type?.toLowerCase().includes("review") ||
            m.name?.toLowerCase().includes("review") ||
            m.type?.toLowerCase().includes("recommendation") ||
            m.type?.toLowerCase().includes("rating")
          );

          platforms.push({
            platform: platform,
            url: url,
            handle: handle,
            displayName: channel?.displayName || channel?.name || formData.businessName,
            avatar: channel?.avatar || null,
            bio: null, // Buffer's channel list doesn't include bio text by default
            websiteUrl: null, // Not directly available from Buffer channels list
            coverImage: null, // Not directly available from Buffer channels list
            category: null, // Not directly available
            followerCount,
            followingCount,
            postCount30d: countPostsLast30Days(posts),
            posts,
            metrics,
            hasEngagement: hasEngagementActivity(metrics),
            hasReplies: hasReplyActivity(metrics),
            hasStories,
            hasReels,
            hasReviews,
            isVerified: channel ? !channel.isDisconnected : false,
          });
        }

        // If no platforms had matching Buffer channels, create a mock entry for the first URL
        // so the report isn't empty
        if (platforms.length === 0) {
          const firstUrl = formData.facebookUrl || formData.instagramUrl || formData.tiktokUrl || formData.linkedinUrl;
          if (firstUrl) {
            const service = formData.facebookUrl ? "facebook" :
                           formData.instagramUrl ? "instagram" :
                           formData.tiktokUrl ? "tiktok" : "linkedin";
            const platformLabel = service === "facebook" ? "Facebook" :
                                  service === "instagram" ? "Instagram" :
                                  service === "tiktok" ? "TikTok" : "LinkedIn";
            platforms.push({
              platform: platformLabel,
              url: firstUrl,
              handle: extractHandle(firstUrl),
              displayName: formData.businessName,
              avatar: null,
              bio: null,
              websiteUrl: null,
              coverImage: null,
              category: null,
              followerCount: 0,
              followingCount: 0,
              postCount30d: 0,
              posts: [],
              metrics: [],
              hasEngagement: false,
              hasReplies: false,
              hasStories: false,
              hasReels: false,
              hasReviews: false,
              isVerified: false,
            });
          }
        }

        // -------------------------------------------------------------------
        // Step 2: Score each dimension
        // -------------------------------------------------------------------

        // Profile Completeness
        const pfBreakdown: Record<string, ProfileScore> = {};
        for (const p of platforms) {
          pfBreakdown[p.platform] = scoreProfileCompleteness(p, p.platform);
        }
        const pfTotal = Object.values(pfBreakdown).reduce((s, v) => s + v.total, 0);
        const pfMax = platforms.length * 25;
        const pfNormalized = pfMax > 0 ? Math.round((pfTotal / pfMax) * 25) : 0;

        // Posting Consistency
        const pcBreakdown: Record<string, ConsistencyScore> = {};
        for (const p of platforms) {
          pcBreakdown[p.platform] = scorePostingConsistency(p.posts, p.platform);
        }
        const pcTotal = Object.values(pcBreakdown).reduce((s, v) => s + v.total, 0);
        const pcMax = platforms.length * 25;
        const pcNormalized = pcMax > 0 ? Math.round((pcTotal / pcMax) * 25) : 0;

        // Engagement Health
        const ehBreakdown: Record<string, EngagementScore> = {};
        for (const p of platforms) {
          ehBreakdown[p.platform] = scoreEngagementHealth(p.metrics, p.platform);
        }
        const ehTotal = Object.values(ehBreakdown).reduce((s, v) => s + v.total, 0);
        const ehMax = platforms.length * 15;
        const ehNormalized = ehMax > 0 ? Math.round((ehTotal / ehMax) * 15) : 0;

        // Competitive Signal
        const csBreakdown: Record<string, CompetitiveScore> = {};
        for (const p of platforms) {
          csBreakdown[p.platform] = scoreCompetitiveSignal(p, p.platform);
        }
        const csTotal = Object.values(csBreakdown).reduce((s, v) => s + v.total, 0);
        const csMax = platforms.length * 15;
        const csNormalized = csMax > 0 ? Math.round((csTotal / csMax) * 15) : 0;

        // Brand Cohesion
        const bcScore = scoreBrandCohesion(platforms);
        const bcNormalized = bcScore.total; // Already 0-20

        const overallScore = pfNormalized + pcNormalized + ehNormalized + csNormalized + bcNormalized;

        const scores: AuditResult["scores"] = {
          profileCompleteness: { total: pfNormalized, breakdown: pfBreakdown },
          postingConsistency: { total: pcNormalized, breakdown: pcBreakdown },
          brandCohesion: { total: bcNormalized, observation: bcScore.observation },
          engagementHealth: { total: ehNormalized, breakdown: ehBreakdown },
          competitiveSignal: { total: csNormalized, breakdown: csBreakdown },
          overall: overallScore,
        };

        // -------------------------------------------------------------------
        // Step 3: Generate strengths, weaknesses, quick wins, recs
        // -------------------------------------------------------------------
        const strengths = generateStrengths(scores, platforms);
        const weaknesses = generateWeaknesses(scores, platforms);
        const quickWins = generateQuickWins(scores, platforms, formData);
        const serviceRecommendations = generateServiceRecommendations(scores, formData);

        // -------------------------------------------------------------------
        // Step 4: Store result
        // -------------------------------------------------------------------
        const id = generateId();
        const result: AuditResult = {
          id,
          formData,
          platforms,
          scores,
          strengths,
          weaknesses,
          quickWins,
          serviceRecommendations,
          timestamp: new Date().toISOString(),
        };

        const auditsDir = "/home/team/shared/audits";
        try {
          await mkdir(auditsDir, { recursive: true });
        } catch {
          // Directory exists
        }
        await writeFile(
          join(auditsDir, `${id}.json`),
          JSON.stringify(result, null, 2),
          "utf-8"
        );

        return new Response(
          JSON.stringify({ id, redirect: `/audit-report?id=${id}` }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      },
    },
  },
});
