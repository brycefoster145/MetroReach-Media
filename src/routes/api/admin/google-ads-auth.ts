/**
 * GET /api/admin/google-ads-auth
 *
 * Admin OAuth flow for the Google Ads API. Handles both phases in one route
 * (same pattern as /api/admin/linkedin-auth):
 *
 *   1. Initiate (no `code` param) — redirects the owner to Google's consent
 *      screen requesting the Google Ads scope (`adwords`) with offline access,
 *      so a refresh token is issued. Sets a CSRF state cookie.
 *   2. Callback (Google redirects back with `code`) — validates the state
 *      cookie, exchanges the code for access + refresh tokens, and stores
 *      them in client_platform_tokens (platform = 'google_ads',
 *      client_id = 'metroreach'). Refresh token is stored in BOTH the
 *      `refresh_token` column and `page_id` (page_id is the existing
 *      convention used by the other Google MCP routes).
 *
 * The owner visits: https://metroreachagency.com/api/admin/google-ads-auth
 *
 * NOTE: Unlike other /api/admin routes, this route deliberately does NOT
 * require the x-api-key header. Google's consent redirect lands in a plain
 * browser, which cannot attach custom headers. CSRF is protected by the
 * state cookie (same trust model as /api/portal/google-oauth).
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";
import { sql } from "~/lib/db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = "https://metroreachagency.com/api/admin/google-ads-auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_API_BASE = "https://www.googleapis.com/oauth2/v2";

// adwords is the Google Ads API scope. userinfo.email is requested only so
// the success page can show which Google account authorized the app.
const GOOGLE_ADS_SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}> {
  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = await res.json();
  if (json.error) {
    throw new Error(
      `Google token exchange failed: ${json.error_description || json.error}`,
    );
  }
  if (!json.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. The adwords scope is a restricted scope — " +
        "the app must be approved (or you must be a Test user) for offline refresh tokens to be issued.",
    );
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? "",
    expires_in: json.expires_in ?? 3600,
    scope: json.scope ?? "",
  };
}

async function getUserInfo(accessToken: string): Promise<{
  name: string;
  email: string;
}> {
  try {
    const res = await fetch(`${USERINFO_API_BASE}/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    const json = await res.json();
    if (json.error) return { name: "Google Account", email: "" };
    return {
      name: json.name ?? "Google Account",
      email: json.email ?? "",
    };
  } catch {
    return { name: "Google Account", email: "" };
  }
}

/** Render the success HTML page (matching the portal Google OAuth styling). */
function renderSuccessPage(user: { name: string; email: string }, scope: string): Response {
  const who = user.email ? `${user.name} (${user.email})` : user.name;
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Google Ads Connected — MetroReach Media</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #e0e0e0; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 32px; max-width: 520px; text-align: center; }
    h1 { color: #34A853; margin-top: 0; }
    p { color: #aaa; line-height: 1.5; }
    a { color: #4285F4; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ Google Ads Connected!</h1>
    <p>${who} — your Google account is now connected to MetroReach Media with the Google Ads (adwords) scope.</p>
    <p>Scopes granted: ${scope}</p>
    <p><a href="/">Back to site</a></p>
  </div>
</body>
</html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html" },
    },
  );
}

export const Route = createFileRoute("/api/admin/google-ads-auth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        const clearStateCookie =
          "google_ads_oauth_state=; path=/; max-age=0; SameSite=Lax; Secure; HttpOnly";

        // ── Callback phase: Google redirected back with a code ──
        if (code) {
          if (error) {
            return new Response(
              `<h1>Google Ads Auth Failed</h1><p>${errorDescription || error || "Authorization was cancelled or failed."}</p><p><a href="/api/admin/google-ads-auth">Try again</a></p>`,
              {
                status: 400,
                headers: {
                  "Content-Type": "text/html",
                  "Set-Cookie": clearStateCookie,
                },
              },
            );
          }

          // CSRF state validation
          const cookies = request.headers.get("cookie") ?? "";
          const stateMatch = cookies.match(
            /(?:^|;\s*)google_ads_oauth_state=([^;]*)/,
          );
          const expectedState = stateMatch
            ? decodeURIComponent(stateMatch[1])
            : "";
          const returnedState = url.searchParams.get("state") ?? "";
          if (!expectedState || returnedState !== expectedState) {
            return new Response(
              `<h1>Security Check Failed</h1><p>State mismatch — possible CSRF attack. Please start the flow again.</p><p><a href="/api/admin/google-ads-auth">Try again</a></p>`,
              {
                status: 400,
                headers: {
                  "Content-Type": "text/html",
                  "Set-Cookie": clearStateCookie,
                },
              },
            );
          }

          try {
            // Step 1: Exchange code for access + refresh tokens
            const tokenData = await exchangeCodeForToken(code);

            // Step 2: Fetch user profile for the success page
            const userInfo = await getUserInfo(tokenData.access_token);

            const expiresAt = tokenData.expires_in
              ? new Date(Date.now() + tokenData.expires_in * 1000)
              : null;
            const accountName = userInfo.email
              ? `${userInfo.name} (${userInfo.email})`
              : userInfo.name || "Google Ads Account";

            // Step 3: Store tokens. page_id holds the refresh token (existing
            // Google convention) and refresh_token column holds it too.
            // UPSERT per (client_id, platform, page_id).
            await sql`
              INSERT INTO client_platform_tokens (
                client_id, platform, access_token, refresh_token, page_id,
                account_name, expires_at, token_status
              )
              VALUES (
                'metroreach', 'google_ads', ${tokenData.access_token},
                ${tokenData.refresh_token || null},
                ${tokenData.refresh_token || "primary"}, ${accountName},
                ${expiresAt?.toISOString() ?? null}, 'active'
              )
              ON CONFLICT (client_id, platform, page_id) DO UPDATE
              SET access_token = EXCLUDED.access_token,
                  refresh_token = EXCLUDED.refresh_token,
                  account_name = EXCLUDED.account_name,
                  expires_at = EXCLUDED.expires_at,
                  token_status = 'active'
            `;

            return renderSuccessPage(userInfo, tokenData.scope);
          } catch (err: any) {
            console.error("Google Ads OAuth callback error:", err.message);
            return new Response(
              `<h1>Error</h1><p>${err.message}</p><p><a href="/api/admin/google-ads-auth">Try again</a></p>`,
              {
                status: 500,
                headers: {
                  "Content-Type": "text/html",
                  "Set-Cookie": clearStateCookie,
                },
              },
            );
          }
        }

        // ── Initiate phase: redirect owner to Google consent ──
        const state = crypto.randomBytes(24).toString("hex");
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", GOOGLE_ADS_SCOPES);
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");
        authUrl.searchParams.set("state", state);

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl.toString(),
            "Set-Cookie": `google_ads_oauth_state=${state}; path=/; max-age=600; SameSite=Lax; Secure; HttpOnly`,
          },
        });
      },
    },
  },
});