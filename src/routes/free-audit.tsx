import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CaretDown,
  Spinner,
  CheckCircle,
  ChartBar,
  MagnifyingGlass,
  Lightning,
  ShieldCheck,
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

interface FormState {
  businessName: string;
  websiteUrl: string;
  industry: string;
  location: string;
  primaryGoal: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  tiktokUrl: string;
  googleBusinessUrl: string;
  contactName: string;
  email: string;
  phone: string;
  consent: boolean;
}

const initialForm: FormState = {
  businessName: "",
  websiteUrl: "",
  industry: "",
  location: "",
  primaryGoal: "",
  facebookUrl: "",
  instagramUrl: "",
  linkedinUrl: "",
  tiktokUrl: "",
  googleBusinessUrl: "",
  contactName: "",
  email: "",
  phone: "",
  consent: false,
};

type FieldName = keyof FormState;

export const Route = createFileRoute("/free-audit")({
  component: FreeAudit,
});

function FreeAudit() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const update = (field: FieldName, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const errs: Partial<Record<FieldName, string>> = {};

    // Required text fields
    const required: { field: FieldName; label: string }[] = [
      { field: "businessName", label: "Business name" },
      { field: "websiteUrl", label: "Website URL" },
      { field: "industry", label: "Industry" },
      { field: "location", label: "Business location" },
      { field: "primaryGoal", label: "Primary goal" },
      { field: "contactName", label: "Contact name" },
      { field: "email", label: "Email address" },
    ];

    for (const { field, label } of required) {
      if (typeof form[field] === "string" && !(form[field] as string).trim()) {
        errs[field] = `${label} is required.`;
      }
    }

    // Email format
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Enter a valid email address.";
    }

    // Website URL format
    if (form.websiteUrl.trim()) {
      try {
        const url = new URL(form.websiteUrl.trim());
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          errs.websiteUrl = "Enter a valid URL starting with http:// or https://";
        }
      } catch {
        errs.websiteUrl = "Enter a valid URL (e.g., https://yourbusiness.com)";
      }
    }

    // Social URL format (optional but validate if provided)
    const socialUrls: { field: FieldName; label: string }[] = [
      { field: "facebookUrl", label: "Facebook URL" },
      { field: "instagramUrl", label: "Instagram URL" },
      { field: "linkedinUrl", label: "LinkedIn URL" },
      { field: "tiktokUrl", label: "TikTok URL" },
      { field: "googleBusinessUrl", label: "Google Business Profile URL" },
    ];
    for (const { field, label } of socialUrls) {
      const val = form[field] as string;
      if (val.trim()) {
        try {
          const url = new URL(val.trim());
          if (url.protocol !== "http:" && url.protocol !== "https:") {
            errs[field] = `Enter a valid ${label}.`;
          }
        } catch {
          errs[field] = `Enter a valid ${label}.`;
        }
      }
    }

    // Consent
    if (!form.consent) {
      errs.consent = "Please confirm your consent to continue.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    console.log("handleSubmit called", form);
    if (!validate()) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/audit/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      // Try to parse JSON; if parsing fails, treat as network/server error
      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error("We couldn't reach our servers. Please check your connection and try again.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      // Save the full audit result to sessionStorage so the report page
      // can access it even on Vercel where serverless instances are ephemeral.
      if (data.result) {
        try {
          sessionStorage.setItem("audit-result", JSON.stringify(data.result));
        } catch {
          // sessionStorage might be full or unavailable — non-critical,
          // the report page will fall back to the URL hash or server-side loader.
        }
      }

      setStatus("success");
      if (data.redirect && data.result) {
        // ── Priority 0: Encode the full result in the URL hash ──
        // This works 100% of the time — no database, no sessionStorage,
        // no serverless issues. The report page reads from window.location.hash.
        const json = JSON.stringify(data.result);
        // Safe base64 encoding that handles any Unicode character
        const encoded = btoa(
          encodeURIComponent(json).replace(
            /%([0-9A-F]{2})/g,
            (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16))
          )
        );
        window.location.href =
          data.redirect.split("?")[0] + "#data=" + encoded;
      } else if (data.redirect) {
        window.location.href = data.redirect;
      }
    } catch (err: any) {
      console.error("Audit form submission error:", err);
      setStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    }
  };

  const inputClass =
    "w-full rounded-xl bg-bg-surface-raised border border-border-subtle px-4 py-3.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-all duration-200 text-base";
  const labelClass = "block text-sm font-medium text-text-secondary mb-2";
  const errorClass = "text-xs text-error mt-1.5";
  const optionalClass = "text-text-muted font-normal";

  return (
    <main>
      {/* Hero */}
      <section className="relative py-24 lg:py-32 bg-bg-root overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_at_50%_30%,rgba(59,130,246,0.06),transparent)] pointer-events-none" />
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
              Metro Reach Media analyzes your digital presence across your website and social
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
                  {
                    icon: MagnifyingGlass,
                    text: "Website analysis — meta tags, content depth, and technical health",
                  },
                  {
                    icon: ChartBar,
                    text: "10-category social media health scoring with evidence-based observations",
                  },
                  {
                    icon: ShieldCheck,
                    text: "Branding and content quality evaluation with specific recommendations",
                  },
                  {
                    icon: Lightning,
                    text: "Quick Wins you can implement today with zero budget",
                  },
                  {
                    icon: ArrowRight,
                    text: "Service recommendations mapped to your specific gaps and goals",
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

            {/* Error message */}
            {status === "error" && (
              <div className="mb-8 p-4 rounded-xl bg-error/10 border border-error/30 text-error text-sm">
                {errorMessage}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-8" noValidate>
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
                    type="text"
                    className={inputClass}
                    placeholder="Your company name"
                    value={form.businessName}
                    onChange={(e) => update("businessName", e.target.value)}
                    required
                  />
                  {errors.businessName && <p className={errorClass}>{errors.businessName}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="websiteUrl" className={labelClass}>
                      Website URL <span className="text-error">*</span>
                    </label>
                    <input
                      id="websiteUrl"
                      type="url"
                      className={inputClass}
                      placeholder="https://yourbusiness.com"
                      value={form.websiteUrl}
                      onChange={(e) => update("websiteUrl", e.target.value)}
                      required
                    />
                    {errors.websiteUrl && <p className={errorClass}>{errors.websiteUrl}</p>}
                  </div>
                  <div>
                    <label htmlFor="industry" className={labelClass}>
                      Industry <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="industry"
                        className={`${inputClass} appearance-none pr-10`}
                        value={form.industry}
                        onChange={(e) => update("industry", e.target.value)}
                        required
                      >
                        <option value="" disabled>
                          Select your industry
                        </option>
                        {industries.map((ind) => (
                          <option key={ind} value={ind}>
                            {ind}
                          </option>
                        ))}
                      </select>
                      <CaretDown
                        size={16}
                        weight="bold"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                      />
                    </div>
                    {errors.industry && <p className={errorClass}>{errors.industry}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="location" className={labelClass}>
                      Business Location (City/State) <span className="text-error">*</span>
                    </label>
                    <input
                      id="location"
                      type="text"
                      className={inputClass}
                      placeholder="Austin, TX"
                      value={form.location}
                      onChange={(e) => update("location", e.target.value)}
                      required
                    />
                    {errors.location && <p className={errorClass}>{errors.location}</p>}
                  </div>
                  <div>
                    <label htmlFor="primaryGoal" className={labelClass}>
                      Primary Goal <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="primaryGoal"
                        className={`${inputClass} appearance-none pr-10`}
                        value={form.primaryGoal}
                        onChange={(e) => update("primaryGoal", e.target.value)}
                        required
                      >
                        <option value="" disabled>
                          What's your top priority?
                        </option>
                        {primaryGoals.map((goal) => (
                          <option key={goal} value={goal}>
                            {goal}
                          </option>
                        ))}
                      </select>
                      <CaretDown
                        size={16}
                        weight="bold"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                      />
                    </div>
                    {errors.primaryGoal && <p className={errorClass}>{errors.primaryGoal}</p>}
                  </div>
                </div>
              </fieldset>

              {/* ── Social Profiles ── */}
              <fieldset className="space-y-5">
                <legend className="text-lg font-semibold font-heading text-text-primary mb-1">
                  Your Social Profiles
                </legend>
                <p className="text-sm text-text-muted -mt-3">
                  Paste the full URLs to your profiles. The more you share, the more
                  complete your audit. All fields are optional — we'll analyze what we can.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {([
                    { key: "facebookUrl" as FieldName, label: "Facebook URL", placeholder: "https://facebook.com/yourpage" },
                    { key: "instagramUrl" as FieldName, label: "Instagram URL", placeholder: "https://instagram.com/yourhandle" },
                    { key: "linkedinUrl" as FieldName, label: "LinkedIn URL", placeholder: "https://linkedin.com/company/yourcompany" },
                    { key: "tiktokUrl" as FieldName, label: "TikTok URL", placeholder: "https://tiktok.com/@yourhandle" },
                    { key: "googleBusinessUrl" as FieldName, label: "Google Business Profile URL", placeholder: "https://maps.google.com/..." },
                  ]).map(({ key, label, placeholder }) => (
                    <div key={key} className={key === "googleBusinessUrl" ? "sm:col-span-2" : ""}>
                      <label htmlFor={key} className={labelClass}>
                        {label} <span className={optionalClass}>(optional)</span>
                      </label>
                      <input
                        id={key}
                        type="url"
                        className={inputClass}
                        placeholder={placeholder}
                        value={form[key] as string}
                        onChange={(e) => update(key, e.target.value)}
                      />
                      {errors[key] && <p className={errorClass}>{errors[key]}</p>}
                    </div>
                  ))}
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
                    type="text"
                    className={inputClass}
                    placeholder="Your full name"
                    value={form.contactName}
                    onChange={(e) => update("contactName", e.target.value)}
                    required
                  />
                  {errors.contactName && <p className={errorClass}>{errors.contactName}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="email" className={labelClass}>
                      Email Address <span className="text-error">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      className={inputClass}
                      placeholder="you@company.com"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      required
                    />
                    {errors.email && <p className={errorClass}>{errors.email}</p>}
                  </div>
                  <div>
                    <label htmlFor="phone" className={labelClass}>
                      Phone <span className={optionalClass}>(optional)</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      className={inputClass}
                      placeholder="(555) 555-5555"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                    />
                  </div>
                </div>
              </fieldset>

              {/* ── Consent ── */}
              <fieldset>
                <div className="flex items-start gap-3">
                  <input
                    id="consent"
                    type="checkbox"
                    className="mt-1 w-4 h-4 rounded border-border-emphasis bg-bg-surface-raised text-brand-primary focus:ring-brand-primary/30 cursor-pointer"
                    checked={form.consent}
                    onChange={(e) => update("consent", e.target.checked)}
                  />
                  <label htmlFor="consent" className="text-sm text-text-secondary cursor-pointer">
                    I consent to Metro Reach Media analyzing publicly accessible business information{" "}
                    <span className="text-error">*</span>
                  </label>
                </div>
                {errors.consent && <p className={errorClass}>{errors.consent}</p>}
              </fieldset>

              {/* ── Submit ── */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 ease-out bg-brand-primary text-text-primary rounded-full px-10 py-4 text-base hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
                >
                  {status === "submitting" ? (
                    <>
                      <Spinner size={20} weight="bold" className="animate-spin" />
                      Analyzing Your Digital Presence...
                    </>
                  ) : (
                    <>
                      Get My Free Audit
                      <ArrowRight size={18} weight="bold" />
                    </>
                  )}
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
            <p className="text-sm text-text-muted uppercase tracking-widest mb-6">
              How It Works
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  label: "You fill out the form",
                  desc: "Takes 2 minutes. Share your website and the social profiles you want analyzed.",
                },
                {
                  step: "02",
                  label: "Our team reviews your presence",
                  desc: "Metro Reach Media analyzes your website, social profiles, and competitive position using our proven methodology.",
                },
                {
                  step: "03",
                  label: "Your report is ready instantly",
                  desc: "Scored, analyzed, and delivered as a detailed report with specific recommendations — no waiting.",
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
              Metro Reach Media — Premium Social Media Marketing. Our team of
              specialists has delivered this audit methodology to businesses across
              contracting, med spas, real estate, auto shops, clinics, and salons.
            </p>
          </div>
        </Container>
      </section>
    </main>
  );
}
