/**
 * GET /api/portal/meta-oauth-callback
 *
 * Handles the Meta OAuth redirect after a client authorizes our app.
 * Exchanges the authorization code for a long-lived page access token,
 * then stores it in client_platform_tokens.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */

import { createFileRoute } from "@tanstack/react-router";
import { getClientFromRequest } from "~/lib/client-auth";
import { sql } from "~/lib/db";

const META_APP_ID = "1210460348820936";
const REDIRECT_URI = "https://metroreachagency.com/api/portal/meta-oauth-callback";
const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

function getAppSecret(): string {
  return process.env.META_APP_SECRET || process.env.META_ACCESS_TOKEN || "";
}

/**
 * Exchange authorization code for a short-lived user access token.
 */
async function exchangeCodeForToken(code: string): Promise<{ access_token: string }> {
  const url = `${GRAPH_API_BASE}/oauth/access_token`;
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: getAppSecret(),
    redirect_uri: REDIRECT_URI,
    code,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = await res.json();
  if (json.error) {
    throw new Error(`Token exchange failed: ${json.error.message} (${json.error.type})`);
  }
  return json as { access_token: string };
}

/**
 * Exchange short-lived token for a long-lived (60 day) token.
 */
async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const url = `${GRAPH_API_BASE}/oauth/access_token`;
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: META_APP_ID,
    client_secret: getAppSecret(),
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = await res.json();
  if (json.error) {
    throw new Error(`Long-lived token exchange failed: ${json.error.message}`);
  }
  return json as { access_token: string; expires_in: number };
}

/**
 * Fetch pages and Instagram accounts accessible to the user token.
 */
async function getUserPages(userToken: string): Promise<
  Array<{
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: { id: string; name?: string };
  }>
> {
  const url = new URL(`${GRAPH_API_BASE}/me/accounts`);
  url.searchParams.set("access_token", userToken);
  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id,name}",
  );

  const res = await fetch(url.toString());
  const json = await res.json();

  if (json.error) {
    throw new Error(`Failed to fetch pages: ${json.error.message}`);
  }
  return (json.data ?? []) as Array<{
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: { id: string; name?: string };
  }>;
}

export const Route = createFileRoute("/api/portal/meta-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");
        const state = url.searchParams.get("state");

        // Get the authenticated client
        const client = getClientFromRequest(request);

        // If user denied or an error occurred, redirect back with error
        if (error || !code) {
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set(
            "error_msg",
            errorDescription || error || "Authorization was cancelled or failed.",
          );
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        }

        // If we don't have a client session, this is a state problem.
        // For now, allow the flow to continue — the client_id can come from
        // the state param or we store it temporarily. Redirect with success
        // but note that connection requires portal login.
        if (!client) {
          // Try to still process: store without client association
          // for manual linking later — but redirect to login
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "error");
          redirectUrl.searchParams.set(
            "error_msg",
            "Your portal session expired. Please log in first, then reconnect.",
          );
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        }

        try {
          // Step 1: Exchange code for short-lived token
          const tokenData = await exchangeCodeForToken(code);

          // Step 2: Exchange for long-lived token
          const longLived = await exchangeForLongLivedToken(tokenData.access_token);

          // Step 3: Get user's pages
          const pages = await getUserPages(longLived.access_token);

          if (pages.length === 0) {
            const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
            redirectUrl.searchParams.set("oauth_result", "error");
            redirectUrl.searchParams.set(
              "error_msg",
              "No Facebook Pages found on your account. Please create a Page first.",
            );
            return new Response(null, {
              status: 302,
              headers: { Location: redirectUrl.toString() },
            });
          }

          // Step 4: Store each page token in client_platform_tokens
          const expiresAt = new Date(Date.now() + longLived.expires_in * 1000);

          for (const page of pages) {
            // Store the Facebook page token
            await sql`
              INSERT INTO client_platform_tokens (client_id, platform, access_token, page_id, account_name, expires_at, token_status)
              VALUES (${client.sub}, 'meta', ${page.access_token}, ${page.id}, ${page.name}, ${expiresAt.toISOString()}, 'active')
              ON CONFLICT DO NOTHING
            `.catch(() => {});

            // Try to update if already exists
            await sql`
              UPDATE client_platform_tokens
              SET access_token = ${page.access_token},
                  account_name = ${page.name},
                  expires_at = ${expiresAt.toISOString()},
                  token_status = 'active'
              WHERE client_id = ${client.sub}
                AND platform = 'meta'
                AND page_id = ${page.id}
            `;

            // If page has an Instagram Business Account, store that too
            if (page.instagram_business_account?.id) {
              const igId = page.instagram_business_account.id;
              const igName = page.instagram_business_account.name || `${page.name} (Instagram)`;

              await sql`
                INSERT INTO client_platform_tokens (client_id, platform, access_token, page_id, account_name, expires_at, token_status)
                VALUES (${client.sub}, 'meta', ${page.access_token}, ${igId}, ${igName}, ${expiresAt.toISOString()}, 'active')
                ON CONFLICT DO NOTHING
              `.catch(() => {});

              await sql`
                UPDATE client_platform_tokens
                SET access_token = ${page.access_token},
                    account_name = ${igName},
                    expires_at = ${expiresAt.toISOString()},
                    token_status = 'active'
                WHERE client_id = ${client.sub}
                  AND platform = 'meta'
                  AND page_id = ${igId}
              `;
            }
          }

          // Redirect back to connect page with success
          const redirectUrl = new URL("https://metroreachagency.com/portal/connect");
          redirectUrl.searchParams.set("oauth_result", "success");
          return new Response(null, {
            status: 302,
            headers: { Location: redirectUrl.toString() },
          });
        } catch (err: any) {
          console.error("Meta OAuth callback error:", err.message);
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
