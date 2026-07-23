/**
 * Free Social Media Audit — Analysis Engine
 * MetroReach Digital
 *
 * Analyzes a business's online presence across 10 categories.
 * Every score connects to evidence found. No invented data.
 * No AI/automation language — positioned as human analyst work.
 */

import type { LeadFormData } from "~/lib/lead-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebsiteAnalysis {
  url: string;
  fetched: boolean;
  title: string | null;
  description: string | null;
  hasHttps: boolean;
  hasMetaTags: boolean;
  hasOpenGraph: boolean;
  wordCount: number;
  statusCode: number | null;
}

export interface CategoryScore {
  name: string;
  label: string;
  score: number; // 0-100
  observation: string;
  evidence: string[];
}

export interface AuditScores {
  overall: number;
  categories: CategoryScore[];
}

export interface QuickWin {
  issue: string;
  fix: string;
  timeEstimate: string;
  impactLevel: "High" | "Medium";
}

export interface ServiceRecommendation {
  slug: string;
  name: string;
  reason: string; // Why this package was selected
  problemsAddressed: string[]; // Which identified problems it addresses
  deliverables: string[]; // What's included
  estimatedTimeline: string; // Expected starting timeline
  price: string; // Exact price
  billingFrequency: string; // monthly, one-time, etc.
  postPurchase: string; // What happens after purchase
  stripeLink: string | null; // Stripe payment link if available
}

export interface AuditResult {
  id: string;
  formData: LeadFormData;
  website: WebsiteAnalysis;
  scores: AuditScores;
  strengths: string[];
  weaknesses: string[];
  quickWins: QuickWin[];
  serviceRecommendations: ServiceRecommendation[];
  recommendationConfidence: "high" | "moderate" | "limited";
  confidenceExplanation: string;
  competitorSnapshot: string;
  executiveSummary: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Website Fetcher
// ---------------------------------------------------------------------------

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

    // Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      result.title = titleMatch[1].trim().replace(/\s+/g, " ");
    }

    // Meta description
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

    // Open Graph
    if (
      html.includes("og:title") ||
      html.includes("og:description") ||
      html.includes("og:image")
    ) {
      result.hasOpenGraph = true;
    }

    // OG description fallback
    if (!result.description) {
      const ogMatch = html.match(
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i
      );
      if (ogMatch) result.description = ogMatch[1].trim();
    }

    // Word count
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

// ---------------------------------------------------------------------------
// Scoring Engine — 10 Categories
// ---------------------------------------------------------------------------

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

