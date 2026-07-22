// Page copy for standalone routes
// Source: /home/team/shared/content/pages/*.md

export const aboutPage = {
  headline: "We got tired of watching agencies fail business owners.",
  body: [
    "Most agencies are built wrong.",
    "They hire talented people, load them with too many accounts, and hope nothing breaks. When someone quits — and someone always quits — the client pays the price. Posts get skipped. Ad performance drifts. The monthly report still shows up, but the leads don't.",
    "We built MetroReach Media because that model is broken and everyone knows it. The agency keeps billing. The business owner keeps waiting. The phone stays quiet.",
    "There's a better way to do this.",
  ],
  beliefs: [
    {
      heading: "Marketing should be relentless.",
      text: "Your competitors don't take weekends off from showing up in your customers' feeds. Your marketing shouldn't either. We built a team that stays on top of your marketing — because the businesses we serve can't afford coverage gaps.",
    },
    {
      heading: "Quality and consistency aren't optional.",
      text: "One bad post won't kill you. But inconsistent posting, stale creative, and slow optimization will bleed you dry over time. We obsess over both: premium creative that earns attention, and the discipline to deliver it every single day.",
    },
    {
      heading: "You should pay for output, not overhead.",
      text: "Traditional agencies bill you for account managers, junior staff, office leases, and billable meetings about having meetings. We eliminated all of it. You pay for what actually moves your business: strategy, creative, and optimization that generates leads.",
    },
    {
      heading: "Trust is earned through transparency.",
      text: "Every client gets a live dashboard. CPL, ROAS, lead volume — visible anytime. No waiting for a monthly call to find out if your money is working.",
    },
  ],
  howWeOperate:
    "MetroReach Media runs on a team of specialized roles — strategy, creative, media buying, analytics, community management — each focused on one function, working together continuously. No one person trying to do everything. No single point of failure.",
  whoWereFor:
    "Service-based businesses that need local leads to survive. Contractors. Med spas. Real estate teams. Auto shops. Clinics. Salons. Businesses where the phone needs to ring and the pipeline needs to stay full.",
  cta: "See what dedicated marketing actually looks like.",
};

export const servicesPage = {
  headline: "Premium Social Media Marketing",
  subheadline:
    "A full team of specialists managing every dimension of your social presence — organic, paid, strategy, analytics, and community. No gaps. No excuses.",
  services: [
    {
      icon: "Article",
      name: "Organic Content Management",
      bullets: [
        "Platform-native content for Facebook, Instagram, TikTok, LinkedIn, X, and YouTube",
        "Custom content calendar aligned with your business goals and seasonality",
        "Brand voice development, visual direction, and content guidelines",
        "Consistent posting schedule that algorithms reward and audiences trust",
      ],
    },
    {
      icon: "Target",
      name: "Paid Advertising",
      bullets: [
        "Full-service campaign management across Meta, TikTok, Google, LinkedIn, and X",
        "Ad creative — static, carousel, video scripts, and YouTube pre-roll",
        "Continuous A/B testing, bid optimization, and audience refinement",
        "Live performance dashboards with real-time CPL and ROAS tracking",
      ],
    },
    {
      icon: "Brain",
      name: "Social Strategy",
      bullets: [
        "Competitive landscape analysis and market positioning",
        "Audience research, segmentation, and platform selection",
        "Content pillar architecture and messaging frameworks",
        "Monthly strategy reviews with performance-driven adjustments",
      ],
    },
    {
      icon: "ChartLineUp",
      name: "Analytics & Reporting",
      bullets: [
        "Live dashboards with CPL, ROAS, engagement, and attribution tracking",
        "Weekly performance summaries and monthly deep-dive reports",
        "Actionable insights surfaced by a dedicated performance analyst",
        "Transparent metrics — no vanity numbers, no hidden slippage",
      ],
    },
    {
      icon: "ChatCircleText",
      name: "Community Management",
      bullets: [
        "Daily monitoring of comments, DMs, and brand mentions across all platforms",
        "Prompt, on-brand responses that build trust and engagement",
        "Review management and reputation monitoring",
        "No customer interaction goes unanswered — period",
      ],
    },
  ],
  platforms: [
    "Facebook",
    "Instagram",
    "TikTok",
    "Google",
    "YouTube",
    "LinkedIn",
    "X",
  ],
  cta: "See what a full marketing team can do.",
};

