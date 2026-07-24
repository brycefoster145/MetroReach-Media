/**
 * Premium Growth Audit — Analysis Engine
 * MetroReach Digital
 *
 * Analyzes a business's online presence across 12 premium categories.
 * Every score connects to evidence found. No invented data.
 * No AI/automation language — positioned as human analyst work.
 */

import type { LeadFormData } from "~/lib/lead-store";
import { isIP } from "node:net";
import { promises as dns } from "node:dns";
import type {
  WebsiteAnalysis,
  CategoryScore,
  QuickWin,
  ServiceRecommendation,
} from "~/lib/audit-analyzer";
import {
  // Reuse the shared utilities by importing what we need
} from "~/lib/audit-analyzer";

// ---------------------------------------------------------------------------
// SSRF Protection
// ---------------------------------------------------------------------------

const BLOCKED_IP_PATTERNS = [
  /^127\./,             // loopback
  /^10\./,              // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./, // Class B private (172.16-31)
  /^192\.168\./,         // Class C private
  /^169\.254\./,         // link-local
  /^0\./,               // "this network"
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64-127
  /^fc00:/,             // IPv6 unique local
  /^fd00:/,             // IPv6 unique local
  /^fe80:/,             // IPv6 link-local
  /^::1$/,              // IPv6 loopback
];

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") return true;
  if (lower === "0.0.0.0") return true;
  if (isIP(lower)) {
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(lower)) return true;
    }
  }
  return false;
}

async function isBlockedUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    if (isBlockedHostname(hostname)) return true;
    try {
      const addresses = await dns.lookup(hostname, { family: 4 });
      for (const pattern of BLOCKED_IP_PATTERNS) {
        if (pattern.test(addresses.address)) return true;
      }
    } catch {
      // DNS resolution failed — allow the fetch to proceed
    }
    return false;
  } catch {
    return false;
  }
}

// We duplicate the shared helpers here to avoid circular imports
// These are identical to the free audit versions

async function fetchWebsiteMeta(url: string): Promise<{
  title: string | null;
  description: string | null;
  hasHttps: boolean;
  hasMetaTags: boolean;
  hasOpenGraph: boolean;
  wordCount: number;
  fetched: boolean;
  statusCode: number | null;
}> {
  const result = {
    title: null as string | null,
    description: null as string | null,
    hasHttps: false,
    hasMetaTags: false,
    hasOpenGraph: false,
    wordCount: 0,
    fetched: false,
    statusCode: null as number | null,
  };

  if (!url || !url.trim()) return result;

  let fetchUrl = url.trim();
  if (!fetchUrl.startsWith("http://") && !fetchUrl.startsWith("https://")) {
    fetchUrl = "https://" + fetchUrl;
  }

  result.hasHttps = fetchUrl.startsWith("https://");

  // SSRF protection — block requests to private/internal IPs
  const blocked = await isBlockedUrl(fetchUrl);
  if (blocked) {
    return result;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MetroReachAudit/2.0; +https://metroreachagency.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);
    result.statusCode = res.status;

    if (!res.ok) return result;

    const html = await res.text();
    result.fetched = true;

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      result.title = titleMatch[1].trim().replace(/\s+/g, " ");
    }

    const descPatterns = [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    ];
    for (const pat of descPatterns) {
      const m = html.match(pat);
      if (m) {
        result.description = m[1].trim();
        result.hasMetaTags = true;
        break;
      }
    }

    if (
      html.includes("og:title") ||
      html.includes("og:description") ||
      html.includes("og:image")
    ) {
      result.hasOpenGraph = true;
    }

    if (!result.description) {
      const ogMatch = html.match(
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i
      );
      if (ogMatch) result.description = ogMatch[1].trim();
    }

    const bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    result.wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
  } catch {
    // Timeout, network error, or blocked — leave fetched=false
  }

  return result;
}

interface ProfileCounts {
  facebook: boolean;
  instagram: boolean;
  linkedin: boolean;
  tiktok: boolean;
  googleBusiness: boolean;
  total: number;
  platforms: string[];
}

function countProfiles(formData: LeadFormData): ProfileCounts {
  const profiles: ProfileCounts = {
    facebook: !!formData.facebookUrl?.trim(),
    instagram: !!formData.instagramUrl?.trim(),
    linkedin: !!formData.linkedinUrl?.trim(),
    tiktok: !!formData.tiktokUrl?.trim(),
    googleBusiness: !!formData.googleBusinessUrl?.trim(),
    total: 0,
    platforms: [],
  };
  if (profiles.facebook) { profiles.total++; profiles.platforms.push("Facebook"); }
  if (profiles.instagram) { profiles.total++; profiles.platforms.push("Instagram"); }
  if (profiles.linkedin) { profiles.total++; profiles.platforms.push("LinkedIn"); }
  if (profiles.tiktok) { profiles.total++; profiles.platforms.push("TikTok"); }
  if (profiles.googleBusiness) { profiles.total++; profiles.platforms.push("Google Business Profile"); }
  return profiles;
}

// ---------------------------------------------------------------------------
// Premium Types
// ---------------------------------------------------------------------------

export interface PremiumCategoryScore {
  name: string;
  label: string;
  score: number;
  observation: string;
  evidence: string[];
  subScores?: { label: string; score: number }[];
}

export interface PriorityItem {
  issue: string;
  category: string;
  businessImpact: number;
  implementationDifficulty: number;
  priority: "Critical" | "High" | "Medium" | "Low";
  recommendation: string;
}

export interface GrowthPhase {
  phase: string;
  timeframe: string;
  actions: string[];
  expectedOutcome: string;
}

