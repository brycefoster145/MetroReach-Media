/**
 * /portal/connect — Connect Social Media Accounts
 *
 * Client connects their social media accounts via OAuth.
 * Each platform's client ID is loaded server-side from environment variables.
 * Platforms without configured credentials show a "Coming Soon" disabled state.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import {
  FacebookLogo,
  InstagramLogo,
  LinkedinLogo,
  TiktokLogo,
  TwitterLogo,
  GoogleLogo,
  YoutubeLogo,
  Link,
  CheckCircle,
  WarningCircle,
  Spinner,
  ArrowRight,
  GlobeHemisphereWest,
  LockSimple,
} from "@phosphor-icons/react";

// ── Server-side OAuth config loader ──
const getOAuthConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    metaAppId: process.env.META_APP_ID || "1210460348820936",
    linkedinClientId: process.env.LINKEDIN_CLIENT_ID || "",
    tiktokClientId: process.env.TIKTOK_CLIENT_ID || "",
    xClientId: process.env.X_CLIENT_ID || "",
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  };
});

interface OAuthConfig {
  metaAppId: string;
  linkedinClientId: string;
  tiktokClientId: string;
  xClientId: string;
  googleClientId: string;
}

const REDIRECT_BASE = "https://metroreachagency.com";

/**
 * Generate a cryptographically random PKCE code_verifier.
 */
function generateCodeVerifier(): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  let result = "";
  for (let i = 0; i < 64; i++) {
    result += charset[array[i] % charset.length];
  }
  return result;
}

/**
 * Compute the S256 code_challenge from a code_verifier.
 */
async function computeCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface ConnectedAccount {
  platform: string;
  page_id: string;
  account_name: string;
  created_at: string;
}

export const Route = createFileRoute("/portal/connect")({
  loader: () => getOAuthConfig(),
  head: () => ({
    meta: [
      { title: "Connect Accounts — MetroReach Media Portal" },
      { name: "description", content: "Connect your social media accounts to MetroReach Media." },
    ],
  }),
  component: PortalConnect,
});

