import { createFileRoute } from "@tanstack/react-router";
import { requireApiKey } from "~/lib/env";
import crypto from "node:crypto";

const X_CLIENT_ID = process.env.X_CLIENT_ID || "";
const REDIRECT_URI = "https://metroreachagency.com/api/portal/x-oauth-callback";

export const Route = createFileRoute("/api/admin/x-auth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const unauthorized = requireApiKey(request);
        if (unauthorized) return unauthorized;
        const codeVerifier = crypto.randomBytes(32).toString("base64url");
        const codeChallenge = crypto
          .createHash("sha256")
          .update(codeVerifier)
          .digest("base64url");

        const authUrl = new URL("https://x.com/i/oauth2/authorize");
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", X_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
        authUrl.searchParams.set("scope", "tweet.read tweet.write users.read offline.access");
        authUrl.searchParams.set("state", crypto.randomBytes(8).toString("hex"));
        authUrl.searchParams.set("code_challenge", codeChallenge);
        authUrl.searchParams.set("code_challenge_method", "S256");

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl.toString(),
            "Set-Cookie": `admin_x_verifier=${codeVerifier}; path=/; max-age=300; SameSite=Lax; Secure; HttpOnly`,
          },
        });
      },
    },
  },
});
