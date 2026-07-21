import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle, WarningCircle, Spinner, Envelope } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { contactPage } from "~/data/pages";
import fs from "node:fs";
import path from "node:path";
import { sendTelegramMessage } from "~/lib/telegram";

const LEADS_FILE = path.join(process.cwd(), "..", "leads.json");

const submitContact = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, string>;
    if (!d.fullName || !d.businessName || !d.industry || !d.email || !d.frustration || !d.budget) {
      throw new Error("Missing required fields");
    }
    return d as {
      fullName: string;
      businessName: string;
      industry: string;
      email: string;
      phone: string;
      frustration: string;
      budget: string;
    };
  })
  .handler(async ({ data }) => {
    const lead = {
      ...data,
      source: "contact-page",
      timestamp: new Date().toISOString(),
    };
    
    // Read existing leads, append new one, write back
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
    lines.push(`Business: ${data.businessName}`);
    lines.push(`Industry: ${data.industry}`);
    lines.push(`Email: ${data.email}`);
    if (data.phone) lines.push(`Phone: ${data.phone}`);
    lines.push(`Budget: ${data.budget}`);
    lines.push("");
    lines.push(`<b>Message:</b> ${data.frustration}`);
    lines.push("");
    lines.push(`<a href="https://7d5924e3a6715d74efa480bc8bb2da91.ctonew.app/leads">View all leads →</a>`);
    sendTelegramMessage(lines.join("\n")).catch(() => {
      // Silently ignore Telegram failures — don't block form submission
    });

    return { success: true };
  });

export const Route = createFileRoute("/contact")({
  component: Contact,
});

type FormData = {
  fullName: string;
  businessName: string;
  industry: string;
  email: string;
  phone: string;
  frustration: string;
  budget: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

function Contact() {
  const [form, setForm] = useState<FormData>({
    fullName: "",
    businessName: "",
    industry: "",
    email: "",
    phone: "",
    frustration: "",
    budget: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!form.fullName.trim()) e.fullName = "Name is required";
    if (!form.businessName.trim()) e.businessName = "Business name is required";
    if (!form.industry) e.industry = "Industry is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email";
    if (!form.frustration.trim()) e.frustration = "Tell us what's frustrating you";
    if (!form.budget) e.budget = "Budget range is required";
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

  const fieldMeta = contactPage.fields;

  return (
    <section className="py-24 bg-bg-root min-h-dvh">
      <Container>
        <SectionHeading
          headline={contactPage.headline}
          description={contactPage.subheadline}
        />

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Left: text */}
          <div>
            <h3 className="text-lg font-semibold font-heading text-text-primary mb-4">
              What happens next
            </h3>
            <ol className="space-y-4">
              {contactPage.nextSteps.map((step) => (
                <li
                  key={step.step}
                  className="flex items-start gap-4 text-text-secondary"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-primary/10 text-brand-primary text-sm font-semibold flex items-center justify-center">
                    {step.step}
                  </span>
                  <span className="text-sm leading-relaxed pt-1">{step.label}</span>
                </li>
              ))}
            </ol>

            <div className="mt-10 flex items-center gap-3 text-text-muted">
              <Envelope size={20} />
              <a
                href={`mailto:${contactPage.directEmail}`}
                className="text-sm text-text-secondary hover:text-brand-primary transition-colors"
              >
                {contactPage.directEmail}
              </a>
            </div>
          </div>

          {/* Right: form */}
          {status === "success" ? (
            <div className="flex flex-col items-center justify-center text-center gap-4 py-12">
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
              className="space-y-5 bg-bg-surface border border-border-subtle rounded-2xl p-8"
              noValidate
            >
              {status === "error" && (
                <div className="flex items-center gap-2 text-sm text-error bg-error/10 rounded-lg px-4 py-3">
                  <WarningCircle size={18} />
                  Something went wrong. Please try again or email us directly.
                </div>
              )}

              {fieldMeta.map((field) => {
                const name = field.name as keyof FormData;
                const isTextarea = field.type === "textarea";
                const isSelect = field.type === "select";
                const Tag = isTextarea ? "textarea" : "input";

                return (
                  <div key={field.name}>
                    <label
                      htmlFor={field.name}
                      className="block text-sm font-medium text-text-primary mb-1.5"
                    >
                      {field.label}
                      {field.required && (
                        <span className="text-brand-accent ml-1">*</span>
                      )}
                    </label>
                    {isSelect ? (
                      <select
                        id={field.name}
                        name={field.name}
                        value={form[name]}
                        onChange={handleChange}
                        required={field.required}
                        className={`w-full rounded-lg px-4 py-3 text-sm bg-bg-root border ${
                          errors[name]
                            ? "border-error"
                            : "border-border-subtle focus:border-brand-primary"
                        } text-text-primary placeholder:text-text-muted outline-none transition-colors`}
                      >
                        <option value="">{field.placeholder}</option>
                        {"options" in field &&
                          field.options.map((opt: string) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <Tag
                        id={field.name}
                        name={field.name}
                        type={isTextarea ? undefined : field.type}
                        placeholder={field.placeholder}
                        value={form[name]}
                        onChange={handleChange}
                        required={field.required}
                        rows={isTextarea ? 4 : undefined}
                        className={`w-full rounded-lg px-4 py-3 text-sm bg-bg-root border ${
                          errors[name]
                            ? "border-error"
                            : "border-border-subtle focus:border-brand-primary"
                        } text-text-primary placeholder:text-text-muted outline-none transition-colors resize-vertical`}
                      />
                    )}
                    {errors[name] && (
                      <p className="text-xs text-error mt-1.5">{errors[name]}</p>
                    )}
                  </div>
                );
              })}

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
      </Container>
    </section>
  );
}