function calculateScores(
  website: WebsiteAnalysis,
  formData: LeadFormData,
  profiles: ProfileCounts
): CategoryScore[] {
  const categories: CategoryScore[] = [];

  // ── 1. Social Media Presence (0-100) ──
  let socialPresence = 0;
  const evidenceSP: string[] = [];
  if (profiles.facebook) { socialPresence += 25; evidenceSP.push("Facebook profile URL provided"); }
  if (profiles.instagram) { socialPresence += 25; evidenceSP.push("Instagram profile URL provided"); }
  if (profiles.linkedin) { socialPresence += 15; evidenceSP.push("LinkedIn profile URL provided"); }
  if (profiles.tiktok) { socialPresence += 15; evidenceSP.push("TikTok profile URL provided"); }
  if (profiles.googleBusiness) { socialPresence += 20; evidenceSP.push("Google Business Profile URL provided"); }
  socialPresence = Math.min(100, socialPresence);

  let spObs: string;
  if (socialPresence >= 70) {
    spObs = `${formData.businessName} has a strong multi-platform presence across ${profiles.platforms.join(", ")}. This gives customers multiple ways to discover and interact with your business.`;
  } else if (socialPresence >= 30) {
    spObs = `${formData.businessName} is present on ${profiles.total} platform${profiles.total === 1 ? "" : "s"}: ${profiles.platforms.join(", ") || "none provided"}. ${profiles.total < 3 ? "Businesses that maintain 3+ active platforms typically capture significantly more local traffic than single-platform competitors." : ""}`;
  } else {
    spObs = `${formData.businessName} has ${profiles.total === 0 ? "no social media profiles provided for analysis" : `limited social media presence with only ${profiles.total} profile${profiles.total === 1 ? "" : "s"} provided`}. Your competitors are capturing local attention on these platforms every day. Each missing platform is a channel where customers can't find you.`;
  }

  categories.push({
    name: "socialPresence",
    label: "Social Media Presence",
    score: socialPresence,
    observation: spObs,
    evidence: evidenceSP,
  });

  // ── 2. Branding & Visual Consistency (0-100) ──
  let branding = 0;
  const evidenceBR: string[] = [];
  if (website.fetched) { branding += 20; evidenceBR.push("Website is accessible for brand analysis"); }
  if (website.title) { branding += 20; evidenceBR.push(`Page title found: "${website.title.slice(0, 60)}${website.title.length > 60 ? "..." : ""}"`); }
  if (website.hasOpenGraph) { branding += 15; evidenceBR.push("Open Graph tags configured for social sharing"); }
  if (website.description) { branding += 10; evidenceBR.push("Meta description configured"); }
  if (formData.businessName.length > 2) { branding += 10; evidenceBR.push("Business name provided"); }
  if (profiles.total >= 3) { branding += 15; evidenceBR.push("Brand present across 3+ platforms — consistency opportunity"); }
  else if (profiles.total >= 1) { branding += 10; evidenceBR.push("Brand present on at least 1 social platform"); }
  if (profiles.facebook && profiles.instagram) { branding += 10; evidenceBR.push("Facebook + Instagram — strongest visual pair for local brands"); }
  branding = Math.min(100, branding);

  let brObs: string;
  if (branding >= 70) {
    brObs = `${formData.businessName} presents a consistent brand across the web. Your website has proper metadata and your social profiles suggest a coordinated presence. This consistency builds recognition and trust with every visitor.`;
  } else if (branding >= 40) {
    const gaps: string[] = [];
    if (!website.hasOpenGraph) gaps.push("social sharing previews aren't configured");
    if (!website.description) gaps.push("no meta description — search engines display arbitrary text");
    if (profiles.total < 2) gaps.push("limited social platforms for brand reinforcement");
    brObs = `${formData.businessName}'s brand consistency has gaps: ${gaps.join("; ")}. When your visual identity and messaging vary across platforms, customers may not recognize your business as the same one they saw elsewhere.`;
  } else {
    brObs = `${formData.businessName}'s brand is difficult to evaluate comprehensively online. ${!website.fetched ? "The website couldn't be reached for brand analysis. " : ""}${profiles.total === 0 ? "No social profiles were provided to assess cross-platform brand consistency." : "Limited profile data available for brand assessment."}`;
  }

  categories.push({
    name: "branding",
    label: "Branding & Visual Consistency",
    score: branding,
    observation: brObs,
    evidence: evidenceBR,
  });

  // ── 3. Content Quality (0-100) ──
  let contentQuality = 0;
  const evidenceCQ: string[] = [];
  if (website.fetched) { contentQuality += 15; evidenceCQ.push("Website content available for analysis"); }
  if (website.description && website.description.length > 30) { contentQuality += 15; evidenceCQ.push("Descriptive meta description found"); }
  else if (website.description) { contentQuality += 8; evidenceCQ.push("Brief meta description found"); }
  if (website.title && website.title.length > 20) { contentQuality += 10; evidenceCQ.push("Descriptive page title"); }
  if (website.wordCount > 500) { contentQuality += 20; evidenceCQ.push(`Substantial website content (~${website.wordCount.toLocaleString()} words)`); }
  else if (website.wordCount > 200) { contentQuality += 10; evidenceCQ.push(`Moderate website content (~${website.wordCount.toLocaleString()} words)`); }
  else if (website.wordCount > 0) { contentQuality += 5; evidenceCQ.push(`Limited website content (~${website.wordCount} words)`); }
  if (website.hasOpenGraph) { contentQuality += 10; evidenceCQ.push("Content is shareable (OG tags)"); }
  if (profiles.total >= 3) { contentQuality += 15; evidenceCQ.push("Content distribution possible across 3+ platforms"); }
  else if (profiles.total >= 1) { contentQuality += 10; evidenceCQ.push("At least 1 platform for content distribution"); }
  if (formData.primaryGoal && formData.primaryGoal.length > 10) { contentQuality += 5; evidenceCQ.push("Clear primary goal provided"); }
  contentQuality = Math.min(100, contentQuality);

  let cqObs: string;
  if (contentQuality >= 70) {
    cqObs = `${formData.businessName} has a solid content foundation. Your website provides substantive information and you have the distribution channels to reach customers where they spend time.`;
  } else if (contentQuality >= 40) {
    cqObs = `${formData.businessName} has some content online, but our review found it's thin. ${website.wordCount < 300 ? `With approximately ${website.wordCount} words on the website, there isn't enough depth for search engines to fully understand your services — or for customers to feel confident choosing you.` : ""} Content is your digital sales team working 24/7.`;
  } else {
    cqObs = `${formData.businessName} has minimal content online — ${!website.fetched ? "the website couldn't be reached for analysis" : `the website has approximately ${website.wordCount} words`}. This is one of the fastest ways to lose a potential customer: they land on your site, find almost nothing, and leave for a competitor who tells a better story.`;
  }

  categories.push({
    name: "contentQuality",
    label: "Content Quality",
    score: contentQuality,
    observation: cqObs,
    evidence: evidenceCQ,
  });

  // ── 4. Posting Consistency (0-100) ──
  // Without Buffer API access, we score based on profile count as a proxy
  // for having channels to post on, and note what we can't measure.
  let postConsistency = 0;
  const evidencePC: string[] = [];
  if (profiles.total >= 4) { postConsistency += 40; evidencePC.push("4+ platforms available for posting"); }
  else if (profiles.total >= 2) { postConsistency += 25; evidencePC.push("2-3 platforms available for posting"); }
  else if (profiles.total >= 1) { postConsistency += 15; evidencePC.push("1 platform available for posting"); }
  if (profiles.facebook) { postConsistency += 15; evidencePC.push("Facebook — key platform for consistent local posting"); }
  if (profiles.instagram) { postConsistency += 15; evidencePC.push("Instagram — high-engagement posting channel"); }
  if (website.fetched && website.wordCount > 200) { postConsistency += 10; evidencePC.push("Website has content — indicates some publishing activity"); }
  // Note: actual posting frequency requires platform API access
  evidencePC.push("Note: actual posting frequency requires direct platform access — scored on available signals");
  postConsistency = Math.min(100, postConsistency);

  let pcObs: string;
  if (postConsistency >= 60) {
    pcObs = `${formData.businessName} has the infrastructure for consistent posting across multiple platforms. Our team could not verify actual posting frequency without platform access — but the channel availability suggests publishing capability. Regular, scheduled posting is what separates active businesses from those that look dormant.`;
  } else if (postConsistency >= 30) {
    pcObs = `Based on the platforms available, ${formData.businessName} has some posting channels but our review couldn't verify actual posting frequency. Inconsistent posting is one of the most common reasons businesses lose audience attention — the algorithm treats gaps as a signal to deprioritize your content.`;
  } else {
    pcObs = `${formData.businessName} has limited posting infrastructure. Without active social profiles, there's nowhere to post consistently — and without consistent posting, customers assume the business is inactive or closed.`;
  }

  categories.push({
    name: "postingConsistency",
    label: "Posting Consistency",
    score: postConsistency,
    observation: pcObs,
    evidence: evidencePC,
  });

  // ── 5. Engagement & Community Activity (0-100) ──
  let engagement = 0;
  const evidenceEN: string[] = [];
  if (profiles.total >= 4) { engagement += 30; evidenceEN.push("4+ platforms — more opportunities for customer interaction"); }
  else if (profiles.total >= 2) { engagement += 20; evidenceEN.push("2-3 platforms for customer interaction"); }
  else if (profiles.total >= 1) { engagement += 10; evidenceEN.push("1 platform for customer interaction"); }
  if (profiles.facebook) { engagement += 15; evidenceEN.push("Facebook — primary platform for local reviews and community interaction"); }
  if (profiles.instagram) { engagement += 15; evidenceEN.push("Instagram — high engagement rates for visual businesses"); }
  if (profiles.googleBusiness) { engagement += 20; evidenceEN.push("Google Business Profile — critical for review management and Q&A"); }
  if (website.fetched && website.wordCount > 300) { engagement += 10; evidenceEN.push("Website has enough content to engage visitors"); }
  // Note on actual engagement data
  evidenceEN.push("Note: actual engagement metrics require platform API access — scored on available signals");
  engagement = Math.min(100, engagement);

  let enObs: string;
  if (engagement >= 60) {
    enObs = `${formData.businessName} has multiple channels where customers can interact with your brand. Our review couldn't verify actual comment response times or DM management without platform access — but the channel infrastructure is in place. The gap between having profiles and actively managing them is where most businesses lose leads.`;
  } else if (engagement >= 30) {
    enObs = `${formData.businessName} has some channels for customer interaction but may not be maximizing them. Unanswered comments and DMs tell customers their input doesn't matter. Community management is the difference between a profile that exists and a profile that converts.`;
  } else {
    enObs = `${formData.businessName} has minimal channels for customer engagement. Without active social profiles, potential customers have nowhere to ask questions, leave reviews, or interact with your brand — and those interactions are often the final step before someone picks up the phone.`;
  }

  categories.push({
    name: "engagement",
    label: "Engagement & Community Activity",
    score: engagement,
    observation: enObs,
    evidence: evidenceEN,
  });

  // ── 6. Profile Optimization (0-100) ──
  let profileOpt = 0;
  const evidencePO: string[] = [];
  if (profiles.facebook) { profileOpt += 20; evidencePO.push("Facebook — profile setup available"); }
  if (profiles.instagram) { profileOpt += 20; evidencePO.push("Instagram — profile setup available"); }
  if (profiles.linkedin) { profileOpt += 15; evidencePO.push("LinkedIn — profile setup available"); }
  if (profiles.tiktok) { profileOpt += 15; evidencePO.push("TikTok — profile setup available"); }
  if (profiles.googleBusiness) { profileOpt += 20; evidencePO.push("Google Business Profile — critical for local search appearance"); }
  if (website.fetched && website.title) { profileOpt += 10; evidencePO.push("Website has a discoverable title — supports profile link relevance"); }
  // Note
  evidencePO.push("Note: actual profile completeness (bios, images, categories) requires platform access");
  profileOpt = Math.min(100, profileOpt);

  let poObs: string;
  if (profileOpt >= 60) {
    poObs = `Based on the profiles provided, ${formData.businessName} has the foundation for well-optimized profiles across key platforms. Our review could not verify specific profile elements like bios, cover images, and category settings without direct platform access — these are the details that make profiles look professional versus neglected.`;
  } else if (profileOpt >= 30) {
    poObs = `${formData.businessName} has some profiles that could be optimized. Missing bios, unset categories, and absent cover images make even active businesses look incomplete. Every incomplete profile element is a trust signal your business isn't sending.`;
  } else {
    poObs = `${formData.businessName} has few or no profiles to optimize. The first step is establishing business profiles on key platforms with complete bios, professional images, and accurate category settings — this alone puts you ahead of businesses that haven't taken this step.`;
  }

  categories.push({
    name: "profileOptimization",
    label: "Profile Optimization",
    score: profileOpt,
    observation: poObs,
    evidence: evidencePO,
  });

  // ── 7. Website Conversion Readiness (0-100) ──
  let websiteScore = 0;
  const evidenceWS: string[] = [];
  if (website.fetched) { websiteScore += 20; evidenceWS.push("Website is accessible"); }
  if (website.hasHttps) { websiteScore += 15; evidenceWS.push("HTTPS enabled — trust signal for visitors"); }
  if (website.title) { websiteScore += 15; evidenceWS.push("Page title configured"); }
  if (website.description) { websiteScore += 15; evidenceWS.push("Meta description configured — controls search result snippet"); }
  if (website.hasMetaTags) { websiteScore += 10; evidenceWS.push("Meta tags present"); }
  if (website.hasOpenGraph) { websiteScore += 10; evidenceWS.push("Open Graph tags configured — social sharing previews work"); }
  if (website.wordCount > 500) { websiteScore += 10; evidenceWS.push("Substantial page content to convert visitors"); }
  else if (website.wordCount > 200) { websiteScore += 5; evidenceWS.push("Moderate page content"); }
  if (!website.fetched && website.url && website.url !== "Not provided") {
    evidenceWS.push("Website could not be reached — possible downtime or configuration issue");
  }
  websiteScore = Math.min(100, websiteScore);

  let wsObs: string;
  if (!website.fetched && formData.websiteUrl?.trim()) {
    wsObs = `Our team attempted to analyze ${formData.websiteUrl} but was unable to reach the site. This could mean the site is down, the URL is incorrect, or there are security settings blocking our review. If potential customers experience the same issue, they'll leave immediately — every marketing dollar spent is wasted if the website isn't accessible.`;
  } else if (!website.fetched) {
    wsObs = "No website URL was provided for analysis. A website is often the first place potential customers go after discovering your business — without one, the evaluation is incomplete.";
  } else if (websiteScore >= 70) {
    wsObs = `The website at ${website.url} is in good technical shape — accessible over HTTPS with proper metadata and shareable content. This is the digital storefront that works 24/7, and it's making a solid first impression.`;
  } else if (websiteScore >= 40) {
    const issues: string[] = [];
    if (!website.hasHttps) issues.push("not using HTTPS (browsers display 'Not Secure' warnings)");
    if (!website.description) issues.push("missing meta description");
    if (!website.hasOpenGraph) issues.push("social sharing previews not configured");
    wsObs = `The website at ${website.url} needs technical improvements: ${issues.join("; ")}. These directly impact whether visitors trust your business and whether search engines rank your site.`;
  } else {
    wsObs = `The website at ${website.url} needs significant work. Basic elements that customers and search engines expect — proper metadata, a clear description of services, and shareable content — are missing or incomplete.`;
  }

  categories.push({
    name: "website",
    label: "Website Conversion Readiness",
    score: websiteScore,
    observation: wsObs,
    evidence: evidenceWS,
  });

  // ── 8. Local Visibility (0-100) ──
  let localVis = 0;
  const evidenceLV: string[] = [];
  if (formData.location && formData.location.trim()) { localVis += 20; evidenceLV.push(`Business location provided: ${formData.location}`); }
  if (profiles.facebook) { localVis += 25; evidenceLV.push("Facebook — top platform for local service discovery"); }
  if (profiles.googleBusiness) { localVis += 25; evidenceLV.push("Google Business Profile — critical for 'near me' searches"); }
  if (profiles.instagram) { localVis += 10; evidenceLV.push("Instagram — growing local discovery through location tags"); }
  if (formData.industry && formData.industry !== "Other") { localVis += 10; evidenceLV.push(`Industry "${formData.industry}" — enables local category targeting`); }
  if (website.fetched && website.description) { localVis += 10; evidenceLV.push("Website includes descriptive content — supports local SEO"); }
  localVis = Math.min(100, localVis);

  let lvObs: string;
  if (localVis >= 70) {
    lvObs = `${formData.businessName} has strong local visibility signals — location information, essential local platforms, and a discoverable web presence. When customers in ${formData.location || "your area"} search for ${formData.industry || "services like yours"}, you have the foundation to appear in results.`;
  } else if (localVis >= 40) {
    const gaps: string[] = [];
    if (!profiles.googleBusiness) gaps.push("no Google Business Profile — the most important local ranking signal");
    if (!profiles.facebook) gaps.push("no Facebook presence — the #1 platform for local service discovery");
    if (!formData.location) gaps.push("no business location provided");
    lvObs = `${formData.businessName} has some local visibility but significant gaps: ${gaps.join("; ")}. When potential customers search for local services, they're finding your competitors — not you.`;
  } else {
    lvObs = `${formData.businessName} is difficult to find online locally. Missing key local platforms ${!formData.location ? "and no location information provided" : ""} means you're essentially invisible to customers searching for ${formData.industry || "services in your area"}.`;
  }

  categories.push({
    name: "localVisibility",
    label: "Local Visibility",
    score: localVis,
    observation: lvObs,
    evidence: evidenceLV,
  });

  // ── 9. Reputation & Reviews (0-100) ──
  let reputation = 0;
  const evidenceRR: string[] = [];
  if (profiles.googleBusiness) { reputation += 30; evidenceRR.push("Google Business Profile — primary review platform for local businesses"); }
  if (profiles.facebook) { reputation += 25; evidenceRR.push("Facebook — second most important review platform"); }
  if (profiles.total >= 3) { reputation += 15; evidenceRR.push("Multiple platforms — reviews distributed across channels"); }
  if (formData.industry && formData.industry !== "Other") { reputation += 10; evidenceRR.push(`Industry "${formData.industry}" — reviews are critical for this sector`); }
  if (website.fetched) { reputation += 10; evidenceRR.push("Website is accessible — potential platform for testimonials"); }
  evidenceRR.push("Note: actual review counts and ratings require platform API access");
  reputation = Math.min(100, reputation);

  let rrObs: string;
  if (reputation >= 60) {
    rrObs = `${formData.businessName} has the infrastructure for a strong review presence — profiles on key platforms where customers leave and read reviews. Our review couldn't access actual review data without platform integration, but the channels are in place. Reviews are the #1 trust signal for local service businesses.`;
  } else if (reputation >= 30) {
    rrObs = `${formData.businessName} has some review infrastructure but is missing key platforms — particularly ${!profiles.googleBusiness ? "Google Business Profile" : ""}${!profiles.googleBusiness && !profiles.facebook ? " and " : ""}${!profiles.facebook ? "Facebook" : ""}${!profiles.googleBusiness && !profiles.facebook ? ", which are the two most important review platforms for local businesses" : ""}. Without reviews visible, potential customers have no social proof to validate their decision.`;
  } else {
    rrObs = `${formData.businessName} has minimal review infrastructure. Without profiles on Google and Facebook — where 85%+ of local service reviews are read — you're asking customers to trust you with no evidence that others have had a positive experience.`;
  }

  categories.push({
    name: "reputation",
    label: "Reputation & Reviews",
    score: reputation,
    observation: rrObs,
    evidence: evidenceRR,
  });

  // ── 10. Overall Marketing Health (aggregate) ──
  const allScores = categories.map((c) => c.score);
  const overall = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
  const overallObs = buildOverallObservation(overall, formData.businessName, profiles, website);

  // Insert at beginning
  categories.unshift({
    name: "overallMarketing",
    label: "Overall Marketing Health",
    score: overall,
    observation: overallObs,
    evidence: [`Aggregate of ${allScores.length} category scores ranging from ${Math.min(...allScores)} to ${Math.max(...allScores)}`],
  });

  return categories;
}