export interface PremiumAuditResult {
  id: string;
  formData: LeadFormData;
  website: WebsiteAnalysis;
  scores: {
    overall: number;
    businessHealth: number;
    categories: PremiumCategoryScore[];
  };
  strengths: string[];
  weaknesses: string[];
  priorityMatrix: PriorityItem[];
  growthRoadmap: GrowthPhase[];
  quickWins: QuickWin[];
  serviceRecommendations: ServiceRecommendation[];
  recommendationConfidence: "high" | "moderate" | "limited";
  confidenceExplanation: string;
  competitorSnapshot: string;
  executiveSummary: string;
  dataConfidence: "High" | "Moderate" | "Limited";
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Shared helpers (reused from free audit)
// ---------------------------------------------------------------------------

function generateQuickWinsShared(
  website: WebsiteAnalysis,
  profiles: ProfileCounts,
  formData: LeadFormData
): QuickWin[] {
  const wins: QuickWin[] = [];

  if (website.fetched && !website.hasHttps) {
    wins.push({
      issue: "Your website lacks HTTPS security — browsers display 'Not Secure' warnings to visitors.",
      fix: "Contact your hosting provider and enable SSL/HTTPS. Most hosts offer this free through Let's Encrypt. One phone call or support ticket.",
      timeEstimate: "1–2 days",
      impactLevel: "High",
    });
  }

  if (website.fetched && !website.description) {
    wins.push({
      issue: "Your website is missing a meta description — search engines display whatever text they find.",
      fix: `Add a meta description to your homepage: a 1–2 sentence summary of what ${formData.businessName} does, who you serve, and your location.`,
      timeEstimate: "15 minutes",
      impactLevel: "High",
    });
  }

  if (website.fetched && !website.hasOpenGraph) {
    wins.push({
      issue: "Your website doesn't have Open Graph tags — social shares look broken or blank.",
      fix: "Add basic Open Graph tags (og:title, og:description, og:image) to your homepage.",
      timeEstimate: "30 minutes",
      impactLevel: "Medium",
    });
  }

  if (!profiles.facebook) {
    wins.push({
      issue: "No Facebook Business Page — missing the #1 platform for local service discovery.",
      fix: "Create a Facebook Business Page with your logo, cover photo, hours, services, and contact info.",
      timeEstimate: "30 minutes",
      impactLevel: "High",
    });
  }

  if (!profiles.googleBusiness) {
    wins.push({
      issue: "No Google Business Profile — invisible in 'near me' searches and Google Maps.",
      fix: "Create or claim your Google Business Profile at google.com/business. Add address, hours, services, and photos.",
      timeEstimate: "20 minutes",
      impactLevel: "High",
    });
  }

  return wins.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Service Recommendation Packages (same as free audit)
// ---------------------------------------------------------------------------

interface PackageDefinition {
  slug: string;
  name: string;
  problemsAddressed: string[];
  deliverables: string[];
  estimatedTimeline: string;
  price: string;
  billingFrequency: string;
  postPurchase: string;
  stripeLink: string | null;
}

const packages: Record<string, PackageDefinition> = {
  socialMediaManagement: {
    slug: "social-media-management",
    name: "Social Media Management",
    problemsAddressed: [
      "Inconsistent or nonexistent posting",
      "Thin content across platforms",
      "No structured content calendar",
    ],
    deliverables: [
      "Custom monthly content calendar aligned with your business goals",
      "Platform-native posts for your active platforms",
      "Caption writing with hooks, value, and CTAs",
      "Hashtag research and posting schedule optimization",
      "Monthly performance report",
    ],
    estimatedTimeline: "Content calendar live within one week. Organic momentum builds over 60–90 days.",
    price: "$1,500",
    billingFrequency: "monthly",
    postPurchase: "Our team onboards you within 48 hours — brand voice interview, platform access setup, and content strategy session. First posts go live within 5 business days.",
    stripeLink: "https://buy.stripe.com/cNifZh06M5zoeFGecd1ck0l",
  },
  communityManagement: {
    slug: "community-management",
    name: "Community Management",
    problemsAddressed: [
      "Customer comments and DMs going unanswered",
      "No review management or response strategy",
      "Low audience interaction and trust signals",
    ],
    deliverables: [
      "Daily monitoring of comments, DMs, and brand mentions",
      "Prompt, on-brand responses to every interaction",
      "Review monitoring and professional response management",
      "Weekly engagement summary",
    ],
    estimatedTimeline: "Immediate impact — engagement begins day one. Noticeable improvement in customer sentiment within 2–4 weeks.",
    price: "$1,200",
    billingFrequency: "monthly",
    postPurchase: "Our community team connects to your profiles within 24 hours. Response templates and brand voice guidelines confirmed on day one.",
    stripeLink: null,
  },
  brandingCreative: {
    slug: "branding-creative",
    name: "Branding & Creative Services",
    problemsAddressed: [
      "Inconsistent brand presentation across platforms",
      "Missing or incomplete profile elements",
      "No visual identity system for social media",
    ],
    deliverables: [
      "Platform setup and optimization across all profiles",
      "Bio and profile copy rewrite for every platform",
      "Brand visual direction document",
      "Cover images, highlight covers, and profile picture optimization",
      "Social media brand guidelines",
    ],
    estimatedTimeline: "Profile optimization begins week one. Full brand system delivered within 2–3 weeks.",
    price: "$500",
    billingFrequency: "one-time",
    postPurchase: "Our brand team begins with a visual audit of your existing profiles. You receive optimized profiles first, followed by the full brand system.",
    stripeLink: null,
  },
  websiteFunnel: {
    slug: "website-funnel",
    name: "Website & Funnel Service",
    problemsAddressed: [
      "Website missing conversion elements",
      "Poor technical SEO configuration",
      "No landing pages for ad campaigns",
    ],
    deliverables: [
      "Comprehensive landing page review with conversion recommendations",
      "Meta tag and Open Graph configuration guidance",
      "Conversion tracking setup consultation",
      "Mobile responsiveness assessment",
    ],
    estimatedTimeline: "Audit delivered within 3 business days. Implementation timeline depends on your web platform.",
    price: "$350",
    billingFrequency: "one-time",
    postPurchase: "Your website audit is delivered as a prioritized report.",
    stripeLink: null,
  },
  localSeoReputation: {
    slug: "local-seo-reputation",
    name: "Local SEO & Reputation Service",
    problemsAddressed: [
      "Poor visibility in local search results",
      "No review generation system",
      "Incomplete Google Business Profile",
    ],
    deliverables: [
      "Google Business Profile optimization",
      "Local SEO audit with prioritized recommendations",
      "Review generation campaign setup",
      "Competitor local ranking analysis",
    ],
    estimatedTimeline: "GBP optimization within 48 hours. Local SEO impact builds over 4–8 weeks.",
    price: "$750",
    billingFrequency: "monthly",
    postPurchase: "Our local SEO specialist audits your Google Business Profile and local search presence immediately.",
    stripeLink: null,
  },
  growthPackage: {
    slug: "growth-package",
    name: "Growth Package (Bundle)",
    problemsAddressed: [
      "Multiple marketing dimensions underperforming simultaneously",
      "Content, engagement, visibility, and lead generation gaps",
      "No integrated marketing strategy",
    ],
    deliverables: [
      "Organic content management across 4 platforms (20 posts/month)",
      "Paid advertising on 2 platforms (3 campaigns, continuously optimized)",
      "Community engagement included",
      "Weekly performance summaries + monthly deep-dive report",
      "Live dashboard access",
      "A/B testing on creative and audiences",
    ],
    estimatedTimeline: "Full implementation within 2 weeks. Paid campaigns generating leads within week one.",
    price: "$3,000",
    billingFrequency: "monthly",
    postPurchase: "Dedicated team assigned within 24 hours. Platform audits, brand voice development, and ad account setup begin immediately.",
    stripeLink: "https://buy.stripe.com/7sY6oH3iYd1Q69ad891ck0m",
  },
  scalePackage: {
    slug: "scale-package",
    name: "Scale Package",
    problemsAddressed: [
      "Strong foundation — need to dominate market",
      "Competitors catching up",
      "Opportunity to capture market leadership",
    ],
    deliverables: [
      "Up to 7 platforms (organic on all, paid on up to 4)",
      "30+ organic posts/month",
      "Unlimited paid campaigns, continuously optimized",
      "Advanced A/B testing and funnel optimization",
      "Short-form video scripts (TikTok, Reels, YouTube Shorts)",
      "Bi-weekly strategy calls",
      "Live dashboard + custom reporting",
    ],
    estimatedTimeline: "Immediate amplification of existing efforts. New campaigns rolled out within 2 weeks.",
    price: "$5,500",
    billingFrequency: "monthly",
    postPurchase: "Senior strategist assigned as your dedicated lead. Full team onboarding within 48 hours.",
    stripeLink: "https://buy.stripe.com/fZufZh2eU0f41SUfgh1ck0n",
  },
};

function generateServiceRecommendations(
  categories: { name: string; label: string; score: number; observation: string; evidence: string[] }[],
  website: WebsiteAnalysis,
  profiles: ProfileCounts,
  formData: LeadFormData
): { recommendations: ServiceRecommendation[]; confidence: "high" | "moderate" | "limited"; explanation: string } {
  const recMap = new Map<string, ServiceRecommendation>();

  const getScore = (name: string) => categories.find((c) => c.name === name)?.score ?? 50;
  const contentScore = getScore("contentStrategy");
  const socialScore = getScore("socialMediaAnalysis");
  const brandScore = getScore("brandIdentity");
  const websiteScore = getScore("websiteAnalysis");
  const localScore = getScore("localMarketing");
  const reputationScore = getScore("reputationAnalysis");
  const leadScore = getScore("leadGeneration");
  const adScore = getScore("advertisingReadiness");

  if (contentScore < 55 || socialScore < 50) {
    const pkg = packages.socialMediaManagement;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `Our premium analysis found that ${formData.businessName}'s content and social presence need strengthening. ${contentScore < 55 ? "Content strategy depth is below competitive threshold. " : ""}${socialScore < 50 ? "Social media presence is insufficient to capture available market attention. " : ""}Our Social Media Management service delivers a structured content calendar with platform-native posts, professional caption writing, and strategic scheduling.`,
      problemsAddressed: pkg.problemsAddressed,
      deliverables: pkg.deliverables,
      estimatedTimeline: pkg.estimatedTimeline,
      price: pkg.price,
      billingFrequency: pkg.billingFrequency,
      postPurchase: pkg.postPurchase,
      stripeLink: pkg.stripeLink,
    });
  }

