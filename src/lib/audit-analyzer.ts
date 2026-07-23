/**
 * Free Social Media Audit — Analysis Engine
 * MetroReach Digital
 *
 * Fetches live website data, scores across 7 categories,
 * generates strengths, weaknesses, quick wins, and service recommendations.
 * Zero AI/automation language — positioned as human analyst work.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditFormData {
  businessName: string;
  websiteUrl: string;
  industry: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  linkedinUrl: string;
  email: string;
  goals: string;
}

export interface WebsiteAnalysis {
  url: string;
  fetched: boolean;
  title: string | null;
  description: string | null;
  hasHttps: boolean;
  hasMetaTags: boolean;
  hasOpenGraph: boolean;
  wordCount: number;
  observation: string;
}

export interface CategoryScore {
  name: string;
  score: number; // 0-100
  label: string;
  observation: string;
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
  reason: string;
  whatIsWrong: string;
  whyItMatters: string;
  whichService: string;
  estimatedTimeline: string;
  monthlyInvestment: string;
}

export interface AuditResult {
  id: string;
  formData: AuditFormData;
  website: WebsiteAnalysis;
  scores: {
    overall: number;
    categories: CategoryScore[];
  };
  strengths: string[];
  weaknesses: string[];
  quickWins: QuickWin[];
  serviceRecommendations: ServiceRecommendation[];
  competitorSnapshot: string;
  estimatedGrowthPotential: string;
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
}> {
  const result = {
    title: null as string | null,
    description: null as string | null,
    hasHttps: false,
    hasMetaTags: false,
    hasOpenGraph: false,
    wordCount: 0,
    fetched: false,
  };

  if (!url) return result;

  // Ensure URL has protocol
  let fetchUrl = url.trim();
  if (!fetchUrl.startsWith("http://") && !fetchUrl.startsWith("https://")) {
    fetchUrl = "https://" + fetchUrl;
  }

  result.hasHttps = fetchUrl.startsWith("https://");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MetroReachAudit/1.0; +https://metroreachagency.com)",
        Accept: "text/html",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) return result;

    const html = await res.text();
    result.fetched = true;

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      result.title = titleMatch[1].trim();
    }

    // Extract meta description
    const descMatch = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
    );
    if (descMatch) {
      result.description = descMatch[1].trim();
      result.hasMetaTags = true;
    }

    // Check for Open Graph tags
    if (
      html.includes("og:title") ||
      html.includes("og:description") ||
      html.includes("og:image")
    ) {
      result.hasOpenGraph = true;
    }

    // Rough word count from body text (strip tags)
    const bodyText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    result.wordCount = bodyText.split(/\s+/).length;

    // If we found title but not description via meta tag, try og:description
    if (!result.description) {
      const ogDescMatch = html.match(
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i
      );
      if (ogDescMatch) {
        result.description = ogDescMatch[1].trim();
      }
    }
  } catch {
    // Fetch failed — return default empty result
  }

  return result;
}

// ---------------------------------------------------------------------------
// Scoring Engine
// ---------------------------------------------------------------------------

function calculateScores(
  website: WebsiteAnalysis,
  formData: AuditFormData
): CategoryScore[] {
  const categories: CategoryScore[] = [];
  const hasSocials = !!(
    formData.facebookUrl ||
    formData.instagramUrl ||
    formData.tiktokUrl ||
    formData.linkedinUrl
  );

  // 1. Overall Marketing (0-100)
  let overallMarketing = 0;
  if (website.fetched) overallMarketing += 20;
  if (website.hasMetaTags) overallMarketing += 15;
  if (website.hasOpenGraph) overallMarketing += 10;
  if (website.title) overallMarketing += 10;
  if (website.description) overallMarketing += 10;
  if (hasSocials) overallMarketing += 20;
  if (website.hasHttps) overallMarketing += 10;
  if (website.wordCount > 300) overallMarketing += 5;
  overallMarketing = Math.min(100, overallMarketing);

  categories.push({
    name: "overallMarketing",
    score: overallMarketing,
    label: "Overall Marketing",
    observation: buildOverallMarketingObs(website, formData, overallMarketing),
  });

  // 2. Social Media Health (0-100)
  let socialHealth = 0;
  const socialCount = [
    formData.facebookUrl,
    formData.instagramUrl,
    formData.tiktokUrl,
    formData.linkedinUrl,
  ].filter(Boolean).length;
  socialHealth += socialCount * 20; // 20 per platform
  if (formData.facebookUrl) socialHealth += 10; // FB bonus for local biz
  if (formData.instagramUrl) socialHealth += 10; // IG bonus for visual
  socialHealth = Math.min(100, socialHealth);

  categories.push({
    name: "socialMediaHealth",
    score: socialHealth,
    label: "Social Media Health",
    observation: buildSocialHealthObs(formData, socialCount, socialHealth),
  });

  // 3. Branding (0-100)
  let branding = 0;
  if (website.fetched) branding += 20;
  if (website.title) branding += 20;
  if (website.description) branding += 15;
  if (website.hasOpenGraph) branding += 15;
  if (website.wordCount > 200) branding += 10;
  if (formData.businessName.length > 2) branding += 10;
  if (hasSocials) branding += 10;
  branding = Math.min(100, branding);

  categories.push({
    name: "branding",
    score: branding,
    label: "Branding",
    observation: buildBrandingObs(website, formData, branding),
  });

  // 4. Content Quality (0-100)
  let contentQuality = 0;
  if (website.fetched) contentQuality += 15;
  if (website.description) contentQuality += 20;
  if (website.title) contentQuality += 15;
  if (website.wordCount > 500) contentQuality += 20;
  else if (website.wordCount > 200) contentQuality += 10;
  if (website.hasOpenGraph) contentQuality += 15;
  if (hasSocials) contentQuality += 15;
  contentQuality = Math.min(100, contentQuality);

  categories.push({
    name: "contentQuality",
    score: contentQuality,
    label: "Content Quality",
    observation: buildContentQualityObs(website, formData, contentQuality),
  });

  // 5. Engagement (0-100)
  let engagement = 0;
  // Estimation based on signals
  if (hasSocials) engagement += 30;
  if (formData.facebookUrl) engagement += 15;
  if (formData.instagramUrl) engagement += 15;
  if (formData.tiktokUrl) engagement += 10;
  if (website.fetched && website.wordCount > 300) engagement += 15;
  if (formData.goals && formData.goals.length > 20) engagement += 15;
  engagement = Math.min(100, engagement);

  categories.push({
    name: "engagement",
    score: engagement,
    label: "Engagement",
    observation: buildEngagementObs(formData, engagement),
  });

  // 6. Website (0-100)
  let websiteScore = 0;
  if (website.fetched) websiteScore += 25;
  if (website.hasHttps) websiteScore += 20;
  if (website.title) websiteScore += 15;
  if (website.description) websiteScore += 15;
  if (website.hasMetaTags) websiteScore += 10;
  if (website.hasOpenGraph) websiteScore += 10;
  if (website.wordCount > 500) websiteScore += 5;
  websiteScore = Math.min(100, websiteScore);

  categories.push({
    name: "website",
    score: websiteScore,
    label: "Website",
    observation: buildWebsiteObs(website, websiteScore),
  });

  // 7. Local Visibility (0-100)
  let localVisibility = 0;
  if (formData.facebookUrl) localVisibility += 25; // FB is key for local
  if (website.fetched) localVisibility += 20;
  if (website.description) localVisibility += 15;
  if (formData.industry && formData.industry !== "Other") localVisibility += 15;
  if (formData.instagramUrl) localVisibility += 10;
  if (website.hasOpenGraph) localVisibility += 10;
  if (website.wordCount > 300) localVisibility += 5;
  localVisibility = Math.min(100, localVisibility);

  categories.push({
    name: "localVisibility",
    score: localVisibility,
    label: "Local Visibility",
    observation: buildLocalVisObs(formData, website, localVisibility),
  });

  return categories;
}

// ---------------------------------------------------------------------------
// Observation builders
// ---------------------------------------------------------------------------

function buildOverallMarketingObs(
  website: WebsiteAnalysis,
  formData: AuditFormData,
  score: number
): string {
  if (score >= 70) {
    return `${formData.businessName} has a solid marketing foundation. Your website is discoverable${website.title ? ` ("${website.title.slice(0, 60)}")` : ""} and you're present across multiple channels. The opportunity now is to refine and scale — moving from "present" to "dominant."`;
  }
  if (score >= 40) {
    const gaps: string[] = [];
    if (!website.fetched) gaps.push("website couldn't be reached for analysis");
    if (!website.hasMetaTags) gaps.push("website is missing basic SEO meta tags");
    if (!website.description) gaps.push("no meta description found");
    if (!formData.facebookUrl && !formData.instagramUrl) gaps.push("no social media profiles provided");
    return `${formData.businessName} has some pieces in place but there are clear gaps holding you back: ${gaps.join("; ")}. These are fixable — and each one represents leads you're currently leaving on the table.`;
  }
  const gaps: string[] = [];
  if (!website.fetched) gaps.push("website isn't accessible or doesn't exist");
  if (!website.hasHttps) gaps.push("website lacks HTTPS security");
  if (!formData.facebookUrl && !formData.instagramUrl) gaps.push("zero social media presence detected");
  return `${formData.businessName} is starting from a low baseline. ${gaps.join(". ")}. The good news: every improvement from here translates directly to more visibility, trust, and leads. There's nowhere to go but up.`;
}

function buildSocialHealthObs(
  formData: AuditFormData,
  socialCount: number,
  score: number
): string {
  if (score >= 70) {
    return `${formData.businessName} is active on ${socialCount} platform${socialCount === 1 ? "" : "s"}. This multi-platform presence gives you multiple touchpoints with potential customers — a strong position that most local businesses haven't achieved.`;
  }
  if (score >= 40) {
    return `${formData.businessName} is present on ${socialCount} platform${socialCount === 1 ? "" : "s"}. There's room to grow — businesses in your industry that maintain 3+ active platforms typically see 2x the lead volume of single-platform competitors.`;
  }
  return `${formData.businessName} has limited (or no) social media presence${
    socialCount > 0 ? ` on just ${socialCount} platform${socialCount === 1 ? "" : "s"}` : ""
  }. Your competitors are capturing the attention and trust of local customers on these platforms every day. Every month without an active social presence is a month of leads you don't get back.`;
}

function buildBrandingObs(
  website: WebsiteAnalysis,
  formData: AuditFormData,
  score: number
): string {
  if (score >= 70) {
    return `${formData.businessName} presents a consistent brand online. Your website has clear metadata${
      website.title ? ` (title: "${website.title.slice(0, 50)}")` : ""
    }, Open Graph tags for social sharing, and a professional foundation. This consistency builds trust with every visitor.`;
  }
  if (score >= 40) {
    const issues: string[] = [];
    if (!website.title) issues.push("no page title found");
    if (!website.description) issues.push("no meta description — search results show whatever Google grabs from your page");
    if (!website.hasOpenGraph) issues.push("no Open Graph tags — when someone shares your site on social media, the preview looks broken");
    return `${formData.businessName}'s branding has gaps: ${issues.join("; ")}. These invisible details determine whether a potential customer clicks through or scrolls past.`;
  }
  return `${formData.businessName}'s brand is mostly invisible online. Without a website with proper metadata, title tags, and social sharing configuration, your business doesn't look established — even if you've been operating for years. First impressions happen in milliseconds online.`;
}

function buildContentQualityObs(
  website: WebsiteAnalysis,
  formData: AuditFormData,
  score: number
): string {
  if (score >= 70) {
    return `${formData.businessName}'s content foundation is strong. Your website has substantive content${
      website.wordCount > 300 ? ` (approximately ${website.wordCount.toLocaleString()} words)` : ""
    } and proper metadata. This provides a solid base for social content, ad landing pages, and SEO visibility.`;
  }
  if (score >= 40) {
    return `${formData.businessName} has content online, but it's thin. With approximately ${website.wordCount} words across your website, there's not enough substance for search engines to understand what you do — or for customers to feel confident choosing you. Content isn't just words on a page; it's your digital sales team working 24/7.`;
  }
  return `${formData.businessName} has minimal content online. This is one of the fastest ways to lose a potential customer — they land on your site, find almost nothing, and bounce to a competitor who tells a better story. Content builds trust. Right now, your content isn't doing that.`;
}

function buildEngagementObs(
  formData: AuditFormData,
  score: number
): string {
  if (score >= 70) {
    return `${formData.businessName} has the infrastructure for strong engagement — active social profiles and a website that gives visitors something to interact with. The next level is systematic engagement: responding to every comment, DM, and review within hours, not days.`;
  }
  if (score >= 40) {
    return `${formData.businessName} has the basics for engagement but isn't maximizing them. Engagement isn't just about having profiles — it's about active, daily interaction with your audience. Unanswered comments and DMs tell customers their input doesn't matter.`;
  }
  return `${
    formData.businessName
  } has minimal engagement infrastructure. Without active social profiles and a content-rich website, there's nothing for potential customers to engage with. Engagement starts with having something worth responding to — and right now, that foundation is missing.`;
}

function buildWebsiteObs(
  website: WebsiteAnalysis,
  score: number
): string {
  if (!website.fetched) {
    return `We attempted to analyze ${website.url} but were unable to reach the site. This could mean the site is down, the URL is incorrect, or there's a configuration issue. If your website isn't accessible to potential customers, every marketing dollar you spend is wasted — they'll land on an error instead of your business.`;
  }
  if (score >= 70) {
    return `Your website at ${website.url} is in good shape. It's accessible over HTTPS, has proper metadata${
      website.title ? `, a clear title ("${website.title.slice(0, 60)}")` : ""
    }, and appears well-configured. This is your digital storefront — and it's making a solid first impression.`;
  }
  if (score >= 40) {
    const issues: string[] = [];
    if (!website.hasHttps) issues.push("not using HTTPS (browsers flag this as 'Not Secure')");
    if (!website.description) issues.push("missing meta description");
    if (!website.hasOpenGraph) issues.push("no social sharing preview configured");
    return `Your website at ${website.url} needs attention: ${issues.join("; ")}. These are technical issues that directly impact whether visitors trust your business and whether search engines rank your site.`;
  }
  return `Your website at ${website.url} needs significant work. It's missing basic elements that customers and search engines expect: proper metadata, a clear description of your services, and shareable content. Your website is often the first impression — right now, it's not working for you.`;
}

function buildLocalVisObs(
  formData: AuditFormData,
  website: WebsiteAnalysis,
  score: number
): string {
  if (score >= 70) {
    return `${formData.businessName} has a strong local visibility foundation — active social profiles on platforms that matter for local discovery, and a website that supports local search. Your potential customers can find you, which is the first and hardest step.`;
  }
  if (score >= 40) {
    return `${formData.businessName} has some local visibility but significant gaps. Businesses in ${
      formData.industry || "your industry"
    } rely on local discovery — customers searching "near me" on Google, Facebook, and Instagram. If you're not fully present on these platforms, you're invisible to the people actively looking for what you offer.`;
  }
  return `${formData.businessName} is difficult to find online locally. Without active social profiles (especially Facebook — the #1 platform for local service discovery) and a properly configured website, you're essentially invisible to local customers searching for ${
    formData.industry || "your services"
  }. Every day this continues, you lose leads to competitors who show up first.`;
}

// ---------------------------------------------------------------------------
// Strengths & Weaknesses Generator
// ---------------------------------------------------------------------------

function generateStrengths(
  categories: CategoryScore[],
  website: WebsiteAnalysis,
  formData: AuditFormData
): string[] {
  const strengths: string[] = [];

  for (const cat of categories) {
    if (cat.score >= 70) {
      if (cat.name === "overallMarketing") {
        strengths.push(
          `Your overall marketing foundation is solid — you've built the basics most businesses skip, which puts you ahead of the majority of your competitors.`
        );
      }
      if (cat.name === "website" && website.fetched) {
        strengths.push(
          `Your website is accessible and properly configured — this is your 24/7 salesperson, and it's showing up for work.`
        );
      }
      if (cat.name === "socialMediaHealth") {
        strengths.push(
          `You're maintaining an active presence across multiple social platforms — your customers can find and interact with your brand wherever they spend their time.`
        );
      }
    }
  }

  if (website.hasHttps && website.fetched) {
    strengths.push(
      `Your website uses HTTPS encryption — this is a trust signal that customers notice and search engines reward.`
    );
  }

  if (website.hasOpenGraph) {
    strengths.push(
      `Your website has Open Graph tags configured — when your content is shared on social media, it renders professionally with images and descriptions intact.`
    );
  }

  if (strengths.length === 0) {
    if (formData.businessName) {
      strengths.push(
        `You're taking the first and most important step: seeking a professional assessment of your marketing. Awareness is the foundation of every turnaround.`
      );
    }
    strengths.push(
      `As a ${formData.industry || "service business"}, you operate in an industry where local trust and reputation drive purchasing decisions — a strong marketing presence compounds over time.`
    );
  }

  return strengths.slice(0, 4);
}

function generateWeaknesses(
  categories: CategoryScore[],
  website: WebsiteAnalysis,
  formData: AuditFormData
): string[] {
  const weaknesses: string[] = [];

  for (const cat of categories) {
    if (cat.score <= 40) {
      if (cat.name === "website") {
        weaknesses.push(
          `Your website is underperforming — ${
            !website.fetched
              ? "it couldn't be reached during our analysis"
              : "it's missing key elements like meta descriptions and social sharing tags"
          }. This is costing you search visibility and customer trust.`
        );
      }
      if (cat.name === "socialMediaHealth") {
        weaknesses.push(
          `Your social media presence is thin — with limited or no active profiles, you're invisible on the platforms where your customers spend hours every day researching businesses like yours.`
        );
      }
      if (cat.name === "branding") {
        weaknesses.push(
          `Your brand presentation is inconsistent or incomplete online. Customers who find you on different platforms may not recognize you as the same business — fragmenting the trust you've worked to build.`
        );
      }
      if (cat.name === "contentQuality") {
        weaknesses.push(
          `Your online content is too thin to compete. Search engines and customers both reward depth and substance — right now, your content isn't providing enough of either.`
        );
      }
      if (cat.name === "engagement") {
        weaknesses.push(
          `Your engagement infrastructure is weak. Without active social profiles to interact with customers and a content-rich website to engage visitors, you're missing the daily interactions that build loyalty and referrals.`
        );
      }
      if (cat.name === "localVisibility") {
        weaknesses.push(
          `Your local visibility is low. When potential customers in your area search for ${
            formData.industry || "services like yours"
          }, they're finding your competitors — not you.`
        );
      }
    }
  }

  if (!website.hasHttps && website.fetched) {
    weaknesses.push(
      `Your website doesn't use HTTPS. Modern browsers flag non-HTTPS sites as "Not Secure," which immediately erodes trust with visitors.`
    );
  }

  if (weaknesses.length === 0) {
    weaknesses.push(
      `While your foundation is solid, the platforms change constantly. Staying ahead requires continuous optimization — what works today may not work six months from now.`
    );
  }

  return weaknesses.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Quick Wins Generator
// ---------------------------------------------------------------------------

function generateQuickWins(
  categories: CategoryScore[],
  website: WebsiteAnalysis,
  formData: AuditFormData
): QuickWin[] {
  const wins: QuickWin[] = [];

  // Website-related quick wins
  if (!website.hasHttps && website.fetched) {
    wins.push({
      issue: "Your website lacks HTTPS security.",
      fix: "Contact your hosting provider and enable SSL/HTTPS. Most hosts offer this free through Let's Encrypt. Takes one phone call or support ticket.",
      timeEstimate: "1–2 days",
      impactLevel: "High",
    });
  }

  if (!website.description && website.fetched) {
    wins.push({
      issue: "Your website is missing a meta description — search engines display whatever text they find, often out of context.",
      fix: `Add a meta description to your homepage: a 1–2 sentence summary of what ${formData.businessName} does, who you serve, and your location. Example: "${formData.businessName} provides professional ${formData.industry || "services"} in [city]. Licensed, insured, and trusted since [year]. Call or book online."`,
      timeEstimate: "15 min",
      impactLevel: "High",
    });
  }

  if (!website.hasOpenGraph && website.fetched) {
    wins.push({
      issue: "Your website doesn't have Open Graph tags — when someone shares your site on Facebook or LinkedIn, the preview looks broken or blank.",
      fix: "Add basic Open Graph tags (og:title, og:description, og:image) to your homepage. If you use WordPress, install Yoast SEO. If your site is custom, your developer can add the tags in 30 minutes.",
      timeEstimate: "30 min",
      impactLevel: "Medium",
    });
  }

  // Social media quick wins
  if (!formData.facebookUrl && !formData.instagramUrl) {
    wins.push({
      issue: "No social media profiles provided — your business is invisible on the platforms where local customers search for services.",
      fix: "Create a Facebook Business Page for your business today. Add your logo, cover photo, business hours, services, and contact info. This alone puts you ahead of businesses that haven't taken this step.",
      timeEstimate: "30 min",
      impactLevel: "High",
    });
  }

  if (formData.facebookUrl && !formData.instagramUrl) {
    wins.push({
      issue: "You're on Facebook but missing Instagram — Instagram has higher engagement rates and is the #1 platform for visual industries.",
      fix: "Create an Instagram Business account connected to your Facebook Page. Post 3 photos of your work, team, or location this week. Instagram's audience overlaps with Facebook but the engagement is typically 3–5x higher.",
      timeEstimate: "20 min",
      impactLevel: "High",
    });
  }

  // Branding quick win
  if (website.fetched && website.title && website.title.length < 15) {
    wins.push({
      issue: `Your website title ("${website.title}") is too short for search engines to understand what you do.`,
      fix: `Expand your page title to include your primary service and location. Format: "${formData.businessName} — [Service] in [City] | [One Benefit]". Example: "${formData.businessName} — ${formData.industry || "Professional Services"} in [City] | Free Estimates."`,
      timeEstimate: "10 min",
      impactLevel: "High",
    });
  }

  return wins.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Service Recommendation Engine
// ---------------------------------------------------------------------------

function generateServiceRecommendations(
  categories: CategoryScore[],
  formData: AuditFormData
): ServiceRecommendation[] {
  const recommendations: ServiceRecommendation[] = [];

  const contentScore = categories.find((c) => c.name === "contentQuality")?.score ?? 0;
  const engagementScore = categories.find((c) => c.name === "engagement")?.score ?? 0;
  const socialScore = categories.find((c) => c.name === "socialMediaHealth")?.score ?? 0;
  const websiteScore = categories.find((c) => c.name === "website")?.score ?? 0;
  const localScore = categories.find((c) => c.name === "localVisibility")?.score ?? 0;

  // Rule: low engagement → Community Management
  if (engagementScore < 50) {
    recommendations.push({
      slug: "community-management",
      name: "Community Management",
      reason: `Based on our review, ${formData.businessName} is missing the daily interactions that build trust and loyalty. Our Community Management team handles comments, DMs, and reviews across all your platforms — ensuring every customer interaction gets a timely, professional response.`,
      whatIsWrong: "Customer comments, messages, and reviews are going unanswered or unmanaged — each one is a missed opportunity to build trust and convert interest into business.",
      whyItMatters: "Customers who receive a response within an hour are 3x more likely to become paying clients. Unanswered interactions signal neglect and send prospects to competitors.",
      whichService: "Community Management Bundle — daily engagement, comment/DM response, and review management across all platforms.",
      estimatedTimeline: "Immediate impact — engagement begins day one. Noticeable improvement in customer sentiment within 2–4 weeks.",
      monthlyInvestment: "From $1,200/month",
    });
  }

  // Rule: low content quality → Organic Content Management
  if (contentScore < 50) {
    recommendations.push({
      slug: "organic-content-management",
      name: "Organic Content Management",
      reason: `Our analysis found that ${formData.businessName}'s online content is too thin to compete effectively. Our Organic Content Management service delivers platform-native content — planned, written, and published on a consistent schedule that builds authority and trust.`,
      whatIsWrong: "Your website and social content lack the depth, consistency, and strategic structure needed to attract search traffic, engage visitors, and convert browsers into leads.",
      whyItMatters: "Content is your digital sales team. Thin content = few leads. Rich, consistent content builds the trust that turns a first-time visitor into a long-term customer.",
      whichService: "Organic Content Management — custom content calendar, platform-native posts, caption writing, and brand voice development.",
      estimatedTimeline: "Content calendar live within week one. Organic momentum builds over 60–90 days as algorithms reward consistency.",
      monthlyInvestment: "From $1,500/month (Starter) to $5,500/month (Scale)",
    });
  }

  // Rule: low social presence / website → Paid Advertising for lead gen
  if (socialScore < 50 || websiteScore < 50 || localScore < 50) {
    recommendations.push({
      slug: "paid-advertising",
      name: "Paid Advertising Management",
      reason: `${formData.businessName} needs to generate leads now — not wait months for organic growth. Our Paid Advertising service launches targeted campaigns on Meta, Google, TikTok, and LinkedIn to put your business in front of local customers actively searching for what you offer.`,
      whatIsWrong: "Your organic visibility is too low to generate consistent leads. Without paid advertising, you're relying entirely on word-of-mouth and chance discovery — leaving pipeline gaps your competitors are filling.",
      whyItMatters: "Paid ads are the fastest path to a full pipeline. While organic presence builds, paid campaigns generate qualified leads immediately — often within 48 hours of launch.",
      whichService: "Paid Advertising Management — campaign strategy, ad creative, continuous optimization, and live performance dashboards across Meta, Google, TikTok, and LinkedIn.",
      estimatedTimeline: "Campaigns launch within 5–7 business days. Targeting dialed in by week 2–3. Target CPL typically reached by end of month one.",
      monthlyInvestment: "From $1,000/month + 10% of managed ad spend",
    });
  }

  // Multiple issues → Growth Package (bundle)
  const lowScores = [contentScore, engagementScore, socialScore, websiteScore, localScore].filter(
    (s) => s < 50
  ).length;

  if (lowScores >= 3) {
    recommendations.push({
      slug: "growth-package",
      name: "Growth Package (Bundle)",
      reason: `Our full analysis of ${formData.businessName} identified gaps across ${lowScores} critical marketing dimensions — content, engagement, visibility, and lead generation. The Growth Package bundles Organic Content Management, Paid Advertising, and Community Management into one integrated service with a dedicated team.`,
      whatIsWrong: `Multiple dimensions of your marketing are underperforming simultaneously — ${lowScores} out of 7 key areas scored below 50. Treating one area while ignoring the others won't move the needle.`,
      whyItMatters: "Marketing dimensions are interconnected. Better content without engagement wastes the content. Paid ads without a strong website wastes the ad spend. The Growth Package addresses all gaps simultaneously — the fastest path to a full pipeline.",
      whichService: "Growth Package — 4 platforms (organic + paid on 2), 20 posts/month, 3 paid campaigns, community engagement, weekly reporting, and live dashboard.",
      estimatedTimeline: "Full implementation within 2 weeks. Paid campaigns generating leads within week one. Organic momentum building by month two. Pipeline transformation typically visible by month three.",
      monthlyInvestment: "$3,000/month",
    });
  }

  // If no recommendations (scores all good)
  if (recommendations.length === 0) {
    recommendations.push({
      slug: "scale-package",
      name: "Scale Package",
      reason: `${formData.businessName} has a strong foundation — the opportunity now is to dominate your market. Our Scale Package deploys a full marketing team across up to 7 platforms, with unlimited campaigns and advanced optimization to capture every available lead in your market.`,
      whatIsWrong: "You're doing well — but your competitors are working to catch up. The businesses that dominate their markets are the ones that accelerate when they're ahead, not the ones that coast.",
      whyItMatters: "Market leadership compounds. Every month you're the dominant presence in local search and social, you capture more of the market — and make it harder for competitors to catch up.",
      whichService: "Scale Package — up to 7 platforms, 30+ posts/month, unlimited paid campaigns, advanced A/B testing, video scripts, bi-weekly strategy calls, and custom reporting.",
      estimatedTimeline: "Immediate amplification of existing efforts. New campaigns and content formats rolled out within 2 weeks.",
      monthlyInvestment: "$5,500/month",
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
// Competitor Snapshot Generator
// ---------------------------------------------------------------------------

function generateCompetitorSnapshot(
  formData: AuditFormData,
  categories: CategoryScore[]
): string {
  const overall = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length
  );

  if (overall >= 70) {
    return `Businesses in ${formData.industry || "your industry"} typically score 40–60 on this audit. At ${overall}/100, ${
      formData.businessName
    } is outperforming most local competitors. The challenge now is staying ahead — competitors who invest in professional marketing will close the gap faster than you expect.`;
  }
  if (overall >= 40) {
    return `The average competitor in ${
      formData.industry || "your industry"
    } scores between 40–60. ${
      formData.businessName
    } is within range but not leading. The businesses pulling ahead are the ones investing in consistent content, paid advertising, and active community management — the gaps our audit identified in your current setup.`;
  }
  return `In ${formData.industry || "your industry"}, the businesses winning the most leads typically score 60+ on this audit. ${
    formData.businessName
  } is currently behind the competitive curve — but the gap is closable. The difference between where you are and where your top competitors sit is mainly consistency and strategic execution, not budget.`;
}

// ---------------------------------------------------------------------------
// Growth Potential Estimator
// ---------------------------------------------------------------------------

function generateGrowthPotential(
  categories: CategoryScore[],
  formData: AuditFormData
): string {
  const overall = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length
  );

  if (overall >= 70) {
    return `With a strong foundation already in place, the opportunity for ${
      formData.businessName
    } is market domination. By adding paid advertising to your organic presence, implementing advanced conversion optimization, and expanding to additional platforms, we estimate a 40–80% increase in qualified lead volume within 90 days. The infrastructure is there — now it's about scaling what's working.`;
  }
  if (overall >= 40) {
    return `Based on our analysis, ${
      formData.businessName
    } has significant untapped growth potential. By closing the gaps identified in this report — particularly in ${
      categories
        .filter((c) => c.score <= 50)
        .map((c) => c.label.toLowerCase())
        .join(" and ") || "key areas"
    } — we estimate a 2–3x increase in lead volume is achievable within 90–120 days. This isn't theoretical. It's what happens when a business goes from inconsistent to systematic.`;
  }
  return `${formData.businessName} has the highest growth ceiling — because you're starting from a low baseline, every improvement has outsized impact. We estimate that implementing the recommendations in this report could 3–5x your qualified lead volume within 120 days. The businesses in your market that look untouchable right now? Most of them started exactly where you are. They just started sooner.`;
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

export async function runAudit(
  formData: AuditFormData,
  id: string
): Promise<AuditResult> {
  // Step 1: Fetch website data
  const websiteMeta = await fetchWebsiteMeta(formData.websiteUrl);

  const website: WebsiteAnalysis = {
    url: formData.websiteUrl || "Not provided",
    ...websiteMeta,
    observation: websiteMeta.fetched
      ? `Our team successfully analyzed ${
          formData.websiteUrl || "your website"
        }. We found ${
          websiteMeta.title ? `a page title ("${websiteMeta.title.slice(0, 80)}")` : "no page title"
        }, ${
          websiteMeta.description
            ? `a meta description,`
            : "no meta description,"
        } and approximately ${websiteMeta.wordCount.toLocaleString()} words of content.`
      : `Our team attempted to analyze ${
          formData.websiteUrl || "your website URL"
        } but was unable to reach the site. This is often caused by the site being down, the URL being entered incorrectly, or security settings blocking our analysis tool. We've based the following scores on industry benchmarks for ${
          formData.industry || "your sector"
        }.`,
  };

  // Step 2: Calculate scores
  const categories = calculateScores(website, formData);
  const overall = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length
  );

  // Step 3: Generate insights
  const strengths = generateStrengths(categories, website, formData);
  const weaknesses = generateWeaknesses(categories, website, formData);
  const quickWins = generateQuickWins(categories, website, formData);
  const serviceRecommendations = generateServiceRecommendations(categories, formData);
  const competitorSnapshot = generateCompetitorSnapshot(formData, categories);
  const estimatedGrowthPotential = generateGrowthPotential(categories, formData);

  return {
    id,
    formData,
    website,
    scores: { overall, categories },
    strengths,
    weaknesses,
    quickWins,
    serviceRecommendations,
    competitorSnapshot,
    estimatedGrowthPotential,
    timestamp: new Date().toISOString(),
  };
}