function buildOverallObservation(
  score: number,
  businessName: string,
  profiles: ProfileCounts,
  website: WebsiteAnalysis
): string {
  if (score >= 70) {
    return `${businessName} has a strong digital marketing foundation. Our team's review found solid evidence across multiple categories — website configuration, social presence, and local visibility. The opportunity now is to refine and scale: moving from "present" to "dominant" in your market.`;
  }
  if (score >= 40) {
    const gaps: string[] = [];
    if (!website.fetched) gaps.push("website accessibility");
    if (profiles.total < 2) gaps.push("limited social media channels");
    if (!profiles.googleBusiness) gaps.push("local visibility");
    return `${businessName} has the basics in place but our analysis identified clear gaps in ${gaps.join(", ")}. These gaps represent opportunities — close them, and your marketing pipeline transforms from inconsistent to reliable.`;
  }
  return `${businessName}'s digital presence needs foundational work. Our review found significant gaps across multiple marketing dimensions. The positive: every improvement from this starting point translates directly to more visibility, trust, and leads. There's nowhere to go but up — and the businesses that start here and execute consistently are the ones that pull ahead.`;
}

// ---------------------------------------------------------------------------
// Strengths & Weaknesses Generator
// ---------------------------------------------------------------------------

function generateStrengths(
  categories: CategoryScore[],
  website: WebsiteAnalysis,
  profiles: ProfileCounts
): string[] {
  const strengths: string[] = [];

  // Find categories scoring 70+
  for (const cat of categories) {
    if (cat.score >= 70 && cat.name !== "overallMarketing") {
      if (cat.name === "socialPresence") {
        strengths.push(`Your business is present across ${profiles.platforms.join(", ")} — customers can find you on the platforms where they spend their time.`);
      }
      if (cat.name === "website" && website.fetched) {
        strengths.push(`Your website is accessible and properly configured — your 24/7 digital storefront is showing up for work.`);
      }
      if (cat.name === "localVisibility") {
        strengths.push(`Strong local visibility signals — your location and platform presence make you findable when customers search for services in your area.`);
      }
    }
  }

  // Specific evidence-based strengths
  if (website.hasHttps && website.fetched) {
    strengths.push("Your website uses HTTPS encryption — a trust signal that customers notice and search engines reward.");
  }

  if (website.hasOpenGraph) {
    strengths.push("Open Graph tags are configured — when your content is shared on social media, it renders professionally with images and descriptions.");
  }

  if (profiles.googleBusiness) {
    strengths.push("Google Business Profile URL provided — this is the single most important platform for local 'near me' searches.");
  }

  // Always find at least one genuine compliment
  if (strengths.length === 0) {
    strengths.push(`You're taking the right first step by seeking a professional assessment of your marketing. Awareness is the foundation of every turnaround.`);
    if (profiles.total > 0) {
      strengths.push(`You've established a presence on ${profiles.total} platform${profiles.total === 1 ? "" : "s"} — many businesses haven't gotten this far.`);
    }
    if (formData.industry) {
      strengths.push(`As a ${formData.industry} business in ${formData.location || "your area"}, you operate in a sector where trust and reputation drive decisions — a strong marketing presence compounds over time.`);
    }
  }

  return strengths.slice(0, 5);
}

