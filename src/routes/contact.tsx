import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle, WarningCircle, Spinner, Envelope, Phone, MapPin } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { contactPage } from "~/data/pages";
import { sendTelegramMessage } from "~/lib/telegram";
import { sendEmail } from "~/lib/email";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function confirmationEmailHtml(name: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#7c3aed;margin-bottom:16px;">Thanks for reaching out, ${escapeHtml(name)}</h2>
  <p>We received your message and our team will review it within 24 hours. You'll hear from us at this email address.</p>
  <p style="margin-top:24px;font-size:14px;color:#6b7280;">— MetroReach Media</p>
</body>
</html>`.trim();
}

function notificationEmailHtml(data: {
  fullName: string;
  email: string;
  company: string;
  serviceInterest: string;
  message: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#7c3aed;margin-bottom:8px;">🚀 New Lead — MetroReach Media</h2>
  <table style="border-collapse:collapse;margin:16px 0;">
    <tr><td style="font-weight:600;padding:4px 12px 4px 0;white-space:nowrap">Name</td><td>${escapeHtml(data.fullName)}</td></tr>
    <tr><td style="font-weight:600;padding:4px 12px 4px 0;white-space:nowrap">Email</td><td>${escapeHtml(data.email)}</td></tr>
    <tr><td style="font-weight:600;padding:4px 12px 4px 0;white-space:nowrap">Company</td><td>${escapeHtml(data.company)}</td></tr>
    <tr><td style="font-weight:600;padding:4px 12px 4px 0;white-space:nowrap">Service</td><td>${escapeHtml(data.serviceInterest)}</td></tr>
  </table>
  <div style="background:#f5f3ff;padding:16px;border-radius:8px;margin:16px 0;">
    <p style="font-weight:600;margin:0 0 8px;">Message:</p>
    <p style="margin:0;">${escapeHtml(data.message)}</p>
  </div>
  <p style="font-size:14px;color:#6b7280;">Source: contact-page · ${new Date().toISOString()}</p>
</body>
</html>`.trim();
}

const submitContact = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, string>;
    if (!d.fullName || !d.email || !d.company || !d.serviceInterest || !d.message) {
      throw new Error("Missing required fields");
    }
    return d as {
      fullName: string;
      email: string;
      company: string;
      serviceInterest: string;
      message: string;
    };
  })
  .handler(async ({ data }) => {
    const { default: fs } = await import("node:fs");
    const { default: path } = await import("node:path");
    const LEADS_FILE = path.join(process.cwd(), "..", "leads.json");

    const lead = {
      ...data,
      source: "contact-page",
      timestamp: new Date().toISOString(),
    };

    let leads: typeof lead[] = [];
    try {
      const raw = fs.readFileSync(LEADS_FILE, "utf-8");
      leads = JSON.parse(raw);
    } catch {
      // File doesn't exist yet — that's fine
    }
    leads.push(lead);
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));

    // Send Telegram notification (non-blocking)
    const lines: string[] = [];
    lines.push("🚀 <b>New Lead — MetroReach Media</b>");
    lines.push("");
    lines.push(`Name: ${data.fullName}`);
    lines.push(`Email: ${data.email}`);
    lines.push(`Company: ${data.company}`);
    lines.push(`Service Interest: ${data.serviceInterest}`);
    lines.push("");
    lines.push(`<b>Message:</b> ${data.message}`);
    lines.push("");
    lines.push(`<a href="https://7d5924e3a6715d74efa480bc8bb2da91.ctonew.app/leads">View all leads →</a>`);
    sendTelegramMessage(lines.join("\n")).catch(() => {
      // Silently ignore Telegram failures — don't block form submission
    });

    // Send confirmation email to the lead (non-blocking)
    sendEmail({
      to: data.email,
      from: "bryce@metroreachagency.com",
      subject: "We got your message — MetroReach Media",
      body: confirmationEmailHtml(data.fullName),
    }).catch(() => {
      // Silently ignore email failures — don't block form submission
    });

    // Send notification email to Bryce (non-blocking)
    sendEmail({
      to: "bryce@metroreachagency.com",
      from: "support@metroreachagency.com",
      subject: `New Lead: ${data.fullName} from ${data.company}`,
      body: notificationEmailHtml(data),
      replyTo: data.email,
    }).catch(() => {
      // Silently ignore email failures — don't block form submission
    });

    return { success: true };
  });

export const Route = createFileRoute("/contact")({
  component: Contact,
});

