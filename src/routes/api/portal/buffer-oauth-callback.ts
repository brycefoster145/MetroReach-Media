/**
 * GET /api/portal/buffer-oauth-callback
 *
 * Handles the Buffer OAuth 2.0 redirect after the agency authorizes our app.
 * Validates CSRF state, exchanges the authorization code + PKCE verifier for
 * an access token, stores it in the buffer_credentials table, and redirects
 * back to the portal.
 *
 * Buffer OAuth 2.0 with PKCE (per developers.buffer.com):
 *   Authorize: https://auth.buffer.com/auth?client_id=...&redirect_uri=...&response_type=code&code_challenge=...&state=...
 *   Token:     POST https://auth.buffer.com/token
 *              body: client_id, client_secret, code, redirect_uri, grant_type, code_verifier
 *   Response:  { access_token, refresh_token, token_type, expires_in, scope }
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

const BUFFER_CLIENT_ID = process.env.BUFFER_CLIENT_ID || "";
const BUFFER_CLIENT_SECRET = process.env.BUFFER_CLIENT_SECRET || "";
const REDIRECT_URI = "https://metroreachagency.com/api/portal/buffer-oauth-callback";
const TOKEN_URL = "https://auth.buffer.com/token";
const PORTAL_BASE = "https://metroreachagency.com";

/**
 * Exchange the authorization code + PKCE verifier for an access token.
 */
async function exchangeCodeForToken(code: string, codeVerifier: string): Promise<{
  access_token: string;
  token_type?: string;
  refresh_token?: string;
  scope?: string;
  expires_in?: number;
}> {
  const params = new URLSearchParams({
    client_id: BUFFER_CLIENT_ID,
    client_secret: BUFFER_CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || json.error) {
    throw new Error(
      `Buffer token exchange failed: ${json.error_description || json.error || `HTTP ${res.status}`}`,
    );
  }
  if (!json.access_token) {
    throw new Error("Buffer token exchange returned no access_token");
  }

  return json;
}

function errorRedirect(message: string): Response {
  const url = new URL(`${PORTAL_BASE}/portal/connect`);
  url.searchParams.set("oauth_result", "error");
  url.searchParams.set("error_msg", message);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

export const Route = createFileRoute("/api/portal/buffer-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const code = url.searchParams.get("code");
          const error = url.searchParams.get("error");
          const errorDescription = url.searchParams.get("error_description");
          const returnedState = url.searchParams.get("state");

          const cookies = request.headers.get("cookie") ?? "";

          function getCookie(name: string): string {
            const m = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
            return m ? decodeURIComponent(m[1]) : "";
          }

          const expectedState = getCookie("buffer_oauth_state");
          const codeVerifier = getCookie("buffer_code_verifier");

          const clearCookies = [
            "buffer_oauth_state=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly",
            "buffer_code_verifier=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly",
          ].join(", ");

          if (error || !code) {
            return errorRedirect(errorDescription || error || "Authorization was cancelled or failed.");
          }

          if (expectedState && returnedState !== expectedState) {
            return errorRedirect("Security check failed. Please try again.");
          }

          if (!codeVerifier) {
            return errorRedirect("Session expired — missing PKCE verifier. Please start again.");
          }

          // Step 1: Exchange the code for an access token
          const tokenData = await exchangeCodeForToken(code, codeVerifier);

          // Step 2: Store the token in buffer_credentials (singleton row)
          const expiresAt = tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : null;

          await sql`
            INSERT INTO buffer_credentials (id, access_token, token_type, refresh_token, scope, expires_at)
            VALUES ('default', ${tokenData.access_token}, ${tokenData.token_type ?? "Bearer"}, ${tokenData.refresh_token ?? null}, ${tokenData.scope ?? null}, ${expiresAt})
            ON CONFLICT (id) DO UPDATE SET
              access_token = EXCLUDED.access_token,
              token_type = EXCLUDED.token_type,
              refresh_token = EXCLUDED.refresh_token,
              scope = EXCLUDED.scope,
              expires_at = EXCLUDED.expires_at,
              updated_at = NOW()
          `;

          console.log("[buffer-oauth-callback] Access token stored in buffer_credentials");

          // Step 3: Redirect back to the portal
          const redirectUrl = new URL(`${PORTAL_BASE}/portal/connect`);
          redirectUrl.searchParams.set("oauth_result", "success");
          redirectUrl.searchParams.set("buffer", "connected");

          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString(), "Set-Cookie": clearCookies },
          });
        } catch (err: any) {
          console.error("Buffer OAuth callback error:", err.message);
          return errorRedirect(err.message);
        }
      },
    },
  },
});