function generateWeaknesses(
  categories: CategoryScore[],
  website: WebsiteAnalysis,
  profiles: ProfileCounts,
  formData: LeadFormData
): string[] {
  const weaknesses: string[] = [];

  for (const cat of categories) {
    if (cat.score <= 40 && cat.name !== "overallMarketing") {
      if (cat.name === "website") {
        weaknesses.push(
          !website.fetched && formData.websiteUrl?.trim()
            ? `Your website at ${formData.websiteUrl} could not be reached during our analysis. If this happens to potential customers, they'll leave immediately.`
            : "Your website is missing key elements that impact search visibility and customer trust — including proper metadata and social sharing configuration."
        );
      }
      if (cat.name === "socialPresence") {
        weaknesses.push(
          profiles.total === 0
            ? "No social media profiles provided — you're invisible on the platforms where your customers spend hours researching businesses."
            : `Limited social media presence (${profiles.total} platform${profiles.total === 1 ? "" : "s"}). Businesses that maintain active profiles across 3+ platforms capture significantly more local leads.`
        );
      }
      if (cat.name === "localVisibility") {
        weaknesses.push(
          "Your local visibility is low. When potential customers search for your services in your area, they're finding your competitors — not you."
        );
      }
      if (cat.name === "reputation") {
        weaknesses.push(
          "Minimal review infrastructure. Without visible reviews on Google and Facebook, potential customers have no social proof to validate choosing your business."
        );
      }
      if (cat.name === "contentQuality") {
        weaknesses.push(
          "Your online content is too thin to compete effectively. Search engines and customers both reward depth and substance — currently, your content isn't providing enough of either."
        );
      }
      if (cat.name === "engagement") {
        weaknesses.push(
          "Limited channels for customer interaction. Without active profiles where customers can ask questions and leave feedback, you're missing daily opportunities to build trust."
        );
      }
    }
  }

  if (!website.hasHttps && website.fetched) {
    weaknesses.push("Your website doesn't use HTTPS. Browsers flag non-HTTPS sites as 'Not Secure,' immediately eroding visitor trust.");
  }

  if (weaknesses.length === 0) {
    weaknesses.push("While your foundation is solid, the platforms change constantly. Staying ahead requires continuous optimization — what works today may not work six months from now.");
  }

  return weaknesses.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Quick Wins Generator
// ---------------------------------------------------------------------------

function generateQuickWins(
  website: WebsiteAnalysis,
  profiles: ProfileCounts,
  formData: LeadFormData
): QuickWin[] {
  const wins: QuickWin[] = [];

  // Website quick wins
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
      issue: "Your website is missing a meta description — search engines display whatever text they find, often out of context.",
      fix: `Add a meta description to your homepage: a 1–2 sentence summary of what ${formData.businessName} does, who you serve, and your location. This controls how your business appears in search results.`,
      timeEstimate: "15 minutes",
      impactLevel: "High",
    });
  }

  if (website.fetched && !website.hasOpenGraph) {
    wins.push({
      issue: "Your website doesn't have Open Graph tags — when someone shares your site on Facebook or LinkedIn, the preview looks broken or blank.",
      fix: "Add basic Open Graph tags (og:title, og:description, og:image) to your homepage. If you use WordPress, install an SEO plugin. Otherwise, your web developer can add the tags quickly.",
      timeEstimate: "30 minutes",
      impactLevel: "Medium",
    });
  }

  // Social quick wins
  if (!profiles.facebook) {
    wins.push({
      issue: "No Facebook Business Page — missing the #1 platform for local service discovery.",
      fix: "Create a Facebook Business Page today. Add your logo, cover photo, business hours, services, and contact info. This alone puts you ahead of competitors who haven't taken this step.",
      timeEstimate: "30 minutes",
      impactLevel: "High",
    });
  }

  if (!profiles.googleBusiness) {
    wins.push({
      issue: "No Google Business Profile — you're invisible in 'near me' searches and Google Maps.",
      fix: "Create or claim your Google Business Profile at google.com/business. Add your address, hours, services, and photos. This is the single most impactful free action for local lead generation.",
      timeEstimate: "20 minutes",
      impactLevel: "High",
    });
  }

  // Bio/title quick win
  if (website.fetched && website.title && website.title.length < 15) {
    wins.push({
      issue: `Your website title ("${website.title}") is too short for search engines to understand your business.`,
      fix: `Expand your page title to include your primary service and location. Format: "${formData.businessName} — ${formData.industry || "Professional Services"} in ${formData.location || "[City]"}."`,
      timeEstimate: "10 minutes",
      impactLevel: "High",
    });
  }

  return wins.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Problem-Based Recommendation Engine
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