export const pricingPage = {
  headline: "Simple pricing. Serious results.",
  subheadline:
    "Every package includes strategy, creative, posting, optimization, and reporting. The only variable is scope.",
  tiers: [
    {
      name: "Starter",
      price: "$1,500",
      period: "/month",
      description: "For businesses ready to establish their social presence and start generating leads.",
      features: [
        "2 platforms (organic + paid on one)",
        "12 organic posts/month",
        "1 paid campaign, managed continuously",
        "Monthly strategy & performance report",
        "Live dashboard access",
      ],
      bestFor: "Auto shops, salons, small contractors",
      featured: false,
      paymentLink: "https://buy.stripe.com/cNifZh06M5zoeFGecd1ck0l",
    },
    {
      name: "Growth",
      price: "$3,000",
      period: "/month",
      description: "For businesses that need multi-platform presence and aggressive lead generation.",
      features: [
        "4 platforms (organic on all, paid on 2)",
        "20 organic posts/month",
        "3 paid campaigns, managed continuously",
        "A/B testing on creative and audiences",
        "Weekly performance summaries + monthly deep-dive",
        "Community engagement included",
        "Live dashboard access",
      ],
      bestFor: "Med spas, mid-size contractors, real estate teams, clinics",
      featured: true,
      paymentLink: "https://buy.stripe.com/7sY6oH3iYd1Q69ad891ck0m",
    },
    {
      name: "Scale",
      price: "$5,500",
      period: "/month",
      description: "For businesses that want to dominate their market across all relevant channels.",
      features: [
        "Up to 7 platforms (organic on all, paid on up to 4)",
        "30+ organic posts/month",
        "Unlimited paid campaigns, managed continuously",
        "Advanced A/B testing, funnel optimization",
        "Short-form video scripts (TikTok, Reels, YouTube Shorts)",
        "Priority strategy adjustments",
        "Bi-weekly strategy calls",
        "Live dashboard + custom reporting",
      ],
      bestFor: "Multi-location, high-growth real estate teams, regional contractors",
      featured: false,
      paymentLink: "https://buy.stripe.com/fZufZh2eU0f41SUfgh1ck0n",
    },
  ],
  addonNote:
    "Paid ad management also available as a standalone service — 10% of managed ad spend (min $750/month).",
  noLockPledge:
    "Month-to-month. Cancel anytime with 30 days notice. We earn your business every month.",
};

export const contactPage = {
  headline: "Let's Build Your Pipeline",
  subheadline:
    "Tell us about your business and what you need. We'll tell you honestly whether we can help — and exactly how.",
  contactInfo: {
    email: "hello@metroreachagency.com",
    phone: "(555) 555-5555",
    location: "Austin, TX — serving clients nationwide",
  },
  serviceOptions: [
    "Organic Content Management",
    "Paid Advertising",
    "Social Strategy",
    "Analytics & Reporting",
    "Community Management",
    "Full-Service (All of the Above)",
    "Not Sure Yet",
  ],
  fields: [
    { name: "fullName", label: "Name", type: "text", placeholder: "Your full name", required: true },
    { name: "email", label: "Email", type: "email", placeholder: "you@company.com", required: true },
    { name: "company", label: "Company", type: "text", placeholder: "Your company name", required: true },
    {
      name: "serviceInterest",
      label: "Service Interest",
      type: "select",
      placeholder: "Select a service",
      required: true,
    },
    {
      name: "message",
      label: "Message",
      type: "textarea",
      placeholder:
        "Tell us about your business, your goals, and what you're looking for in a marketing partner.",
      required: true,
    },
  ],
  nextSteps: [
    { step: 1, label: "A strategist reads your message — personally. You'll hear back within one business day." },
    {
      step: 2,
      label:
        "If there's a fit, we'll set up a 30-minute strategy call. If not, we'll tell you honestly and point you toward someone who can help.",
    },
    {
      step: 3,
      label: "No hard sell. No canned follow-ups. Straight answers from real marketers who want to earn your business.",
    },
  ],
  confirmation: "Thanks — we'll get back to you within one business day. No autoresponder spam, we promise.",
};