function PortalConnect() {
  const oauthConfig = Route.useLoaderData() as OAuthConfig;

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

  // ── OAuth URL builders (use server-loaded config) ──

  function getMetaOAuthUrl(): string {
    const metaAppId = oauthConfig.metaAppId;
    const redirectUri = `${REDIRECT_BASE}/api/portal/meta-oauth-callback`;
    return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish&response_type=code`;
  }

  function getLinkedInOAuthUrl(): string {
    const clientId = oauthConfig.linkedinClientId;
    const redirectUri = `${REDIRECT_BASE}/api/portal/linkedin-oauth-callback`;
    return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=w_member_social%20r_organization_social&state=metroreach`;
  }

  function getTikTokOAuthUrl(): string {
    const clientKey = oauthConfig.tiktokClientId;
    const redirectUri = `${REDIRECT_BASE}/api/portal/tiktok-oauth-callback`;
    return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=user.info.basic,video.publish,video.upload&state=metroreach`;
  }

  function getGoogleOAuthUrl(): string {
    const clientId = oauthConfig.googleClientId;
    const redirectUri = `${REDIRECT_BASE}/api/portal/google-oauth-callback`;
    const scopes = encodeURIComponent(
      "https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/youtube.upload"
    );
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent&state=metroreach`;
  }

  async function redirectToXAuth(): Promise<string | null> {
    const clientId = oauthConfig.xClientId;
    if (!clientId) return null;

    const codeVerifier = generateCodeVerifier();
    document.cookie =
      `x_code_verifier=${encodeURIComponent(codeVerifier)}; ` +
      `path=/; max-age=600; SameSite=Lax; Secure`;

    const codeChallenge = await computeCodeChallenge(codeVerifier);
    const state = "metroreach_" + Date.now().toString(36);

    const url = new URL("https://x.com/i/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", `${REDIRECT_BASE}/api/portal/x-oauth-callback`);
    url.searchParams.set("scope", "tweet.read tweet.write users.read offline.access");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    window.location.href = url.toString();
    return null; // never reached
  }

  // ── Connect handlers ──

  function handleConnect() {
    setConnecting(true);
    setError("");
    window.location.href = getMetaOAuthUrl();
  }

  function handleLinkedInConnect() {
    if (!oauthConfig.linkedinClientId) return;
    setConnecting(true);
    setError("");
    window.location.href = getLinkedInOAuthUrl();
  }

  function handleTikTokConnect() {
    if (!oauthConfig.tiktokClientId) return;
    setConnecting(true);
    setError("");
    window.location.href = getTikTokOAuthUrl();
  }

  async function handleXConnect() {
    if (!oauthConfig.xClientId) return;
    setConnecting(true);
    setError("");
    await redirectToXAuth();
  }

  function handleGoogleConnect() {
    if (!oauthConfig.googleClientId) return;
    setConnecting(true);
    setError("");
    window.location.href = getGoogleOAuthUrl();
  }

  const hasFacebook = accounts.some((a) => a.platform === "facebook");
  const hasInstagram = accounts.some((a) => a.platform === "instagram");
  const hasLinkedIn = accounts.some((a) => a.platform === "linkedin");
  const hasTikTok = accounts.some((a) => a.platform === "tiktok");
  const hasX = accounts.some((a) => a.platform === "x");
  const hasGMB = accounts.some((a) => a.platform === "google_gmb");
  const hasYouTube = accounts.some((a) => a.platform === "google_youtube");

  // ── "Coming Soon" card for platforms without credentials ──
  function renderComingSoonCard(
    icon: React.ReactNode,
    platformName: string,
    description: string,
    accentColor: string,
  ) {
    return (
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6 opacity-70">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}33`, borderWidth: 1, borderStyle: "solid" }}
          >
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-bold font-heading text-text-primary">{platformName}</h3>
            <p className="text-xs text-text-muted">{description}</p>
          </div>
        </div>
        <div className="text-center py-8">
          <LockSimple size={24} className="text-text-muted mx-auto mb-3" />
          <p className="text-sm font-medium text-text-muted">Coming Soon</p>
          <p className="text-xs text-text-muted mt-1">
            {platformName} integration will be available shortly.
          </p>
        </div>
      </div>
    );
  }

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
                Your social media accounts are now linked. You're ready to go.
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

        <div className="grid gap-6 lg:grid-cols-4">
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

          {/* ── LinkedIn Connect Card ── */}
          {oauthConfig.linkedinClientId ? (
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#0A66C2]/10 border border-[#0A66C2]/20 flex items-center justify-center">
                  <LinkedinLogo size={20} className="text-[#0A66C2]" weight="fill" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-text-primary">LinkedIn</h3>
                  <p className="text-xs text-text-muted">Connect your Company Pages</p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size={24} className="text-brand-primary animate-spin" />
                </div>
              ) : hasLinkedIn ? (
                <div className="space-y-3">
                  {accounts
                    .filter((a) => a.platform === "linkedin")
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
                    onClick={handleLinkedInConnect}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-bg-surface-raised border border-border-subtle text-text-secondary text-sm font-medium hover:border-border-emphasis hover:text-text-primary transition-colors mt-2"
                  >
                    <Link size={14} /> Reconnect / Add Pages
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-text-secondary mb-4">
                    Connect your LinkedIn Company Pages to let us publish professional content for you.
                  </p>
                  <button
                    onClick={handleLinkedInConnect}
                    disabled={connecting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A66C2] text-white text-sm font-semibold hover:bg-[#084E96] transition-colors disabled:opacity-50"
                  >
                    {connecting ? (
                      <><Spinner size={16} className="animate-spin" /> Connecting...</>
                    ) : (
                      <><LinkedinLogo size={16} weight="fill" /> Connect LinkedIn</>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            renderComingSoonCard(
              <LinkedinLogo size={20} className="text-[#0A66C2]" weight="fill" />,
              "LinkedIn",
              "Connect your Company Pages",
              "#0A66C2",
            )
          )}

          {/* ── TikTok Connect Card ── */}
          {oauthConfig.tiktokClientId ? (
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#FE2C55]/10 border border-[#FE2C55]/20 flex items-center justify-center">
                  <TiktokLogo size={20} className="text-[#FE2C55]" weight="fill" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-text-primary">TikTok</h3>
                  <p className="text-xs text-text-muted">Connect your TikTok account</p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size={24} className="text-brand-primary animate-spin" />
                </div>
              ) : hasTikTok ? (
                <div className="space-y-3">
                  {accounts
                    .filter((a) => a.platform === "tiktok")
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
                    onClick={handleTikTokConnect}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-bg-surface-raised border border-border-subtle text-text-secondary text-sm font-medium hover:border-border-emphasis hover:text-text-primary transition-colors mt-2"
                  >
                    <Link size={14} /> Reconnect
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-text-secondary mb-4">
                    Connect your TikTok account to let us publish video content for you.
                  </p>
                  <button
                    onClick={handleTikTokConnect}
                    disabled={connecting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#000000] text-white text-sm font-semibold hover:bg-[#FE2C55] transition-colors disabled:opacity-50"
                  >
                    {connecting ? (
                      <><Spinner size={16} className="animate-spin" /> Connecting...</>
                    ) : (
                      <><TiktokLogo size={16} weight="fill" /> Connect TikTok</>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            renderComingSoonCard(
              <TiktokLogo size={20} className="text-[#FE2C55]" weight="fill" />,
              "TikTok",
              "Connect your TikTok account",
              "#FE2C55",
            )
          )}

          {/* ── X (Twitter) Connect Card ── */}
          {oauthConfig.xClientId ? (
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#1DA1F2]/10 border border-[#1DA1F2]/20 flex items-center justify-center">
                  <TwitterLogo size={20} className="text-[#1DA1F2]" weight="fill" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-text-primary">X</h3>
                  <p className="text-xs text-text-muted">Connect your X account</p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size={24} className="text-brand-primary animate-spin" />
                </div>
              ) : hasX ? (
                <div className="space-y-3">
                  {accounts
                    .filter((a) => a.platform === "x")
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
                    onClick={handleXConnect}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-bg-surface-raised border border-border-subtle text-text-secondary text-sm font-medium hover:border-border-emphasis hover:text-text-primary transition-colors mt-2"
                  >
                    <Link size={14} /> Reconnect
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-text-secondary mb-4">
                    Connect your X account to let us publish tweets and manage your presence.
                  </p>
                  <button
                    onClick={handleXConnect}
                    disabled={connecting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1DA1F2] text-white text-sm font-semibold hover:bg-[#1A8CD8] transition-colors disabled:opacity-50"
                  >
                    {connecting ? (
                      <><Spinner size={16} className="animate-spin" /> Connecting...</>
                    ) : (
                      <><TwitterLogo size={16} weight="fill" /> Connect X</>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            renderComingSoonCard(
              <TwitterLogo size={20} className="text-[#1DA1F2]" weight="fill" />,
              "X",
              "Connect your X account",
              "#1DA1F2",
            )
          )}

          {/* ── Google Connect Card (GMB + YouTube) ── */}
          {oauthConfig.googleClientId ? (
            <div className="bg-bg-surface border border-border-subtle rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#4285F4]/10 border border-[#4285F4]/20 flex items-center justify-center">
                  <GoogleLogo size={20} className="text-[#4285F4]" weight="fill" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-heading text-text-primary">Google</h3>
                  <p className="text-xs text-text-muted">Connect GMB &amp; YouTube</p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size={24} className="text-brand-primary animate-spin" />
                </div>
              ) : hasGMB || hasYouTube ? (
                <div className="space-y-3">
                  {accounts
                    .filter((a) => a.platform === "google_gmb")
                    .map((a) => (
                      <div
                        key={a.page_id}
                        className="flex items-center gap-3 p-3 bg-bg-surface-raised border border-border-subtle rounded-xl"
                      >
                        <CheckCircle size={18} className="text-brand-accent flex-shrink-0" weight="fill" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary truncate">{a.account_name}</p>
                          <p className="text-xs text-text-muted">
                            GMB · Connected {new Date(a.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      </div>
                    ))}
                  {accounts
                    .filter((a) => a.platform === "google_youtube")
                    .map((a) => (
                      <div
                        key={a.page_id}
                        className="flex items-center gap-3 p-3 bg-bg-surface-raised border border-border-subtle rounded-xl"
                      >
                        <YoutubeLogo size={18} className="text-[#FF0000] flex-shrink-0" weight="fill" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary truncate">{a.account_name}</p>
                          <p className="text-xs text-text-muted">
                            YouTube · Connected {new Date(a.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      </div>
                    ))}
                  <button
                    onClick={handleGoogleConnect}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-bg-surface-raised border border-border-subtle text-text-secondary text-sm font-medium hover:border-border-emphasis hover:text-text-primary transition-colors mt-2"
                  >
                    <Link size={14} /> Reconnect / Add Accounts
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-text-secondary mb-4">
                    Connect your Google account to let us manage your Google My Business listing and publish YouTube videos.
                  </p>
                  <button
                    onClick={handleGoogleConnect}
                    disabled={connecting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4285F4] text-white text-sm font-semibold hover:bg-[#3367D6] transition-colors disabled:opacity-50"
                  >
                    {connecting ? (
                      <><Spinner size={16} className="animate-spin" /> Connecting...</>
                    ) : (
                      <><GoogleLogo size={16} weight="fill" /> Connect Google</>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            renderComingSoonCard(
              <GoogleLogo size={20} className="text-[#4285F4]" weight="fill" />,
              "Google",
              "Connect GMB & YouTube",
              "#4285F4",
            )
          )}
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
            {oauthConfig.linkedinClientId && (
              <>
                <div className="flex items-start gap-3">
                  <CheckCircle size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">LinkedIn posting</p>
                    <p className="text-xs text-text-muted">Publish posts to your Company Pages</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">Organization access</p>
                    <p className="text-xs text-text-muted">Manage content on admin Company Pages</p>
                  </div>
                </div>
              </>
            )}
            {oauthConfig.tiktokClientId && (
              <div className="flex items-start gap-3">
                <CheckCircle size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-text-primary">TikTok video publishing</p>
                  <p className="text-xs text-text-muted">Upload and publish videos to your TikTok profile</p>
                </div>
              </div>
            )}
            {oauthConfig.xClientId && (
              <div className="flex items-start gap-3">
                <CheckCircle size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-text-primary">X (Twitter) posting</p>
                  <p className="text-xs text-text-muted">Publish tweets and manage your X presence</p>
                </div>
              </div>
            )}
            {oauthConfig.googleClientId && (
              <>
                <div className="flex items-start gap-3">
                  <CheckCircle size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">Google My Business</p>
                    <p className="text-xs text-text-muted">Publish posts and updates to your GMB listing</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">YouTube publishing</p>
                    <p className="text-xs text-text-muted">Upload videos to your connected YouTube channel</p>
                  </div>
                </div>
              </>
            )}
          </div>
          <p className="text-xs text-text-muted mt-4 pt-4 border-t border-border-subtle">
            You can revoke access at any time from your Facebook Business Settings, LinkedIn app permissions, TikTok app settings, X app permissions, or Google account security settings.
            Your data is encrypted and stored securely.
          </p>
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
