/**
 * GET /api/portal/tiktok-oauth-callback
 *
 * Handles the TikTok OAuth redirect after a client authorizes our app.
 * Exchanges the authorization code for an access token, fetches the
 * user's TikTok account info, and stores tokens in client_platform_tokens.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";

const TIKTOK_CLIENT_ID = process.env.TIKTOK_CLIENT_ID || "";
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || "";
const REDIRECT_URI = "https://metroreachagency.com/api/portal/tiktok-oauth-callback";
const TIKTOK_API_BASE = "https://open.tiktokapis.com";

/**
 * Exchange authorization code for an access token.
 */
async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  open_id: string;
  scope: string;
}> {
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_ID,
    client_secret: TIKTOK_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
  });

  const res = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const json = await res.json();

  if (json.error || json.data?.error_code) {
    const errMsg =
      json.error_description ||
      json.error ||
      json.data?.description ||
      "Unknown error";
    throw new Error(`TikTok token exchange failed: ${errMsg}`);
  }

  const data = json.data ?? json;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in ?? 86400,
    open_id: data.open_id,
    scope: data.scope ?? "",
  };
}

/**
 * Fetch TikTok user info using the access token.
 */
async function getUserInfo(accessToken: string): Promise<{
  open_id: string;
  union_id: string;
  avatar_url: string;
  display_name: string;
}> {
  const url = new URL(`${TIKTOK_API_BASE}/v2/user/info/`);
  url.searchParams.set("fields", "open_id,union_id,avatar_url,display_name");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = await res.json();

  if (json.error || json.data?.error_code) {
    const errMsg =
      json.error_description ||
      json.error ||
      json.data?.description ||
      "Unknown error";
    throw new Error(`Failed to fetch TikTok user info: ${errMsg}`);
  }

  const data = json.data ?? json;
  const user = data.user ?? data;

  return {
    open_id: user.open_id ?? "",
    union_id: user.union_id ?? "",
    avatar_url: user.avatar_url ?? "",
    display_name: user.display_name ?? "TikTok Account",
  };
}

/**
 * Construct the OAuth authorization URL.
 */
export function getTikTokAuthUrl(state: string): string {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", TIKTOK_CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "user.info.basic,video.publish,video.upload");
  url.searchParams.set("state", state);
  return url.toString();
}

export const Route = createFileRoute("/api/portal/tiktok-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        // Get the authenticated client
        const client = getClientFromRequest(request);

        // If user denied or an error occurred, redirect back with error
        if (error || !code) {
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set(
            "error_msg",
            errorDescription || error || "Authorization was cancelled or failed."
          );
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        }

        if (!client) {
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set(
            "error_msg",
            "Your portal session expired. Please log in first, then reconnect."
          );
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        }

        try {
          // Step 1: Exchange code for access token
          const tokenData = await exchangeCodeForToken(code);

          // Step 2: Get user info
          const userInfo = await getUserInfo(tokenData.access_token);

          // Step 3: Store in client_platform_tokens
          const expiresAt = tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null;

          // Insert if not exists
          await sql`
            INSERT INTO client_platform_tokens (client_id, platform, access_token, page_id, account_name, expires_at)
            VALUES (${client.sub}, 'tiktok', ${tokenData.access_token}, ${userInfo.open_id}, ${userInfo.display_name}, ${
              expiresAt?.toISOString() ?? null
            })
            ON CONFLICT DO NOTHING
          `.catch(() => {});

          // Update if already exists
          await sql`
            UPDATE client_platform_tokens
            SET access_token = ${tokenData.access_token},
                account_name = ${userInfo.display_name},
                expires_at = ${expiresAt?.toISOString() ?? null}
            WHERE client_id = ${client.sub}
              AND platform = 'tiktok'
              AND page_id = ${userInfo.open_id}
          `;

          // Redirect back to connect page with success
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "success");
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        } catch (err: any) {
          console.error("TikTok OAuth callback error:", err.message);
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
