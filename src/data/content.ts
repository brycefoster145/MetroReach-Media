// Centralized homepage copy for MetroReach Media
// Premium rewrite — 2026-07-26

export const siteMeta = {
  title: "MetroReach Media — Premium Social Media Marketing Agency",
  description:
    "Premium social media management for service businesses. Organic content across Facebook, Instagram, and X. A dedicated team of specialists running your marketing.",
};

export const hero = {
  tagline: "YOUR PHONE SHOULD BE RINGING.",
  headline: "Social Media Marketing That Builds Brands and Drives Real Growth.",
  subheadline:
    "High‑quality content, consistent posting, and professional management — all handled for you to strengthen your brand and drive measurable results.",
  primaryCta: "Get a Free Audit",
  secondaryCta: "See our work",
  trustBar: "Facebook. Instagram. X. — Consistent organic posting for service businesses.",
};

export const platforms = [
  "Facebook",
  "Instagram",
  "X",
] as const;

export const problem = {
  headline: "Your marketing has gaps you're paying for right now.",
  pivot: "That gap costs you leads. Every day it stays open.",
  label: "The Real Problem",
  bullets: [
    {
      lead: "Inconsistent posting",
      detail: "algorithms kill your reach, competitors fill the gap",
    },
    {
      lead: "Slow response",
      detail: "CPL creeps up for weeks. Nobody catches it.",
    },
    {
      lead: "Account turnover",
      detail: "your manager quits. Their replacement starts from zero.",
    },
    {
      lead: "Weekend silence",
      detail: "leads come in Saturday. Nobody's watching.",
    },
    {
      lead: "Generic strategy",
      detail: "templated playbooks that ignore your market and margins",
    },
  ],
};

export const solution = {
  headline: "A marketing team that delivers. Daily.",
  subheadline:
    "MetroReach Media gives every client a dedicated team of specialists — strategist, copywriter, designer, media buyer, analyst, engineer, and QA. No account manager juggling five clients. No freelancer who goes dark. Just consistent, premium output at a cost that reflects our efficiency, not someone's overhead.",
  differentiators: [
    {
      number: "01",
      headline: "Dedicated. Responsive. Accountable.",
      body: "When your content needs adjustment, our team catches it — within hours, not days. Strategy, creative, audience targeting — adjusted by specialists who know your account history. Not a junior account manager. Not a freelancer who'll get to it Monday. A full team, working as one unit.",
      icon: "ClockCounterClockwise" as const,
      color: "brand-primary",
    },
    {
      number: "02",
      headline: "Specialist-led. Not account-managed.",
      body: "Traditional agencies give you one account manager. We give you a team of seven specialists — each focused on a single function, each accountable for their output. Strategy. Copy. Design. Media buying. Analytics. Engineering. QA. No single point of failure. No \"sorry, your account manager is on vacation.\"",
      icon: "SealCheck" as const,
      color: "brand-teal",
    },
    {
      number: "03",
      headline: "One team. Three platforms. Zero handoffs.",
      body: "We run Facebook, Instagram, and X — from one coordinated team. One strategy. One voice. Every platform covered with consistent, professional content.",
      icon: "SquaresFour" as const,
      color: "brand-primary-glow",
    },
  ],
};

