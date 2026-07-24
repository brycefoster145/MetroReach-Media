// Centralized homepage copy for MetroReach Media
// Source: /home/team/shared/content/site-copy.md

export const siteMeta = {
  title: "MetroReach Media — Premium Social Media Marketing Agency",
  description:
    "Premium social media management for service businesses. Organic content and paid ads across every major platform. Agency quality without the traditional overhead.",
};

export const hero = {
  tagline: "PREMIUM MARKETING. REAL RESULTS.",
  headline: "Marketing that actually gets results. No excuses.",
  subheadline:
    "Premium social media management — organic and paid, across every major platform — for less than a traditional agency retainer. No gaps. No excuses. More leads.",
  primaryCta: "Start getting leads",
  secondaryCta: "See our work",
  trustBar: "Trusted by service businesses across 12+ markets",
};

export const platforms = [
  "Facebook",
  "Instagram",
  "TikTok",
  "Google",
  "YouTube",
  "LinkedIn",
  "X",
] as const;

export const problem = {
  headline: "You're paying for marketing gaps you don't even see.",
  body: [
    "Here's how it usually goes. You hire an agency or a freelancer. Things start strong. Posts go up. Ads launch. Then your account manager takes a new job. Or your freelancer gets too busy. Posts get skipped. Ad performance drifts. Nobody's watching on weekends. The monthly report still shows up — but the leads don't.",
    "And when you ask what's happening, you get variations on \"we're optimizing\" while your phone stays quiet.",
    "Meanwhile, your competitors are capturing every search, every scroll, every local intent signal you're missing. Not because they're better at what you do. Because they're showing up and you're not.",
  ],
  pivot: "That's the gap. And it's costing you real money.",
  label: "The Real Problem",
  bullets: [
    {
      lead: "Inconsistent posting",
      detail: "momentum dies, algorithms punish you",
    },
    {
      lead: "Slow response to performance signals",
      detail: "CPL drifts up for weeks before anyone notices",
    },
    {
      lead: "Talent turnover",
      detail: "your account manager leaves, their replacement starts from zero",
    },
    {
      lead: "Weekend & holiday gaps",
      detail: "leads don't take weekends off, but agencies do",
    },
    {
      lead: "Generic strategy",
      detail: "one-size-fits-all playbooks that ignore your market and your margins",
    },
  ],
};

export const solution = {
  headline: "A marketing team built differently.",
  subheadline:
    "MetroReach Media is a premium social media agency. Premium strategy. Premium creative. Paid ad management across every platform that matters. A dedicated team of specialists — at a cost that reflects our efficiency, not someone else's overhead.",
  differentiators: [
    {
      number: "01",
      headline: "Dedicated. Responsive. Relentless.",
      body: "When CPL creeps up, we're on it immediately. Bids, creative, audiences — adjusted in real time by specialists who know your account, not a rotating cast of junior staff. Our team of strategists, media buyers, and creative directors works as one dedicated unit. No handoffs to someone who's never read your brief.",
      icon: "ClockCounterClockwise" as const,
      color: "brand-primary",
    },
    {
      number: "02",
      headline: "Premium Quality at 40–60% Less",
      body: "Traditional agencies charge premium rates because they carry premium overhead: account managers, junior creatives, office leases, billable-hour padding. We eliminated the overhead — not the quality. You get agency-grade creative, strategic rigor, and multi-platform execution for a fraction of what a comparable traditional agency charges.",
      icon: "SealCheck" as const,
      color: "brand-accent",
    },
    {
      number: "03",
      headline: "One Team. Seven Platforms.",
      body: "Facebook. Instagram. TikTok. Google. YouTube. LinkedIn. X. Most agencies specialize in one or two and subcontract the rest. We run them all — organically and paid — from a single integrated team. No handoffs. No finger-pointing. One strategy, executed everywhere.",
      icon: "SquaresFour" as const,
      color: "brand-primary-glow",
    },
  ],
};

