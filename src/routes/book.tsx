import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle, WarningCircle, Spinner } from "@phosphor-icons/react";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";
import { Button } from "~/components/Button";
import { sendTelegramMessage } from "~/lib/telegram";
import fs from "node:fs";
import path from "node:path";

const BOOKINGS_FILE = path.join(process.cwd(), "..", "bookings.json");

const submitBooking = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as Record<string, string>;
    if (!d.fullName || !d.email || !d.businessName || !d.industry || !d.preferredDay || !d.preferredTime) {
      throw new Error("Missing required fields");
    }
    return d as {
      fullName: string;
      email: string;
      businessName: string;
      industry: string;
      preferredDay: string;
      preferredTime: string;
      notes: string;
    };
  })
  .handler(async ({ data }) => {
    const booking = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    let bookings: typeof booking[] = [];
    try {
      const raw = fs.readFileSync(BOOKINGS_FILE, "utf-8");
      bookings = JSON.parse(raw);
    } catch {
      // File doesn't exist yet — that's fine
    }
    bookings.push(booking);
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));

    // Send Telegram notification (non-blocking)
    const lines: string[] = [];
    lines.push("📅 <b>New Strategy Call Request</b>");
    lines.push("");
    lines.push(`Name: ${data.fullName}`);
    lines.push(`Business: ${data.businessName}`);
    lines.push(`Industry: ${data.industry}`);
    lines.push(`Email: ${data.email}`);
    lines.push(`Preferred: ${data.preferredDay}, ${data.preferredTime}`);
    lines.push(`Notes: ${data.notes || "None"}`);
    lines.push("");
    lines.push(
      `<a href="https://7d5924e3a6715d74efa480bc8bb2da91.ctonew.app/bookings">View all bookings →</a>`
    );
    sendTelegramMessage(lines.join("\n")).catch(() => {
      // Silently ignore Telegram failures
    });

    return { success: true, name: data.fullName };
  });

export const Route = createFileRoute("/book")({
  component: Book,
});

type FormData = {
  fullName: string;
  email: string;
  businessName: string;
  industry: string;
  preferredDay: string;
  preferredTime: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const industries = ["HVAC", "Med Spa", "Real Estate", "Auto Shop", "Clinic", "Salon", "Other"];

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const times = [
  "Morning (9–11am ET)",
  "Midday (11am–1pm ET)",
  "Afternoon (1–3pm ET)",
  "Late Afternoon (3–5pm ET)",
];

function Book() {
  const [form, setForm] = useState<FormData>({
    fullName: "",
    email: "",
    businessName: "",
    industry: "",
    preferredDay: "",
    preferredTime: "",
    notes: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submittedName, setSubmittedName] = useState("");

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!form.fullName.trim()) e.fullName = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email";
    if (!form.businessName.trim()) e.businessName = "Business name is required";
    if (!form.industry) e.industry = "Industry is required";
    if (!form.preferredDay) e.preferredDay = "Preferred day is required";
    if (!form.preferredTime) e.preferredTime = "Preferred time is required";
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
      const result = await submitBooking({ data: form });
      setSubmittedName(result.name);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  const inputCls = (field: keyof FormData) =>
    `w-full rounded-lg px-4 py-3 text-sm bg-bg-root border ${
      errors[field]
        ? "border-error"
        : "border-border-subtle focus:border-brand-primary"
    } text-text-primary placeholder:text-text-muted outline-none transition-colors`;

  const labelCls = "block text-sm font-medium text-text-primary mb-1.5";

  return (
    <section className="py-24 bg-bg-root min-h-dvh">
      <Container>
        <SectionHeading
          headline="Book a Strategy Call"
          description="30 minutes. No pressure. Just an honest assessment of your current marketing."
        />

        <div className="max-w-2xl mx-auto">
          {status === "success" ? (
            <div className="flex flex-col items-center justify-center text-center gap-4 py-16">
              <CheckCircle size={48} weight="duotone" className="text-brand-accent" />
              <p className="text-xl font-semibold text-text-primary">
                Thanks {submittedName} — we'll reach out within one business day to confirm your call time.
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
                  Something went wrong. Please try again or email us at hello@metroreachagency.com.
                </div>
              )}

              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className={labelCls}>
                  Full Name <span className="text-brand-accent">*</span>
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Your full name"
                  value={form.fullName}
                  onChange={handleChange}
                  className={inputCls("fullName")}
                />
                {errors.fullName && (
                  <p className="text-xs text-error mt-1.5">{errors.fullName}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className={labelCls}>
                  Email <span className="text-brand-accent">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={handleChange}
                  className={inputCls("email")}
                />
                {errors.email && (
                  <p className="text-xs text-error mt-1.5">{errors.email}</p>
                )}
              </div>

              {/* Business Name */}
              <div>
                <label htmlFor="businessName" className={labelCls}>
                  Business Name <span className="text-brand-accent">*</span>
                </label>
                <input
                  id="businessName"
                  name="businessName"
                  type="text"
                  placeholder="Your business name"
                  value={form.businessName}
                  onChange={handleChange}
                  className={inputCls("businessName")}
                />
                {errors.businessName && (
                  <p className="text-xs text-error mt-1.5">{errors.businessName}</p>
                )}
              </div>

              {/* Industry */}
              <div>
                <label htmlFor="industry" className={labelCls}>
                  Industry <span className="text-brand-accent">*</span>
                </label>
                <select
                  id="industry"
                  name="industry"
                  value={form.industry}
                  onChange={handleChange}
                  className={inputCls("industry")}
                >
                  <option value="">Select your industry</option>
                  {industries.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
                {errors.industry && (
                  <p className="text-xs text-error mt-1.5">{errors.industry}</p>
                )}
              </div>

              {/* Preferred Day + Time row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Preferred Day */}
                <div>
                  <label htmlFor="preferredDay" className={labelCls}>
                    Preferred Day <span className="text-brand-accent">*</span>
                  </label>
                  <select
                    id="preferredDay"
                    name="preferredDay"
                    value={form.preferredDay}
                    onChange={handleChange}
                    className={inputCls("preferredDay")}
                  >
                    <option value="">Select a day</option>
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {errors.preferredDay && (
                    <p className="text-xs text-error mt-1.5">{errors.preferredDay}</p>
                  )}
                </div>

                {/* Preferred Time */}
                <div>
                  <label htmlFor="preferredTime" className={labelCls}>
                    Preferred Time <span className="text-brand-accent">*</span>
                  </label>
                  <select
                    id="preferredTime"
                    name="preferredTime"
                    value={form.preferredTime}
                    onChange={handleChange}
                    className={inputCls("preferredTime")}
                  >
                    <option value="">Select a time</option>
                    {times.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {errors.preferredTime && (
                    <p className="text-xs text-error mt-1.5">{errors.preferredTime}</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className={labelCls}>
                  Anything we should know
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  placeholder="Any specific topics you'd like to cover, questions you have, or context about your business..."
                  value={form.notes}
                  onChange={handleChange}
                  className={`${inputCls("notes")} resize-vertical`}
                />
              </div>

              <Button
                type="submit"
                className="w-full justify-center"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? (
                  <>
                    <Spinner size={18} className="animate-spin" />
                    Booking...
                  </>
                ) : (
                  "Schedule your strategy call"
                )}
              </Button>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}
