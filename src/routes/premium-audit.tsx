import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  ChartBar,
  MagnifyingGlass,
  Lightning,
  ShieldCheck,
  Medal,
  Star,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";

const industries = [
  "Contractor",
  "Med Spa",
  "Real Estate",
  "Auto Shop",
  "Clinic",
  "Salon",
  "Restaurant",
  "Law Firm",
  "Dental Practice",
  "Home Services",
  "Other",
] as const;

const primaryGoals = [
  "Generate more leads",
  "Improve brand awareness",
  "Increase website traffic",
  "Get more reviews",
  "Expand to new platforms",
  "Build a consistent social presence",
  "All of the above",
] as const;

export const Route = createFileRoute("/premium-audit")({
  component: PremiumAudit,
});

const inputClass =
  "w-full rounded-xl bg-bg-surface-raised border border-border-subtle px-4 py-3.5 text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-all duration-200 text-base";
const labelClass = "block text-sm font-medium text-text-secondary mb-2";
const optionalClass = "text-text-muted font-normal";

function PremiumAudit() {
  return (
    <main>
      {/* Hero */}
      <section className="relative py-24 lg:py-32 bg-bg-root overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_at_50%_30%,rgba(0,143,255,0.08),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_400px_at_80%_60%,rgba(6,214,160,0.06),transparent)] pointer-events-none" />

        <Container className="relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-medium text-brand-accent uppercase tracking-widest mb-6">
              Premium Growth Audit
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading text-text-primary tracking-tight leading-[1.05] mb-6">
              Get Your Complete Growth Blueprint
            </h1>
            <p className="text-lg lg:text-xl text-text-secondary max-w-2xl mx-auto mb-8">
              MetroReach Media's most comprehensive business assessment — 12
              categories, evidence-based scoring, priority matrix, and a phased
              growth roadmap built by our team of marketing specialists.
            </p>
            <div className="inline-flex items-center gap-3 bg-bg-surface-raised border border-brand-primary/30 rounded-full px-6 py-3">
              <span className="text-2xl font-bold font-heading text-text-primary">$495</span>
              <span className="text-sm text-text-secondary">
                Fully creditable toward any qualifying service within 30 days
              </span>
            </div>
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
                Your premium audit includes:
              </h3>
              <ul className="space-y-3">
                {[
                  {
                    icon: MagnifyingGlass,
                    text: "12-category comprehensive analysis — Brand Identity, Website, Social Media, Content Strategy, Local Marketing, Search Visibility, Reputation, Competitor, Lead Generation, Advertising Readiness, and more",
                  },
                  {
                    icon: ChartBar,
                    text: "Evidence-based scoring with detailed observations and supporting evidence for every category",
                  },
                  {
                    icon: Medal,
                    text: "Priority Matrix ranking every issue by Business Impact × Implementation Difficulty",
                  },
                  {
                    icon: Lightning,
                    text: "4-Phase Growth Roadmap with specific actions, timeframes, and expected outcomes",
                  },
                  {
                    icon: Star,
                    text: "Executive Summary with Overall Marketing Score, Business Health Rating, and top recommendations",
                  },
                  {
                    icon: ShieldCheck,
                    text: "Service recommendations mapped to your specific gaps — each with pricing, timeline, and deliverables",
                  },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                    <item.icon
                      size={18}
                      weight="fill"
                      className="text-brand-accent flex-shrink-0 mt-0.5"
                    />
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Error banner — hidden by default, shown via JS */}
            <div
              id="form-error"
              className="hidden bg-error/10 border border-error/30 text-error rounded-xl p-4 mb-8"
              role="alert"
            >
              <p className="text-sm font-medium flex items-start gap-2">
                <span className="text-base flex-shrink-0">⚠</span>
                <span id="form-error-msg"></span>
              </p>
            </div>

            {/* FORM — hybrid: pure HTML fallback, JS-enhanced for error handling */}
            <form
              id="premium-audit-form"
              action="/api/premium-audit/submit"
              method="POST"
              encType="application/x-www-form-urlencoded"
              className="space-y-8"
            >
              {/* ── Business Information ── */}
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
                      <option value="" disabled selected>
                        Select your industry
                      </option>
                      {industries.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
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
                      <option value="" disabled selected>
                        What's your top priority?
                      </option>
                      {primaryGoals.map((goal) => (
                        <option key={goal} value={goal}>
                          {goal}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* ── Social Profiles ── */}
              <fieldset className="space-y-5">
                <legend className="text-lg font-semibold font-heading text-text-primary mb-1">
                  Your Social Profiles
                </legend>
                <p className="text-sm text-text-muted -mt-3">
                  Paste the full URLs. The more you share, the deeper your analysis. All optional — our team evaluates what's provided.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="facebookUrl" className={labelClass}>
                      Facebook URL <span className={optionalClass}>(optional)</span>
                    </label>
                    <input
                      id="facebookUrl"
                      name="facebookUrl"
                      type="url"
                      className={inputClass}
                      placeholder="https://facebook.com/yourpage"
                    />
                  </div>
                  <div>
                    <label htmlFor="instagramUrl" className={labelClass}>
                      Instagram URL <span className={optionalClass}>(optional)</span>
                    </label>
                    <input
                      id="instagramUrl"
                      name="instagramUrl"
                      type="url"
                      className={inputClass}
                      placeholder="https://instagram.com/yourhandle"
                    />
                  </div>
                  <div>
                    <label htmlFor="xUrl" className={labelClass}>
                      X URL <span className={optionalClass}>(optional)</span>
                    </label>
                    <input
                      id="xUrl"
                      name="xUrl"
                      type="url"
                      className={inputClass}
                      placeholder="https://x.com/yourhandle"
                    />
                  </div>
                  <div>
                    <label htmlFor="linkedinUrl" className={labelClass}>
                      LinkedIn URL <span className={optionalClass}>(optional)</span>
                    </label>
                    <input
                      id="linkedinUrl"
                      name="linkedinUrl"
                      type="url"
                      className={inputClass}
                      placeholder="https://linkedin.com/company/yourcompany"
                    />
                  </div>
                  <div>
                    <label htmlFor="tiktokUrl" className={labelClass}>
                      TikTok URL <span className={optionalClass}>(optional)</span>
                    </label>
                    <input
                      id="tiktokUrl"
                      name="tiktokUrl"
                      type="url"
                      className={inputClass}
                      placeholder="https://tiktok.com/@yourhandle"
                    />
                  </div>
                  <div>
                    <label htmlFor="googleBusinessUrl" className={labelClass}>
                      Google Business Profile URL <span className={optionalClass}>(optional)</span>
                    </label>
                    <input
                      id="googleBusinessUrl"
                      name="googleBusinessUrl"
                      type="url"
                      className={inputClass}
                      placeholder="https://maps.google.com/..."
                    />
                  </div>
                </div>
              </fieldset>

              {/* ── Contact Information ── */}
              <fieldset className="space-y-5">
                <legend className="text-lg font-semibold font-heading text-text-primary mb-1">
                  Your Contact Information
                </legend>

                <div>
                  <label htmlFor="contactName" className={labelClass}>
                    Contact Name <span className="text-error">*</span>
                  </label>
                  <input
                    id="contactName"
                    name="contactName"
                    type="text"
                    className={inputClass}
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="email" className={labelClass}>
                      Email Address <span className="text-error">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className={inputClass}
                      placeholder="you@company.com"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className={labelClass}>
                      Phone <span className={optionalClass}>(optional)</span>
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      className={inputClass}
                      placeholder="(555) 555-5555"
                    />
                  </div>
                </div>
              </fieldset>

              {/* ── Consent ── */}
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

              {/* ── Submit ── */}
              <div className="pt-4">
                <button
                  id="submit-btn"
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 ease-out bg-brand-primary text-text-primary rounded-full px-10 py-4 text-base hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary hover:shadow-[0_0_20px_rgba(0,143,255,0.15)] hover:scale-[1.02] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                >
                  <span id="submit-btn-text">Get My Premium Audit — $495</span>
                  <span id="submit-btn-spinner" className="hidden" aria-hidden="true">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </span>
                </button>
                <p className="text-xs text-text-muted mt-4">
                  You'll be redirected to Stripe for secure payment. After purchase,
                  your comprehensive report is generated immediately.
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
            <p className="text-sm text-text-muted uppercase tracking-widest mb-6">
              How It Works
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  label: "Complete the form",
                  desc: "Share your website and social profiles. Takes 2 minutes and gives our team the data needed for a thorough analysis.",
                },
                {
                  step: "02",
                  label: "Secure payment",
                  desc: "$495 via Stripe — fully creditable toward any qualifying MetroReach Media service within 30 days.",
                },
                {
                  step: "03",
                  label: "Your report is ready instantly",
                  desc: "12 categories scored. Priority matrix. Growth roadmap. Service recommendations. All evidence-based.",
                },
              ].map((item) => (
                <div key={item.step}>
                  <p className="text-3xl font-bold font-heading text-brand-primary/30 mb-2">
                    {item.step}
                  </p>
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
              specialists has delivered comprehensive growth audits to businesses across
              contracting, med spas, real estate, auto shops, clinics, and salons.
            </p>
          </div>
        </Container>
      </section>

      <Outlet />

      {/* Inline JS — hybrid form enhancement for error display + loading state */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  var form = document.getElementById('premium-audit-form');
  var errorDiv = document.getElementById('form-error');
  var errorMsg = document.getElementById('form-error-msg');
  var submitBtn = document.getElementById('submit-btn');
  var btnText = document.getElementById('submit-btn-text');
  var btnSpinner = document.getElementById('submit-btn-spinner');

  if (!form || !errorDiv || !errorMsg || !submitBtn || !btnText || !btnSpinner) return;

  function showError(msg) {
    errorMsg.textContent = msg;
    errorDiv.classList.remove('hidden');
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function hideError() {
    errorDiv.classList.add('hidden');
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    if (loading) {
      btnText.textContent = 'Processing...';
      btnSpinner.classList.remove('hidden');
    } else {
      btnText.textContent = 'Get My Premium Audit — $495';
      btnSpinner.classList.add('hidden');
    }
  }

  // Check URL for error param on page load
  var urlParams = new URLSearchParams(window.location.search);
  var urlError = urlParams.get('error');
  if (urlError) {
    showError(decodeURIComponent(urlError));
    // Clean URL without reloading
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  // Intercept form submit
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    hideError();
    setLoading(true);

    var formData = new FormData(form);
    var body = new URLSearchParams(formData).toString();

    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
      redirect: 'follow',
    })
      .then(function(resp) {
        var finalUrl = resp.url;
        if (finalUrl.indexOf('checkout.stripe.com') !== -1) {
          // Success — redirect to Stripe Checkout
          window.location.href = finalUrl;
        } else if (finalUrl.indexOf('?error=') !== -1) {
          // API returned an error — extract and show inline (form data preserved!)
          var parts = finalUrl.split('?');
          var errParams = new URLSearchParams(parts[1] || '');
          var err = errParams.get('error');
          showError(err ? decodeURIComponent(err) : 'An unexpected error occurred. Please try again.');
          setLoading(false);
        } else {
          // Unexpected response — navigate to it
          window.location.href = finalUrl;
        }
      })
      .catch(function() {
        showError('A network error occurred. Please check your connection and try again.');
        setLoading(false);
      });
  });
})();
          `.trim(),
        }}
      />
    </main>
  );
}