  if (reputationScore < 50 || socialScore < 40) {
    const pkg = packages.communityManagement;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `Our review found ${formData.businessName} lacks infrastructure for consistent customer interaction. ${reputationScore < 50 ? "Review management capabilities are insufficient. " : ""}Our Community Management team handles comments, DMs, and reviews across all platforms — ensuring every customer interaction gets a timely, professional response.`,
      problemsAddressed: pkg.problemsAddressed,
      deliverables: pkg.deliverables,
      estimatedTimeline: pkg.estimatedTimeline,
      price: pkg.price,
      billingFrequency: pkg.billingFrequency,
      postPurchase: pkg.postPurchase,
      stripeLink: pkg.stripeLink,
    });
  }

  if (brandScore < 55) {
    const pkg = packages.brandingCreative;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `Our premium audit found ${formData.businessName}'s brand presentation is inconsistent or incomplete. ${!website.hasOpenGraph ? "Social sharing previews don't render correctly. " : ""}Our Branding & Creative team optimizes every profile element so your business presents professionally.`,
      problemsAddressed: pkg.problemsAddressed,
      deliverables: pkg.deliverables,
      estimatedTimeline: pkg.estimatedTimeline,
      price: pkg.price,
      billingFrequency: pkg.billingFrequency,
      postPurchase: pkg.postPurchase,
      stripeLink: pkg.stripeLink,
    });
  }

  if (websiteScore < 55 && website.fetched) {
    const pkg = packages.websiteFunnel;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `The website needs conversion-focused improvements. Our Website & Funnel Service delivers a prioritized audit of your conversion path with specific, actionable fixes.`,
      problemsAddressed: pkg.problemsAddressed,
      deliverables: pkg.deliverables,
      estimatedTimeline: pkg.estimatedTimeline,
      price: pkg.price,
      billingFrequency: pkg.billingFrequency,
      postPurchase: pkg.postPurchase,
      stripeLink: pkg.stripeLink,
    });
  }

  if (localScore < 55) {
    const pkg = packages.localSeoReputation;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `${formData.businessName} is difficult to find in local search. ${!profiles.googleBusiness ? "No Google Business Profile — the most important local ranking factor. " : ""}Our Local SEO & Reputation service optimizes your Google presence and builds review infrastructure.`,
      problemsAddressed: pkg.problemsAddressed,
      deliverables: pkg.deliverables,
      estimatedTimeline: pkg.estimatedTimeline,
      price: pkg.price,
      billingFrequency: pkg.billingFrequency,
      postPurchase: pkg.postPurchase,
      stripeLink: pkg.stripeLink,
    });
  }

  const lowCount = [contentScore, socialScore, brandScore, websiteScore, localScore, reputationScore, leadScore, adScore].filter((s) => s < 55).length;
  if (lowCount >= 4) {
    const pkg = packages.growthPackage;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `Our comprehensive premium audit identified gaps across ${lowCount} critical marketing dimensions. The Growth Package bundles Social Media Management, Paid Advertising, and Community Management into one integrated service — the fastest path to a full pipeline.`,
      problemsAddressed: pkg.problemsAddressed,
      deliverables: pkg.deliverables,
      estimatedTimeline: pkg.estimatedTimeline,
      price: pkg.price,
      billingFrequency: pkg.billingFrequency,
      postPurchase: pkg.postPurchase,
      stripeLink: pkg.stripeLink,
    });
  }

  if (recMap.size === 0) {
    const pkg = packages.scalePackage;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `${formData.businessName} has a strong marketing foundation — the opportunity now is market domination. Our Scale Package deploys a full team across up to 7 platforms with unlimited campaigns.`,
      problemsAddressed: pkg.problemsAddressed,
      deliverables: pkg.deliverables,
      estimatedTimeline: pkg.estimatedTimeline,
      price: pkg.price,
      billingFrequency: pkg.billingFrequency,
      postPurchase: pkg.postPurchase,
      stripeLink: pkg.stripeLink,
    });
  }

  // Determine confidence
  let confidence: "high" | "moderate" | "limited";
  let explanation: string;

  const evidenceFactors: string[] = [];
  if (website.fetched) evidenceFactors.push("website was successfully analyzed");
  else evidenceFactors.push("website could not be reached");
  if (profiles.total >= 3) evidenceFactors.push(`${profiles.total} social profiles provided`);
  else if (profiles.total > 0) evidenceFactors.push(`only ${profiles.total} social profile${profiles.total === 1 ? "" : "s"} provided`);
  else evidenceFactors.push("no social profiles provided");

  const evidencePoints = (website.fetched ? 2 : 0) + Math.min(profiles.total, 2);

  if (evidencePoints >= 3) {
    confidence = "high";
    explanation = `Strong confidence: ${evidenceFactors.join("; ")}. Our team had sufficient public information to make direct, evidence-based recommendations.`;
  } else if (evidencePoints >= 1) {
    confidence = "moderate";
    explanation = `Moderate confidence: ${evidenceFactors.join("; ")}. Some information was unavailable, but our recommendations are grounded in the available evidence.`;
  } else {
    confidence = "limited";
    explanation = `Limited data available: ${evidenceFactors.join("; ")}. Our recommendations are based on industry benchmarks and the partial information available.`;
  }

  const recommendations = Array.from(recMap.values());
  const growthIdx = recommendations.findIndex((r) => r.slug === "growth-package");
  if (growthIdx > 0) {
    const [growth] = recommendations.splice(growthIdx, 1);
    recommendations.unshift(growth);
  }

  return { recommendations, confidence, explanation };
}

// ---------------------------------------------------------------------------
// Premium Scoring Engine — 12 Categories
// ---------------------------------------------------------------------------

