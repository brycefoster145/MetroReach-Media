/**
 * GET /api/portal/buffer-oauth-start
 *
 * Initiates the Buffer OAuth 2.0 flow with PKCE for the agency's Buffer account.
 * Redirects the user to Buffer's consent screen.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";

const BUFFER_CLIENT_ID = process.env.BUFFER_CLIENT_ID || "";
const REDIRECT_URI = "https://www.metroreachagency.com/api/portal/buffer-oauth-callback";
const AUTHORIZE_URL = "https://auth.buffer.com/auth";
const SCOPE = "posts:write posts:read ideas:read ideas:write account:read account:write offline_access";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export const Route = createFileRoute("/api/portal/buffer-oauth-start")({
  server: {
    handlers: {
      GET: async () => {
        if (!BUFFER_CLIENT_ID) {
          const redirectUrl = new URL("https://www.metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set("error_msg", "Buffer OAuth not configured (BUFFER_CLIENT_ID missing).");
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        }

        // PKCE: generate code_verifier and code_challenge
        const codeVerifier = base64url(crypto.randomBytes(32));
        const challengeHash = crypto.createHash("sha256").update(codeVerifier).digest();
        const codeChallenge = base64url(challengeHash);
        const state = crypto.randomBytes(24).toString("hex");

        const authUrl = new URL(AUTHORIZE_URL);
        authUrl.searchParams.set("client_id", BUFFER_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", SCOPE);
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("code_challenge", codeChallenge);
        authUrl.searchParams.set("code_challenge_method", "S256");
        authUrl.searchParams.set("prompt", "consent");

        const cookie = `buffer_oauth_state=${state}; Path=/; Max-Age=600; SameSite=Lax; Secure; HttpOnly`;
        const verifierCookie = `buffer_code_verifier=${codeVerifier}; Path=/; Max-Age=600; SameSite=Lax; Secure; HttpOnly`;

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl.toString(),
            "Set-Cookie": `${cookie}, ${verifierCookie}`,
          },
        });
      },
    },
  },
});