export const demoPage = {
  headline: "30 minutes. No pitch. Just clarity on what your marketing should be doing.",
  subheadline:
    "Book a call with our strategy team. We'll look at what you're doing now, what's missing, and whether MetroReach Media makes sense for your business. If it doesn't, we'll tell you.",
  takeaways: [
    "An honest assessment of your current marketing — what's working, what's not, what's costing you money you don't know about",
    "A realistic timeline for what results look like in your industry and market",
    "A clear recommendation — even if that recommendation is \"we're not the right fit\"",
    "No obligation. No contract waiting in your inbox. No follow-up pressure campaign.",
  ],
  prepare: [
    "A rough sense of your current marketing: what platforms you're on, what you're spending, what's frustrating you",
    "Your top business goal for the next 6 months (more leads? more listings? more booked consults?)",
    "That's it. Don't build a deck. Don't pull reports. Just show up.",
  ],
  timeCommitment: "30 minutes. We'll end on time. If we need more time to dig into something, we'll schedule a follow-up — we won't hold you hostage on a Zoom call.",
  bookingUrl: "/book",
  confirmation: "You're in. Check your email for the calendar invite and a quick note on what to expect.",
};

export const caseStudiesPage = {
  headline: "Results That Speak for Themselves",
  subheadline:
    "Three businesses. Three industries. One thing in common: they trusted MetroReach Media with their pipeline — and it paid off.",
  studies: [
    {
      name: "Ridgeway Heating & Cooling",
      industry: "HVAC — Residential service and replacement",
      challenge:
        "Ridgeway had built a solid reputation over 15 years — but it was all word of mouth. When competitors started running aggressive Google Local Services ads and posting daily on Facebook, Ridgeway's phone went from steady to sporadic.",
      approach: [
        "Built a Facebook and Instagram presence from scratch — educational content, seasonal offers, behind-the-scenes from job sites",
        "Launched Meta lead gen campaigns targeting homeowners within a 20-mile radius",
        "Optimized Google Business Profile with weekly posts, review management, and service-area targeting",
        "Created a content calendar aligned with HVAC seasonality",
      ],
      results: {
        before: "8–12 leads/month (mostly referrals)",
        after: "~18 leads/month, CPL ~$28, Facebook reach ~8,500/month",
      },
      quote:
        "We went from 2-3 leads a week to 15-20. Our phone rings every day now. I haven't thought about marketing in three months.",
      personName: "Mike R.",
      title: "Owner",
    },
    {
      name: "Lumina Aesthetics",
      industry: "Med Spa — Injectables, laser treatments, skin rejuvenation",
      challenge:
        "Lumina had a strong local reputation but growth had stalled. Their previous agency charged $6,000/month and delivered generic content. Patient acquisition cost was creeping up.",
      approach: [
        "Developed a distinct brand voice: clinical authority meets approachable luxury",
        "Built consistent Instagram and TikTok content: treatment explainers, patient journey stories, provider spotlights",
        "Launched Meta and TikTok conversion campaigns targeting high-intent aesthetic audiences",
        "Implemented compliance guardrails for medical claims",
      ],
      results: {
        before: "12–18 consults/month from social, ~$85 CPL",
        after: "28–34 consults/month from social, ~$52 CPL, Instagram +40% followers",
      },
      quote:
        "The content looks better than what our $6,000/month agency was producing — and it actually goes out on schedule.",
      personName: "Dr. Sarah C.",
      title: "Medical Director",
    },
    {
      name: "The Keller Group",
      industry: "Real Estate — Residential sales team (18 agents)",
      challenge:
        "The Keller Group was doing $40M+ in annual volume almost entirely on referrals and Zillow leads. Zillow costs were rising and conversion was dropping. The team brand was invisible online.",
      approach: [
        "Built a multi-platform brand presence: Instagram for listings, YouTube for neighborhood guides, LinkedIn for agent recruitment",
        "Created a listing marketing package: professional posts, neighborhood compilations, video walkthrough scripts",
        "Launched Meta and Google Ads targeting seller intent",
        "Developed agent content kits: pre-written posts and shareable assets",
      ],
      results: {
        before: "~4 seller leads/month, ~15 buyer leads/month",
        after: "~11 seller leads/month, ~31 buyer leads/month, listing win rate 60% → 80%",
      },
      quote:
        "The listing marketing alone is worth the retainer. We're winning listings because sellers can see we have a real marketing operation behind us.",
      personName: "David K.",
      title: "Team Lead",
    },
  ],
  cta: "Your results could be next.",
};

