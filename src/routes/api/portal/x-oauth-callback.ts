/**
 * GET /api/portal/x-oauth-callback
 *
 * Handles the X (Twitter) OAuth 2.0 redirect after a client authorizes our app.
 * Uses PKCE (S256) for security. Exchanges the authorization code for an
 * access token, fetches the user's X account info, and stores tokens in
 * client_platform_tokens.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";

const X_CLIENT_ID = process.env.X_CLIENT_ID || "";
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET || "";
const REDIRECT_URI = "https://metroreachagency.com/api/portal/x-oauth-callback";
const X_API_BASE = "https://api.x.com";

/**
 * Exchange authorization code + PKCE code_verifier for an access token.
 *
 * X OAuth 2.0 token endpoint uses HTTP Basic auth (client_id:client_secret)
 * and expects application/x-www-form-urlencoded body.
 */
async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}> {
  const params = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64");

  const res = await fetch(`${X_API_BASE}/2/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: params.toString(),
  });

  const json = await res.json();

  if (json.error) {
    throw new Error(
      `X token exchange failed: ${json.error_description || json.error}`,
    );
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? "",
    expires_in: json.expires_in ?? 7200,
    scope: json.scope ?? "",
  };
}

/**
 * Fetch the authenticated X user's account info.
 */
async function getUserInfo(accessToken: string): Promise<{
  id: string;
  name: string;
  username: string;
}> {
  const res = await fetch(`${X_API_BASE}/2/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = await res.json();

  if (json.errors || json.status >= 400) {
    const errMsg =
      json.errors?.[0]?.detail ??
      json.detail ??
      json.title ??
      "Unknown error";
    throw new Error(`Failed to fetch X user info: ${errMsg}`);
  }

  const data = json.data ?? json;
  return {
    id: data.id ?? "",
    name: data.name ?? "X Account",
    username: data.username ?? "",
  };
}

/**
 * Construct the OAuth authorization URL with PKCE.
 *
 * This is called from the frontend (connect.tsx) which generates the
 * code_verifier + code_challenge client-side, then redirects.
 */
export function getXAuthUrl(codeChallenge: string, state: string): string {
  const url = new URL("https://x.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", X_CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set(
    "scope",
    "tweet.read tweet.write users.read offline.access",
  );
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export const Route = createFileRoute("/api/portal/x-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        // Retrieve the PKCE code_verifier from the cookie
        const cookies = request.headers.get("cookie") ?? "";
        const codeVerifierMatch = cookies.match(/(?:^|;\s*)x_code_verifier=([^;]*)/);
        const codeVerifier = codeVerifierMatch ? decodeURIComponent(codeVerifierMatch[1]) : "";

        // Get the authenticated client (may be null for admin flow)
        const client = getClientFromRequest(request);

        // Check for admin PKCE cookie as fallback
        const adminVerifierMatch = cookies.match(/(?:^|;\s*)admin_x_verifier=([^;]*)/);
        const adminCodeVerifier = adminVerifierMatch ? decodeURIComponent(adminVerifierMatch[1]) : "";
        const isAdminFlow = !!adminCodeVerifier;

        const effectiveVerifier = codeVerifier || adminCodeVerifier;

        // If user denied or an error occurred
        if (error || !code) {
          if (isAdminFlow) {
            return new Response(`<h1>X Auth Failed</h1><p>${errorDescription || error || "Authorization cancelled."}</p>`, {
              status: 400, headers: { "Content-Type": "text/html" },
            });
          }
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set("error_msg", errorDescription || error || "Authorization was cancelled or failed.");
          return new Response(null, { status: 302, headers: { Location: redirectUrl.toString() } });
        }

        if (!effectiveVerifier) {
          if (isAdminFlow) {
            return new Response("<h1>Session expired</h1><p>Try again</p>", {
              status: 400, headers: { "Content-Type": "text/html" },
            });
          }
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set("error_msg", "PKCE session expired.");
          return new Response(null, { status: 302, headers: { Location: redirectUrl.toString() } });
        }

        if (!client && !isAdminFlow) {
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set("error_msg", "Your portal session expired.");
          return new Response(null, { status: 302, headers: { Location: redirectUrl.toString() } });
        }

        try {
          // Step 1: Exchange code + code_verifier for access token
          const tokenData = await exchangeCodeForToken(code, effectiveVerifier);

          // Step 2: Fetch X user info
          const userInfo = await getUserInfo(tokenData.access_token);

          // Step 3: Store in client_platform_tokens
          const expiresAt = tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null;

          const accountName = userInfo.name
            ? `${userInfo.name} (@${userInfo.username})`
            : `@${userInfo.username}`;

          const effectiveClientId = isAdminFlow ? "metroreach" : (client?.sub || "unknown");

          // Insert if not exists (with refresh_token)
          await sql`
            INSERT INTO client_platform_tokens (client_id, platform, access_token, refresh_token, page_id, account_name, expires_at)
            VALUES (${effectiveClientId}, 'x', ${tokenData.access_token}, ${tokenData.refresh_token}, ${userInfo.id}, ${accountName}, ${
              expiresAt?.toISOString() ?? null
            })
            ON CONFLICT DO NOTHING
          `.catch(() => {});

          // Update if already exists (with refresh_token)
          await sql`
            UPDATE client_platform_tokens
            SET access_token = ${tokenData.access_token},
                refresh_token = ${tokenData.refresh_token},
                account_name = ${accountName},
                expires_at = ${expiresAt?.toISOString() ?? null}
            WHERE client_id = ${effectiveClientId}
              AND platform = 'x'
              AND page_id = ${userInfo.id}
          `;

          // Clear the PKCE cookies
          const clearCookies = [
            "x_code_verifier=; path=/; max-age=0; SameSite=Lax; Secure",
            "admin_x_verifier=; path=/; max-age=0; SameSite=Lax; Secure",
          ];

          if (isAdminFlow) {
            return new Response(
              `<h1>✅ X Connected!</h1><p>${userInfo.name} (@${userInfo.username}) — your X account is now connected to MetroReach Media.</p><p><a href="/">Back to site</a></p>`,
              {
                status: 200,
                headers: {
                  "Content-Type": "text/html",
                  "Set-Cookie": clearCookies.join(", "),
                },
              },
            );
          }

          // Redirect back to connect page with success
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "success");
          return new Response(null, {
            status: 302,
            headers: {
              Location: redirectUrl.toString(),
              "Set-Cookie": clearCookies.join(", "),
            },
          });
        } catch (err: any) {
          if (isAdminFlow) {
            return new Response(`<h1>Error</h1><p>${err.message}</p>`, {
              status: 500, headers: { "Content-Type": "text/html" },
            });
          }
          console.error("X OAuth callback error:", err.message);
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set("error_msg", encodeURIComponent(err.message));
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        }
      },
    },
  },
});
