/**
 * GET /api/portal/google-oauth
 *
 * Initiates Google OAuth 2.0 flow. Generates a random state for CSRF
 * protection, stores it in a cookie, and redirects the user to Google's
 * consent screen.
 *
 * Works for both client portal auth and admin setup — no client login
 * required (matches X admin oauth pattern).
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const REDIRECT_URI = "https://metroreachagency.com/api/portal/google-oauth-callback";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/adwords",
].join(" ");

export const Route = createFileRoute("/api/portal/google-oauth")({
  server: {
    handlers: {
      GET: async () => {
        const state = crypto.randomBytes(24).toString("hex");

        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", GOOGLE_SCOPES);
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");
        authUrl.searchParams.set("state", state);

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl.toString(),
            "Set-Cookie": `google_oauth_state=${state}; path=/; max-age=600; SameSite=Lax; Secure; HttpOnly`,
          },
        });
      },
    },
  },
});