export const services = {
  headline: "Everything your marketing needs. Nothing you don't.",
  items: [
    {
      name: "Organic Social Management",
      description:
        "Strategy, content creation, posting, and community management across your chosen platforms. We build your brand presence day by day — educational content, social proof, behind-the-scenes, offers — on a consistent schedule that algorithms reward and audiences trust.",
      features: [
        "Platform-native content for Facebook, Instagram, TikTok, LinkedIn, X, YouTube",
        "Custom content calendar built around your business rhythms",
        "Brand voice development and visual direction",
        "Community engagement and response management",
        "Monthly content performance reports",
      ],
      image: null,
    },
    {
      name: "Paid Ad Management",
      description:
        "Full-service campaign management from strategy to creative to optimization. We build campaigns that turn ad spend into qualified leads — not just impressions.",
      features: [
        "Campaign strategy and audience architecture",
        "Ad creative (static, carousel, video scripts, YouTube pre-roll)",
        "Continuous A/B testing and creative refresh",
        "Bid, budget, and targeting optimization",
        "Live performance dashboards with CPL and ROAS tracking",
        "Platforms: Meta (FB + IG), TikTok, Google (Search + Display + YouTube), LinkedIn, X",
      ],
      image: "/images/services-performance-chart.webp",
    },
    {
      name: "Strategy & Creative Projects",
      description:
        "Not every engagement needs a monthly retainer. We offer project-based work for brand positioning, funnel architecture, campaign launches, and creative sprints.",
      features: [
        "Brand positioning and messaging frameworks",
        "Funnel audit and architecture",
        "Campaign launch packages (creative + strategy + initial management)",
        "Content sprints (30/60/90 days of content in one delivery)",
      ],
      image: null,
    },
  ],
};

export const howItWorks = {
  headline: "Behind every post and ad: a dedicated team of specialists.",
  subheadline:
    "Here's how it actually works. Not a single overworked account manager guessing across seven platforms. A full team of specialists — strategy, creative, media buying, analytics, community management — each focused on one function, working together continuously. Think of it as a full agency team, minus the overhead, minus the downtime.",
  roles: [
    {
      name: "Strategy Lead",
      description:
        "Studies your market, competitors, and audience. Sets the direction. Pivots when the data says pivot.",
      icon: "Brain" as const,
    },
    {
      name: "Creative Director",
      description:
        "Owns brand voice and visual direction. Ensures every post and ad looks and sounds premium.",
      icon: "PaintBrush" as const,
    },
    {
      name: "Content Producer",
      description:
        "Creates platform-native posts, carousels, short-form scripts, and long-form content. Every day.",
      icon: "Article" as const,
    },
    {
      name: "Media Buyer",
      description:
        "Launches, manages, and optimizes paid campaigns. Adjusts bids, audiences, and creative based on real-time performance.",
      icon: "ChartLineUp" as const,
    },
    {
      name: "Performance Analyst",
      description:
        "Tracks everything that matters: CPL, ROAS, engagement, attribution. Surfaces insights. Recommends actions.",
      icon: "ChartBar" as const,
    },
    {
      name: "Community Manager",
      description:
        "Monitors comments, DMs, and engagement. Ensures no customer interaction goes unanswered.",
      icon: "ChatCircleText" as const,
    },
  ],
  qualityControl: {
    icon: "Heartbeat" as const,
    text: "Every deliverable goes through a quality review before it reaches your audience. If something isn't performing, we catch it and fix it — fast.",
  },
  onboarding: [
    {
      step: 1,
      label: "Brand immersion",
      detail: "We learn your business, voice, goals, and constraints.",
    },
    {
      step: 2,
      label: "Competitive landscape",
      detail: "We map your market: who's winning, where the gaps are.",
    },
    {
      step: 3,
      label: "Strategy build",
      detail: "Positioning, messaging, content plan, and campaign architecture.",
    },
    {
      step: 4,
      label: "Launch",
      detail: "Content goes live. Ads go live. Optimization begins. You get a dashboard.",
    },
  ],
};

