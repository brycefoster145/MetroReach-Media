/**
 * /portal — Client Portal Login
 *
 * Invite-code based access. Clients enter their unique portal token
 * or click an invite link with ?token=XXX in the URL.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Key,
  ArrowRight,
  CheckCircle,
  WarningCircle,
  Buildings,
  EnvelopeSimple,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: "Client Portal — MetroReach Digital" },
      { name: "description", content: "Secure client portal for MetroReach Digital clients. Access your campaign dashboard, messages, and content approvals." },
      { property: "og:url", content: "https://metroreachagency.com/portal" },
    ],
    links: [
      { rel: "canonical", href: "https://metroreachagency.com/portal" },
    ],
  }),
  component: PortalLogin,
});

function PortalLogin() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Resend code flow
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [resendMsg, setResendMsg] = useState("");
  const [resendInviteCode, setResendInviteCode] = useState("");

  // Auto-fill token from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
      // Auto-submit if token is in URL
      handleLogin(t).then(() => {
        // Clean URL after attempt (success redirects away, failure cleans up)
        if (window.location.pathname === "/portal" || window.location.pathname === "/portal/") {
          window.history.replaceState(null, "", "/portal");
        }
      });
    }
  }, []);

  async function handleLogin(t?: string) {
    const code = (t || token).trim();
    if (!code || code.length < 8) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-protection": "1" },
        body: JSON.stringify({ token: code }),
      });

      const data = await res.json();
      if (data.success) {
        setStatus("success");
        // Redirect to dashboard
        window.location.href = "/portal/dashboard";
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Invalid invite code. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please check your connection and try again.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await handleLogin();
  }

  async function handleResendCode(e: React.FormEvent) {
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
        setResendMsg("Your invite code has been regenerated. Check your email or use the code below.");
        setResendInviteCode(data.inviteCode || "");
      } else {
        setResendStatus("error");
        setResendMsg(data.error || "Failed to resend code. Please try again.");
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
            Enter your invite code to access your campaign dashboard.
          </p>
        </div>

        {/* Error message */}
        {status === "error" && errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
            <WarningCircle size={20} className="text-error flex-shrink-0 mt-0.5" weight="fill" />
            <p className="text-sm text-error">{errorMsg}</p>
          </div>
        )}

        {/* Success (redirecting) */}
        {status === "success" ? (
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-accent/10 mb-5">
              <CheckCircle size={28} className="text-brand-accent" weight="fill" />
            </div>
            <h2 className="text-xl font-bold font-heading text-text-primary mb-2">
              Welcome Back
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Redirecting to your dashboard...
            </p>
            <div className="mt-4">
              <span className="inline-block w-5 h-5 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
            </div>
          </div>
        ) : (
          /* Invite code form */
          <form onSubmit={handleSubmit} className="bg-bg-surface border border-border-subtle rounded-2xl p-8">
            <label htmlFor="token" className="block text-sm font-medium text-text-secondary mb-2">
              Invite Code
            </label>
            <div className="relative mb-5">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <Key size={18} className="text-text-muted" />
              </div>
              <input
                id="token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter your invite code"
                required
                autoFocus
                autoComplete="off"
                maxLength={128}
                className="w-full pl-10 pr-4 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors text-sm font-mono tracking-wider"
              />
            </div>

            <button
              type="submit"
              disabled={status === "loading" || token.length < 8}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "loading" ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Access Portal
                  <ArrowRight size={16} weight="bold" />
                </>
              )}
            </button>

            <p className="text-xs text-text-muted text-center mt-5">
              Don't have an invite code? Contact your MetroReach account manager.
            </p>

            {/* Resend code link */}
            <div className="mt-4 pt-4 border-t border-border-subtle text-center">
              {!showResend ? (
                <button
                  type="button"
                  onClick={() => setShowResend(true)}
                  className="text-xs text-text-muted hover:text-brand-primary transition-colors"
                >
                  Lost your invite code?
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-text-secondary">
                    Enter your email and we'll regenerate your invite code.
                  </p>
                  {resendStatus === "success" ? (
                    <div className="p-3 rounded-xl bg-brand-accent/10 border border-brand-accent/20">
                      <p className="text-xs text-brand-accent mb-2">{resendMsg}</p>
                      {resendInviteCode && (
                        <p className="text-sm font-mono font-bold text-text-primary bg-bg-surface-raised rounded-lg p-2">
                          {resendInviteCode}
                        </p>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleResendCode} className="space-y-3">
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
                          "Resend Invite Code"
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="text-xs text-text-muted text-center mt-8">
          &copy; {new Date().getFullYear()} MetroReach Digital. All rights reserved.
        </p>
      </div>
    </main>
  );
}
