/**
 * GET /api/portal/buffer-oauth-start
 *
 * Initiates the Buffer OAuth 2.0 flow for the agency's Buffer account.
 * Generates a random state for CSRF protection, stores it in an HttpOnly
 * cookie, and redirects the user to Buffer's consent screen.
 *
 * No client login required — this connects the agency's own Buffer account
 * (the publishing layer for all clients), matching the X/Google admin oauth
 * pattern.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";

const BUFFER_CLIENT_ID = process.env.BUFFER_CLIENT_ID || "";
const REDIRECT_URI = "https://www.metroreachagency.com/api/portal/buffer-oauth-callback";
const AUTHORIZE_URL = "https://login.buffer.com/oauth2/authorize";

export const Route = createFileRoute("/api/portal/buffer-oauth-start")({
  server: {
    handlers: {
      GET: async () => {
        if (!BUFFER_CLIENT_ID) {
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set(
            "error_msg",
            "Buffer OAuth is not configured yet (BUFFER_CLIENT_ID missing).",
          );
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        }

        const state = crypto.randomBytes(24).toString("hex");

        const authUrl = new URL(AUTHORIZE_URL);
        authUrl.searchParams.set("client_id", BUFFER_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("state", state);

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl.toString(),
            "Set-Cookie": `buffer_oauth_state=${state}; path=/; max-age=600; SameSite=Lax; Secure; HttpOnly`,
          },
        });
      },
    },
  },
});
