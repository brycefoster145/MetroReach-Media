/**
 * GET /api/portal/google-oauth-callback
 *
 * Handles the Google OAuth 2.0 redirect after a user authorizes our app.
 * Validates CSRF state, exchanges the authorization code for tokens,
 * fetches user profile info, optionally discovers GMB accounts + YouTube
 * channels (when those scopes are granted), and stores tokens in
 * client_platform_tokens.
 *
 * Supports both admin flow (client_id = 'metroreach', no login required)
 * and client portal flow (JWT-authenticated client). Matches the X admin
 * oauth pattern.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = "https://metroreachagency.com/api/portal/google-oauth-callback";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMB_API_BASE = "https://mybusinessaccountmanagement.googleapis.com";
const USERINFO_API_BASE = "https://www.googleapis.com/oauth2/v2";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Exchange authorization code for access + refresh tokens.
 */
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
      `Google token exchange failed: ${json.error_description || json.error}`
    );
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? "",
    expires_in: json.expires_in ?? 3600,
    scope: json.scope ?? "",
  };
}

/**
 * Fetch basic Google user profile info.
 */
async function getUserInfo(accessToken: string): Promise<{
  id: string;
  name: string;
  email: string;
}> {
  const res = await fetch(`${USERINFO_API_BASE}/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const json = await res.json();
  if (json.error) {
    throw new Error(
      `Failed to fetch Google user info: ${json.error.message || json.error}`
    );
  }

  return {
    id: json.id ?? "",
    name: json.name ?? "Google Account",
    email: json.email ?? "",
  };
}

/**
 * Fetch Google My Business accounts the authenticated user has access to.
 * Returns empty array if the GMB scope wasn't granted (graceful skip).
 */
async function getGMBAccounts(accessToken: string): Promise<
  Array<{ account_id: string; account_name: string }>
> {
  try {
    const res = await fetch(`${GMB_API_BASE}/v1/accounts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const json = await res.json();
    if (json.error) return []; // Scope not granted — skip gracefully

    const accounts: any[] = json.accounts ?? [];
    return accounts.map((acc: any) => ({
      account_id: acc.name ?? "",
      account_name: acc.accountName ?? "Google My Business Account",
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch YouTube channels owned by the authenticated user.
 * Returns empty array if the YouTube scope wasn't granted (graceful skip).
 */
async function getYouTubeChannels(accessToken: string): Promise<
  Array<{ channel_id: string; channel_name: string }>
> {
  try {
    const url = new URL(`${YOUTUBE_API_BASE}/channels`);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("mine", "true");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const json = await res.json();
    if (json.error) return []; // Scope not granted — skip gracefully

    const items: any[] = json.items ?? [];
    return items.map((item: any) => ({
      channel_id: item.id ?? "",
      channel_name: item.snippet?.title ?? "YouTube Channel",
    }));
  } catch {
    return [];
  }
}

/**
 * Construct the Google OAuth authorization URL.
 * Exported for use by the frontend connect page.
 */
export function getGoogleAuthUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/business.manage",
      "https://www.googleapis.com/auth/youtube.upload",
    ].join(" ")
  );
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export const Route = createFileRoute("/api/portal/google-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");
        const returnedState = url.searchParams.get("state");

        // --- CSRF state validation ---
        const cookies = request.headers.get("cookie") ?? "";
        const stateMatch = cookies.match(/(?:^|;\s*)google_oauth_state=([^;]*)/);
        const expectedState = stateMatch ? decodeURIComponent(stateMatch[1]) : "";

        // Determine flow: admin (no client auth) vs client portal
        const client = getClientFromRequest(request);
        const isAdminFlow = !client;

        // Clear the state cookie regardless of outcome
        const clearStateCookie = "google_oauth_state=; path=/; max-age=0; SameSite=Lax; Secure; HttpOnly";

        if (error || !code) {
          if (isAdminFlow) {
            return new Response(
              `<h1>Google Auth Failed</h1><p>${errorDescription || error || "Authorization was cancelled or failed."}</p>`,
              {
                status: 400,
                headers: {
                  "Content-Type": "text/html",
                  "Set-Cookie": clearStateCookie,
                },
              }
            );
          }
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set(
            "error_msg",
            errorDescription || error || "Authorization was cancelled or failed."
          );
          return new Response(null, {
            status: 302,
            headers: {
              Location: redirectUrl.toString(),
              "Set-Cookie": clearStateCookie,
            },
          });
        }

        // Validate state to prevent CSRF
        if (expectedState && returnedState !== expectedState) {
          if (isAdminFlow) {
            return new Response(
              "<h1>Security Check Failed</h1><p>State mismatch — possible CSRF attack. Please try again.</p>",
              {
                status: 400,
                headers: {
                  "Content-Type": "text/html",
                  "Set-Cookie": clearStateCookie,
                },
              }
            );
          }
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set("error_msg", "Security check failed. Please try again.");
          return new Response(null, {
            status: 302,
            headers: {
              Location: redirectUrl.toString(),
              "Set-Cookie": clearStateCookie,
            },
          });
        }

        try {
          // Step 1: Exchange code for tokens
          const tokenData = await exchangeCodeForToken(code);

          // Step 2: Fetch Google user profile
          const userInfo = await getUserInfo(tokenData.access_token);

          // Step 3: Optionally fetch GMB accounts + YouTube channels
          const gmbAccounts = await getGMBAccounts(tokenData.access_token);
          const youtubeChannels = await getYouTubeChannels(tokenData.access_token);

          const expiresAt = tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null;

          const effectiveClientId = isAdminFlow ? "metroreach" : (client?.sub || "unknown");
          const accountName = userInfo.email
            ? `${userInfo.name} (${userInfo.email})`
            : userInfo.name || "Google Account";

          // Step 4: Store primary Google token (refresh_token stored in page_id per existing convention)
          await sql`
            INSERT INTO client_platform_tokens (client_id, platform, access_token, page_id, account_name, expires_at)
            VALUES (${effectiveClientId}, 'google', ${tokenData.access_token}, ${
              tokenData.refresh_token || "primary"
            }, ${accountName}, ${expiresAt?.toISOString() ?? null})
            ON CONFLICT DO NOTHING
          `.catch(() => {});

          await sql`
            UPDATE client_platform_tokens
            SET access_token = ${tokenData.access_token},
                page_id = ${tokenData.refresh_token || "primary"},
                account_name = ${accountName},
                expires_at = ${expiresAt?.toISOString() ?? null}
            WHERE client_id = ${effectiveClientId}
              AND platform = 'google'
          `;

          // Step 5: Store each GMB account (only if GMB scope was granted)
          for (const acc of gmbAccounts) {
            await sql`
              INSERT INTO client_platform_tokens (client_id, platform, access_token, page_id, account_name, expires_at)
              VALUES (${effectiveClientId}, 'google_gmb', ${tokenData.access_token}, ${acc.account_id}, ${acc.account_name}, ${
                expiresAt?.toISOString() ?? null
              })
              ON CONFLICT DO NOTHING
            `.catch(() => {});

            await sql`
              UPDATE client_platform_tokens
              SET access_token = ${tokenData.access_token},
                  account_name = ${acc.account_name},
                  expires_at = ${expiresAt?.toISOString() ?? null}
              WHERE client_id = ${effectiveClientId}
                AND platform = 'google_gmb'
                AND page_id = ${acc.account_id}
            `;
          }

          // Step 6: Store each YouTube channel (only if YouTube scope was granted)
          for (const ch of youtubeChannels) {
            await sql`
              INSERT INTO client_platform_tokens (client_id, platform, access_token, page_id, account_name, expires_at)
              VALUES (${effectiveClientId}, 'google_youtube', ${tokenData.access_token}, ${ch.channel_id}, ${ch.channel_name}, ${
                expiresAt?.toISOString() ?? null
              })
              ON CONFLICT DO NOTHING
            `.catch(() => {});

            await sql`
              UPDATE client_platform_tokens
              SET access_token = ${tokenData.access_token},
                  account_name = ${ch.channel_name},
                  expires_at = ${expiresAt?.toISOString() ?? null}
              WHERE client_id = ${effectiveClientId}
                AND platform = 'google_youtube'
                AND page_id = ${ch.channel_id}
            `;
          }

          // Admin flow → render success HTML page
          if (isAdminFlow) {
            const connectedAccounts = [];
            if (gmbAccounts.length > 0) connectedAccounts.push(`${gmbAccounts.length} GMB listing(s)`);
            if (youtubeChannels.length > 0) connectedAccounts.push(`${youtubeChannels.length} YouTube channel(s)`);
            const extra = connectedAccounts.length > 0 ? `<p>Also connected: ${connectedAccounts.join(", ")}.</p>` : "";

            return new Response(
              `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Google Connected — MetroReach Media</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #e0e0e0; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 32px; max-width: 480px; text-align: center; }
    h1 { color: #34A853; margin-top: 0; }
    p { color: #aaa; line-height: 1.5; }
    a { color: #4285F4; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ Google Connected!</h1>
    <p>${userInfo.name} (${userInfo.email}) — your Google account is now connected to MetroReach Media.</p>
    ${extra}
    <p><a href="/">Back to site</a></p>
  </div>
</body>
</html>`,
              {
                status: 200,
                headers: {
                  "Content-Type": "text/html",
                  "Set-Cookie": clearStateCookie,
                },
              }
            );
          }

          // Client portal flow → redirect back with success
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "success");
          return new Response(null, {
            status: 302,
            headers: {
              Location: redirectUrl.toString(),
              "Set-Cookie": clearStateCookie,
            },
          });
        } catch (err: any) {
          console.error("Google OAuth callback error:", err.message);

          if (isAdminFlow) {
            return new Response(
              `<h1>Error</h1><p>${err.message}</p>`,
              {
                status: 500,
                headers: {
                  "Content-Type": "text/html",
                  "Set-Cookie": clearStateCookie,
                },
              }
            );
          }

          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set("error_msg", encodeURIComponent(err.message));
          return new Response(null, {
            status: 302,
            headers: {
              Location: redirectUrl.toString(),
              "Set-Cookie": clearStateCookie,
            },
          });
        }
      },
    },
  },
});