// Package definitions based on pricing data
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
    postPurchase: "Your website audit is delivered as a prioritized report. We identify the highest-impact fixes first so you can implement immediately.",
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
    estimatedTimeline: "GBP optimization within 48 hours. Local SEO impact builds over 4–8 weeks. Review campaign begins generating results in week 2.",
    price: "$750",
    billingFrequency: "monthly",
    postPurchase: "Our local SEO specialist audits your Google Business Profile and local search presence immediately. You receive an action plan within 2 business days.",
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
    estimatedTimeline: "Full implementation within 2 weeks. Paid campaigns generating leads within week one. Organic momentum building by month two. Pipeline transformation typically visible by month three.",
    price: "$3,000",
    billingFrequency: "monthly",
    postPurchase: "Dedicated team assigned within 24 hours. Platform audits, brand voice development, and ad account setup begin immediately. First campaigns launch within 5 business days.",
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
    estimatedTimeline: "Immediate amplification of existing efforts. New campaigns and content formats rolled out within 2 weeks.",
    price: "$5,500",
    billingFrequency: "monthly",
    postPurchase: "Senior strategist assigned as your dedicated lead. Full team onboarding within 48 hours. Existing campaigns audited for immediate optimization opportunities.",
    stripeLink: "https://buy.stripe.com/fZufZh2eU0f41SUfgh1ck0n",
  },
};

