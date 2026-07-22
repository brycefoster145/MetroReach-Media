import { useEffect, useRef, useState, type FormEvent } from "react";
import { Container } from "~/components/Container";
import { Button } from "~/components/Button";
import { footerCta } from "~/data/content";

const industries = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Roofing",
  "General Contracting",
  "Med Spa / Aesthetics",
  "Auto Repair",
  "Real Estate",
  "Dental / Medical Clinic",
  "Salon / Personal Services",
  "Other",
];

interface FormErrors {
  name?: string;
  email?: string;
  company?: string;
  industry?: string;
  message?: string;
}

export function ContactSection() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  function validate(): boolean {
    const e: FormErrors = {};
    if (!name.trim()) e.name = "Name is required.";
    if (!email.trim()) {
      e.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = "Please enter a valid email.";
    }
    if (!company.trim()) e.company = "Company is required.";
    if (!industry) e.industry = "Please select an industry.";
    if (!message.trim()) {
      e.message = "Tell us a bit about your needs.";
    } else if (message.trim().length < 10) {
      e.message = "A few more details would help.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) return;

    setStatus("submitting");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), company: company.trim(), industry, message: message.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
      setName("");
      setEmail("");
      setCompany("");
      setIndustry("");
      setMessage("");
      setErrors({});
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const inputCls =
    "w-full bg-bg-surface border border-border-subtle rounded-md px-4 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors";
  const errorCls = "text-xs text-error mt-1";

  return (
    <section ref={ref} className="py-24 bg-bg-root relative overflow-hidden">
      {/* Gradient wash behind text */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_1000px_at_40%_50%,rgba(59,130,246,0.12),transparent)] pointer-events-none" />

      <Container className="relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Left column: text */}
          <div
            className={`transition-all duration-500 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            }`}
            style={{
              transitionDelay: "100ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold font-heading text-text-primary tracking-tight mb-6">
              {footerCta.headline}
            </h2>
            <p className="text-lg text-text-secondary leading-relaxed mb-8 max-w-lg">
              {footerCta.subheadline}
            </p>

            <div className="space-y-4">
              <Button href="/book">{footerCta.primaryCta}</Button>
              <div>
                <p className="text-sm text-text-muted mb-2">
                  {footerCta.secondaryLabel}
                </p>
                <Button variant="secondary" href="/dashboard">
                  {footerCta.secondaryCta}
                </Button>
              </div>
            </div>
          </div>

          {/* Right column: form */}
          <div
            className={`transition-all duration-500 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
            style={{
              transitionDelay: "300ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {status === "success" ? (
              <div className="bg-bg-surface border border-brand-accent/30 rounded-2xl p-8 text-center">
                <p className="text-lg font-semibold text-text-primary mb-2">
                  Thanks for reaching out!
                </p>
                <p className="text-base text-text-secondary">
                  We'll review your message and get back to you within one business day.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                noValidate
                className="bg-bg-surface border border-border-subtle rounded-2xl p-8 space-y-5"
              >
                {/* Name */}
                <div>
                  <label htmlFor="contact-name" className="block text-sm font-medium text-text-primary mb-1.5">
                    Name <span className="text-error">*</span>
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    className={inputCls}
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: undefined })); }}
                  />
                  {errors.name && <p className={errorCls}>{errors.name}</p>}
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="contact-email" className="block text-sm font-medium text-text-primary mb-1.5">
                    Email <span className="text-error">*</span>
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    className={inputCls}
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
                  />
                  {errors.email && <p className={errorCls}>{errors.email}</p>}
                </div>

                {/* Company */}
                <div>
                  <label htmlFor="contact-company" className="block text-sm font-medium text-text-primary mb-1.5">
                    Company <span className="text-error">*</span>
                  </label>
                  <input
                    id="contact-company"
                    type="text"
                    className={inputCls}
                    placeholder="Your business name"
                    value={company}
                    onChange={(e) => { setCompany(e.target.value); if (errors.company) setErrors((p) => ({ ...p, company: undefined })); }}
                  />
                  {errors.company && <p className={errorCls}>{errors.company}</p>}
                </div>

                {/* Industry */}
                <div>
                  <label htmlFor="contact-industry" className="block text-sm font-medium text-text-primary mb-1.5">
                    Industry <span className="text-error">*</span>
                  </label>
                  <select
                    id="contact-industry"
                    className={inputCls}
                    value={industry}
                    onChange={(e) => { setIndustry(e.target.value); if (errors.industry) setErrors((p) => ({ ...p, industry: undefined })); }}
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
                  {errors.industry && <p className={errorCls}>{errors.industry}</p>}
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium text-text-primary mb-1.5">
                    What do you need? <span className="text-error">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    className={inputCls}
                    placeholder="Tell us about your business, current marketing, and what you're looking for..."
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); if (errors.message) setErrors((p) => ({ ...p, message: undefined })); }}
                  />
                  {errors.message && <p className={errorCls}>{errors.message}</p>}
                </div>

                {/* Error banner */}
                {status === "error" && (
                  <p className="text-sm text-error">{errorMsg}</p>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full justify-center"
                >
                  {status === "submitting" ? "Sending..." : "Send message"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