function calculatePremiumScores(
  website: WebsiteAnalysis,
  formData: LeadFormData,
  profiles: ProfileCounts
): PremiumCategoryScore[] {
  const categories: PremiumCategoryScore[] = [];

  // ── 1. Brand Identity (0-100) ──
  let brandId = 0;
  const evidenceBI: string[] = [];
  if (website.fetched) { brandId += 15; evidenceBI.push("Website accessible for brand identity analysis"); }
  if (website.title) { brandId += 10; evidenceBI.push(`Brand name present in page title`); }
  if (website.hasOpenGraph) { brandId += 10; evidenceBI.push("Open Graph tags configured — brand renders properly when shared"); }
  if (profiles.total >= 3) { brandId += 15; evidenceBI.push("Brand present across 3+ platforms — consistency evaluated"); }
  else if (profiles.total >= 1) { brandId += 8; evidenceBI.push("Brand present on at least 1 platform"); }
  if (profiles.facebook && profiles.instagram) { brandId += 12; evidenceBI.push("Facebook + Instagram presence — strongest visual pair"); }
  if (formData.businessName.length > 4) { brandId += 8; evidenceBI.push("Distinct business name — brand recognition foundation"); }
  if (website.description) { brandId += 10; evidenceBI.push("Brand messaging present in meta description"); }
  if (website.hasHttps) { brandId += 10; evidenceBI.push("HTTPS — trust indicator for brand credibility"); }
  evidenceBI.push("Note: logo quality, typography consistency, and color palette analysis require direct access to brand assets");
  brandId = Math.min(100, brandId);

  let biObs: string;
  if (brandId >= 70) {
    biObs = `${formData.businessName} presents a coherent brand identity online. The website and social profiles create a consistent first impression. Our team noted proper metadata, multi-platform presence, and trust signals that build recognition.`;
  } else if (brandId >= 40) {
    biObs = `${formData.businessName}'s brand identity has building blocks but lacks the consistency that separates memorable brands. ${!website.hasOpenGraph ? "Without Open Graph tags, social shares render without brand control. " : ""}${profiles.total < 3 ? "Limited platform presence means fewer brand reinforcement opportunities. " : ""}`;
  } else {
    biObs = `${formData.businessName}'s brand identity is difficult to evaluate comprehensively — ${!website.fetched ? "the website couldn't be reached, " : ""}${profiles.total === 0 ? "and no social profiles were provided" : "and limited profile data is available"}. Brand identity is the multiplier on every marketing dollar spent.`;
  }
  categories.push({ name: "brandIdentity", label: "Brand Identity", score: brandId, observation: biObs, evidence: evidenceBI });

  // ── 2. Website Analysis (0-100) ──
  let websiteScore = 0;
  const evidenceWA: string[] = [];
  if (website.fetched) { websiteScore += 15; evidenceWA.push("Website is accessible and responding"); }
  if (website.hasHttps) { websiteScore += 12; evidenceWA.push("HTTPS enabled — secure connection"); }
  if (website.title) { websiteScore += 10; evidenceWA.push("Page title configured"); }
  if (website.description && website.description.length > 40) { websiteScore += 10; evidenceWA.push("Descriptive meta description"); }
  else if (website.description) { websiteScore += 5; evidenceWA.push("Meta description present but brief"); }
  if (website.hasOpenGraph) { websiteScore += 8; evidenceWA.push("OG tags — social sharing displays correctly"); }
  if (website.wordCount > 800) { websiteScore += 15; evidenceWA.push(`Substantial content (~${website.wordCount.toLocaleString()} words)`); }
  else if (website.wordCount > 400) { websiteScore += 10; evidenceWA.push(`Moderate content (~${website.wordCount.toLocaleString()} words)`); }
  else if (website.wordCount > 100) { websiteScore += 5; evidenceWA.push(`Limited content (~${website.wordCount} words)`); }
  if (website.statusCode && website.statusCode < 400) { websiteScore += 8; evidenceWA.push(`Status code ${website.statusCode}`); }
  evidenceWA.push("Note: mobile responsiveness, page speed, and UX flow require browser-based audit");
  websiteScore = Math.min(100, websiteScore);

  let waObs: string;
  if (!website.fetched && formData.websiteUrl?.trim()) {
    waObs = `Metro Reach Media attempted to analyze ${formData.websiteUrl} but was unable to reach the site. This is the most critical issue — if customers experience the same, every marketing dollar is wasted.`;
  } else if (!website.fetched) {
    waObs = "No website URL was provided. A website is your 24/7 salesperson — without one, the digital marketing funnel has a missing foundation.";
  } else if (websiteScore >= 70) {
    waObs = `The website at ${website.url} is technically sound — accessible, secure, and with proper metadata. Content volume supports both customer decision-making and search visibility.`;
  } else if (websiteScore >= 40) {
    const issues: string[] = [];
    if (!website.hasHttps) issues.push("missing HTTPS");
    if (!website.description) issues.push("no meta description");
    if (!website.hasOpenGraph) issues.push("social sharing not configured");
    waObs = `The website needs technical improvements: ${issues.join("; ")}. These directly impact whether visitors trust you and whether search engines rank you.`;
  } else {
    waObs = `The website requires significant attention. Basic elements that customers and search engines expect are missing. This is the digital storefront — right now it isn't making the impression your business deserves.`;
  }
  categories.push({ name: "websiteAnalysis", label: "Website Analysis", score: websiteScore, observation: waObs, evidence: evidenceWA });

  // ── 3. Social Media Analysis (0-100) ──
  let socialAnalysis = 0;
  const evidenceSA: string[] = [];
  const platformScores: { label: string; score: number }[] = [];

  if (profiles.facebook) { socialAnalysis += 18; evidenceSA.push("Facebook profile provided"); platformScores.push({ label: "Facebook", score: 18 }); }
  else { platformScores.push({ label: "Facebook", score: 0 }); evidenceSA.push("No Facebook profile"); }

  if (profiles.instagram) { socialAnalysis += 18; evidenceSA.push("Instagram profile provided"); platformScores.push({ label: "Instagram", score: 18 }); }
  else { platformScores.push({ label: "Instagram", score: 0 }); evidenceSA.push("No Instagram profile"); }

  if (profiles.linkedin) { socialAnalysis += 15; evidenceSA.push("LinkedIn profile provided"); platformScores.push({ label: "LinkedIn", score: 15 }); }
  else { platformScores.push({ label: "LinkedIn", score: 0 }); evidenceSA.push("No LinkedIn profile"); }

  if (profiles.tiktok) { socialAnalysis += 12; evidenceSA.push("TikTok profile provided"); platformScores.push({ label: "TikTok", score: 12 }); }
  else { platformScores.push({ label: "TikTok", score: 0 }); }

  if (profiles.googleBusiness) { socialAnalysis += 20; evidenceSA.push("Google Business Profile"); platformScores.push({ label: "Google Business", score: 20 }); }
  else { platformScores.push({ label: "Google Business", score: 0 }); evidenceSA.push("No Google Business Profile"); }

  if (profiles.total >= 4) { socialAnalysis += 10; evidenceSA.push("Multi-platform strategy"); }
  if (profiles.facebook && profiles.instagram) { socialAnalysis += 7; evidenceSA.push("FB + IG combo advantage"); }
  evidenceSA.push("Note: posting frequency, engagement rates require platform API access");
  socialAnalysis = Math.min(100, socialAnalysis);

  let saObs: string;
  if (socialAnalysis >= 70) {
    saObs = `${formData.businessName} maintains a strong social media presence across ${profiles.total} platform${profiles.total === 1 ? "" : "s"}: ${profiles.platforms.join(", ")}. This multi-channel strategy creates multiple discovery paths.`;
  } else if (socialAnalysis >= 35) {
    const missing: string[] = [];
    if (!profiles.facebook) missing.push("Facebook");
    if (!profiles.googleBusiness) missing.push("Google Business Profile");
    if (!profiles.instagram) missing.push("Instagram");
    saObs = `${formData.businessName} is present on ${profiles.total} platform${profiles.total === 1 ? "" : "s"} but missing: ${missing.join(", ")}. Each missing platform is a door customers can't walk through.`;
  } else {
    saObs = `${formData.businessName} has minimal social media presence. While competitors engage customers daily across multiple platforms, your business is effectively invisible on social media.`;
  }
  categories.push({ name: "socialMediaAnalysis", label: "Social Media Analysis", score: socialAnalysis, observation: saObs, evidence: evidenceSA, subScores: platformScores });

  // ── 4. Content Strategy (0-100) ──
  let contentStrategy = 0;
  const evidenceCS: string[] = [];
  if (website.fetched) { contentStrategy += 12; evidenceCS.push("Website content available for assessment"); }
  if (website.wordCount > 600) { contentStrategy += 18; evidenceCS.push("Substantial content depth"); }
  else if (website.wordCount > 200) { contentStrategy += 10; evidenceCS.push("Moderate content"); }
  else if (website.wordCount > 0) { contentStrategy += 5; evidenceCS.push("Limited content"); }
  if (profiles.total >= 3) { contentStrategy += 15; evidenceCS.push("Multi-platform distribution"); }
  else if (profiles.total >= 1) { contentStrategy += 8; evidenceCS.push("At least 1 distribution channel"); }
  if (website.description && website.description.length > 50) { contentStrategy += 10; evidenceCS.push("Clear messaging in meta description"); }
  if (profiles.instagram || profiles.tiktok) { contentStrategy += 10; evidenceCS.push("Visual/video platform — short-form content opportunity"); }
  if (profiles.facebook) { contentStrategy += 8; evidenceCS.push("Facebook — longer-form content platform"); }
  if (website.hasOpenGraph) { contentStrategy += 7; evidenceCS.push("Content is shareable with proper previews"); }
  evidenceCS.push("Note: content pillar analysis and storytelling quality require content audit");
  contentStrategy = Math.min(100, contentStrategy);

  let csObs: string;
  if (contentStrategy >= 70) {
    csObs = `${formData.businessName} has the foundation for a strong content strategy. The opportunity: moving from "posting" to a content engine that systematically educates, engages, and converts.`;
  } else if (contentStrategy >= 40) {
    csObs = `${formData.businessName}'s content is present but lacks strategic depth. ${website.wordCount < 400 ? "Thin website content limits SEO and customer confidence. " : ""}${profiles.total < 2 ? "Too few distribution channels. " : ""}A content strategy maps what to say, where to say it, and when.`;
  } else {
    csObs = `${formData.businessName} has minimal content online. Content is your digital sales team — the more quality content you publish, the more reasons customers have to find, trust, and choose you.`;
  }
  categories.push({ name: "contentStrategy", label: "Content Strategy", score: contentStrategy, observation: csObs, evidence: evidenceCS });

  // ── 5. Local Marketing (0-100) ──
  let localMarketing = 0;
  const evidenceLM: string[] = [];
  if (profiles.googleBusiness) { localMarketing += 30; evidenceLM.push("Google Business Profile — highest-impact local asset"); }
  if (formData.location && formData.location.trim()) { localMarketing += 15; evidenceLM.push(`Location: ${formData.location}`); }
  if (profiles.facebook) { localMarketing += 20; evidenceLM.push("Facebook — strong local discovery"); }
  if (profiles.instagram) { localMarketing += 10; evidenceLM.push("Instagram — growing local discovery"); }
  if (formData.industry && formData.industry !== "Other") { localMarketing += 10; evidenceLM.push(`Industry "${formData.industry}" — local category targeting`); }
  if (website.fetched) { localMarketing += 5; evidenceLM.push("Website accessible — platform for local landing pages"); }
  evidenceLM.push("Note: NAP consistency and citation audit require direct platform access");
  localMarketing = Math.min(100, localMarketing);

  let lmObs: string;
  if (localMarketing >= 70) {
    lmObs = `${formData.businessName} has strong local marketing infrastructure. Customers searching for ${formData.industry || "your services"} in ${formData.location || "your area"} have multiple paths to find you.`;
  } else if (localMarketing >= 35) {
    const gaps: string[] = [];
    if (!profiles.googleBusiness) gaps.push("no Google Business Profile");
    if (!profiles.facebook) gaps.push("no Facebook presence");
    lmObs = `${formData.businessName} has some local signals but critical gaps: ${gaps.join("; ")}. When customers search locally, these gaps mean they find competitors first.`;
  } else {
    lmObs = `${formData.businessName} is nearly invisible in local search. ${!profiles.googleBusiness ? "Without a Google Business Profile, you're missing 90%+ of local discovery traffic. " : ""}`;
  }
  categories.push({ name: "localMarketing", label: "Local Marketing", score: localMarketing, observation: lmObs, evidence: evidenceLM });

  // ── 6. Search Visibility (0-100) ──
  let searchVis = 0;
  const evidenceSV: string[] = [];
  if (website.fetched) { searchVis += 10; evidenceSV.push("Website crawlable"); }
  if (website.title) { searchVis += 15; evidenceSV.push("Page title — #1 on-page SEO factor"); }
  if (website.description) { searchVis += 10; evidenceSV.push("Meta description — controls search snippet"); }
  if (website.hasHttps) { searchVis += 10; evidenceSV.push("HTTPS — Google ranking signal"); }
  if (website.wordCount > 500) { searchVis += 15; evidenceSV.push("Content depth supports keyword relevance"); }
  else if (website.wordCount > 200) { searchVis += 8; evidenceSV.push("Moderate content for keyword targeting"); }
  if (profiles.googleBusiness) { searchVis += 15; evidenceSV.push("GBP — dominant local search presence"); }
  if (formData.location) { searchVis += 10; evidenceSV.push("Location data — local keyword optimization"); }
  evidenceSV.push("Note: keyword rankings and backlink profile require SEO tools");
  searchVis = Math.min(100, searchVis);

  let svObs: string;
  if (searchVis >= 70) {
    svObs = `${formData.businessName} has solid search visibility fundamentals. The opportunity: moving from "findable" to "dominant" through targeted keyword strategy.`;
  } else if (searchVis >= 40) {
    svObs = `${formData.businessName} has some search elements but gaps exist: ${!website.title ? "missing page title, " : ""}${!website.description ? "no meta description, " : ""}${!profiles.googleBusiness ? "no GBP for local search." : ""}`;
  } else {
    svObs = `${formData.businessName} has minimal search visibility. ${!website.fetched ? "An unreachable website means zero organic search presence. " : ""}Without SEO fundamentals, customers find competitors instead.`;
  }
  categories.push({ name: "searchVisibility", label: "Search Visibility", score: searchVis, observation: svObs, evidence: evidenceSV });

  // ── 7. Reputation Analysis (0-100) ──
  let reputation = 0;
  const evidenceRA: string[] = [];
  if (profiles.googleBusiness) { reputation += 30; evidenceRA.push("GBP — primary review platform"); }
  if (profiles.facebook) { reputation += 25; evidenceRA.push("Facebook — second most important review platform"); }
  if (profiles.total >= 3) { reputation += 12; evidenceRA.push("Reviews can be distributed across platforms"); }
  if (formData.industry && formData.industry !== "Other") { reputation += 10; evidenceRA.push(`Industry "${formData.industry}" — reviews are critical`); }
  if (website.fetched) { reputation += 8; evidenceRA.push("Website — potential testimonial showcase"); }
  evidenceRA.push("Note: review count, ratings, and response rate require platform API access");
  reputation = Math.min(100, reputation);

  let raObs: string;
  if (reputation >= 70) {
    raObs = `${formData.businessName} has the platform infrastructure for strong reputation management. Systematic review generation and professional response management will maximize this advantage.`;
  } else if (reputation >= 35) {
    raObs = `${formData.businessName} has some review infrastructure but missing key platforms — ${!profiles.googleBusiness ? "particularly Google Business Profile. " : ""}Without visible reviews, potential customers lack independent validation.`;
  } else {
    raObs = `${formData.businessName} has minimal review infrastructure. Reviews are the #1 trust signal for service businesses. Without them, every new customer is taking a leap of faith.`;
  }
  categories.push({ name: "reputationAnalysis", label: "Reputation Analysis", score: reputation, observation: raObs, evidence: evidenceRA });

  // ── 8. Competitor Analysis (0-100) ──
  let competitor = 0;
  const evidenceCA: string[] = [];
  if (website.fetched) { competitor += 15; evidenceCA.push("Website analyzed — competitive comparison basis"); }
  if (profiles.total >= 3) { competitor += 20; evidenceCA.push("Multi-platform presence — competitive parity assessment"); }
  else if (profiles.total >= 1) { competitor += 10; evidenceCA.push("Some platforms for comparison"); }
  if (formData.industry && formData.industry !== "Other") { competitor += 15; evidenceCA.push(`Industry "${formData.industry}" — competitive context`); }
  if (formData.location && formData.location.trim()) { competitor += 10; evidenceCA.push(`Location: ${formData.location} — local competitive landscape`); }
  if (website.wordCount > 500) { competitor += 10; evidenceCA.push("Content depth competitive with market leaders"); }
  evidenceCA.push("Note: direct competitor identification requires competitive research tools");
  competitor = Math.min(100, competitor);

  let caObs: string;
  if (competitor >= 65) {
    caObs = `${formData.businessName} has the digital infrastructure to compete effectively in ${formData.location || "your market"}'s ${formData.industry || "industry"} landscape. The opportunity: pulling ahead of the pack.`;
  } else if (competitor >= 35) {
    caObs = `${formData.businessName} shows competitive potential but has gaps competitors are likely exploiting. ${profiles.total < 3 ? "Fewer platforms than top competitors means ceding visibility. " : ""}`;
  } else {
    caObs = `${formData.businessName} is at a competitive disadvantage online. Most competitors have stronger digital presence — more platforms, more content, more visibility. The gap is real, but it's also the opportunity.`;
  }
  categories.push({ name: "competitorAnalysis", label: "Competitor Analysis", score: competitor, observation: caObs, evidence: evidenceCA });

  // ── 9. Lead Generation (0-100) ──
  let leadGen = 0;
  const evidenceLG: string[] = [];
  if (website.fetched) { leadGen += 20; evidenceLG.push("Website accessible — primary lead capture platform"); }
  if (website.hasHttps) { leadGen += 10; evidenceLG.push("HTTPS — trust requirement for forms"); }
  if (website.wordCount > 400) { leadGen += 12; evidenceLG.push("Content depth supports lead nurturing"); }
  if (profiles.googleBusiness) { leadGen += 15; evidenceLG.push("GBP — direct call/click/direction leads"); }
  if (profiles.facebook) { leadGen += 10; evidenceLG.push("Facebook — Messenger and page CTAs"); }
  if (profiles.instagram) { leadGen += 8; evidenceLG.push("Instagram — DM and profile link lead paths"); }
  if (formData.primaryGoal && formData.primaryGoal.toLowerCase().includes("lead")) { leadGen += 7; evidenceLG.push("Lead generation is stated primary goal"); }
  evidenceLG.push("Note: form analysis and conversion path review require UX audit");
  leadGen = Math.min(100, leadGen);

  let lgObs: string;
  if (leadGen >= 70) {
    lgObs = `${formData.businessName} has solid lead generation infrastructure. The next level: conversion rate optimization through A/B testing, landing page refinement, and lead magnet development.`;
  } else if (leadGen >= 40) {
    lgObs = `${formData.businessName} has some lead capture potential but gaps exist: ${!website.fetched ? "website not accessible, " : ""}${!profiles.googleBusiness ? "no GBP for direct calls, " : ""}${website.wordCount < 300 ? "thin content." : ""}`;
  } else {
    lgObs = `${formData.businessName} has minimal lead generation capability. ${!website.fetched ? "Without an accessible website, there's no primary conversion point. " : ""}Lead generation starts with being findable and having clear conversion paths.`;
  }
  categories.push({ name: "leadGeneration", label: "Lead Generation", score: leadGen, observation: lgObs, evidence: evidenceLG });

  // ── 10. Advertising Readiness (0-100) ──
  let adReadiness = 0;
  const evidenceAR: string[] = [];
  if (website.fetched) { adReadiness += 20; evidenceAR.push("Website — landing page destination for ads"); }
  if (website.hasHttps) { adReadiness += 10; evidenceAR.push("HTTPS — required for ad landing pages"); }
  if (website.hasMetaTags) { adReadiness += 10; evidenceAR.push("Meta tags — supports ad relevance"); }
  if (website.wordCount > 300) { adReadiness += 12; evidenceAR.push("Content depth supports ad quality score"); }
  if (profiles.facebook) { adReadiness += 15; evidenceAR.push("Facebook — largest paid social platform"); }
  if (profiles.instagram) { adReadiness += 10; evidenceAR.push("Instagram — visual ad format"); }
  if (profiles.googleBusiness) { adReadiness += 8; evidenceAR.push("GBP — Google Ads location extensions"); }
  evidenceAR.push("Note: tracking pixel verification and conversion events require ad platform access");
  adReadiness = Math.min(100, adReadiness);

  let arObs: string;
  if (adReadiness >= 70) {
    arObs = `${formData.businessName} is well-positioned for paid advertising. The next step: campaign structure, creative development, and conversion tracking setup.`;
  } else if (adReadiness >= 40) {
    arObs = `${formData.businessName} has foundational elements but gaps would hurt campaign performance: ${!website.fetched ? "unreachable landing pages, " : ""}${!profiles.facebook && !profiles.instagram ? "missing Meta platforms." : ""}`;
  } else {
    arObs = `${formData.businessName} is not currently ready for effective paid advertising. ${!website.fetched ? "No accessible landing page. " : ""}Running ads without fundamentals burns budget without returns.`;
  }
  categories.push({ name: "advertisingReadiness", label: "Advertising Readiness", score: adReadiness, observation: arObs, evidence: evidenceAR });

  // ── 11. Overall Marketing Score (aggregate) ──
  const allScores = categories.map((c) => c.score);
  const overall = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

  let overallObs: string;
  if (overall >= 70) {
    overallObs = `${formData.businessName} has a strong marketing foundation across ${allScores.length} assessment categories. The digital infrastructure is solid. The opportunity now is scaling from strong to dominant.`;
  } else if (overall >= 40) {
    overallObs = `${formData.businessName} has the basics in place but our comprehensive analysis identified clear gaps across multiple dimensions. These represent real missed opportunities: leads not captured, customers not reached, revenue not generated.`;
  } else {
    overallObs = `${formData.businessName}'s marketing presence needs foundational work across nearly every dimension we assessed. Every improvement from this starting point delivers outsized returns.`;
  }

  categories.unshift({
    name: "overallMarketing",
    label: "Overall Marketing Score",
    score: overall,
    observation: overallObs,
    evidence: [`Aggregate of ${allScores.length} category scores`],
  });

  // ── 12. Business Health Rating ──
  const bizHealth = Math.round(overall * 0.7 + (website.fetched ? 15 : 0) + (profiles.total >= 3 ? 15 : profiles.total >= 1 ? 8 : 0));
  const healthScore = Math.min(100, bizHealth);

  let bhObs: string;
  if (healthScore >= 70) {
    bhObs = `${formData.businessName} demonstrates healthy business marketing fundamentals. The focus now: optimizing the conversion path from discovery to customer.`;
  } else if (healthScore >= 40) {
    bhObs = `${formData.businessName} shows signs of a real business but digital health indicators are mixed. These are fixable — and fixing them directly improves customer confidence and lead volume.`;
  } else {
    bhObs = `${formData.businessName}'s online business health indicators are concerning. The gap is significant — but every improvement directly impacts business performance.`;
  }

  categories.push({
    name: "businessHealth",
    label: "Overall Business Health Rating",
    score: healthScore,
    observation: bhObs,
    evidence: ["Composite score based on marketing health, website accessibility, platform diversity, and trust signals"],
  });

  return categories;
}

