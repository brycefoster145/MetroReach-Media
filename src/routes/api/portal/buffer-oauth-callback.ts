/**
 * GET /api/portal/buffer-oauth-callback
 *
 * Handles Buffer OAuth 2.0 callback. The PKCE code_verifier is extracted
 * from the state parameter (no cookies needed). Exchanges the code for
 * an access token and stores it in buffer_credentials.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";
import { migrate } from "~/lib/migrate";

const BUFFER_CLIENT_ID = process.env.BUFFER_CLIENT_ID || "";
const BUFFER_CLIENT_SECRET = process.env.BUFFER_CLIENT_SECRET || "";
const REDIRECT_URI = "https://www.metroreachagency.com/api/portal/buffer-oauth-callback";
const TOKEN_URL = "https://auth.buffer.com/token";

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

function errorPage(message: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Connection Failed — MetroReach Media</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #e4e4e4; }
  .card { background: #161616; border: 1px solid #2a2a2a; border-radius: 16px; padding: 40px 48px; text-align: center; max-width: 420px; }
  h1 { font-size: 1.25rem; margin: 0 0 8px; color: #ef4444; }
  p { color: #a0a0a0; font-size: 0.95rem; }
  a { color: #4da6ff; }
</style></head>
<body><div class="card"><h1>Connection Failed</h1><p>${message}</p><p><a href="/api/portal/buffer-oauth-start">Try Again</a></p></div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function successPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Buffer Connected — MetroReach Media</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #e4e4e4; }
  .card { background: #161616; border: 1px solid #2a2a2a; border-radius: 16px; padding: 40px 48px; text-align: center; max-width: 420px; }
  h1 { font-size: 1.5rem; margin: 0 0 8px; }
  .check { font-size: 3rem; margin-bottom: 12px; }
  p { color: #a0a0a0; font-size: 0.95rem; line-height: 1.5; }
  a { color: #4da6ff; }
</style></head>
<body>
<div class="card">
  <div class="check">&#x2705;</div>
  <h1>Buffer Connected</h1>
  <p>MetroReach Media is now connected to Buffer. Posts can be scheduled and published through the agency's Buffer account.</p>
  <p><a href="/portal/dashboard">Go to Dashboard</a></p>
</div>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * State format from buffer-oauth-start: <csrf_hex>.<base64url_verifier>
 * Returns [csrf, verifier] or null if the format is wrong.
 */
function parseState(state: string | null): [string, string] | null {
  if (!state) return null;
  const dot = state.indexOf(".");
  if (dot < 1 || dot === state.length - 1) return null;
  return [state.slice(0, dot), state.slice(dot + 1)];
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

          if (error || !code) {
            return errorPage(errorDescription || error || "Authorization was cancelled or failed.");
          }

          const parsed = parseState(returnedState);
          if (!parsed) {
            return errorPage("Invalid state parameter — possible CSRF. Please try again.");
          }

          const [, codeVerifier] = parsed;
          if (!codeVerifier) {
            return errorPage("Missing PKCE verifier in state. Please start again.");
          }

          // Ensure the buffer_credentials table exists (idempotent)
          await migrate();

          // Exchange the code for an access token
          const tokenData = await exchangeCodeForToken(code, codeVerifier);

          // Store the token in buffer_credentials (singleton row)
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
          return successPage();
        } catch (err: any) {
          console.error("Buffer OAuth callback error:", err.message);
          return errorPage(err.message);
        }
      },
    },
  },
});