export const services = {
  headline: "Everything your pipeline needs. Nothing you don't.",
  items: [
    {
      name: "Organic Content Management",
      description:
        "Platform-native content built around your business — not a template, not a repurposed blog post. We create posts, carousels, short-form video scripts, and stories that match how your customers actually consume content. Every piece is original. Every piece is on-brand. Every piece goes live on schedule — on Facebook, Instagram, and X.",
      tagline: "Your brand, everywhere. Consistently.",
      icon: "Article",
      features: [
        "Platform-native content for Facebook, Instagram, and X",
        "Custom content calendar built around your business",
        "Brand voice development and visual direction",
        "Consistent posting schedule algorithms reward",
      ],
    },
    {
      name: "Paid Advertising",
      description:
        "Coming soon. We're building our paid advertising capabilities — Meta Ads, TikTok, and Google — and will offer them once fully operational.",
      tagline: "Coming Soon — Paid campaigns that convert.",
      icon: "Target",
      comingSoon: true,
      features: [
        "Coming Soon: Campaign strategy and management",
      ],
    },
    {
      name: "Social Strategy",
      description:
        "Strategy isn't a PDF you get at onboarding and never look at again. It's the living foundation of everything we do — audience research, competitive analysis, platform selection, content architecture. Built for your specific market, updated monthly based on what the data says.",
      tagline: "A plan built on your market. Not a template.",
      icon: "Brain",
      features: [
        "Audience research and competitive analysis",
        "Platform selection and content architecture",
        "Messaging frameworks and brand positioning",
        "Monthly strategy reviews with data-driven updates",
      ],
    },
    {
      name: "Analytics & Reporting",
      description:
        "No waiting for a monthly PDF full of vanity metrics. Every client gets a monthly performance summary — engagement, reach, follower growth, and what's working. A dedicated analyst reviews your account and flags what to improve.",
      tagline: "Know exactly what your marketing is doing. Any time.",
      icon: "ChartLineUp",
      features: [
        "Monthly performance summary",
        "Weekly performance snapshots",
        "Monthly deep-dives with actionable insights",
        "No vanity metrics — just what matters",
      ],
    },
    {
      name: "Community Management",
      description:
        "Coming soon. We're building out our community management capabilities to handle comments, DMs, and reviews — with the same premium standard as our content.",
      tagline: "Coming Soon — Every comment. Every DM. Every review.",
      icon: "ChatCircleText",
      comingSoon: true,
      features: [
        "Coming Soon: Daily monitoring and response",
      ],
    },
  ],
};

export const process = {
  headline: "How we turn your marketing into a lead engine.",
  steps: [
    { number: 1, label: "Strategy", description: "We learn your business, your market, and your customers. Then we build the plan." },
    { number: 2, label: "Content Creation", description: "Your brand voice. Your visual identity. Your content — produced by specialists." },
    { number: 3, label: "Review & Approval", description: "You see the plan. You approve the direction. We execute." },
    { number: 4, label: "Posting & Scheduling", description: "Content goes live on schedule. Every platform. Every time." },
    { number: 5, label: "Growth Planning", description: "Monthly reviews to refine strategy. Continuous improvement." },
    { number: 6, label: "Reporting & Insights", description: "Monthly performance summary. Clear metrics. Actionable recommendations." },
  ],
};

export const portfolio = {
  headline: "What your content engine looks like.",
  subheadline: "Consistent, professional content across Facebook, Instagram, and X — delivered on schedule, every time.",
  items: [
    {
      title: "Consistent Brand Presence",
      category: "Organic Content",
      description: "Your brand, showing up daily across Facebook, Instagram, and X.",
      visual: "instagram",
    },
    {
      title: "Content Calendar That Delivers",
      category: "Scheduling",
      description: "Every post planned. Every post on time. No surprises.",
      visual: "calendar",
    },
    {
      title: "Professional Post Design",
      category: "Creative",
      description: "Scroll-stopping content that reflects your brand's quality.",
      visual: "ad-creative",
    },
  ],
};

export const credibility = {
  headline: "We're building our client roster. Be one of the first.",
  stats: [] as { value: string; label: string }[],
  badges: ["Facebook", "Instagram", "X"],
};

export const socialProof = {
  headline: "We're building our client roster. Be one of the first.",
  subheadline: "We're looking for service businesses that want consistent, professional social media presence — and are ready to grow with us.",
  testimonials: [] as { quote: string; name: string; title: string; business: string; industry: string; location: string; rating: number }[],
  caseStudies: [] as { name: string; industry: string; metric: string; metricLabel: string; subMetric: string; subLabel: string }[],
};

