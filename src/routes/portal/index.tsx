/**
 * /portal — Client Portal Login & Account Setup
 *
 * Email + password login. Clients who haven't set a password yet arrive
 * via a one-time setup link (?token=XXX) and are prompted to choose one;
 * afterward they log in with email + password. "Forgot password?" emails
 * a fresh setup link.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Eye,
  EyeSlash,
  ArrowRight,
  CheckCircle,
  WarningCircle,
  Buildings,
  EnvelopeSimple,
  LockSimple,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: "Client Portal — MetroReach Media" },
      { name: "description", content: "Secure client portal for MetroReach Media clients. Access your campaign dashboard, messages, and content approvals." },
      { property: "og:url", content: "https://metroreachagency.com/portal" },
    ],
    links: [
      { rel: "canonical", href: "https://metroreachagency.com/portal" },
    ],
  }),
  component: PortalLogin,
});

function PortalLogin() {
  const [setupToken, setSetupToken] = useState<string | null>(null);

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Setup form state
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [showSetupConfirm, setShowSetupConfirm] = useState(false);
  const [setupStatus, setSetupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [setupErrorMsg, setSetupErrorMsg] = useState("");

  // Resend / forgot-password flow state
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [resendMsg, setResendMsg] = useState("");

  // Success banner shown after password setup (e.g. /portal?setup=1)
  const [setupDone, setSetupDone] = useState(false);

  // Read one-time setup token from URL (?token=XXX)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t && t.length >= 8) {
      setSetupToken(t);
    }
    if (params.get("setup") === "1") {
      setSetupDone(true);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-protection": "1" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();
      if (data.success) {
        setStatus("success");
        // Redirect to dashboard
        window.location.href = "/portal/dashboard";
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Invalid email or password.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please check your connection and try again.");
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (!setupToken) return;

    if (setupPassword.length < 8) {
      setSetupStatus("error");
      setSetupErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (setupPassword !== setupConfirm) {
      setSetupStatus("error");
      setSetupErrorMsg("Passwords don't match. Please try again.");
      return;
    }

    setSetupStatus("loading");
    setSetupErrorMsg("");

    try {
      const res = await fetch("/api/portal/setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-protection": "1" },
        body: JSON.stringify({ token: setupToken, password: setupPassword }),
      });

      const data = await res.json();
      if (data.success) {
        setSetupStatus("success");
        // Consumed the token — drop it from the URL and return to login.
        setSetupToken(null);
        setSetupDone(true);
        window.history.replaceState(null, "", "/portal?setup=1");
      } else {
        setSetupStatus("error");
        setSetupErrorMsg(data.error || "Failed to set password. Please try again.");
      }
    } catch {
      setSetupStatus("error");
      setSetupErrorMsg("Network error. Please check your connection and try again.");
    }
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!resendEmail || !resendEmail.includes("@")) return;

    setResendStatus("loading");
    setResendMsg("");

    try {
      const res = await fetch("/api/portal/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-protection": "1" },
        body: JSON.stringify({ email: resendEmail.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (data.success) {
        setResendStatus("success");
        setResendMsg(data.message || "If an account exists for that email, we've sent you a link to set up your password.");
      } else {
        setResendStatus("error");
        setResendMsg(data.error || "Failed to send the link. Please try again.");
      }
    } catch {
      setResendStatus("error");
      setResendMsg("Network error. Please check your connection and try again.");
    }
  }

  return (
    <main className="min-h-dvh bg-bg-root flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo area */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 mb-5">
            <Buildings size={24} className="text-brand-primary" weight="fill" />
          </div>
          <h1 className="text-2xl font-bold font-heading text-text-primary mb-2">
            Client Portal
          </h1>
          <p className="text-sm text-text-secondary">
            {setupToken
              ? "Set your password to activate your account."
              : "Log in with your email and password."}
          </p>
        </div>

        {/* Post-setup success banner */}
        {setupDone && (
          <div className="mb-6 p-4 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-start gap-3">
            <CheckCircle size={20} className="text-brand-accent flex-shrink-0 mt-0.5" weight="fill" />
            <p className="text-sm text-brand-accent">
              Your password has been set. Log in with your email and password.
            </p>
          </div>
        )}

        {setupToken ? (
          /* ── Set your password form ── */
          <form onSubmit={handleSetup} className="bg-bg-surface border border-border-subtle rounded-2xl p-8">
            {setupStatus === "error" && setupErrorMsg && (
              <div className="mb-5 p-4 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
                <WarningCircle size={20} className="text-error flex-shrink-0 mt-0.5" weight="fill" />
                <p className="text-sm text-error">{setupErrorMsg}</p>
              </div>
            )}

            <label htmlFor="setup-password" className="block text-sm font-medium text-text-secondary mb-2">
              New Password
            </label>
            <div className="relative mb-5">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <LockSimple size={18} className="text-text-muted" />
              </div>
              <input
                id="setup-password"
                type={showSetupPassword ? "text" : "password"}
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                maxLength={128}
                autoFocus
                autoComplete="new-password"
                className="w-full pl-10 pr-12 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSetupPassword((v) => !v)}
                aria-label={showSetupPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-text-muted hover:text-text-primary transition-colors"
              >
                {showSetupPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <label htmlFor="setup-confirm" className="block text-sm font-medium text-text-secondary mb-2">
              Confirm Password
            </label>
            <div className="relative mb-5">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <LockSimple size={18} className="text-text-muted" />
              </div>
              <input
                id="setup-confirm"
                type={showSetupConfirm ? "text" : "password"}
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value)}
                placeholder="Re-enter your password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                className="w-full pl-10 pr-12 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSetupConfirm((v) => !v)}
                aria-label={showSetupConfirm ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-text-muted hover:text-text-primary transition-colors"
              >
                {showSetupConfirm ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {setupStatus === "success" ? (
              <div className="w-full p-4 rounded-xl bg-brand-accent/10 border border-brand-accent/20 text-center">
                <p className="text-sm text-brand-accent">Password set. Redirecting to login...</p>
              </div>
            ) : (
              <button
                type="submit"
                disabled={setupStatus === "loading" || !setupPassword || !setupConfirm}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {setupStatus === "loading" ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Set Password
                    <ArrowRight size={16} weight="bold" />
                  </>
                )}
              </button>
            )}

            <p className="text-xs text-text-muted text-center mt-5">
              Already have a password?{" "}
              <button
                type="button"
                onClick={() => {
                  setSetupToken(null);
                  window.history.replaceState(null, "", "/portal");
                }}
                className="text-text-muted hover:text-brand-primary underline underline-offset-2 transition-colors"
              >
                Back to login
              </button>
            </p>
          </form>
        ) : (
          /* ── Login form ── */
          <form onSubmit={handleLogin} className="bg-bg-surface border border-border-subtle rounded-2xl p-8">
            {status === "error" && errorMsg && (
              <div className="mb-5 p-4 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
                <WarningCircle size={20} className="text-error flex-shrink-0 mt-0.5" weight="fill" />
                <p className="text-sm text-error">{errorMsg}</p>
              </div>
            )}

            <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
              Email
            </label>
            <div className="relative mb-5">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <EnvelopeSimple size={18} className="text-text-muted" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
                autoComplete="email"
                maxLength={254}
                className="w-full pl-10 pr-4 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors text-sm"
              />
            </div>

            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowResend((v) => !v)}
                className="text-xs text-text-muted hover:text-brand-primary transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative mb-5">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <LockSimple size={18} className="text-text-muted" />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                maxLength={128}
                autoComplete="current-password"
                className="w-full pl-10 pr-12 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-text-muted hover:text-text-primary transition-colors"
              >
                {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={status === "loading" || !email || !password}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "loading" ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  Log In
                  <ArrowRight size={16} weight="bold" />
                </>
              )}
            </button>

            <p className="text-xs text-text-muted text-center mt-5">
              First time here? Check your email for your account setup link.
            </p>

            {/* Forgot password / resend setup link */}
            {showResend && (
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <div className="space-y-3">
                  <p className="text-xs text-text-secondary">
                    Enter your email and we'll send you a link to set up a new password.
                  </p>
                  {resendStatus === "success" ? (
                    <div className="p-3 rounded-xl bg-brand-accent/10 border border-brand-accent/20">
                      <p className="text-xs text-brand-accent">{resendMsg}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleResend} className="space-y-3">
                      {resendStatus === "error" && resendMsg && (
                        <div className="p-3 rounded-lg bg-error/10 border border-error/20 flex items-start gap-2">
                          <WarningCircle size={14} className="text-error flex-shrink-0 mt-0.5" weight="fill" />
                          <p className="text-xs text-error">{resendMsg}</p>
                        </div>
                      )}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                          <EnvelopeSimple size={16} className="text-text-muted" />
                        </div>
                        <input
                          type="email"
                          value={resendEmail}
                          onChange={(e) => setResendEmail(e.target.value)}
                          placeholder="you@company.com"
                          required
                          autoComplete="email"
                          maxLength={254}
                          className="w-full pl-10 pr-4 py-2.5 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted text-sm focus-visible:outline-2 focus-visible:outline-brand-primary"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={resendStatus === "loading" || !resendEmail}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-bg-surface-raised border border-border-subtle text-text-secondary text-xs font-semibold hover:border-border-emphasis hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resendStatus === "loading" ? (
                          <><span className="inline-block w-3.5 h-3.5 border-2 border-text-muted/30 border-t-text-muted rounded-full animate-spin" /> Sending...</>
                        ) : (
                          "Send Setup Link"
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </form>
        )}

        {/* Footer */}
        <p className="text-xs text-text-muted text-center mt-8">
          &copy; {new Date().getFullYear()} MetroReach Media. All rights reserved.
        </p>
      </div>
    </main>
  );
}
