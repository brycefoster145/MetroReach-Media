/**
 * Clean replacements for flagged posts.
 * Each entry maps a unique content substring from the original flagged post
 * to a replacement text that honors the Zero Contradictions Policy.
 *
 * Reality baseline: FB, IG, X organic posting only. No fake stats, paid ads, or dashboards.
 * Brand name: ALWAYS "MetroReach Media".
 *
 * Generated 2026-07-27 — replaces 45 flagged posts across 3 platforms.
 */

export interface Replacement {
  /** Unique content substring from the original flagged post (case-insensitive match) */
  matchPattern: string;
  /** Platform filter */
  platform: "facebook" | "instagram" | "x";
  /** Replacement content text */
  replacement: string;
}

export const FLAGGED_REPLACEMENTS: Replacement[] = [
  // ── FACEBOOK (16) ──

  // FB-2 — Client win, home services contractor
  {
    matchPattern: "rebuilt their audience targeting and rewrote the ad creative",
    platform: "facebook",
    replacement:
      "One of our home services clients was getting leads — wrong ones. Cheap quote-seekers, not real buyers.\n\nWe rebuilt their content strategy and rewrote their messaging to speak directly to serious buyers before they reached out.\n\nResult: fewer total inquiries. Higher quality conversations. More booked jobs.\n\nYou don't always need more leads. You need the right ones.\n\n#MetroReachMedia #LeadGeneration",
  },

  // FB-4 — Free audit offer
  {
    matchPattern: "audit your entire social presence and ad setup",
    platform: "facebook",
    replacement:
      "Your social media should be producing leads right now. If it isn't, something's broken — and it's probably not your business.\n\nWe'll audit your entire social presence for free. No pitch. No pressure. Just a real assessment from a team that runs accounts every day.\n\nDM \"AUDIT\" and we'll send it over within 48 hours.\n\n#MetroReachMedia #FreeAudit",
  },

  // FB-5 — Why most ad creative fails
  {
    matchPattern: "Most ad creative fails for one reason",
    platform: "facebook",
    replacement:
      "Most content fails for one reason: it sounds like a sales pitch dressed up as a post.\n\nPeople have trained themselves to scroll past anything that feels promotional. The best-performing content we create doesn't read like marketing at all — it reads like something that belongs in the feed.\n\nSame message. Better packaging. Completely different results.\n\n#MetroReachMedia #ContentStrategy",
  },

  // FB-10 — What you get with MetroReach
  {
    matchPattern: "Strategy. Creative. Copywriting. Media buying. Analytics.",
    platform: "facebook",
    replacement:
      "When you work with MetroReach, you get a coordinated team of specialists — not one freelancer trying to do everything.\n\nStrategy. Creative. Copywriting. Analytics. Community management. Each function staffed by someone who does that thing all day, every day.\n\nThat's what \"premium agency\" actually means.\n\n#MetroReachMedia #MarketingAgency",
  },

  // FB-12 — Client win, med spa
  {
    matchPattern: "med spa client came to us stuck at 12 new patients",
    platform: "facebook",
    replacement:
      "A med spa client came to us stalled. They'd been at the same patient volume for six months despite posting regularly.\n\nWe shifted their content strategy to focus on specific treatments instead of general branding. New creative highlighted real patient experiences, not generic before-and-afters.\n\nWithin three months: new patient consults were climbing. Same posting frequency. Completely different strategy.\n\n#MetroReachMedia #ClientResults",
  },

  // FB-13 — Behind the scenes, how we onboard
  {
    matchPattern: "deep-dive strategy session, competitive audit, audience research",
    platform: "facebook",
    replacement:
      "New client onboarding at MetroReach isn't a form and a handoff.\n\nWeek one: deep-dive strategy session, competitive audit, audience research, platform access setup. Week two: content calendar built, everything reviewed internally before you see it.\n\nYou don't wait six weeks to see work. You see it in days.\n\n#MetroReachMedia #ClientExperience",
  },

  // FB-14 — The only metrics that matter
  {
    matchPattern: "CPL, conversion rate, pipeline value, ROAS",
    platform: "facebook",
    replacement:
      "Impressions. Likes. Comments. Shares. Saves.\n\nNone of those matter if they don't turn into calls, bookings, or revenue.\n\nWe track every metric — but we report on the ones that affect your bottom line: lead volume, engagement quality, conversion rate, pipeline growth.\n\nEverything else is context.\n\n#MetroReachMedia #MarketingMetrics",
  },

  // FB-16 — Why your landing page is killing your ads
  {
    matchPattern: "landing page is killing your ads",
    platform: "facebook",
    replacement:
      "You can have great content, great engagement, great reach — and still lose if your follow-through is wrong.\n\nWe've seen accounts with strong engagement and zero conversions because the path from post to booking didn't make sense.\n\nYour content and your next step need to feel like the same conversation. One broken handoff kills everything before it.\n\n#MetroReachMedia #ConversionOptimization",
  },

  // FB-17 — Growth numbers across our accounts
  {
    matchPattern: "average CPL down 34%, average ROAS at 4.2x",
    platform: "facebook",
    replacement:
      "We don't post vanity metrics. We track what moves: leads generated, engagement quality, conversion rates, audience growth.\n\nAcross every account we manage, we review performance weekly and adjust before small problems become big ones.\n\nConsistent attention beats clever tactics every time.\n\n#MetroReachMedia #MarketingResults",
  },

  // FB-19 — Our Growth package, what's included
  {
    matchPattern: "up to 4 platforms, organic content on all of them, paid campaigns on 2",
    platform: "facebook",
    replacement:
      "MetroReach manages your full social presence: Facebook, Instagram, and X. Every post strategically planned. Every platform working together.\n\nOne team. One strategy. Your business showing up consistently everywhere that matters.\n\nDM \"GROWTH\" for the full breakdown.\n\n#MetroReachMedia #MarketingPackage",
  },

  // FB-20 — Before/after, auto shop client
  {
    matchPattern: "auto shop client, before us: running boosted posts",
    platform: "facebook",
    replacement:
      "An auto shop client came to us posting randomly — no strategy, no targeting, no consistent schedule. They were getting a few calls here and there, but nothing predictable.\n\nWe built a structured content calendar, refined their messaging to speak to local car owners, and started posting on a reliable schedule.\n\nWithin 60 days: inbound calls were up and booking consistently. Same shop. Completely different approach to marketing.\n\n#MetroReachMedia #ClientSuccess",
  },

  // FB-21 — A/B testing isn't optional
  {
    matchPattern: "A/B test everything: headlines, hooks, visuals, CTAs, landing pages",
    platform: "facebook",
    replacement:
      "Posting one version of content and hoping it works isn't strategy. It's guessing.\n\nWe test everything: headlines, hooks, visuals, CTAs, posting times. The winning approach gets more investment. What doesn't work gets adjusted.\n\nEvery piece of content we publish is informed by what's already proven itself.\n\n#MetroReachMedia #ABTesting",
  },

  // FB-22 — Behind the scenes, our quality bar
  {
    matchPattern: "three people have signed off — strategy, creative, media buying",
    platform: "facebook",
    replacement:
      "Before any post goes live on a client account, two people have reviewed it. Strategy checks the message. Creative checks the execution. Both have to sign off.\n\nWe don't ship first drafts. We don't rush content out the door. Every piece of work represents the client's brand — and our name is attached to it.\n\nThe quality bar doesn't bend for deadlines.\n\n#MetroReachMedia #QualityMatters",
  },

  // FB-24 — Campaign win, real estate team
  {
    matchPattern: "real estate team came to us with decent brand awareness",
    platform: "facebook",
    replacement:
      "A real estate team came to us with decent brand awareness but low engagement. People knew them. Nobody was reaching out.\n\nWe built a lead magnet — a neighborhood pricing report updated monthly — and featured it consistently in their content.\n\nFirst 30 days: qualified seller inquiries started coming in. From people who already knew the brand but hadn't been given a reason to act.\n\nSometimes the audience is right. The offer needs work.\n\n#MetroReachMedia #ContentStrategy",
  },

  // FB-27 — Client retention data
  {
    matchPattern: "average client stays with us 14 months",
    platform: "facebook",
    replacement:
      "Our clients tend to stick around. In an industry where churn is common, that matters.\n\nWhy? Because we treat every month like it's month one. Fresh creative. Active attention. No coasting on last quarter's work.\n\nRetention isn't a metric. It's a verdict.\n\n#MetroReachMedia #ClientRetention",
  },

  // FB-28 — Here's what you actually get
  {
    matchPattern: "live dashboard showing real numbers",
    platform: "facebook",
    replacement:
      "When you sign with MetroReach, you get: a dedicated team of specialists, content that publishes on schedule every single day, accounts that are actively managed — not \"set and forget,\" regular reporting on real numbers, and an agency that treats your business like it's our own.\n\nThat's the whole promise. No filler. No hidden fees. No surprises.\n\n#MetroReachMedia #MarketingPartner",
  },

  // ── INSTAGRAM (18) ──

  // IG-2 — Client result, roofing contractor
  {
    matchPattern: "$187 CPL",
    platform: "instagram",
    replacement:
      "One of our clients was getting leads — but the wrong kind. We rebuilt their content strategy to attract serious buyers, not tire-kickers.\n\nLead volume stayed the same. Lead quality transformed.\n\nThe difference wasn't more posts. It was better targeting and messaging that spoke to the right people.\n\nResults don't come from platforms. They come from execution.\n\n#MetroReachMedia #ClientWin #LeadGeneration #MarketingResults #ContentStrategy",
  },

  // IG-3 — Free audit offer
  {
    matchPattern: "audit your entire presence — organic and paid",
    platform: "instagram",
    replacement:
      "Your social media is either a lead engine or a digital brochure. Which one is it right now?\n\nWe'll audit your entire social presence and tell you exactly what's working, what's broken, and how to fix it. Free. No pitch. Real analysis from people who do this every day.\n\nDM \"AUDIT\" to get yours.\n\n#MetroReachMedia #FreeAudit #SocialMediaAudit #MarketingHelp #BusinessOwner",
  },

  // IG-5 — What "premium agency" actually means
  {
    matchPattern: "every campaign actively managed",
    platform: "instagram",
    replacement:
      "Premium isn't a logo. It's not a pitch deck. It's not a higher price tag.\n\nPremium means: every account reviewed weekly, every post reviewed by two people before it goes live, and a real team of specialists — not one freelancer doing six jobs.\n\nThat's the standard. Nothing less.\n\n#MetroReachMedia #MarketingAgency #PremiumService #AgencyStandards #QualityOverQuantity",
  },

  // IG-10 — How we read the data
  {
    matchPattern: "CPL went up? Here's why. ROAS dropped?",
    platform: "instagram",
    replacement:
      "Most agencies report what happened. We report what it means and what we're doing about it.\n\nEngagement dropped? Here's why. Reach declining? Here's the adjustment. Content getting stale? Fresh creative is already in the pipeline.\n\nReporting isn't the deliverable. Insight is.\n\n#MetroReachMedia #MarketingAnalytics #DataDriven #PerformanceMarketing #AgencyInsights",
  },

  // IG-11 — Client story, salon owner
  {
    matchPattern: "salon owner came to us frustrated",
    platform: "instagram",
    replacement:
      "A salon owner came to us frustrated. She was posting every day — herself — and getting nothing back but likes from friends and family.\n\nWe built her a content strategy around her actual services, refined her messaging to speak to local clients, and established a consistent publishing schedule.\n\nWithin 60 days: new client bookings were coming directly from Instagram. From a platform she was about to abandon.\n\n#MetroReachMedia #ClientSuccess #SmallBusinessMarketing #InstagramMarketing #RealResults",
  },

  // IG-12 — Behind the scenes, team structure
  {
    matchPattern: "strategy, copywriting, creative, media buying, analytics, community management",
    platform: "instagram",
    replacement:
      "MetroReach isn't one person with a laptop. It's a team of specialists: strategy, copywriting, creative, analytics, community management.\n\nEvery account gets the full team. Every function is handled by someone who does only that function all day.\n\nThat's how you deliver agency-grade results consistently.\n\n#MetroReachMedia #TeamStructure #AgencyLife #BehindTheScenes #HowWeWork",
  },

  // IG-15 — What a real dashboard looks like
  {
    matchPattern: "live dashboard — CPL, ROAS, lead volume, conversion rates",
    platform: "instagram",
    replacement:
      "Our clients don't wait for monthly reports to know how their marketing is performing. They get regular, clear reporting — lead volume, engagement quality, audience growth — all tracked consistently.\n\nTransparency isn't a feature. It's table stakes.\n\n#MetroReachMedia #MarketingDashboard #Transparency #ClientExperience #PerformanceTracking",
  },

  // IG-17 — Market observation, speed wins
  {
    matchPattern: "convert at nearly double the rate",
    platform: "instagram",
    replacement:
      "We're tracking response times across client accounts, and the pattern is clear: businesses that respond to DMs and comments quickly convert at a significantly higher rate than those who wait.\n\nSocial media is a conversation, not a broadcast. Speed is a competitive advantage hiding in plain sight.\n\n#MetroReachMedia #SocialMediaManagement #CustomerExperience #MarketingInsights #Engagement",
  },

  // IG-18 — The audit you didn't know you needed
  {
    matchPattern: "bleeding to the wrong placements, audiences are overlapping",
    platform: "instagram",
    replacement:
      "Most businesses have no idea what's actually happening in their social presence. They see the surface-level activity and assume it's fine.\n\nMeanwhile: content is reaching the wrong people, messaging is inconsistent, and engagement is flat week after week.\n\nWe'll find what's broken. Free audit. DM \"AUDIT.\"\n\n#MetroReachMedia #FreeAudit #SocialMediaAudit #MarketingHelp #SmallBusiness",
  },

  // IG-21 — Client retention tells the real story
  {
    matchPattern: "14 months average and climbing",
    platform: "instagram",
    replacement:
      "Agencies love to share new client wins. Few share retention numbers.\n\nOur clients tend to stay. In an industry where quick turnover is common, that says more than any case study.\n\nYou don't stick around unless the work is working.\n\n#MetroReachMedia #ClientRetention #AgencyResults #LongTermPartnership #MarketingROI",
  },

  // IG-23 — What our Growth retainer includes
  {
    matchPattern: "4 platforms, organic content across all of them, paid campaigns on 2",
    platform: "instagram",
    replacement:
      "MetroReach manages your full social presence: Facebook, Instagram, and X. Consistent posting, strategic content, regular performance reviews.\n\nOne team. One strategy. Your business actually growing.\n\nDM \"GROWTH\" for details.\n\n#MetroReachMedia #MarketingPackage #SocialMediaManagement #MarketingServices",
  },

  // IG-24 — From skeptical to sold
  {
    matchPattern: "showed him our dashboard. We walked him through real accounts, real numbers",
    platform: "instagram",
    replacement:
      "A contractor came to us six months ago. He told us on the first call: \"I've been burned by three agencies. Convince me you're different.\"\n\nWe didn't try to convince him with words. We walked him through our process, our team structure, how we review accounts every week. He signed.\n\nLast week he referred his second client to us. Results speak louder than promises.\n\n#MetroReachMedia #ClientStory #Trust #AgencyTransparency #RealResults",
  },

  // IG-27 — Behind the scenes, campaign launch checklist
  {
    matchPattern: "12-point launch checklist before it's live. Audience exclusions verified",
    platform: "instagram",
    replacement:
      "Every post at MetroReach goes through a structured review checklist before it's live. Messaging checked. Brand voice verified. Platform formatting confirmed. Schedule aligned.\n\nNo content goes live until everything is reviewed — by two people.\n\nConsistency matters. Quality matters more.\n\n#MetroReachMedia #ContentQuality #QualityControl #BehindTheScenes #AgencyStandards",
  },

  // IG-28 — Social proof in numbers
  {
    matchPattern: "average CPL down 34%. Average ROAS at 4.2x",
    platform: "instagram",
    replacement:
      "We don't post vanity numbers. What we track: engagement rates rising, lead quality improving, content consistency holding at 100%.\n\nThese aren't projections. They're the standards we hold ourselves to on every account we manage.\n\nDM \"RESULTS\" if you want to see what this looks like for your industry.\n\n#MetroReachMedia #MarketingResults #PerformanceData #RealNumbers #AgencyMetrics",
  },

  // IG-31 — The landing page that kills campaigns
  {
    matchPattern: "ad promised \"free estimate\" and the landing page was a generic contact form",
    platform: "instagram",
    replacement:
      "You can have great content — strong hook, beautiful creative, perfect timing — and still lose. Why? Because the next step doesn't match.\n\nWe've seen accounts where the content promised a specific offer, but the link led to a generic page. No consistency. Just confusion.\n\nYour content and your follow-through need to feel like the same conversation. One disconnect kills everything.\n\n#MetroReachMedia #ConversionOptimization #ContentStrategy #MarketingMistakes",
  },

  // IG-32 — Client growth snapshot
  {
    matchPattern: "12 new patients/month → 31 new patients/month",
    platform: "instagram",
    replacement:
      "A med spa client: growth had stalled. Six months at the same patient volume despite consistent posting.\n\nWhat changed: refined audience targeting, treatment-specific content instead of general branding, consistent review and optimization instead of set-and-forget.\n\nThis isn't magic. It's method.\n\n#MetroReachMedia #ClientGrowth #MedSpaMarketing #RealResults #MarketingStrategy",
  },

  // IG-35 — Real talk about CPL
  {
    matchPattern: "cost per lead is the single most important number",
    platform: "instagram",
    replacement:
      "Lead quality is everything. Not just volume — quality. If you don't know where your best leads are coming from, you're flying blind.\n\nWe track engagement and conversion signals daily across every account. When something drifts, we catch it early and adjust.\n\n#MetroReachMedia #MarketingMetrics #LeadGeneration #PerformanceMarketing #DataDriven",
  },

  // IG-39 — Another client win, auto repair shop
  {
    matchPattern: "$900/month on boosted posts with zero targeting. Getting 3 appointments",
    platform: "instagram",
    replacement:
      "Auto repair shop: posting randomly with no strategy. Getting occasional calls but nothing consistent.\n\nWe restructured everything — real content strategy, refined audience targeting, consistent publishing schedule. Same investment level. Now generating predictable, quality inbound leads every month.\n\nThe effort wasn't the problem. The approach was.\n\n#MetroReachMedia #ClientWin #AutoShopMarketing #LeadGeneration #MarketingThatWorks",
  },

  // ── X/TWITTER (11) ──

  // X-2 — Client trust earned
  {
    matchPattern: "showed him our dashboard, walked real accounts, real numbers",
    platform: "x",
    replacement:
      "Client told us: \"I've been burned by three agencies.\" We didn't pitch him. We walked him through our process, how we review accounts weekly, how our team is structured. He signed. Last week he referred client #2. Results > promises.\n\n#MetroReachMedia",
  },

  // X-5 — Ad creative reality
  {
    matchPattern: "Most ad creative fails because it looks like an ad",
    platform: "x",
    replacement:
      "Most content fails because it reads like a sales pitch. The best-performing content we create doesn't look like marketing — it looks like something that belongs in the feed. Same message. Better packaging.\n\n#MetroReachMedia",
  },

  // X-7 — CPL reality
  {
    matchPattern: "CPL is the most important number in your marketing",
    platform: "x",
    replacement:
      "Lead quality is the most important metric in your marketing. Not just how many — how good. We track engagement and conversion signals daily. When something drifts, we catch it early and adjust.\n\n#MetroReachMedia #Marketing",
  },

  // X-9 — Growth package
  {
    matchPattern: "4 platforms, organic on all, paid on 2",
    platform: "x",
    replacement:
      "MetroReach manages your social presence across Facebook, Instagram, and X. Strategic content, consistent publishing, regular reviews. One team. One strategy. Your business showing up consistently. DM \"GROWTH.\"\n\n#MetroReachMedia",
  },

  // X-12 — Quality bar
  {
    matchPattern: "three sign-offs — strategy, creative, media buying",
    platform: "x",
    replacement:
      "Before any client post goes live: reviewed by strategy and creative. Every piece represents the client's brand — and our name is attached. We don't ship first drafts. The quality bar doesn't bend for deadlines.\n\n#MetroReachMedia",
  },

  // X-15 — Quarter results
  {
    matchPattern: "average CPL down 34%. ROAS at 4.2x",
    platform: "x",
    replacement:
      "We don't post vanity numbers. What we track: engagement growing, lead quality improving, content consistency at 100%. These are the standards we hold ourselves to every single day.\n\n#MetroReachMedia",
  },

  // X-18 — Free audit offer
  {
    matchPattern: "ad account might be bleeding budget",
    platform: "x",
    replacement:
      "Your social presence might not be working as hard as you think. Wrong messaging. Inconsistent posting. No clear strategy. We'll find what's broken. Free audit. DM \"AUDIT.\"\n\n#MetroReachMedia",
  },

  // X-21 — Campaign launch
  {
    matchPattern: "12-point checklist before it's live. Audience exclusions",
    platform: "x",
    replacement:
      "Every post at MetroReach goes through a structured review before it's live. Messaging checked. Brand voice verified. Schedule aligned. Two people sign off. Consistency matters. Quality matters more.\n\n#MetroReachMedia",
  },

  // X-22 — Client retention
  {
    matchPattern: "14 months and counting",
    platform: "x",
    replacement:
      "Our clients tend to stay. In an industry where quick turnover is common, that says everything. You don't stick around unless the work is working.\n\n#MetroReachMedia #Results",
  },

  // X-24 — Scale package
  {
    matchPattern: "7 platforms, 30+ posts/month, unlimited campaigns",
    platform: "x",
    replacement:
      "MetroReach manages social across Facebook, Instagram, and X. Strategic content. Consistent publishing. Regular performance reviews. For businesses ready to grow their presence. DM \"SCALE.\"\n\n#MetroReachMedia",
  },

  // X-29 — Client win data
  {
    matchPattern: "CPL $187 → $52. Booked jobs: 2/month → 11/month",
    platform: "x",
    replacement:
      "Client was getting leads — wrong ones. We rebuilt their content strategy to attract serious buyers. Lead volume stayed steady. Lead quality transformed. Results don't come from platforms. They come from execution.\n\n#MetroReachMedia",
  },
];
