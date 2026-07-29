import { createFileRoute } from "@tanstack/react-router";
import { Container } from "~/components/Container";

const industries = [
  "Contractor", "Med Spa", "Real Estate", "Auto Shop", "Clinic",
  "Salon", "Restaurant", "Law Firm", "Dental Practice", "Home Services", "Other",
] as const;

const primaryGoals = [
  "Generate more leads", "Improve brand awareness", "Increase website traffic",
  "Get more reviews", "Expand to new platforms", "Build a consistent social presence", "All of the above",
] as const;

export const Route = createFileRoute("/free-audit/")({
  head: () => ({
    meta: [
      { title: "Free Social Media Audit — MetroReach Media" },
      { name: "description", content: "Get a free audit of your digital presence. We'll identify gaps and recommend the right marketing package — no obligation." },
      { property: "og:url", content: "https://www.metroreachagency.com/free-audit" },
    ],
    links: [
      { rel: "canonical", href: "https://www.metroreachagency.com/free-audit" },
    ],
  }),
  component: FreeAudit,
});

const inputClass =
  "w-full rounded-xl bg-bg-surface-raised border border-border-subtle px-4 py-3.5 text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-all duration-200 text-base";
const labelClass = "block text-sm font-medium text-text-secondary mb-2";
const optionalClass = "text-text-muted font-normal";