export const platformsPage = {
  headline: "Seven platforms. One team. Zero gaps.",
  subheadline:
    "We manage organic content and paid advertising across every platform that matters to service businesses. No subcontractors. No handoffs. No \"we don't really do TikTok.\"",
  platformBlocks: [
    {
      name: "Facebook",
      tagline: "The backbone of local service marketing.",
      description:
        "Facebook is where your customers live — especially homeowners 35+. We manage your business page, run lead gen and conversion campaigns through Meta Ads Manager, and build the kind of consistent presence that builds trust before someone picks up the phone.",
      items: ["Organic: daily posts, community engagement, review management", "Paid: lead gen ads, offer promotion, retargeting, lookalike audiences", "Formats: static posts, carousels, video, event-based campaigns"],
    },
    {
      name: "Instagram",
      tagline: "Where your brand looks as good as your work.",
      description:
        "Instagram is the showroom. For med spas, salons, real estate, and any business where visuals sell, we create platform-native content that stops the scroll.",
      items: ["Organic: Reels, Stories, feed posts, engagement with local accounts", "Paid: Story ads, feed ads, Reels ads, shopping ads", "Formats: short-form video, before/after carousels, behind-the-scenes, client features"],
    },
    {
      name: "TikTok",
      tagline: "Where attention goes first.",
      description:
        "TikTok isn't optional for businesses targeting under-45 audiences. We produce short-form video concepts, scripts, and direction that fit the platform's native tone.",
      items: ["Organic: video concepts, trending audio integration, community duets and stitches", "Paid: Spark Ads, In-Feed Ads, lead gen campaigns", "Formats: 15–60 second video, text-overlay explainers, day-in-the-life, quick tips"],
    },
    {
      name: "Google",
      tagline: "Where intent becomes a lead.",
      description:
        "When someone searches \"HVAC repair near me\" or \"best med spa Denver,\" you need to be there. We manage Google Search Ads, Local Services Ads, Display retargeting, and YouTube pre-roll.",
      items: ["Search: keyword strategy, ad copy, bid management, Local Services Ads", "Display: retargeting, local awareness, competitor geo-fencing", "YouTube: pre-roll and in-stream ads, channel content strategy, video SEO"],
    },
    {
      name: "LinkedIn",
      tagline: "For B2B services and professional trust.",
      description:
        "If you sell to other businesses — commercial contractors, B2B clinics, real estate teams recruiting agents — LinkedIn is your platform.",
      items: ["Organic: company page posts, thought leadership articles, industry commentary", "Paid: lead gen forms, sponsored content, InMail campaigns", "Formats: text posts, document carousels, video, sponsored articles"],
    },
    {
      name: "X (Twitter)",
      tagline: "Real-time presence for brands that move fast.",
      description:
        "X is optional for most service businesses — but powerful for real estate teams, industry authority building, and brands that want to engage in real-time.",
      items: ["Organic: daily posts, thread-based content, community engagement", "Paid: promoted posts, trend takeover (selective, high-impact)", "Formats: short text posts, threads, video clips, polls"],
    },
  ],
  philosophy:
    "We don't recommend all seven platforms for every client. During onboarding, we identify the 2–4 platforms where your customers actually spend time — and we dominate those. Adding platforms is easy when you're ready.",
  cta: "Your customers are on these platforms right now. Are you?",
};