export const socialProof = {
  headline: "Don't take our word for it.",
  subheadline: "Here's what happens when businesses like yours get the full team behind them.",
  stats: [
    { value: "340+", label: "Active leads delivered/month" },
    { value: "3.4x", label: "Average ROAS across clients" },
    { value: "98.7%", label: "Client satisfaction rate" },
    { value: "7", label: "Platforms managed" },
  ],
  testimonials: [
    {
      quote:
        "We went from 2-3 leads a week to 15-20. Our phone rings every day now. I haven't thought about marketing in three months — I just look at the dashboard on Friday afternoons to see how the week went.",
      name: "Mike R.",
      title: "Owner",
      business: "Ridgeway Heating & Cooling",
      industry: "HVAC",
      location: "Columbus, OH",
    },
    {
      quote:
        "I was skeptical about switching agencies. But the content looks better than what our $6,000/month agency was producing — and it actually goes out on schedule. Our Instagram grew 40% in the first quarter.",
      name: "Dr. Sarah C.",
      title: "Medical Director",
      business: "Lumina Aesthetics",
      industry: "Med Spa",
      location: "Scottsdale, AZ",
    },
    {
      quote:
        "The listing marketing alone is worth the retainer. We're winning listings because sellers can see we have a real marketing operation behind us. Our team brand actually has a presence now.",
      name: "David K.",
      title: "Team Lead",
      business: "The Keller Group",
      industry: "Real Estate",
      location: "Denver, CO",
    },
  ],
};

export const pricing = {
  headline: "Simple pricing. Serious results.",
  subheadline:
    "Every package includes strategy, creative, posting, optimization, and reporting. The only variable is scope.",
  tiers: [
    {
      name: "Starter",
      price: "$1,500",
      featured: false,
      features: [
        "2 platforms (organic + paid on one)",
        "12 organic posts/month",
        "1 paid campaign, managed continuously",
        "Monthly strategy & performance report",
        "Live dashboard access",
      ],
      bestFor: "Auto shops, salons, small contractors getting started with social.",
      cta: "Get started",
      paymentLink: "https://buy.stripe.com/cNifZh06M5zoeFGecd1ck0l",
    },
    {
      name: "Growth",
      price: "$3,000",
      featured: true,
      features: [
        "4 platforms (organic on all, paid on 2)",
        "20 organic posts/month",
        "3 paid campaigns, managed continuously",
        "A/B testing on creative and audiences",
        "Weekly performance summaries + monthly deep-dive",
        "Community engagement included",
        "Live dashboard access",
      ],
      bestFor:
        "Med spas, mid-size contractors, real estate teams, clinics.",
      cta: "Get started",
      paymentLink: "https://buy.stripe.com/7sY6oH3iYd1Q69ad891ck0m",
    },
    {
      name: "Scale",
      price: "$5,500",
      featured: false,
      features: [
        "Up to 7 platforms (organic on all, paid on up to 4)",
        "30+ organic posts/month",
        "Unlimited paid campaigns, managed continuously",
        "Advanced A/B testing, funnel optimization",
        "Influencer research reports & partnership strategy",
        "Priority strategy adjustments",
        "Bi-weekly strategy calls",
        "Live dashboard + custom reporting",
      ],
      bestFor:
        "Multi-location businesses, high-growth real estate teams, regional contractors.",
      cta: "Get started",
      paymentLink: "https://buy.stripe.com/fZufZh2eU0f41SUfgh1ck0n",
    },
  ],
  addonNote:
    "Paid ad management also available as a standalone service — 10% of managed ad spend (min $750/month).",
  noLockPledge:
    "Month-to-month. Cancel anytime. We earn your business every month.",
};

