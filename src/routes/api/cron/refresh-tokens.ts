/**
 * GET /api/cron/refresh-tokens
 *
 * Nightly cron (midnight UTC) that refreshes Meta long-lived tokens
 * and X (Twitter) OAuth 2.0 tokens before they expire.
 *
 * Meta: Calls fb_exchange_token endpoint to get a fresh 60-day token.
 * X: Calls OAuth 2.0 token endpoint with grant_type=refresh_token.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 */
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

const META_APP_ID = "1210460348820936";
const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";
const X_API_BASE = "https://api.x.com";

function getAppSecret(): string {
  return process.env.META_APP_SECRET || process.env.META_ACCESS_TOKEN || "";
}

interface MetaRefreshResponse {
  access_token: string;
  expires_in: number;
  error?: { message: string; type: string };
}

async function refreshMetaToken(
  currentToken: string,
): Promise<MetaRefreshResponse> {
  const url = `${GRAPH_API_BASE}/oauth/access_token`;
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: META_APP_ID,
    client_secret: getAppSecret(),
    fb_exchange_token: currentToken,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = await res.json();
  return json as MetaRefreshResponse;
}

// ── H3: X (Twitter) OAuth 2.0 token refresh ──

interface XRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

async function refreshXToken(
  refreshToken: string,
): Promise<XRefreshResponse> {
  const clientId = process.env.X_CLIENT_ID || "";
  const clientSecret = process.env.X_CLIENT_SECRET || "";
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(`${X_API_BASE}/2/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: params.toString(),
  });

  const json = await res.json();

  if (json.error) {
    throw new Error(
      `X token refresh failed: ${json.error_description || json.error}`,
    );
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? refreshToken,
    expires_in: json.expires_in ?? 7200,
  };
}

async function refreshTokens(): Promise<Response> {
  const results: Array<{
    id: string;
    status: string;
    new_expires?: string;
    error?: string;
  }> = [];

  try {
    // Find all active Meta tokens expiring within 7 days
    const expiringTokens = await sql`
      SELECT id, client_id, platform, access_token, page_id, account_name, expires_at
      FROM client_platform_tokens
      WHERE token_status = 'active'
        AND platform = 'meta'
        AND expires_at IS NOT NULL
        AND expires_at < NOW() + INTERVAL '7 days'
      ORDER BY expires_at ASC
    `;

    console.log(
      `[refresh-tokens] Found ${expiringTokens.length} tokens expiring within 7 days`,
    );

    for (const token of expiringTokens) {
      const tokenId = token.id as string;
      const currentToken = token.access_token as string;
      const accountName = (token.account_name as string) || tokenId;

      try {
        const refreshResult = await refreshMetaToken(currentToken);

        if (refreshResult.error) {
          console.error(
            `[refresh-tokens] Failed to refresh token ${tokenId} (${accountName}): ${refreshResult.error.message}`,
          );
          // Mark as needs_reauth — client must reconnect
          await sql`
            UPDATE client_platform_tokens
            SET token_status = 'needs_reauth'
            WHERE id = ${tokenId}
          `;
          results.push({
            id: tokenId,
            status: "needs_reauth",
            error: refreshResult.error.message,
          });
          continue;
        }

        // Success — update token and expiry
        const newExpiresAt = new Date(
          Date.now() + refreshResult.expires_in * 1000,
        );

        await sql`
          UPDATE client_platform_tokens
          SET access_token = ${refreshResult.access_token},
              expires_at = ${newExpiresAt.toISOString()},
              token_status = 'active'
          WHERE id = ${tokenId}
        `;

        console.log(
          `[refresh-tokens] Refreshed token ${tokenId} (${accountName}) — new expiry: ${newExpiresAt.toISOString()}`,
        );
        results.push({
          id: tokenId,
          status: "refreshed",
          new_expires: newExpiresAt.toISOString(),
        });
      } catch (err: any) {
        console.error(
          `[refresh-tokens] Error refreshing token ${tokenId}:`,
          err.message,
        );
        // Network or unexpected error — keep as active, will retry next cron
        results.push({
          id: tokenId,
          status: "error",
          error: err.message,
        });
      }
    }

    // ── H3: Refresh X (Twitter) tokens expiring within 1 hour ──
    const xTokens = await sql`
      SELECT id, client_id, platform, access_token, refresh_token, page_id, account_name, expires_at
      FROM client_platform_tokens
      WHERE token_status = 'active'
        AND platform = 'x'
        AND expires_at IS NOT NULL
        AND expires_at < NOW() + INTERVAL '1 hour'
        AND refresh_token IS NOT NULL
      ORDER BY expires_at ASC
    `;

    if (xTokens.length > 0) {
      console.log(
        `[refresh-tokens] Found ${xTokens.length} X token(s) expiring within 1 hour`,
      );

      for (const token of xTokens) {
        const tokenId = token.id as string;
        const accountName = (token.account_name as string) || tokenId;
        const storedRefreshToken = token.refresh_token as string;

        try {
          const xResult = await refreshXToken(storedRefreshToken);

          const newExpiresAt = new Date(
            Date.now() + xResult.expires_in * 1000,
          );

          await sql`
            UPDATE client_platform_tokens
            SET access_token = ${xResult.access_token},
                refresh_token = ${xResult.refresh_token},
                expires_at = ${newExpiresAt.toISOString()},
                token_status = 'active'
            WHERE id = ${tokenId}
          `;

          console.log(
            `[refresh-tokens] Refreshed X token ${tokenId} (${accountName}) — new expiry: ${newExpiresAt.toISOString()}`,
          );
          results.push({
            id: tokenId,
            status: "refreshed",
            new_expires: newExpiresAt.toISOString(),
          });
        } catch (err: any) {
          console.error(
            `[refresh-tokens] Error refreshing X token ${tokenId} (${accountName}):`,
            err.message,
          );
          await sql`
            UPDATE client_platform_tokens
            SET token_status = 'needs_reauth'
            WHERE id = ${tokenId}
          `;
          results.push({
            id: tokenId,
            status: "needs_reauth",
            error: err.message,
          });
        }
      }
    }

  } catch (err: any) {
    console.error("[refresh-tokens] Query error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message, results }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      results,
      refreshed: results.filter((r) => r.status === "refreshed").length,
      needs_reauth: results.filter((r) => r.status === "needs_reauth")
        .length,
      errors: results.filter((r) => r.status === "error").length,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export const Route = createFileRoute("/api/cron/refresh-tokens")({
  server: {
    handlers: {
      GET: async () => {
        return refreshTokens();
      },
      POST: async () => {
        return refreshTokens();
      },
    },
  },
});
