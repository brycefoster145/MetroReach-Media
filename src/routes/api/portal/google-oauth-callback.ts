/**
 * GET /api/portal/google-oauth-callback
 *
 * Handles the Google OAuth 2.0 redirect after a client authorizes our app.
 * Exchanges the authorization code for an access + refresh token,
 * fetches the user's Google My Business accounts and YouTube channels,
 * and stores tokens in client_platform_tokens.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = "https://metroreachagency.com/api/portal/google-oauth-callback";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMB_API_BASE = "https://mybusinessaccountmanagement.googleapis.com";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/youtube.upload",
].join(" ");

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
 * Fetch Google My Business accounts the authenticated user has access to.
 */
async function getGMBAccounts(accessToken: string): Promise<
  Array<{ account_id: string; account_name: string }>
> {
  const res = await fetch(`${GMB_API_BASE}/v1/accounts`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const json = await res.json();
  if (json.error) {
    throw new Error(
      `Failed to fetch GMB accounts: ${json.error.message || json.error}`
    );
  }

  const accounts: any[] = json.accounts ?? [];
  return accounts.map((acc: any) => ({
    account_id: acc.name ?? "", // "accounts/123456"
    account_name: acc.accountName ?? "Google My Business Account",
  }));
}

/**
 * Fetch YouTube channels owned by the authenticated user.
 */
async function getYouTubeChannels(accessToken: string): Promise<
  Array<{ channel_id: string; channel_name: string }>
> {
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
  if (json.error) {
    throw new Error(
      `Failed to fetch YouTube channels: ${json.error.message || json.error}`
    );
  }

  const items: any[] = json.items ?? [];
  return items.map((item: any) => ({
    channel_id: item.id ?? "",
    channel_name: item.snippet?.title ?? "YouTube Channel",
  }));
}

/**
 * Construct the Google OAuth authorization URL.
 */
export function getGoogleAuthUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
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

        const client = getClientFromRequest(request);

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
          // Step 1: Exchange code for tokens
          const tokenData = await exchangeCodeForToken(code);

          if (!tokenData.refresh_token) {
            throw new Error(
              "No refresh token received. Please disconnect and reconnect via Google settings, then try again."
            );
          }

          // Step 2: Fetch GMB accounts
          const gmbAccounts = await getGMBAccounts(tokenData.access_token);

          // Step 3: Fetch YouTube channels
          const youtubeChannels = await getYouTubeChannels(tokenData.access_token);

          // Must have at least one GMB account or YouTube channel
          if (gmbAccounts.length === 0 && youtubeChannels.length === 0) {
            const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
            redirectUrl.searchParams.set("oauth_result", "error");
            redirectUrl.searchParams.set(
              "error_msg",
              "No Google My Business accounts or YouTube channels found on this Google account. You need to have at least one to connect."
            );
            return new Response(null, {
              status: 302,
              headers: { Location: redirectUrl.toString() },
            });
          }

          const expiresAt = tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null;

          // Step 4: Store primary Google token (used for lookup)
          await sql`
            INSERT INTO client_platform_tokens (client_id, platform, access_token, page_id, account_name, expires_at)
            VALUES (${client.sub}, 'google', ${tokenData.access_token}, ${tokenData.refresh_token}, 'Google Account', ${
              expiresAt?.toISOString() ?? null
            })
            ON CONFLICT DO NOTHING
          `.catch(() => {});

          await sql`
            UPDATE client_platform_tokens
            SET access_token = ${tokenData.access_token},
                page_id = ${tokenData.refresh_token},
                account_name = 'Google Account',
                expires_at = ${expiresAt?.toISOString() ?? null}
            WHERE client_id = ${client.sub}
              AND platform = 'google'
              AND page_id = ${tokenData.refresh_token}
          `;

          // Step 5: Store each GMB account
          for (const acc of gmbAccounts) {
            await sql`
              INSERT INTO client_platform_tokens (client_id, platform, access_token, page_id, account_name, expires_at)
              VALUES (${client.sub}, 'google_gmb', ${tokenData.access_token}, ${acc.account_id}, ${acc.account_name}, ${
                expiresAt?.toISOString() ?? null
              })
              ON CONFLICT DO NOTHING
            `.catch(() => {});

            await sql`
              UPDATE client_platform_tokens
              SET access_token = ${tokenData.access_token},
                  account_name = ${acc.account_name},
                  expires_at = ${expiresAt?.toISOString() ?? null}
              WHERE client_id = ${client.sub}
                AND platform = 'google_gmb'
                AND page_id = ${acc.account_id}
            `;
          }

          // Step 6: Store each YouTube channel
          for (const ch of youtubeChannels) {
            await sql`
              INSERT INTO client_platform_tokens (client_id, platform, access_token, page_id, account_name, expires_at)
              VALUES (${client.sub}, 'google_youtube', ${tokenData.access_token}, ${ch.channel_id}, ${ch.channel_name}, ${
                expiresAt?.toISOString() ?? null
              })
              ON CONFLICT DO NOTHING
            `.catch(() => {});

            await sql`
              UPDATE client_platform_tokens
              SET access_token = ${tokenData.access_token},
                  account_name = ${ch.channel_name},
                  expires_at = ${expiresAt?.toISOString() ?? null}
              WHERE client_id = ${client.sub}
                AND platform = 'google_youtube'
                AND page_id = ${ch.channel_id}
            `;
          }

          // Redirect back with success
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "success");
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        } catch (err: any) {
          console.error("Google OAuth callback error:", err.message);
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
