/**
 * GET /api/portal/buffer-oauth-callback
 *
 * Handles the Buffer OAuth 2.0 redirect after the agency authorizes our app.
 * Validates CSRF state, exchanges the authorization code for an access token,
 * stores it in the buffer_credentials table (singleton row), and redirects
 * back to the portal.
 *
 * Buffer OAuth 2.0:
 *   Authorize: https://login.buffer.com/oauth2/authorize?client_id=...&redirect_uri=...&response_type=code&state=...
 *   Token:     POST https://api.buffer.com/oauth2/token
 *              body: client_id, client_secret, code, redirect_uri, grant_type=authorization_code
 *   Response:  { access_token, token_type, ... }
 *
 * No client login required — this connects the agency's own Buffer account,
 * matching the X/Google admin oauth pattern.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

const BUFFER_CLIENT_ID = process.env.BUFFER_CLIENT_ID || "";
const BUFFER_CLIENT_SECRET = process.env.BUFFER_CLIENT_SECRET || "";
const REDIRECT_URI = "https://metroreachagency.com/api/portal/buffer-oauth-callback";
const TOKEN_URL = "https://api.buffer.com/oauth2/token";
const PORTAL_BASE = "https://metroreachagency.com";

/**
 * Exchange the authorization code for an access token.
 * Buffer expects application/x-www-form-urlencoded with grant_type=authorization_code.
 */
async function exchangeCodeForToken(code: string): Promise<{
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

/** Redirect helper for error outcomes. */
function errorRedirect(message: string): Response {
  const redirectUrl = new URL(`${PORTAL_BASE}/portal/connect`);
  redirectUrl.searchParams.set("oauth_result", "error");
  redirectUrl.searchParams.set("error_msg", message);
  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl.toString() },
  });
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

          // CSRF state validation against the cookie set by buffer-oauth-start.
          const cookies = request.headers.get("cookie") ?? "";
          const stateMatch = cookies.match(/(?:^|;\s*)buffer_oauth_state=([^;]*)/);
          const expectedState = stateMatch ? decodeURIComponent(stateMatch[1]) : "";
          const clearStateCookie =
            "buffer_oauth_state=; path=/; max-age=0; SameSite=Lax; Secure; HttpOnly";

          // User denied or Buffer returned an error
          if (error || !code) {
            return errorRedirect(
              errorDescription || error || "Authorization was cancelled or failed.",
            );
          }

          // State mismatch — possible CSRF
          if (expectedState && returnedState !== expectedState) {
            return errorRedirect("Security check failed. Please try again.");
          }

          // Step 1: Exchange the code for an access token
          const tokenData = await exchangeCodeForToken(code);

          // Step 2: Store the token in buffer_credentials (singleton row).
          // The MCP bridge reads this row when BUFFER_ACCESS_TOKEN is not set.
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

          console.log(
            "[buffer-oauth-callback] Access token stored in buffer_credentials",
          );

          // Step 3: Redirect back to the portal connect page
          const redirectUrl = new URL(`${PORTAL_BASE}/portal/connect`);
          redirectUrl.searchParams.set("oauth_result", "success");
          redirectUrl.searchParams.set("buffer", "connected");
          return new Response(null, {
            status: 302,
            headers: {
              Location: redirectUrl.toString(),
              "Set-Cookie": clearStateCookie,
            },
          });
        } catch (err: any) {
          console.error("Buffer OAuth callback error:", err.message);
          return errorRedirect(err.message);
        }
      },
    },
  },
});