export const faqPage = {
  headline: "Questions smart business owners ask before signing up.",
  items: [
    {
      question: "How do you handle multiple platforms without spreading too thin?",
      answer:
        "Most agencies assign one person to handle 4–5 accounts across multiple platforms. That's how things slip. We run a dedicated team structure — each specialist focuses on their function across your accounts. No single point of failure. No 'sorry, your account manager is on vacation.'",
    },
    {
      question: "What if I don't like the content? Can I approve posts before they go live?",
      answer:
        "During onboarding, we build your brand voice model and content guidelines. Once you sign off on the direction, we execute. Most clients prefer to review the monthly content calendar — but we can build in pre-approval workflows if your industry requires it.",
    },
    {
      question: "How long until I see results?",
      answer:
        "Paid ads: 2–4 weeks to dial in targeting and creative. By month two, you should see your CPL approaching target. Organic: 60–90 days to build meaningful momentum. No agency can guarantee overnight results. But we can guarantee we won't waste time.",
    },
    {
      question: "What industries do you specialize in?",
      answer:
        "Service-based businesses that depend on local leads: contractors, med spas and aesthetic clinics, auto repair shops, real estate teams, dental and medical clinics, salons and personal services.",
    },
    {
      question: "What if I want to change my package or cancel?",
      answer:
        "Switch packages or cancel with 30 days notice. No penalty. No \"annual commitment.\" We designed this for business owners who've been burned by agency contracts.",
    },
    {
      question: "What makes your content better than what I'd get from a freelancer?",
      answer:
        "Freelancers are one person trying to do everything — strategy, writing, design, posting, optimization. We run a full team of specialists. Your strategy is built by someone who studies your market. Your copy is written by a dedicated writer. Your performance is tracked by an analyst who flags what's working and what's not. You get the output of an entire agency, not one person's best effort.",
    },
    {
      question: "Do you handle compliance-sensitive industries?",
      answer:
        "Yes. Med spas, clinics, and other regulated businesses work within specific guardrails. We build your compliance requirements into our content guidelines during onboarding. Claims, disclaimers, and platform-specific rules are part of the system.",
    },
  ],
};

export const securityPage = {
  headline: "How we protect your business.",
  subheadline:
    "Marketing compliance isn't a checkbox at the end. We build it into how we operate — from content creation to data handling to platform policy adherence.",
  dataHandling: {
    access:
      "We connect to your social media accounts and advertising platforms through official APIs and OAuth. We do not ask for, store, or need your banking credentials, customer payment data, or protected health information (PHI).",
    storage: [
      "Client credentials are encrypted at rest and in transit",
      "Campaign data, audience insights, and performance metrics are stored in isolated tenant environments — your data is never commingled with other clients",
      "Access is role-restricted: only the team members that need your data to operate can access it",
    ],
    customerData:
      "We don't collect, store, or process your customers' personal data beyond what social platforms provide through their standard analytics and lead form integrations. If you use a CRM integration, we connect through the CRM's official API.",
    retention:
      "When you cancel, we disconnect all platform integrations within 48 hours. Campaign performance data is retained for 90 days (for your reference if you return), then purged.",
  },
  platformCompliance: [
    {
      name: "Meta (Facebook & Instagram)",
      text: "We operate within Meta's advertising policies, commerce policies, and community standards. Our team is trained on vertical-specific compliance rules — housing, employment, credit, and special ad category requirements are built into campaign setup.",
    },
    {
      name: "Google (Search, Display, YouTube)",
      text: "We adhere to Google Ads policies including restricted content categories, local service ad requirements, and Google Business Profile guidelines. For industries with Google's verification requirements, we guide you through verification.",
    },
    {
      name: "TikTok",
      text: "We follow TikTok's advertising policies and branded content guidelines. For restricted industries, we apply the appropriate content limitations and disclaimers.",
    },
    {
      name: "LinkedIn",
      text: "We comply with LinkedIn's advertising policies and professional community guidelines, including industry-specific restrictions for healthcare, legal, and financial services.",
    },
    {
      name: "X",
      text: "We adhere to X's advertising policies and content guidelines, including regulated industry restrictions.",
    },
  ],
  guardrails: [
    {
      industry: "Med Spas & Aesthetic Clinics",
      text: "All content adheres to platform-specific medical advertising policies. Claims are reviewed against FDA and platform standards. We never use patient images without documented consent.",
    },
    {
      industry: "Real Estate",
      text: "Fair Housing Act compliance is built into audience targeting rules. Listing content follows MLS and local regulatory requirements. Agent and brokerage disclosure requirements are met on all paid advertising.",
    },
    {
      industry: "Home Services (Contractors, Auto Shops)",
      text: "Google Local Services Ads verification support. License and insurance information properly displayed where required. No misleading pricing or guarantee claims that create compliance exposure.",
    },
  ],
  disclaimer:
    "We don't claim certifications we don't have. We're not SOC 2 certified. We're not HIPAA compliant (and no marketing agency should claim to be unless they're processing PHI — which we don't). We don't make guarantees about platform algorithms or ad approval. Platforms change their rules. We adapt quickly and transparently when they do.",
};