type FormData = {
  fullName: string;
  email: string;
  company: string;
  serviceInterest: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

function Contact() {
  const [form, setForm] = useState<FormData>({
    fullName: "",
    email: "",
    company: "",
    serviceInterest: "",
    message: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!form.fullName.trim()) e.fullName = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email";
    if (!form.company.trim()) e.company = "Company is required";
    if (!form.serviceInterest) e.serviceInterest = "Please select a service";
    if (!form.message.trim()) e.message = "Message is required";
    return e;
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setStatus("submitting");
    try {
      await submitContact({ data: form });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="py-24 bg-bg-root min-h-dvh">
      <Container>
        <SectionHeading
          headline={contactPage.headline}
          description={contactPage.subheadline}
        />

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-16">
          {/* Left: Contact Info Panel */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-bg-surface border border-border-subtle p-8 lg:p-10">
              <h3 className="text-lg font-semibold font-heading text-text-primary mb-6">
                Get in touch
              </h3>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-text-secondary">
                  <Envelope size={20} weight="duotone" className="text-brand-primary flex-shrink-0" />
                  <a
                    href={`mailto:${contactPage.contactInfo.email}`}
                    className="text-sm hover:text-brand-primary transition-colors"
                  >
                    {contactPage.contactInfo.email}
                  </a>
                </div>
                <div className="flex items-center gap-3 text-text-secondary">
                  <Phone size={20} weight="duotone" className="text-brand-primary flex-shrink-0" />
                  <span className="text-sm">{contactPage.contactInfo.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-text-secondary">
                  <MapPin size={20} weight="duotone" className="text-brand-primary flex-shrink-0" />
                  <span className="text-sm">{contactPage.contactInfo.location}</span>
                </div>
              </div>

              <div className="border-t border-border-subtle pt-6">
                <h4 className="text-sm font-semibold font-heading text-text-primary mb-4">
                  What happens next
                </h4>
                <ol className="space-y-4">
                  {contactPage.nextSteps.map((step) => (
                    <li
                      key={step.step}
                      className="flex items-start gap-3 text-text-secondary"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-semibold flex items-center justify-center">
                        {step.step}
                      </span>
                      <span className="text-sm leading-relaxed">{step.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          {/* Right: Contact Form */}
          <div className="lg:col-span-3">
            {status === "success" ? (
              <div className="flex flex-col items-center justify-center text-center gap-4 py-16 bg-bg-surface border border-border-subtle rounded-2xl">
                <CheckCircle size={48} weight="duotone" className="text-brand-accent" />
                <p className="text-lg font-semibold text-text-primary">
                  Message sent
                </p>
                <p className="text-sm text-text-secondary max-w-sm">
                  {contactPage.confirmation}
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-5 bg-bg-surface border border-border-subtle rounded-2xl p-8 lg:p-10"
                noValidate
              >
                {status === "error" && (
                  <div className="flex items-center gap-2 text-sm text-error bg-error/10 rounded-lg px-4 py-3">
                    <WarningCircle size={18} />
                    Something went wrong. Please try again or email us directly.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Name */}
                  <div>
                    <label
                      htmlFor="fullName"
                      className="block text-sm font-medium text-text-primary mb-1.5"
                    >
                      Name <span className="text-brand-accent">*</span>
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      placeholder="Your full name"
                      value={form.fullName}
                      onChange={handleChange}
                      required
                      className={`w-full rounded-lg px-4 py-3 text-sm bg-bg-root border ${
                        errors.fullName
                          ? "border-error"
                          : "border-border-subtle focus:border-brand-primary"
                      } text-text-primary placeholder:text-text-muted outline-none transition-colors`}
                    />
                    {errors.fullName && (
                      <p className="text-xs text-error mt-1.5">{errors.fullName}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-text-primary mb-1.5"
                    >
                      Email <span className="text-brand-accent">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@company.com"
                      value={form.email}
                      onChange={handleChange}
                      required
                      className={`w-full rounded-lg px-4 py-3 text-sm bg-bg-root border ${
                        errors.email
                          ? "border-error"
                          : "border-border-subtle focus:border-brand-primary"
                      } text-text-primary placeholder:text-text-muted outline-none transition-colors`}
                    />
                    {errors.email && (
                      <p className="text-xs text-error mt-1.5">{errors.email}</p>
                    )}
                  </div>
                </div>

                {/* Company */}
                <div>
                  <label
                    htmlFor="company"
                    className="block text-sm font-medium text-text-primary mb-1.5"
                  >
                    Company <span className="text-brand-accent">*</span>
                  </label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    placeholder="Your company name"
                    value={form.company}
                    onChange={handleChange}
                    required
                    className={`w-full rounded-lg px-4 py-3 text-sm bg-bg-root border ${
                      errors.company
                        ? "border-error"
                        : "border-border-subtle focus:border-brand-primary"
                    } text-text-primary placeholder:text-text-muted outline-none transition-colors`}
                  />
                  {errors.company && (
                    <p className="text-xs text-error mt-1.5">{errors.company}</p>
                  )}
                </div>

                {/* Service Interest */}
                <div>
                  <label
                    htmlFor="serviceInterest"
                    className="block text-sm font-medium text-text-primary mb-1.5"
                  >
                    Service Interest <span className="text-brand-accent">*</span>
                  </label>
                  <select
                    id="serviceInterest"
                    name="serviceInterest"
                    value={form.serviceInterest}
                    onChange={handleChange}
                    required
                    className={`w-full rounded-lg px-4 py-3 text-sm bg-bg-root border ${
                      errors.serviceInterest
                        ? "border-error"
                        : "border-border-subtle focus:border-brand-primary"
                    } text-text-primary placeholder:text-text-muted outline-none transition-colors`}
                  >
                    <option value="">Select a service</option>
                    {contactPage.serviceOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {errors.serviceInterest && (
                    <p className="text-xs text-error mt-1.5">{errors.serviceInterest}</p>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-text-primary mb-1.5"
                  >
                    Message <span className="text-brand-accent">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    placeholder="Tell us about your business, your goals, and what you're looking for in a marketing partner."
                    value={form.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    className={`w-full rounded-lg px-4 py-3 text-sm bg-bg-root border ${
                      errors.message
                        ? "border-error"
                        : "border-border-subtle focus:border-brand-primary"
                    } text-text-primary placeholder:text-text-muted outline-none transition-colors resize-vertical`}
                  />
                  {errors.message && (
                    <p className="text-xs text-error mt-1.5">{errors.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full justify-center"
                  disabled={status === "submitting"}
                >
                  {status === "submitting" ? (
                    <>
                      <Spinner size={18} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send message"
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
