/**
 * /portal/connect — Connect Social Media Accounts
 *
 * Client connects their Facebook Pages and Instagram accounts
 * via Meta OAuth. After authorization, we exchange the code for
 * a long-lived page access token and store it in client_platform_tokens.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  FacebookLogo,
  InstagramLogo,
  Link,
  CheckCircle,
  WarningCircle,
  Spinner,
  ArrowRight,
  GlobeHemisphereWest,
} from "@phosphor-icons/react";

const META_APP_ID = "1210460348820936";
const REDIRECT_URI = "https://metroreachagency.com/api/portal/meta-oauth-callback";
const META_OAUTH_URL = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish&response_type=code`;

interface ConnectedAccount {
  platform: string;
  page_id: string;
  account_name: string;
  created_at: string;
}

export const Route = createFileRoute("/portal/connect")({
  head: () => ({
    meta: [
      { title: "Connect Accounts — MetroReach Digital Portal" },
      { name: "description", content: "Connect your social media accounts to MetroReach Digital." },
    ],
  }),
  component: PortalConnect,
});

function PortalConnect() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<string>("");

  // Check for OAuth callback success/error from query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get("oauth_result");

    if (oauthResult === "success") {
      setOauthStatus("success");
      // Clean the URL
      window.history.replaceState(null, "", "/portal/connect");
    } else if (oauthResult === "error") {
      const errMsg = params.get("error_msg") || "Authorization failed. Please try again.";
      setOauthStatus("error");
      setError(decodeURIComponent(errMsg));
      window.history.replaceState(null, "", "/portal/connect");
    }
  }, []);

  // Fetch connected accounts
  useEffect(() => {
    fetchConnected();
  }, []);

  async function fetchConnected() {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/connected-accounts");
      if (res.status === 401) {
        window.location.href = "/portal";
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (err: any) {
      // Don't show error for empty state
    } finally {
      setLoading(false);
    }
  }

  function handleConnect() {
    setConnecting(true);
    setError("");
    // Redirect to Meta OAuth
    window.location.href = META_OAUTH_URL;
  }

  const hasFacebook = accounts.some((a) => a.platform === "facebook");
  const hasInstagram = accounts.some((a) => a.platform === "instagram");

  return (
    <main className="min-h-dvh bg-bg-root">
      {/* ── Top Bar ── */}
      <header className="bg-bg-surface border-b border-border-subtle sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
              <GlobeHemisphereWest size={18} className="text-brand-primary" weight="fill" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary font-heading">
                Connected Accounts
              </p>
            </div>
          </div>
          <a
            href="/portal/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
          >
            <ArrowRight size={14} className="rotate-180" />
            Back to Dashboard
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* OAuth success banner */}
        {oauthStatus === "success" && (
          <div className="mb-6 p-4 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-start gap-3 animate-fade-in">
            <CheckCircle size={20} className="text-brand-accent flex-shrink-0 mt-0.5" weight="fill" />
            <div>
              <p className="text-sm font-semibold text-brand-accent">Accounts connected successfully!</p>
              <p className="text-xs text-text-secondary mt-1">
                Your Facebook Pages and Instagram accounts are now linked. You're ready to go.
              </p>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
            <WarningCircle size={20} className="text-error flex-shrink-0 mt-0.5" weight="fill" />
            <div>
              <p className="text-sm font-semibold text-error">Connection failed</p>
              <p className="text-xs text-error/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Facebook Connect Card ── */}
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 border border-[#1877F2]/20 flex items-center justify-center">
                <FacebookLogo size={20} className="text-[#1877F2]" weight="fill" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading text-text-primary">Facebook</h3>
                <p className="text-xs text-text-muted">Connect your Facebook Pages</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size={24} className="text-brand-primary animate-spin" />
              </div>
            ) : hasFacebook ? (
              <div className="space-y-3">
                {accounts
                  .filter((a) => a.platform === "facebook")
                  .map((a) => (
                    <div
                      key={a.page_id}
                      className="flex items-center gap-3 p-3 bg-bg-surface-raised border border-border-subtle rounded-xl"
                    >
                      <CheckCircle size={18} className="text-brand-accent flex-shrink-0" weight="fill" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">{a.account_name}</p>
                        <p className="text-xs text-text-muted">Connected {new Date(a.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="text-xs font-semibold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    </div>
                  ))}
                <button
                  onClick={handleConnect}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-bg-surface-raised border border-border-subtle text-text-secondary text-sm font-medium hover:border-border-emphasis hover:text-text-primary transition-colors mt-2"
                >
                  <Link size={14} /> Reconnect / Add Pages
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-text-secondary mb-4">
                  Connect your Facebook Pages to let us manage and publish content for you.
                </p>
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1877F2] text-white text-sm font-semibold hover:bg-[#166FE5] transition-colors disabled:opacity-50"
                >
                  {connecting ? (
                    <><Spinner size={16} className="animate-spin" /> Connecting...</>
                  ) : (
                    <><FacebookLogo size={16} weight="fill" /> Connect Facebook &amp; Instagram</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* ── Instagram Connect Card ── */}
          <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#E4405F]/10 border border-[#E4405F]/20 flex items-center justify-center">
                <InstagramLogo size={20} className="text-[#E4405F]" weight="fill" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading text-text-primary">Instagram</h3>
                <p className="text-xs text-text-muted">Connect your Instagram accounts</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size={24} className="text-brand-primary animate-spin" />
              </div>
            ) : hasInstagram ? (
              <div className="space-y-3">
                {accounts
                  .filter((a) => a.platform === "instagram")
                  .map((a) => (
                    <div
                      key={a.page_id}
                      className="flex items-center gap-3 p-3 bg-bg-surface-raised border border-border-subtle rounded-xl"
                    >
                      <CheckCircle size={18} className="text-brand-accent flex-shrink-0" weight="fill" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">{a.account_name}</p>
                        <p className="text-xs text-text-muted">Connected {new Date(a.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="text-xs font-semibold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-text-secondary mb-4">
                  Instagram accounts linked to your Facebook Pages are connected automatically when you connect Facebook.
                </p>
                <p className="text-xs text-text-muted">
                  Click the Facebook button to connect both platforms at once.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Info ── */}
        <div className="mt-8 bg-bg-surface border border-border-subtle rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
            What we access
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <CheckCircle size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-primary">Publish content</p>
                <p className="text-xs text-text-muted">Post to your Facebook Page and Instagram feed</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-primary">Read engagement</p>
                <p className="text-xs text-text-muted">Monitor likes, comments, and shares</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-primary">Instagram basic</p>
                <p className="text-xs text-text-muted">Access Instagram profile and media</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-primary">Content publishing</p>
                <p className="text-xs text-text-muted">Publish photos and videos to Instagram</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-4 pt-4 border-t border-border-subtle">
            You can revoke access at any time from your Facebook Business Settings.
            Your data is encrypted and stored securely.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-5 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} MetroReach Digital. Premium Social Media Marketing.
          </p>
        </div>
      </footer>
    </main>
  );
}
