/**
 * /client — Client Portal Login
 *
 * Email entry form for magic link authentication.
 * If ?token=JWT is present, validates and redirects to dashboard.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  EnvelopeSimple,
  ArrowRight,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/client/")({
  head: () => ({
    meta: [
      { title: "Client Portal — MetroReach Digital" },
      { name: "description", content: "Secure client portal for MetroReach Digital clients." },
      { property: "og:url", content: "https://www.metroreachagency.com/client" },
    ],
    links: [
      { rel: "canonical", href: "https://www.metroreachagency.com/client" },
    ],
  }),
  component: ClientLogin,
});

function ClientLogin() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Handle ?token=JWT redirect — forward to verify API
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      window.location.href = `/api/client/verify?token=${encodeURIComponent(token)}`;
    }
  }, []);

  // Check for error in URL
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const urlError = searchParams?.get("error");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/client/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (data.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please check your connection and try again.");
    }
  }

  return (
    <main className="min-h-dvh bg-bg-root flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo area */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 mb-5">
            <EnvelopeSimple size={24} className="text-brand-primary" weight="fill" />
          </div>
          <h1 className="text-2xl font-bold font-heading text-text-primary mb-2">
            Client Portal
          </h1>
          <p className="text-sm text-text-secondary">
            Enter your email to receive a secure login link.
          </p>
        </div>

        {/* Expired token message */}
        {urlError === "expired" && (
          <div className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/20 flex items-start gap-3">
            <WarningCircle size={20} className="text-warning flex-shrink-0 mt-0.5" weight="fill" />
            <div>
              <p className="text-sm font-semibold text-warning">Link Expired</p>
              <p className="text-xs text-text-secondary mt-1">
                Your login link has expired. Enter your email below for a new one.
              </p>
            </div>
          </div>
        )}

        {/* Success state */}
        {status === "success" ? (
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-accent/10 mb-5">
              <CheckCircle size={28} className="text-brand-accent" weight="fill" />
            </div>
            <h2 className="text-xl font-bold font-heading text-text-primary mb-2">
              Check Your Email
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              We sent a secure login link to <strong className="text-text-primary">{email}</strong>.
              Click the link in the email to access your dashboard.
            </p>
            <p className="text-xs text-text-muted mt-4">
              Didn't receive it? Check spam or{" "}
              <button
                type="button"
                className="text-brand-primary hover:underline font-medium"
                onClick={() => setStatus("idle")}
              >
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          /* Login form */
          <form onSubmit={handleSubmit} className="bg-bg-surface border border-border-subtle rounded-2xl p-8">
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
              Email Address
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
                className="w-full pl-10 pr-4 py-3 bg-bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 transition-colors text-sm"
              />
            </div>

            {status === "error" && errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/20 flex items-start gap-2.5">
                <WarningCircle size={16} className="text-error flex-shrink-0 mt-0.5" weight="fill" />
                <p className="text-xs text-error">{errorMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading" || !email}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-primary text-text-primary text-sm font-semibold hover:bg-gradient-to-r hover:from-brand-primary hover:to-brand-accent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "loading" ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending Link...
                </>
              ) : (
                <>
                  Send Login Link
                  <ArrowRight size={16} weight="bold" />
                </>
              )}
            </button>

            <p className="text-xs text-text-muted text-center mt-5">
              Secure, passwordless access to your MetroReach Digital dashboard.
            </p>
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