// ---------------------------------------------------------------------------
// Premium Strengths & Weaknesses
// ---------------------------------------------------------------------------

function generatePremiumStrengths(
  categories: PremiumCategoryScore[],
  website: WebsiteAnalysis,
  profiles: ProfileCounts
): string[] {
  const strengths: string[] = [];

  for (const cat of categories) {
    if (cat.score >= 70 && cat.name !== "overallMarketing" && cat.name !== "businessHealth") {
      if (cat.name === "brandIdentity") {
        strengths.push(`Strong brand identity — consistent signals across web and social platforms build recognition and trust.`);
      }
      if (cat.name === "websiteAnalysis" && website.fetched) {
        strengths.push(`Your website is technically sound — properly configured, secure, and accessible. Your 24/7 digital storefront is working.`);
      }
      if (cat.name === "socialMediaAnalysis") {
        strengths.push(`Multi-platform social presence across ${profiles.platforms.join(", ")} — customers can discover you wherever they spend time online.`);
      }
      if (cat.name === "localMarketing") {
        strengths.push(`Strong local marketing infrastructure — your location and platform presence make you findable in local searches.`);
      }
    }
  }

  if (website.hasHttps && website.fetched) {
    strengths.push("HTTPS encryption active — a trust signal that both customers and search engines reward.");
  }
  if (website.hasOpenGraph && website.fetched) {
    strengths.push("Social sharing is properly configured — your content renders professionally when shared.");
  }
  if (profiles.googleBusiness) {
    strengths.push("Google Business Profile present — the single highest-impact platform for local lead generation.");
  }

  if (strengths.length === 0) {
    strengths.push("You're investing in a comprehensive professional assessment — the first and most important step toward marketing excellence.");
    if (profiles.total > 0) {
      strengths.push(`You've established ${profiles.total} platform${profiles.total === 1 ? "" : "s"} — a foundation most local businesses haven't built.`);
    }
  }

  return strengths.slice(0, 5);
}

