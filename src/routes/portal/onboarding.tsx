/**
 * /portal/onboarding — Client Onboarding Form
 *
 * Multi-step form for new clients to provide business info,
 * social media access, brand guidelines, and goals.
 *
 * Protected — requires client portal auth.
 * Submits to POST /api/client/onboarding.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  WarningCircle,
  Spinner,
  Buildings,
  GlobeHemisphereWest,
  Palette,
  ClipboardText,
  UploadSimple,
  X,
} from "@phosphor-icons/react";

// ── Industry options ──
const INDUSTRIES = [
  "Contractor",
  "Med Spa",
  "Marina",
  "Auto Shop",
  "Real Estate",
  "Clinic",
  "Salon",
  "Other",
];

// ── Form data shape ──
interface OnboardingFormData {
  // Step 1: Business Info
  businessName: string;
  industry: string;
  websiteUrl: string;
  businessLocation: string;
  contactName: string;
  phone: string;
  // Step 2: Social Media Access
  facebookUrl: string;
  instagramUrl: string;
  xUrl: string;
  linkedinUrl: string;
  tiktokUrl: string;
  googleUrl: string;
  hasAdminAccess: boolean;
  competitors: string; // audit-only: competitor names/URLs for benchmarking
  // Step 3: Brand & Goals
  brandGuidelines: string;
  targetAudience: string;
  brandVoice: string;
  goal1: string;
  goal2: string;
  goal3: string;
  pastCampaigns: string;
  logoFile: File | null;
  // Step 4 is review
}

const INITIAL_DATA: OnboardingFormData = {
  businessName: "",
  industry: "",
  websiteUrl: "",
  businessLocation: "",
  contactName: "",
  phone: "",
  facebookUrl: "",
  instagramUrl: "",
  xUrl: "",
  linkedinUrl: "",
  tiktokUrl: "",
  googleUrl: "",
  hasAdminAccess: true,
  competitors: "",
  brandGuidelines: "",
  targetAudience: "",
  brandVoice: "",
  goal1: "",
  goal2: "",
  goal3: "",
  pastCampaigns: "",
  logoFile: null,
};

const TOTAL_STEPS = 4;

export const Route = createFileRoute("/portal/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — MetroReach Media Portal" },
      { name: "description", content: "Complete your onboarding to get started with MetroReach Media." },
    ],
  }),
  component: PortalOnboarding,
});

function PortalOnboarding() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingFormData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ service_slug?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Premium Growth Audit clients get a manual analysis — they never grant
  // publishing/account access, so we hide all admin-access UI for them.
  const isAuditOnly = profile?.service_slug === "premium-growth-audit";

  // Auth check on mount. Session wins; ?token= routes through /portal setup.
  useEffect(() => {
    async function checkAuth() {
      try {
        // Verify session via dashboard endpoint first — a valid session wins.
        const res = await fetch("/api/portal/dashboard");
        if (res.status === 401) {
          // Not logged in. A ?token= link is now a one-time account-setup
          // token (not a login), so route through /portal to set the
          // password / log in; otherwise go to the login page.
          const searchParams = new URLSearchParams(window.location.search);
          const portalToken = searchParams.get("token");
          if (portalToken && portalToken.length >= 8) {
            window.location.href = `/portal?token=${encodeURIComponent(portalToken)}`;
          } else {
            window.location.href = "/portal";
          }
          return;
        }
        if (!res.ok) throw new Error("Failed to verify session");
        // Clean a stale ?token= from the URL now that we're authenticated
        if (window.location.search) {
          window.history.replaceState(null, "", "/portal/onboarding");
        }
        const data = await res.json();
        setProfile(data?.profile || null);
      } catch {
        window.location.href = "/portal";
        return;
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  // ── Helpers ──

  function updateField<K extends keyof OnboardingFormData>(field: K, value: OnboardingFormData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPG, PNG, WebP, or SVG file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File must be under 10MB.");
      return;
    }

    setError("");
    updateField("logoFile", file);

    // Preview
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    updateField("logoFile", null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Step validation ──

  function canAdvanceFromStep(s: number): boolean {
    switch (s) {
      case 1:
        return formData.businessName.trim().length > 0 && formData.contactName.trim().length > 0;
      case 2:
        // Audit-only clients must provide at least one social URL for manual analysis
        if (isAuditOnly) {
          return [
            formData.facebookUrl,
            formData.instagramUrl,
            formData.xUrl,
            formData.linkedinUrl,
            formData.tiktokUrl,
            formData.googleUrl,
          ].some((u) => u.trim().length > 0);
        }
        return true; // All optional
      case 3:
        return true; // All optional
      default:
        return true;
    }
  }

  function nextStep() {
    if (!canAdvanceFromStep(step)) return;
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function prevStep() {
    if (step > 1) {
      setStep(step - 1);
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ── Submit ──

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    try {
      // 1. Upload logo if present
      let logoAsset: { name: string } | null = null;
      if (formData.logoFile) {
        const logoForm = new FormData();
        logoForm.append("files", formData.logoFile);
        const uploadRes = await fetch("/api/client/upload", {
          method: "POST",
          body: logoForm,
          credentials: "include",
          headers: { "x-csrf-protection": "1" },
        });
        if (uploadRes.status === 401) {
          window.location.href = "/portal";
          return;
        }
        if (uploadRes.ok) {
          const uploadJson = await uploadRes.json();
          logoAsset = uploadJson.files?.[0] || null;
        }
      }

      // 2. Submit onboarding data
      const payload: Record<string, unknown> = {
        businessInfo: {
          businessName: formData.businessName,
          industry: formData.industry,
          websiteUrl: formData.websiteUrl,
          businessLocation: formData.businessLocation,
          contactName: formData.contactName,
          phone: formData.phone,
        },
        platformUrls: {
          facebook: formData.facebookUrl,
          instagram: formData.instagramUrl,
          x: formData.xUrl,
          linkedin: formData.linkedinUrl,
          tiktok: formData.tiktokUrl,
          google: formData.googleUrl,
        },
        brandInfo: {
          brandGuidelines: formData.brandGuidelines,
          targetAudience: formData.targetAudience,
          brandVoice: formData.brandVoice,
          goals: [formData.goal1, formData.goal2, formData.goal3].filter(Boolean),
          pastCampaigns: formData.pastCampaigns,
          logo: logoAsset,
        },
      };
      // Audit clients never grant admin/publishing access — don't send the field.
      if (!isAuditOnly) {
        payload.hasAdminAccess = formData.hasAdminAccess;
      }
      if (isAuditOnly && formData.competitors.trim()) {
        payload.competitors = formData.competitors.trim();
      }

      const res = await fetch("/api/client/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-protection": "1",
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (res.status === 401) {
        window.location.href = "/portal";
        return;
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to submit onboarding data");
      }

      // Success — redirect to dashboard with success flag
      window.location.href = "/portal/dashboard?onboarding=complete";
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──

  if (loading) {
    return (
      <main className="min-h-dvh bg-bg-root flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size={32} className="text-brand-primary animate-spin" />
          <p className="text-sm text-text-muted">Verifying your session...</p>
        </div>
      </main>
    );
  }

  // ── Step labels ──

  const stepLabels = ["Business Info", "Social Media", "Brand & Goals", "Review"];

  // ── Input classes shared across form ──

  const inputClass =
    "w-full px-4 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted text-sm focus-visible:outline-2 focus-visible:outline-brand-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors";
  const textareaClass = `${inputClass} resize-none`;
  const labelClass = "block text-sm font-medium text-text-secondary mb-2";
  const optionalClass = "text-xs font-normal text-text-muted ml-1";

  return (
    <main className="min-h-dvh bg-bg-root">
      {/* ── Top Bar ── */}
      <header className="bg-bg-surface border-b border-border-subtle sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
              <Buildings size={18} className="text-brand-primary" weight="fill" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary font-heading">
                Client Onboarding
              </p>
            </div>
          </div>
          <Link
            to="/portal/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* ── Progress Indicator ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {stepLabels.map((label, i) => {
              const stepNum = i + 1;
              const isActive = stepNum === step;
              const isComplete = stepNum < step;
              return (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                        isComplete
                          ? "bg-success text-bg-root"
                          : isActive
                          ? "bg-brand-primary text-text-primary ring-2 ring-brand-primary/30"
                          : "bg-bg-surface-raised border border-border-subtle text-text-muted"
                      }`}
                    >
                      {isComplete ? <CheckCircle size={16} weight="fill" /> : stepNum}
                    </div>
                    <span
                      className={`text-[10px] mt-1.5 font-medium whitespace-nowrap ${
                        isActive ? "text-brand-primary" : isComplete ? "text-success" : "text-text-muted"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 mt-[-14px] rounded transition-colors duration-200 ${
                        stepNum > i + 1 ? "bg-success" : "bg-border-subtle"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
            <WarningCircle size={20} className="text-error flex-shrink-0 mt-0.5" weight="fill" />
            <div>
              <p className="text-sm font-semibold text-error">Something went wrong</p>
              <p className="text-xs text-error/80 mt-1">{error}</p>
              {error.includes("try again") && (
                <button
                  onClick={handleSubmit}
                  className="mt-2 text-xs font-semibold text-error underline hover:no-underline"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Form Card ── */}
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 sm:p-8">
          {/* ── Step 1: Business Info ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold font-heading text-text-primary mb-1">
                  Business Information
                </h2>
                <p className="text-sm text-text-secondary">
                  Tell us about your business so we can tailor your strategy.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>
                    Business Name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => updateField("businessName", e.target.value)}
                    placeholder="Acme Construction Co."
                    maxLength={200}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Industry</label>
                  <select
                    value={formData.industry}
                    onChange={(e) => updateField("industry", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select industry...</option>
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Website URL</label>
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => updateField("websiteUrl", e.target.value)}
                  placeholder="https://www.yourbusiness.com"
                  maxLength={500}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Business Location</label>
                <input
                  type="text"
                  value={formData.businessLocation}
                  onChange={(e) => updateField("businessLocation", e.target.value)}
                  placeholder="City, State"
                  maxLength={200}
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>
                    Contact Name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => updateField("contactName", e.target.value)}
                    placeholder="Jane Smith"
                    maxLength={200}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="(555) 123-4567"
                    maxLength={30}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Social Media Access ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold font-heading text-text-primary mb-1">
                  {isAuditOnly ? "Social Profiles" : "Social Media Access"}
                </h2>
                {isAuditOnly ? (
                  <p className="text-sm text-text-secondary">
                    Share your public profile URLs so we can analyze your current presence. We&apos;ll
                    analyze your publicly available profiles —{" "}
                    <strong>no account access needed</strong>.
                  </p>
                ) : (
                  <p className="text-sm text-text-secondary">
                    Share your profile URLs so we can review your current presence. All fields are optional.
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>Facebook URL</label>
                <input
                  type="url"
                  value={formData.facebookUrl}
                  onChange={(e) => updateField("facebookUrl", e.target.value)}
                  placeholder="https://www.facebook.com/yourpage"
                  maxLength={500}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Instagram URL</label>
                <input
                  type="url"
                  value={formData.instagramUrl}
                  onChange={(e) => updateField("instagramUrl", e.target.value)}
                  placeholder="https://www.instagram.com/yourhandle"
                  maxLength={500}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>X (Twitter) URL</label>
                <input
                  type="url"
                  value={formData.xUrl}
                  onChange={(e) => updateField("xUrl", e.target.value)}
                  placeholder="https://x.com/yourhandle"
                  maxLength={500}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>LinkedIn URL</label>
                <input
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(e) => updateField("linkedinUrl", e.target.value)}
                  placeholder="https://www.linkedin.com/company/yourcompany"
                  maxLength={500}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>TikTok URL</label>
                <input
                  type="url"
                  value={formData.tiktokUrl}
                  onChange={(e) => updateField("tiktokUrl", e.target.value)}
                  placeholder="https://www.tiktok.com/@yourhandle"
                  maxLength={500}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Google Business Profile URL</label>
                <input
                  type="url"
                  value={formData.googleUrl}
                  onChange={(e) => updateField("googleUrl", e.target.value)}
                  placeholder="https://maps.google.com/..."
                  maxLength={500}
                  className={inputClass}
                />
              </div>

              {/* Competitors — audit clients only: used for benchmarking, never contacted */}
              {isAuditOnly && (
                <div>
                  <label className={labelClass}>
                    Competitors to Analyze
                    <span className={optionalClass}>(optional but recommended)</span>
                  </label>
                  <textarea
                    value={formData.competitors}
                    onChange={(e) => updateField("competitors", e.target.value)}
                    placeholder="List your main competitors — names or profile URLs, one per line. We'll benchmark your presence against theirs."
                    rows={3}
                    maxLength={2000}
                    className={textareaClass}
                  />
                  <p className="text-xs text-text-muted mt-1.5">
                    These are used for competitive analysis in your audit only — no account access needed.
                  </p>
                </div>
              )}

              {/* Admin access toggle — managed services only; audits never need publishing access */}
              {!isAuditOnly && (
                <div className="bg-bg-surface-raised border border-border-subtle rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        Do you have admin access to these accounts?
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        We&apos;ll need admin access to publish content on your behalf.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField("hasAdminAccess", !formData.hasAdminAccess)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 flex-shrink-0 ${
                        formData.hasAdminAccess ? "bg-success" : "bg-bg-surface-high border border-border-subtle"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                          formData.hasAdminAccess ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {!formData.hasAdminAccess && (
                    <p className="text-xs text-warning mt-3 pt-3 border-t border-border-subtle">
                      Once you submit this form, we&apos;ll send connection requests to your accounts. You can also connect them directly from the{" "}
                      <Link to="/portal/connect" className="text-brand-primary underline hover:no-underline">
                        Connect Accounts
                      </Link>{" "}
                      page.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Brand & Goals ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold font-heading text-text-primary mb-1">
                  Brand &amp; Goals
                </h2>
                <p className="text-sm text-text-secondary">
                  Help us understand your brand voice, audience, and what you want to achieve.
                </p>
              </div>

              <div>
                <label className={labelClass}>
                  Brand Guidelines or Description
                  <span className={optionalClass}>(optional)</span>
                </label>
                <textarea
                  value={formData.brandGuidelines}
                  onChange={(e) => updateField("brandGuidelines", e.target.value)}
                  placeholder="Share a link to your brand guidelines or describe your brand colors, fonts, and visual style..."
                  rows={3}
                  maxLength={2000}
                  className={textareaClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Target Audience Description
                  <span className={optionalClass}>(optional)</span>
                </label>
                <textarea
                  value={formData.targetAudience}
                  onChange={(e) => updateField("targetAudience", e.target.value)}
                  placeholder="Who are your ideal customers? Demographics, interests, pain points..."
                  rows={3}
                  maxLength={2000}
                  className={textareaClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Brand Voice / Tone
                  <span className={optionalClass}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.brandVoice}
                  onChange={(e) => updateField("brandVoice", e.target.value)}
                  placeholder='e.g. "Professional and authoritative" or "Friendly and approachable"'
                  maxLength={200}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Top 3 Business Goals
                  <span className={optionalClass}>(optional)</span>
                </label>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={formData.goal1}
                    onChange={(e) => updateField("goal1", e.target.value)}
                    placeholder="Goal 1 — e.g. Increase qualified leads by 30%"
                    maxLength={300}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={formData.goal2}
                    onChange={(e) => updateField("goal2", e.target.value)}
                    placeholder="Goal 2 — e.g. Build brand awareness in the local market"
                    maxLength={300}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={formData.goal3}
                    onChange={(e) => updateField("goal3", e.target.value)}
                    placeholder="Goal 3 — e.g. Launch new service line"
                    maxLength={300}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Existing Marketing Materials or Past Campaign Notes
                  <span className={optionalClass}>(optional)</span>
                </label>
                <textarea
                  value={formData.pastCampaigns}
                  onChange={(e) => updateField("pastCampaigns", e.target.value)}
                  placeholder="Share anything relevant — past campaign results, current marketing efforts, things that worked or didn't..."
                  rows={3}
                  maxLength={2000}
                  className={textareaClass}
                />
              </div>

              {/* Logo Upload */}
              <div>
                <label className={labelClass}>
                  Logo Upload
                  <span className={optionalClass}>(optional)</span>
                </label>
                {logoPreview ? (
                  <div className="flex items-center gap-4 p-4 bg-bg-surface-raised border border-border-subtle rounded-xl">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-16 h-16 object-contain rounded-lg bg-white/5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {formData.logoFile?.name || "Logo"}
                      </p>
                      <p className="text-xs text-text-muted">
                        {(formData.logoFile?.size || 0) > 0
                          ? `${(formData.logoFile!.size / 1024).toFixed(1)} KB`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="p-1.5 text-text-muted hover:text-error rounded-lg hover:bg-error/10 transition-colors"
                    >
                      <X size={16} weight="bold" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-3 p-6 border-2 border-dashed border-border-subtle hover:border-border-emphasis rounded-xl bg-bg-surface-raised transition-colors cursor-pointer"
                  >
                    <UploadSimple size={24} className="text-text-muted" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-text-primary">Upload your logo</p>
                      <p className="text-xs text-text-muted">JPG, PNG, WebP, SVG — max 10MB</p>
                    </div>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  onChange={handleLogoSelect}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* ── Step 4: Review & Submit ── */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold font-heading text-text-primary mb-1">
                  Review &amp; Submit
                </h2>
                <p className="text-sm text-text-secondary">
                  Review your information before submitting. You can go back to any step to make changes.
                </p>
              </div>

              {/* Business Info Summary */}
              <div className="rounded-xl bg-bg-surface-raised border border-border-subtle p-5 space-y-3">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Buildings size={16} className="text-brand-primary" weight="fill" />
                  Business Information
                </h3>
                <div className="grid gap-2 text-sm">
                  <SummaryRow label="Business Name" value={formData.businessName} />
                  <SummaryRow label="Industry" value={formData.industry} />
                  <SummaryRow label="Website" value={formData.websiteUrl} />
                  <SummaryRow label="Location" value={formData.businessLocation} />
                  <SummaryRow label="Contact" value={formData.contactName} />
                  <SummaryRow label="Phone" value={formData.phone} />
                </div>
              </div>

              {/* Social Media Summary */}
              <div className="rounded-xl bg-bg-surface-raised border border-border-subtle p-5 space-y-3">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <GlobeHemisphereWest size={16} className="text-brand-primary" weight="fill" />
                  {isAuditOnly ? "Social Profiles — For Analysis Only" : "Social Media"}
                </h3>
                <div className="grid gap-2 text-sm">
                  <SummaryRow label="Facebook" value={formData.facebookUrl} />
                  <SummaryRow label="Instagram" value={formData.instagramUrl} />
                  <SummaryRow label="X (Twitter)" value={formData.xUrl} />
                  <SummaryRow label="LinkedIn" value={formData.linkedinUrl} />
                  <SummaryRow label="TikTok" value={formData.tiktokUrl} />
                  <SummaryRow label="Google Business" value={formData.googleUrl} />
                  {isAuditOnly && formData.competitors.trim() && (
                    <SummaryRow label="Competitors" value={formData.competitors} lines={2} />
                  )}
                  {!isAuditOnly && (
                    <SummaryRow
                      label="Admin Access"
                      value={formData.hasAdminAccess ? "Yes" : "No — connection requests will be sent"}
                    />
                  )}
                </div>
                {isAuditOnly && (
                  <p className="text-xs text-text-muted pt-2 border-t border-border-subtle">
                    No account access needed — we&apos;ll analyze your publicly available profiles only.
                  </p>
                )}
              </div>

              {/* Brand & Goals Summary */}
              <div className="rounded-xl bg-bg-surface-raised border border-border-subtle p-5 space-y-3">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Palette size={16} className="text-brand-primary" weight="fill" />
                  Brand &amp; Goals
                </h3>
                <div className="grid gap-2 text-sm">
                  <SummaryRow label="Brand Voice" value={formData.brandVoice} />
                  <SummaryRow label="Target Audience" value={formData.targetAudience} lines={2} />
                  <SummaryRow label="Brand Guidelines" value={formData.brandGuidelines} lines={2} />
                  {formData.goal1 && <SummaryRow label="Goal 1" value={formData.goal1} />}
                  {formData.goal2 && <SummaryRow label="Goal 2" value={formData.goal2} />}
                  {formData.goal3 && <SummaryRow label="Goal 3" value={formData.goal3} />}
                  <SummaryRow label="Past Campaigns" value={formData.pastCampaigns} lines={2} />
                  <SummaryRow
                    label="Logo"
                    value={formData.logoFile ? formData.logoFile.name : "Not uploaded"}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Navigation Buttons ── */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border-subtle">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-bg-surface-raised border border-border-subtle text-text-secondary text-sm font-medium hover:border-border-emphasis hover:text-text-primary transition-colors"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}
            </div>

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!canAdvanceFromStep(step)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ArrowRight size={16} weight="bold" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-success text-bg-root text-sm font-semibold hover:bg-success/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Spinner size={16} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <ClipboardText size={16} weight="bold" />
                    Submit Onboarding
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-5 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} MetroReach Media. Premium Social Media Marketing.
          </p>
        </div>
      </footer>
    </main>
  );
}

// ── Summary row helper ──

function SummaryRow({
  label,
  value,
  lines,
}: {
  label: string;
  value: string;
  lines?: number;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-text-muted min-w-[100px] flex-shrink-0">{label}</span>
      <span className={`text-xs text-text-primary ${lines ? `line-clamp-${lines}` : ""}`}>
        {value}
      </span>
    </div>
  );
}