function FreeAudit() {
  return (
    <main>
      {/* Hero */}
      <section className="relative py-24 lg:py-32 bg-bg-root overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_at_50%_30%,rgba(0,143,255,0.06),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_400px_at_80%_60%,rgba(6,214,160,0.04),transparent)] pointer-events-none" />
        <Container className="relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-medium text-brand-accent uppercase tracking-widest mb-6">
              Free Social Media Audit
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading text-text-primary tracking-tight leading-[1.05] mb-6">
              Get Your Free Social Media Audit
            </h1>
            <p className="text-lg lg:text-xl text-text-secondary max-w-2xl mx-auto">
              MetroReach Media analyzes your digital presence across your website and social
              platforms — then delivers a detailed report with scores, strengths,
              weaknesses, and a clear growth plan. No templates. No fluff.
            </p>
          </div>
        </Container>
      </section>

      {/* Form Section */}
      <section className="py-20 bg-bg-surface">
        <Container>
          <div className="max-w-2xl mx-auto">

            {/* What's included */}
            <div className="mb-12 p-6 rounded-2xl bg-bg-surface-raised border border-border-subtle">
              <h3 className="text-lg font-semibold font-heading text-text-primary mb-4">
                Your free audit includes:
              </h3>
              <ul className="space-y-3">
                {[
                  "Website analysis — meta tags, content depth, and technical health",
                  "10-category social media health scoring with evidence-based observations",
                  "Branding and content quality evaluation with specific recommendations",
                  "Quick Wins you can implement today with zero budget",
                  "Service recommendations mapped to your specific gaps and goals",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                    <span className="text-brand-accent flex-shrink-0 mt-0.5">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* FORM — Pure HTML, no JavaScript required */}
            <form
              action="/api/audit/submit"
              method="POST"
              encType="application/x-www-form-urlencoded"
              className="space-y-8"
            >
              {/* Business Information */}
              <fieldset className="space-y-5">
                <legend className="text-lg font-semibold font-heading text-text-primary mb-1">
                  About Your Business
                </legend>

                <div>
                  <label htmlFor="businessName" className={labelClass}>
                    Business Name <span className="text-error">*</span>
                  </label>
                  <input
                    id="businessName"
                    name="businessName"
                    type="text"
                    className={inputClass}
                    placeholder="Your company name"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="websiteUrl" className={labelClass}>
                      Website URL <span className="text-error">*</span>
                    </label>
                    <input
                      id="websiteUrl"
                      name="websiteUrl"
                      type="url"
                      className={inputClass}
                      placeholder="https://yourbusiness.com"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="industry" className={labelClass}>
                      Industry <span className="text-error">*</span>
                    </label>
                    <select
                      id="industry"
                      name="industry"
                      className={inputClass}
                      required
                    >
                      <option value="" disabled selected>Select your industry</option>
                      {industries.map((ind) => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="location" className={labelClass}>
                      Business Location (City/State) <span className="text-error">*</span>
                    </label>
                    <input
                      id="location"
                      name="location"
                      type="text"
                      className={inputClass}
                      placeholder="Austin, TX"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="primaryGoal" className={labelClass}>
                      Primary Goal <span className="text-error">*</span>
                    </label>
                    <select
                      id="primaryGoal"
                      name="primaryGoal"
                      className={inputClass}
                      required
                    >
                      <option value="" disabled selected>What's your top priority?</option>
                      {primaryGoals.map((goal) => (
                        <option key={goal} value={goal}>{goal}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Social Profiles */}
              <fieldset className="space-y-5">
                <legend className="text-lg font-semibold font-heading text-text-primary mb-1">
                  Your Social Profiles
                </legend>
                <p className="text-sm text-text-muted -mt-3">
                  Paste the full URLs to your profiles. The more you share, the more
                  complete your audit. All fields are optional — we'll analyze what we can.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="facebookUrl" className={labelClass}>
                      Facebook URL <span className={optionalClass}>(optional)</span>
                    </label>
                    <input id="facebookUrl" name="facebookUrl" type="url" className={inputClass} placeholder="https://facebook.com/yourpage" />
                  </div>
                  <div>
                    <label htmlFor="instagramUrl" className={labelClass}>
                      Instagram URL <span className={optionalClass}>(optional)</span>
                    </label>
                    <input id="instagramUrl" name="instagramUrl" type="url" className={inputClass} placeholder="https://instagram.com/yourhandle" />
                  </div>
                  <div>
                    <label htmlFor="xUrl" className={labelClass}>
                      X URL <span className={optionalClass}>(optional)</span>
                    </label>
                    <input id="xUrl" name="xUrl" type="url" className={inputClass} placeholder="https://x.com/yourhandle" />
                  </div>
                  <div>
                    <label htmlFor="linkedinUrl" className={labelClass}>
                      LinkedIn URL <span className={optionalClass}>(optional)</span>
                    </label>
                    <input id="linkedinUrl" name="linkedinUrl" type="url" className={inputClass} placeholder="https://linkedin.com/company/your-page" />
                  </div>
                  <div>
                    <label htmlFor="tiktokUrl" className={labelClass}>
                      TikTok URL <span className={optionalClass}>(optional)</span>
                    </label>
                    <input id="tiktokUrl" name="tiktokUrl" type="url" className={inputClass} placeholder="https://tiktok.com/@yourhandle" />
                  </div>
                  <div>
                    <label htmlFor="googleBusinessUrl" className={labelClass}>
                      Google Business URL <span className={optionalClass}>(optional)</span>
                    </label>
                    <input id="googleBusinessUrl" name="googleBusinessUrl" type="url" className={inputClass} placeholder="https://maps.google.com/?cid=..." />
                  </div>
                </div>
              </fieldset>

              {/* Contact */}
              <fieldset className="space-y-5">
                <legend className="text-lg font-semibold font-heading text-text-primary mb-1">
                  Your Contact Information
                </legend>
                <div>
                  <label htmlFor="contactName" className={labelClass}>
                    Contact Name <span className="text-error">*</span>
                  </label>
                  <input id="contactName" name="contactName" type="text" className={inputClass} placeholder="Your full name" required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="email" className={labelClass}>
                      Email Address <span className="text-error">*</span>
                    </label>
                    <input id="email" name="email" type="email" className={inputClass} placeholder="you@company.com" required />
                  </div>
                  <div>
                    <label htmlFor="phone" className={labelClass}>
                      Phone <span className={optionalClass}>(optional)</span>
                    </label>
                    <input id="phone" name="phone" type="tel" className={inputClass} placeholder="(555) 555-5555" />
                  </div>
                </div>
              </fieldset>

              {/* Consent */}
              <fieldset>
                <div className="flex items-start gap-3">
                  <input
                    id="consent"
                    name="consent"
                    type="checkbox"
                    value="on"
                    required
                    className="mt-1 w-4 h-4 rounded border-border-emphasis bg-bg-surface-raised text-brand-primary focus:ring-brand-primary/30 cursor-pointer"
                  />
                  <label htmlFor="consent" className="text-sm text-text-secondary cursor-pointer">
                    I consent to MetroReach Media analyzing publicly accessible business information{" "}
                    <span className="text-error">*</span>
                  </label>
                </div>
              </fieldset>

              {/* Submit */}
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 ease-out bg-brand-primary text-text-primary rounded-full px-10 py-4 text-base hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary hover:shadow-[0_0_20px_rgba(0,143,255,0.15)] hover:scale-[1.02] cursor-pointer"
                >
                  Get My Free Audit
                </button>
                <p className="text-xs text-text-muted mt-4">
                  Free. No credit card. No commitment. Our team reviews your
                  submission and delivers your report instantly.
                </p>
              </div>
            </form>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="py-16 bg-bg-root border-t border-border-subtle">
        <Container>
          <div className="text-center max-w-xl mx-auto">
            <p className="text-sm text-text-muted uppercase tracking-widest mb-6">How It Works</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                { step: "01", label: "You fill out the form", desc: "Takes 2 minutes. Share your website and the social profiles you want analyzed." },
                { step: "02", label: "Our team reviews your presence", desc: "MetroReach Media analyzes your website, social profiles, and competitive position using our proven methodology." },
                { step: "03", label: "Your report is ready instantly", desc: "Scored, analyzed, and delivered as a detailed report with specific recommendations — no waiting." },
              ].map((item) => (
                <div key={item.step}>
                  <p className="text-3xl font-bold font-heading text-brand-primary/30 mb-2">{item.step}</p>
                  <p className="text-sm font-semibold text-text-primary mb-1">{item.label}</p>
                  <p className="text-xs text-text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Trust bar */}
      <section className="py-12 bg-bg-surface border-t border-border-subtle">
        <Container>
          <div className="text-center max-w-xl mx-auto">
            <p className="text-sm text-text-muted">
              MetroReach Media — Premium Social Media Marketing. Our team of
              specialists has delivered this audit methodology to businesses across
              contracting, med spas, real estate, auto shops, clinics, and salons.
            </p>
          </div>
        </Container>
      </section>
    </main>
  );
}
