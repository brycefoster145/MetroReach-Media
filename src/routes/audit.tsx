import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CaretDown,
  Spinner,
  CheckCircle,
} from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";

const industries = [
  "Contractor",
  "Med Spa",
  "Real Estate",
  "Auto Shop",
  "Clinic",
  "Salon",
  "Other",
] as const;

interface FormState {
  businessName: string;
  websiteUrl: string;
  industry: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  linkedinUrl: string;
  name: string;
  email: string;
  phone: string;
  goals: string;
}

const initialForm: FormState = {
  businessName: "",
  websiteUrl: "",
  industry: "",
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  linkedinUrl: "",
  name: "",
  email: "",
  phone: "",
  goals: "",
};

export const Route = createFileRoute("/audit")({
  component: Audit,
});

function Audit() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const update = (field: keyof FormState, value: string) => {
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
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.businessName.trim()) errs.businessName = "Business name is required.";
    if (!form.name.trim()) errs.name = "Your name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email address.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      setStatus("success");
      // Redirect to report page
      window.location.href = data.redirect;
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    }
  };

  const inputClass =
    "w-full rounded-xl bg-bg-surface-raised border border-border-subtle px-4 py-3.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-all duration-200 text-base";
  const labelClass = "block text-sm font-medium text-text-secondary mb-2";
  const errorClass = "text-xs text-error mt-1.5";

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
              See exactly where your social media is losing leads.
            </h1>
            <p className="text-lg lg:text-xl text-text-secondary max-w-2xl mx-auto">
              A specialist-level analysis of your profiles, content, and competitive position — delivered
              as a detailed report with specific, actionable recommendations. No templates. No fluff.
            </p>
          </div>
        </Container>
      </section>

      {/* Form */}
      <section className="py-20 bg-bg-surface">
        <Container>
          <div className="max-w-2xl mx-auto">
            {/* What you'll get */}
            <div className="mb-12 p-6 rounded-2xl bg-bg-surface-raised border border-border-subtle">
              <h3 className="text-lg font-semibold font-heading text-text-primary mb-4">
                Your audit report includes:
              </h3>
              <ul className="space-y-3">
                {[
                  "Profile completeness analysis across every platform you share",
                  "Posting consistency scoring with specific cadence recommendations",
                  "Brand cohesion evaluation — do you look like the same business everywhere?",
                  "Engagement health check — are you building community or broadcasting?",
                  "3 Quick Wins you can implement today (no budget required)",
                  "Personalized service recommendations based on your specific gaps",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                    <CheckCircle size={18} weight="fill" className="text-brand-accent flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {status === "error" && (
              <div className="mb-8 p-4 rounded-xl bg-error/10 border border-error/30 text-error text-sm">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8" noValidate>
              {/* Business Info */}
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
                      Website URL
                    </label>
                    <input
                      id="websiteUrl"
                      type="url"
                      className={inputClass}
                      placeholder="https://yourbusiness.com"
                      value={form.websiteUrl}
                      onChange={(e) => update("websiteUrl", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="industry" className={labelClass}>
                      Industry
                    </label>
                    <div className="relative">
                      <select
                        id="industry"
                        className={`${inputClass} appearance-none pr-10`}
                        value={form.industry}
                        onChange={(e) => update("industry", e.target.value)}
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
                  </div>
                </div>
              </fieldset>

              {/* Social URLs */}
              <fieldset className="space-y-5">
                <legend className="text-lg font-semibold font-heading text-text-primary mb-1">
                  Your Social Profiles
                </legend>
                <p className="text-sm text-text-muted -mt-3">
                  Paste the full URLs to your profiles. The more you share, the more complete your audit.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {([
                    { key: "facebookUrl" as const, label: "Facebook URL", placeholder: "https://facebook.com/yourpage" },
                    { key: "instagramUrl" as const, label: "Instagram URL", placeholder: "https://instagram.com/yourhandle" },
                    { key: "tiktokUrl" as const, label: "TikTok URL", placeholder: "https://tiktok.com/@yourhandle" },
                    { key: "linkedinUrl" as const, label: "LinkedIn URL", placeholder: "https://linkedin.com/company/yourcompany" },
                  ]).map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label htmlFor={key} className={labelClass}>
                        {label}
                      </label>
                      <input
                        id={key}
                        type="url"
                        className={inputClass}
                        placeholder={placeholder}
                        value={form[key]}
                        onChange={(e) => update(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>

              {/* Contact Info */}
              <fieldset className="space-y-5">
                <legend className="text-lg font-semibold font-heading text-text-primary mb-1">
                  Your Contact Information
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className={labelClass}>
                      Your Name <span className="text-error">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      className={inputClass}
                      placeholder="Your full name"
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                      required
                    />
                    {errors.name && <p className={errorClass}>{errors.name}</p>}
                  </div>
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
                </div>

                <div>
                  <label htmlFor="phone" className={labelClass}>
                    Phone Number
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
              </fieldset>

              {/* Goals */}
              <fieldset>
                <label htmlFor="goals" className={labelClass}>
                  What do you want social media to do for your business?
                </label>
                <textarea
                  id="goals"
                  className={`${inputClass} resize-y min-h-[100px]`}
                  placeholder="More leads? Better brand visibility? Fill the pipeline? Tell us what success looks like for you."
                  value={form.goals}
                  onChange={(e) => update("goals", e.target.value)}
                  rows={3}
                />
              </fieldset>

              {/* Submit */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 ease-out bg-brand-primary text-text-primary rounded-full px-10 py-4 text-base hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
                >
                  {status === "submitting" ? (
                    <>
                      <Spinner size={20} weight="bold" className="animate-spin" />
                      Analyzing your profiles...
                    </>
                  ) : (
                    <>
                      Get My Free Audit
                      <ArrowRight size={18} weight="bold" />
                    </>
                  )}
                </button>
                <p className="text-xs text-text-muted mt-4">
                  Free. No credit card. No commitment. Your report is ready in under a minute.
                </p>
              </div>
            </form>
          </div>
        </Container>
      </section>

      {/* Trust bar */}
      <section className="py-16 bg-bg-root border-t border-border-subtle">
        <Container>
          <div className="text-center max-w-xl mx-auto">
            <p className="text-sm text-text-muted uppercase tracking-widest mb-6">
              How We Deliver
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {[
                { step: "01", label: "You fill out the form", desc: "Takes 2 minutes. Share the profiles you want analyzed." },
                { step: "02", label: "Our system pulls real data", desc: "We pull live profile and posting data from the platforms you share." },
                { step: "03", label: "Report is generated instantly", desc: "Scored, analyzed, and delivered as a detailed report — no waiting." },
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
    </main>
  );
}