export const privacyPage = {
  headline: "Privacy Policy",
  lastUpdated: "July 2026",
  sections: [
    {
      heading: "Information We Collect",
      text: "We collect information you provide directly: name, email, phone number, business details, and marketing preferences when you fill out our contact form or book a strategy call. We also collect standard web analytics data: pages visited, referrer, device type, and approximate location — all anonymized.",
    },
    {
      heading: "How We Use Your Information",
      text: "We use your information to respond to inquiries, provide our services, send occasional relevant updates (only if you opt in), and improve our website and service based on aggregated analytics.",
    },
    {
      heading: "Information Sharing",
      text: "We do not sell, rent, or share your personal information with third parties for their marketing purposes. We may use trusted service providers (scheduling tools, analytics) who are contractually bound to handle data securely.",
    },
    {
      heading: "Data Retention",
      text: "We retain your information for as long as needed to provide our services or as required by law. If you request deletion, we'll remove your data within 30 days.",
    },
    {
      heading: "Your Rights",
      text: "You can request access to, correction of, or deletion of your personal data at any time by contacting us at hello@metroreachagency.com.",
    },
    {
      heading: "Contact",
      text: "For privacy-related questions, reach us at hello@metroreachagency.com.",
    },
  ],
};

export const termsPage = {
  headline: "Terms of Service",
  lastUpdated: "July 2026",
  sections: [
    {
      heading: "Services",
      text: "MetroReach Media provides social media marketing services including organic content management, paid advertising management, and strategy consulting as described in our service agreements.",
    },
    {
      heading: "Payment",
      text: "Services are billed monthly in advance. Payments are due on the invoice date. Late payments may result in service suspension after a 7-day grace period.",
    },
    {
      heading: "Cancellation",
      text: "Either party may cancel with 30 days written notice. Upon cancellation, we'll complete any outstanding paid campaigns through the end of the billing period and disconnect platform integrations within 48 hours of the end date.",
    },
    {
      heading: "Intellectual Property",
      text: "Content created for your business (posts, ad creative, strategy documents) belongs to you upon full payment. Our proprietary systems and methodologies remain our intellectual property.",
    },
    {
      heading: "Limitation of Liability",
      text: "While we work diligently to deliver results, marketing outcomes depend on many factors beyond our control (market conditions, platform algorithm changes, competitive activity). Our liability is limited to the fees paid for the specific service period in question.",
    },
    {
      heading: "Platform Policies",
      text: "You agree to comply with the terms of service of each social media and advertising platform we manage on your behalf. We're not responsible for account suspensions or ad rejections resulting from platform policy violations outside our control.",
    },
    {
      heading: "Contact",
      text: "For questions about these terms, contact us at hello@metroreachagency.com.",
    },
  ],
};

export const dashboardPage = {
  title: "Client Dashboard — MetroReach Media",
  description: "Real-time performance dashboard for Ridgeway Heating & Cooling.",
  clientName: "Ridgeway Heating & Cooling",
  month: "June 2026",
};

export const cookiePolicyPage = {
  headline: "Cookie Policy",
  lastUpdated: "July 2026",
  sections: [
    {
      heading: "What Are Cookies?",
      text: "Cookies are small text files placed on your device when you visit a website. They're widely used to make websites work, work better, and provide information to the site owners. They don't contain viruses and can't access other files on your device.",
    },
    {
      heading: "What Cookies We Use",
      text: "Our website uses a minimal set of cookies. We don't run ad trackers, retargeting pixels, or third-party marketing cookies on metroreachagency.com.",
    },
    {
      heading: "Essential Cookies",
      text: "A session cookie maintains your session while you browse (e.g., contact form submission). It expires when you close your browser.",
    },
    {
      heading: "Analytics Cookies",
      text: "We use a privacy-focused analytics tool to understand how visitors use our site. Cookies are anonymous (page views, referrer, basic device info), retained for 30 days. We do not track you across other websites or sell analytics data.",
    },
    {
      heading: "Third-Party Cookies",
      text: "We embed a scheduling tool for strategy call bookings. When you use the booking widget, the scheduling provider may set its own cookies for functionality. These are governed by the provider's own cookie policy.",
    },
    {
      heading: "How to Control Cookies",
      text: "You can block or delete cookies through your browser settings. Blocking essential cookies may affect form functionality. Blocking analytics cookies won't affect your experience.",
    },
    {
      heading: "Contact",
      text: "If you have questions about this policy, contact us at hello@metroreachagency.com.",
    },
  ],
};