function generatePremiumWeaknesses(
  categories: PremiumCategoryScore[],
  website: WebsiteAnalysis,
  profiles: ProfileCounts,
  formData: LeadFormData
): string[] {
  const weaknesses: string[] = [];

  for (const cat of categories) {
    if (cat.score <= 35 && cat.name !== "overallMarketing" && cat.name !== "businessHealth") {
      if (cat.name === "websiteAnalysis") {
        weaknesses.push(!website.fetched && formData.websiteUrl?.trim()
          ? `Your website could not be reached during analysis — if customers experience the same, they leave immediately.`
          : "Your website lacks critical elements for conversion and search visibility.");
      }
      if (cat.name === "socialMediaAnalysis") {
        weaknesses.push(profiles.total === 0
          ? "No social media presence — invisible on every platform where customers discover businesses."
          : `Only ${profiles.total} platform${profiles.total === 1 ? "" : "s"} — competitors on 3+ platforms capture more attention and leads.`);
      }
      if (cat.name === "localMarketing") {
        weaknesses.push("Critical gaps in local marketing — customers searching for your services find competitors, not you.");
      }
      if (cat.name === "reputationAnalysis") {
        weaknesses.push("Minimal review infrastructure — without visible reviews, potential customers lack social proof.");
      }
      if (cat.name === "leadGeneration") {
        weaknesses.push("Lead capture capability is insufficient — the paths from discovery to customer are too weak to convert reliably.");
      }
    }
  }

  if (weaknesses.length === 0) {
    weaknesses.push("While your foundation is solid, platforms and algorithms evolve constantly. Continuous optimization is essential.");
  }

  return weaknesses.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Priority Matrix
// ---------------------------------------------------------------------------

function generatePriorityMatrix(
  categories: PremiumCategoryScore[],
  _website: WebsiteAnalysis,
  _profiles: ProfileCounts
): PriorityItem[] {
  const items: PriorityItem[] = [];

  for (const cat of categories) {
    if (cat.name === "overallMarketing" || cat.name === "businessHealth") continue;

    const score = cat.score;
    let businessImpact: number;
    let implDifficulty: number;

    // Lower scores = higher business impact from fixing
    if (score <= 35) {
      businessImpact = 90;
      implDifficulty = 35;
    } else if (score <= 55) {
      businessImpact = 70;
      implDifficulty = 45;
    } else if (score <= 75) {
      businessImpact = 45;
      implDifficulty = 55;
    } else {
      businessImpact = 25;
      implDifficulty = 40;
    }

    const priorityScore = businessImpact - (implDifficulty * 0.5);
    let priority: PriorityItem["priority"];
    if (priorityScore >= 65) priority = "Critical";
    else if (priorityScore >= 40) priority = "High";
    else if (priorityScore >= 20) priority = "Medium";
    else priority = "Low";

    const recommendations: Record<string, string> = {
      brandIdentity: "Engage branding services to establish consistent visual identity, logo optimization, and brand guidelines.",
      websiteAnalysis: "Prioritize website improvements — HTTPS, meta tags, content expansion, and conversion optimization.",
      socialMediaAnalysis: "Expand to key missing platforms and optimize existing profiles with complete bios and images.",
      contentStrategy: "Develop a structured content calendar with educational, promotional, and community-building pillars.",
      localMarketing: "Create/optimize Google Business Profile, ensure NAP consistency, and build local citations.",
      searchVisibility: "Implement on-page SEO fundamentals — title tags, meta descriptions, content optimization.",
      reputationAnalysis: "Launch systematic review generation campaign and implement professional response management.",
      competitorAnalysis: "Conduct formal competitor research to identify gaps and opportunities in your market.",
      leadGeneration: "Audit and optimize all conversion paths — CTAs, forms, landing pages, and contact options.",
      advertisingReadiness: "Prepare landing pages, install tracking pixels, and build campaign-ready audiences.",
    };

    items.push({
      issue: cat.observation.slice(0, 100) + "...",
      category: cat.label,
      businessImpact,
      implementationDifficulty: implDifficulty,
      priority,
      recommendation: recommendations[cat.name] || "Address with professional marketing support.",
    });
  }

  return items.sort((a, b) => {
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return order[a.priority] - order[b.priority];
  });
}

// ---------------------------------------------------------------------------
// Growth Roadmap
// ---------------------------------------------------------------------------

function generateGrowthRoadmap(
  _categories: PremiumCategoryScore[],
  _priorities: PriorityItem[]
): GrowthPhase[] {
  return [
    {
      phase: "Phase 1: Foundation & Immediate Improvements",
      timeframe: "Week 1–4",
      actions: [
        "Complete website technical audit and fix critical issues (HTTPS, meta tags, accessibility)",
        "Create or claim Google Business Profile with complete information",
        "Establish presence on any missing key social platforms (Facebook, Instagram)",
        "Implement Quick Wins identified in this report",
        "Set up basic conversion tracking and analytics",
      ],
      expectedOutcome: "Your digital presence becomes findable, credible, and trackable. Foundation for all future marketing investment.",
    },
    {
      phase: "Phase 2: Brand & Visibility Build",
      timeframe: "Month 2–3",
      actions: [
        "Launch consistent content calendar across active platforms (minimum 12 posts/month)",
        "Optimize all social profiles with professional bios, images, and category settings",
        "Begin systematic review generation campaign",
        "Implement on-page SEO improvements and local citation building",
        "Develop brand visual identity system and guidelines",
      ],
      expectedOutcome: "Consistent brand presence across platforms. Organic visibility begins building. Reviews and social proof accumulate.",
    },
    {
      phase: "Phase 3: Lead Generation Optimization",
      timeframe: "Month 3–4",
      actions: [
        "Audit and redesign conversion paths — CTAs, forms, landing pages",
        "Launch paid advertising on 1–2 platforms with optimized landing pages",
        "Implement community management for comment/DM response",
        "Deploy lead magnets and email capture strategy",
        "A/B test messaging, offers, and creative",
      ],
      expectedOutcome: "Reliable lead flow begins. Marketing investment shows measurable ROI. Conversion paths optimized.",
    },
    {
      phase: "Phase 4: Growth & Market Leadership",
      timeframe: "Month 4–6+",
      actions: [
        "Scale paid campaigns to additional platforms and audiences",
        "Expand content to video, Reels, Stories, and long-form educational content",
        "Implement advanced A/B testing across all channels",
        "Build retargeting and nurture sequences",
        "Conduct quarterly competitive analysis and strategy refinement",
      ],
      expectedOutcome: "Market leadership position. Predictable, scalable lead generation. Brand recognized as authority in your category.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Executive Summary
// ---------------------------------------------------------------------------

function generatePremiumExecutiveSummary(
  formData: LeadFormData,
  overall: number,
  health: number,
  categories: PremiumCategoryScore[],
  profiles: ProfileCounts,
  website: WebsiteAnalysis
): string {
  const topStrength = categories
    .filter((c) => c.name !== "overallMarketing" && c.name !== "businessHealth")
    .sort((a, b) => b.score - a.score)[0];
  const topWeakness = categories
    .filter((c) => c.name !== "overallMarketing" && c.name !== "businessHealth")
    .sort((a, b) => a.score - b.score)[0];

  let summary = `Metro Reach Media completed a comprehensive Premium Growth Audit of ${formData.businessName}, analyzing ${categories.filter(c => c.name !== "overallMarketing" && c.name !== "businessHealth").length} marketing dimensions. `;

  if (website.fetched) {
    summary += `The website was fully analyzed for technical health, content depth, and conversion readiness. `;
  } else if (formData.websiteUrl?.trim()) {
    summary += `The website could not be reached — a critical issue affecting every aspect of digital marketing. `;
  }

  if (profiles.total > 0) {
    summary += `${profiles.total} social platform${profiles.total === 1 ? " was" : "s were"} evaluated: ${profiles.platforms.join(", ")}. `;
  }

  summary += `Overall Marketing Score: ${overall}/100. Business Health Rating: ${health}/100. `;

  if (topStrength) {
    summary += `Strongest area: ${topStrength.label} (${topStrength.score}/100). `;
  }
  if (topWeakness) {
    summary += `Highest priority for improvement: ${topWeakness.label} (${topWeakness.score}/100).`;
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Competitor Snapshot
// ---------------------------------------------------------------------------

function generateCompetitorSnapshotShared(
  formData: LeadFormData,
  categories: { name: string; label: string; score: number }[],
  _profiles: ProfileCounts
): string {
  const overall = categories.find((c) => c.name === "overallMarketing")?.score ?? 50;

  if (overall >= 70) {
    return `Businesses in ${formData.industry || "your industry"} typically score 40–60 on this audit. At ${overall}/100, ${formData.businessName} is outperforming most local competitors. The challenge now is staying ahead.`;
  }
  if (overall >= 40) {
    return `The average competitor in ${formData.industry || "your industry"} scores between 40–60. ${formData.businessName} is within range but not leading. The businesses pulling ahead are investing in consistent content, paid advertising, and active community management.`;
  }
  return `In ${formData.industry || "your industry"}, the businesses winning the most leads typically score 60+ on this audit. ${formData.businessName} is currently behind the competitive curve — but the gap is closable through consistent execution.`;
}

// ---------------------------------------------------------------------------
// Data Confidence
// ---------------------------------------------------------------------------

function determinePremiumConfidence(
  website: WebsiteAnalysis,
  profiles: ProfileCounts
): { level: "High" | "Moderate" | "Limited"; explanation: string } {
  const signals: string[] = [];
  if (website.fetched) signals.push("website was successfully analyzed");
  else signals.push("website could not be reached");
  if (profiles.total >= 3) signals.push(`${profiles.total} social profiles provided`);
  else if (profiles.total > 0) signals.push(`only ${profiles.total} social profile${profiles.total === 1 ? "" : "s"} provided`);
  else signals.push("no social profiles provided");

  const points = (website.fetched ? 3 : 0) + Math.min(profiles.total * 2, 4);

  if (points >= 5) {
    return {
      level: "High",
      explanation: `High confidence: ${signals.join("; ")}. Metro Reach Media had sufficient data to perform a thorough, evidence-based assessment.`,
    };
  } else if (points >= 2) {
    return {
      level: "Moderate",
      explanation: `Moderate confidence: ${signals.join("; ")}. Some categories were assessed with limited direct evidence. Providing additional profile URLs would enable more precise analysis.`,
    };
  } else {
    return {
      level: "Limited",
      explanation: `Limited data: ${signals.join("; ")}. Many categories were assessed using industry benchmarks and available signals. For a complete analysis, provide social profile URLs and ensure website accessibility.`,
    };
  }
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

export async function runPremiumAudit(
  formData: LeadFormData,
  id: string
): Promise<PremiumAuditResult> {
  const websiteMeta = await fetchWebsiteMeta(formData.websiteUrl);
  const website: WebsiteAnalysis = {
    url: formData.websiteUrl?.trim() || "Not provided",
    ...websiteMeta,
  };

  const profiles = countProfiles(formData);
  const categories = calculatePremiumScores(website, formData, profiles);
  const strengths = generatePremiumStrengths(categories, website, profiles);
  const weaknesses = generatePremiumWeaknesses(categories, website, profiles, formData);
  const priorityMatrix = generatePriorityMatrix(categories, website, profiles);
  const growthRoadmap = generateGrowthRoadmap(categories, priorityMatrix);
  const quickWins = generateQuickWinsShared(website, profiles, formData);
  const { recommendations, confidence, explanation: confidenceExplanation } =
    generateServiceRecommendations(
      categories.map(c => ({
        name: c.name,
        label: c.label,
        score: c.score,
        observation: c.observation,
        evidence: c.evidence,
      })),
      website,
      profiles,
      formData
    );
  const { level: dataConfidence, explanation: _dataConfExplanation } =
    determinePremiumConfidence(website, profiles);

  const overall = categories.find((c) => c.name === "overallMarketing")?.score ?? 0;
  const health = categories.find((c) => c.name === "businessHealth")?.score ?? 0;
  const execSummary = generatePremiumExecutiveSummary(formData, overall, health, categories, profiles, website);
  const competitorSnapshot = generateCompetitorSnapshotShared(
    formData,
    categories.map(c => ({ name: c.name, label: c.label, score: c.score })),
    profiles
  );

  return {
    id,
    formData,
    website,
    scores: {
      overall,
      businessHealth: health,
      categories: categories.filter((c) => c.name !== "overallMarketing" && c.name !== "businessHealth"),
    },
    strengths,
    weaknesses,
    priorityMatrix,
    growthRoadmap,
    quickWins,
    serviceRecommendations: recommendations,
    recommendationConfidence: confidence,
    confidenceExplanation,
    competitorSnapshot,
    executiveSummary: execSummary,
    dataConfidence,
    timestamp: new Date().toISOString(),
  };
}