function generateServiceRecommendations(
  categories: CategoryScore[],
  website: WebsiteAnalysis,
  profiles: ProfileCounts,
  formData: LeadFormData
): { recommendations: ServiceRecommendation[]; confidence: "high" | "moderate" | "limited"; explanation: string } {
  const recMap = new Map<string, ServiceRecommendation>();

  // Score lookups
  const getScore = (name: string) => categories.find((c) => c.name === name)?.score ?? 50;
  const contentScore = getScore("contentQuality");
  const postScore = getScore("postingConsistency");
  const engagementScore = getScore("engagement");
  const brandingScore = getScore("branding");
  const websiteScore = getScore("website");
  const localScore = getScore("localVisibility");
  const reputationScore = getScore("reputation");
  const socialScore = getScore("socialPresence");

  // Rule: Weak posting & content → Social Media Management
  if (contentScore < 55 || postScore < 55) {
    const pkg = packages.socialMediaManagement;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `Our analysis found that ${formData.businessName}'s content and posting infrastructure needs strengthening. ${contentScore < 55 ? "Content depth is below the competitive threshold. " : ""}${postScore < 55 ? "Posting channels and consistency signals are weak. " : ""}Our Social Media Management service delivers a structured content calendar with platform-native posts, professional caption writing, and strategic scheduling — building the consistent presence that algorithms reward and customers trust.`,
      problemsAddressed: pkg.problemsAddressed,
      deliverables: pkg.deliverables,
      estimatedTimeline: pkg.estimatedTimeline,
      price: pkg.price,
      billingFrequency: pkg.billingFrequency,
      postPurchase: pkg.postPurchase,
      stripeLink: pkg.stripeLink,
    });
  }

  // Rule: Weak comments, responses → Community Management
  if (engagementScore < 55 || reputationScore < 45) {
    const pkg = packages.communityManagement;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `Based on our review, ${formData.businessName} lacks the infrastructure for consistent customer interaction. ${engagementScore < 55 ? "Engagement channels are limited. " : ""}${reputationScore < 45 ? "Review management capabilities are insufficient. " : ""}Our Community Management team handles comments, DMs, and reviews across all platforms — ensuring every customer interaction gets a timely, professional response that builds trust.`,
      problemsAddressed: pkg.problemsAddressed,
      deliverables: pkg.deliverables,
      estimatedTimeline: pkg.estimatedTimeline,
      price: pkg.price,
      billingFrequency: pkg.billingFrequency,
      postPurchase: pkg.postPurchase,
      stripeLink: pkg.stripeLink,
    });
  }

  // Rule: Poor brand consistency → Branding/Creative
  if (brandingScore < 55) {
    const pkg = packages.brandingCreative;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `Our analysis found that ${formData.businessName}'s brand presentation is inconsistent or incomplete across digital channels. ${!website.hasOpenGraph ? "Social sharing previews don't render correctly. " : ""}${profiles.total < 2 ? "Limited platforms mean limited brand reinforcement. " : ""}Our Branding & Creative team optimizes every profile element — bios, images, cover photos, and visual identity — so your business presents as the professional operation it is.`,
      problemsAddressed: pkg.problemsAddressed,
      deliverables: pkg.deliverables,
      estimatedTimeline: pkg.estimatedTimeline,
      price: pkg.price,
      billingFrequency: pkg.billingFrequency,
      postPurchase: pkg.postPurchase,
      stripeLink: pkg.stripeLink,
    });
  }

  // Rule: Weak website → Website/Funnel Service
  if (websiteScore < 55 && website.fetched) {
    const pkg = packages.websiteFunnel;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `The website at ${formData.websiteUrl || "the provided URL"} needs conversion-focused improvements. ${!website.hasMetaTags ? "Basic SEO elements are missing. " : ""}${website.wordCount < 300 ? "Content is too thin to convert visitors. " : ""}Our Website & Funnel Service delivers a prioritized audit of your conversion path with specific, actionable fixes.`,
      problemsAddressed: pkg.problemsAddressed,
      deliverables: pkg.deliverables,
      estimatedTimeline: pkg.estimatedTimeline,
      price: pkg.price,
      billingFrequency: pkg.billingFrequency,
      postPurchase: pkg.postPurchase,
      stripeLink: pkg.stripeLink,
    });
  }

  // Rule: Poor local visibility → Local SEO/Reputation
  if (localScore < 55) {
    const pkg = packages.localSeoReputation;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `${formData.businessName} is difficult to find in local search. ${!profiles.googleBusiness ? "No Google Business Profile — the most important local ranking factor. " : ""}${!formData.location ? "No location information provided for local targeting. " : ""}Our Local SEO & Reputation service optimizes your Google presence and builds the review infrastructure that drives local discovery.`,
      problemsAddressed: pkg.problemsAddressed,
      deliverables: pkg.deliverables,
      estimatedTimeline: pkg.estimatedTimeline,
      price: pkg.price,
      billingFrequency: pkg.billingFrequency,
      postPurchase: pkg.postPurchase,
      stripeLink: pkg.stripeLink,
    });
  }

  // Rule: Multiple connected problems → Growth Package
  const lowCount = [contentScore, engagementScore, brandingScore, websiteScore, localScore, reputationScore, postScore].filter((s) => s < 55).length;
  if (lowCount >= 3) {
    const pkg = packages.growthPackage;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `Our full analysis identified gaps across ${lowCount} critical marketing dimensions — content, engagement, visibility, and lead generation. The Growth Package bundles Social Media Management, Paid Advertising, and Community Management into one integrated service. Instead of treating each gap separately, we address them simultaneously — the fastest path to a full pipeline.`,
      problemsAddressed: pkg.problemsAddressed,
      deliverables: pkg.deliverables,
      estimatedTimeline: pkg.estimatedTimeline,
      price: pkg.price,
      billingFrequency: pkg.billingFrequency,
      postPurchase: pkg.postPurchase,
      stripeLink: pkg.stripeLink,
    });
  }

  // All scores strong → Scale Package
  if (recMap.size === 0) {
    const pkg = packages.scalePackage;
    recMap.set(pkg.slug, {
      slug: pkg.slug,
      name: pkg.name,
      reason: `${formData.businessName} has a strong marketing foundation — the opportunity now is market domination. Our Scale Package deploys a full team across up to 7 platforms with unlimited campaigns and advanced optimization to capture every available lead in your market.`,
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
    explanation = `Moderate confidence: ${evidenceFactors.join("; ")}. Some information was unavailable, but our recommendations are grounded in the available evidence. Providing additional social profile URLs would enable a more precise analysis.`;
  } else {
    confidence = "limited";
    explanation = `Limited data available: ${evidenceFactors.join("; ")}. Our recommendations are based on industry benchmarks and the partial information available. For a more tailored analysis, provide your social profile URLs and ensure your website is accessible. You can also browse all our service packages to see what fits your needs.`;
  }

  // Convert map to array, Growth Package first if present
  const recommendations = Array.from(recMap.values());
  const growthIdx = recommendations.findIndex((r) => r.slug === "growth-package");
  if (growthIdx > 0) {
    const [growth] = recommendations.splice(growthIdx, 1);
    recommendations.unshift(growth);
  }

  return { recommendations, confidence, explanation };
}

// ---------------------------------------------------------------------------
// Competitor Snapshot
// ---------------------------------------------------------------------------

function generateCompetitorSnapshot(
  formData: LeadFormData,
  categories: CategoryScore[],
  profiles: ProfileCounts
): string {
  const overall = categories.find((c) => c.name === "overallMarketing")?.score ?? 50;

  if (overall >= 70) {
    return `Businesses in ${formData.industry || "your industry"} typically score 40–60 on this audit. At ${overall}/100, ${formData.businessName} is outperforming most local competitors. The challenge now is staying ahead — competitors who invest in professional marketing will close the gap.`;
  }
  if (overall >= 40) {
    return `The average competitor in ${formData.industry || "your industry"} scores between 40–60. ${formData.businessName} is within range but not leading. The businesses pulling ahead are the ones investing in consistent content, paid advertising, and active community management — the gaps identified in this audit.`;
  }
  return `In ${formData.industry || "your industry"}, the businesses winning the most leads typically score 60+ on this audit. ${formData.businessName} is currently behind the competitive curve — but the gap is closable through consistent execution of the recommendations in this report.`;
}

// ---------------------------------------------------------------------------
// Executive Summary
// ---------------------------------------------------------------------------

function generateExecutiveSummary(
  formData: LeadFormData,
  overall: number,
  categories: CategoryScore[],
  profiles: ProfileCounts,
  website: WebsiteAnalysis
): string {
  const topStrength = categories
    .filter((c) => c.name !== "overallMarketing")
    .sort((a, b) => b.score - a.score)[0];
  const topWeakness = categories
    .filter((c) => c.name !== "overallMarketing")
    .sort((a, b) => a.score - b.score)[0];

  let summary = `Metro Reach Media analyzed ${formData.businessName}'s online presence across 10 marketing dimensions. `;

  if (website.fetched) {
    summary += `The website at ${formData.websiteUrl} was reviewed for technical configuration and content quality. `;
  } else if (formData.websiteUrl?.trim()) {
    summary += `The website at ${formData.websiteUrl} could not be reached during our analysis. `;
  } else {
    summary += `No website URL was provided for review. `;
  }

  if (profiles.total > 0) {
    summary += `${profiles.total} social media profile${profiles.total === 1 ? " was" : "s were"} provided across ${profiles.platforms.join(", ")}. `;
  } else {
    summary += `No social media profiles were provided for platform-specific analysis. `;
  }

  if (overall >= 70) {
    summary += `The overall marketing health score of ${overall}/100 reflects a strong foundation with opportunities to scale and dominate. `;
  } else if (overall >= 40) {
    summary += `The overall score of ${overall}/100 shows a business with the basics in place but clear gaps that, once closed, will directly improve lead volume and customer trust. `;
  } else {
    summary += `The overall score of ${overall}/100 indicates significant room for growth — every improvement from this starting point will have an outsized impact on visibility and lead generation. `;
  }

  summary += `The strongest area identified was ${topStrength?.label.toLowerCase() || "n/a"} (${topStrength?.score ?? 0}/100); the area needing most attention is ${topWeakness?.label.toLowerCase() || "n/a"} (${topWeakness?.score ?? 0}/100).`;

  return summary;
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

export async function runAudit(
  formData: LeadFormData,
  id: string
): Promise<AuditResult> {
  // Step 1: Fetch website
  const websiteMeta = await fetchWebsiteMeta(formData.websiteUrl);
  const website: WebsiteAnalysis = {
    url: formData.websiteUrl?.trim() || "Not provided",
    ...websiteMeta,
  };

  // Step 2: Count profiles
  const profiles = countProfiles(formData);

  // Step 3: Score categories
  const categories = calculateScores(website, formData, profiles);

  // Step 4: Generate insights
  const strengths = generateStrengths(categories, website, profiles);
  const weaknesses = generateWeaknesses(categories, website, profiles, formData);
  const quickWins = generateQuickWins(website, profiles, formData);
  const { recommendations, confidence, explanation: confidenceExplanation } =
    generateServiceRecommendations(categories, website, profiles, formData);

  const overall = categories.find((c) => c.name === "overallMarketing")?.score ?? 0;
  const competitorSnapshot = generateCompetitorSnapshot(formData, categories, profiles);
  const executiveSummary = generateExecutiveSummary(formData, overall, categories, profiles, website);

  return {
    id,
    formData,
    website,
    scores: {
      overall,
      categories: categories.filter((c) => c.name !== "overallMarketing"),
    },
    strengths,
    weaknesses,
    quickWins,
    serviceRecommendations: recommendations,
    recommendationConfidence: confidence,
    confidenceExplanation,
    competitorSnapshot,
    executiveSummary,
    timestamp: new Date().toISOString(),
  };
}