export const pricing = {
  headline: "One retainer. Full team. Consistent execution.",
  subheadline:
    "Every package includes strategy, creative, and consistent posting.",
  tiers: [
    {
      name: "Starter",
      price: "$1,500",
      period: "/month",
      featured: false,
      features: [
        "Up to 2 platforms",
        "12 original posts per month",
        "Monthly strategy report + performance review",
        "Monthly performance summary starting month one",
      ],
      bestFor: "Businesses ready to establish their social presence and start generating leads.",
      cta: "Get Started",
      paymentLink: "https://buy.stripe.com/cNifZh06M5zoeFGecd1ck0l",
    },
    {
      name: "Growth",
      price: "$3,000",
      period: "/month",
      featured: true,
      comingSoon: true,
      features: [
        "Up to 4 platforms — organic on all",
        "20 original posts per month",
        "Weekly performance snapshots + monthly deep-dive",
        "Community engagement included",
      ],
      bestFor: "Med spas, mid-size contractors, real estate teams, clinics.",
    },
    {
      name: "Scale",
      price: "$5,500",
      period: "/month",
      featured: false,
      comingSoon: true,
      features: [
        "Up to 7 platforms — organic on all",
        "30+ original posts per month",
        "Short-form video scripts",
        "Custom reporting",
      ],
      bestFor: "Multi-location businesses, high-growth real estate teams, regional contractors.",
    },
  ],
  noLockPledge:
    "Every package is month-to-month. Cancel with 30 days notice. No penalty. No annual commitment.",
};

export const faq = {
  headline: "What business owners ask before they trust us with their pipeline.",
  items: [
    {
      question: "How does one team manage three platforms without dropping the ball?",
      answer:
        "Most agencies assign one person to handle 4–5 accounts across multiple platforms. That's how things slip. We run a dedicated team structure — each specialist focuses on their function (creative, strategy, analytics) across your accounts. No single point of failure. No \"sorry, your account manager is on vacation.\"",
    },
    {
      question: "What if the content doesn't feel like us?",
      answer:
        "During onboarding, we build your brand voice model and content guidelines. Once you sign off on the direction, we execute. Most clients prefer to review the monthly content calendar (not every individual post) — but we can build in pre-approval workflows if your industry requires it. The default is: we earn your trust, then we move fast.",
    },
    {
      question: "When will I actually see leads?",
      answer:
        "Organic social takes 60–90 days to build meaningful momentum — algorithms reward consistency, and we deliver it. No agency can guarantee overnight results. But we can guarantee we won't waste time — every day, our team is working to grow your presence and build your audience.",
    },
    {
      question: "What industries do you specialize in?",
      answer:
        "Service-based businesses that depend on local leads: contractors (HVAC, roofing, electrical, plumbing, general), med spas and aesthetic clinics, auto repair shops, real estate teams, dental and medical clinics, salons and personal services. If you serve a local market and your phone needs to ring, we're built for you.",
    },
    {
      question: "What if I need to scale up, scale down, or cancel?",
      answer:
        "Switch packages or cancel with 30 days notice. No penalty. No \"annual commitment.\" We designed this for business owners who've been burned by agency contracts. If we're not delivering, you shouldn't be stuck.",
    },
    {
      question: "Why shouldn't I just hire a freelancer?",
      answer:
        "Freelancers are one person trying to do everything — strategy, writing, design, posting. We run a full team of specialists. Your strategy is built by someone who studies your market. Your copy is written by a dedicated writer. Your performance is tracked by a dedicated analyst. You get the output of an entire team, not one person's best effort.",
    },
    {
      question: "Do you handle compliance-sensitive industries?",
      answer:
        "Yes. Med spas, clinics, and other regulated businesses work within specific guardrails. We build your compliance requirements into our content guidelines during onboarding. Claims, disclaimers, and platform-specific rules are part of the system — not afterthoughts.",
    },
  ],
};

export const footerCta = {
  headline: "Your competitors are showing up. You should be too.",
  subheadline:
    "One message. No pressure. An honest assessment of what your current marketing is leaving on the table — and exactly what we'd do about it.",
  primaryCta: "Get a Free Audit",
  secondaryLabel: "Or if you're not ready to reach out:",
  secondaryCta: "See an example monthly report",
};

export const footer = {
  company: "MetroReach Media",
  tagline: "Premium social media marketing. Consistent execution.",
  services: ["Organic Social", "Strategy & Creative"],
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
    { label: "Facebook", href: "#", icon: "FacebookLogo" },
    { label: "Instagram", href: "#", icon: "InstagramLogo" },
    { label: "X (Twitter)", href: "#", icon: "XLogo" },
  ],
  copyright: `© ${new Date().getFullYear()} MetroReach Media. All rights reserved.`,
};

export const notFound = {
  headline: "Page not found.",
  subheadline: "But our team of specialists is ready to help.",
  cta: "Back to homepage",
};