export const faq = {
  headline: "Questions smart business owners ask before signing up.",
  items: [
    {
      question:
        "How do you handle multiple platforms without spreading too thin?",
      answer:
        "Most agencies assign one person to handle 4–5 accounts across multiple platforms. That's how things slip. We run a dedicated team structure — each specialist focuses on their function (creative, media buying, analytics) across your accounts. No single point of failure. No \"sorry, your account manager is on vacation.\"",
    },
    {
      question:
        "What if I don't like the content? Can I approve posts before they go live?",
      answer:
        "During onboarding, we build your brand voice model and content guidelines. Once you sign off on the direction, we execute. Most clients prefer to review the monthly content calendar (not every individual post) — but we can build in pre-approval workflows if your industry requires it. The default is: we earn your trust, then we move fast.",
    },
    {
      question: "How long until I see results?",
      answer:
        "Paid ads: 2–4 weeks to dial in targeting and creative. By month two, you should see your CPL approaching target. Organic: 60–90 days to build meaningful momentum (algorithms reward consistency, and we deliver it). No agency can guarantee overnight results. But we can guarantee we won't waste time — every day, our team is working to narrow the gap.",
    },
    {
      question: "What industries do you specialize in?",
      answer:
        "Service-based businesses that depend on local leads: contractors (HVAC, roofing, electrical, plumbing, general), med spas and aesthetic clinics, auto repair shops, real estate teams, dental and medical clinics, salons and personal services. If you serve a local market and your phone needs to ring, we're built for you.",
    },
    {
      question: "What if I want to change my package or cancel?",
      answer:
        "Switch packages or cancel with 30 days notice. No penalty. No \"annual commitment.\" We designed this for business owners who've been burned by agency contracts. If we're not delivering, you shouldn't be stuck.",
    },
    {
      question:
        "What makes your content better than what I'd get from a freelancer?",
      answer:
        "Freelancers are one person trying to do everything — strategy, writing, design, posting, optimization. We run a full team of specialists. Your strategy is built by someone who studies your market. Your copy is written by a dedicated writer. Your performance is tracked by an analyst who flags what's working and what's not. You get the output of an entire agency, not one person's best effort.",
    },
    {
      question: "Do you handle compliance-sensitive industries?",
      answer:
        "Yes. Med spas, clinics, and other regulated businesses work within specific guardrails. We build your compliance requirements into our content guidelines during onboarding. Claims, disclaimers, and platform-specific rules are part of the system — not afterthoughts.",
    },
  ],
};

export const footerCta = {
  headline: "Stop paying for marketing gaps. Start getting leads.",
  subheadline:
    "One conversation. No pressure. Just an honest assessment of what your current marketing is leaving on the table — and what MetroReach Media could do about it.",
  primaryCta: "Book a strategy call",
  secondaryLabel: "Or if you're not ready to talk:",
  secondaryCta: "See an example monthly report",
};

export const footer = {
  company: "MetroReach Media",
  tagline: "Premium social media marketing. Real results.",
  services: ["Organic Social", "Paid Ads", "Strategy & Creative"],
  markets: [
    "Contractors",
    "Med Spas",
    "Real Estate",
    "Auto Shops",
    "Clinics",
    "Salons",
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookie-policy" },
  ],
  social: [
    { label: "Facebook", href: "https://facebook.com/metroreachmedia", icon: "FacebookLogo" },
    { label: "Instagram", href: "https://instagram.com/metroreachmedia", icon: "InstagramLogo" },
    { label: "LinkedIn", href: "https://linkedin.com/company/metroreachmedia", icon: "LinkedinLogo" },
    { label: "TikTok", href: "https://tiktok.com/@metroreachmedia", icon: "TiktokLogo" },
    { label: "X (Twitter)", href: "https://x.com/metroreachmedia", icon: "XLogo" },
  ],
  copyright: `© ${new Date().getFullYear()} MetroReach Media. All rights reserved.`,
};

export const notFound = {
  headline: "Page not found.",
  subheadline: "But our team of specialists is ready to help.",
  cta: "Back to homepage",
};
