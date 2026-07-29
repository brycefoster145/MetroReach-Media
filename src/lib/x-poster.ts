/**
 * X (Twitter) direct posting utility.
 *
 * Posts directly via the X API v2 using the client's stored OAuth access token.
 * Used by the posting scheduler to publish scheduled tweets at exact times.
 *
 * No third-party middleware — direct X API v2 calls.
 *
 * H3: Token expiry check — refreshes token via OAuth 2.0 refresh_token
 * if the stored access token is within 5 minutes of expiry.
 */
import { sql } from "~/lib/db";

const X_API_BASE = "https://api.x.com";
const X_CLIENT_ID = process.env.X_CLIENT_ID || "";
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET || "";

export interface XPostResult {
  post_id: string;
  platform: "x";
  status: string;
}

/**
 * Refresh an X access token using the stored refresh_token.
 * Updates client_platform_tokens with the new token and expiry.
 */
async function refreshXAccessToken(
  clientId: string,
  xUserId: string,
): Promise<string> {
  const rows = await sql`
    SELECT refresh_token
    FROM client_platform_tokens
    WHERE client_id = ${clientId}
      AND platform = 'x'
      AND page_id = ${xUserId}
      AND refresh_token IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0 || !rows[0].refresh_token) {
    throw new Error(
      `No X refresh token found for client "${clientId}" user "${xUserId}". Re-authentication required.`,
    );
  }

  const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64");
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: rows[0].refresh_token as string,
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

  const newToken = json.access_token;
  const newRefreshToken = json.refresh_token;
  const expiresIn = json.expires_in ?? 7200;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Update stored tokens
  await sql`
    UPDATE client_platform_tokens
    SET access_token = ${newToken},
        refresh_token = ${newRefreshToken || rows[0].refresh_token},
        expires_at = ${expiresAt.toISOString()},
        token_status = 'active'
    WHERE client_id = ${clientId}
      AND platform = 'x'
      AND page_id = ${xUserId}
  `;

  return newToken;
}

/**
 * Get a valid X access token, refreshing if within 5 minutes of expiry.
 */
export async function getValidXToken(
  clientId: string,
  xUserId: string,
): Promise<string> {
  const rows = await sql`
    SELECT access_token, expires_at, refresh_token
    FROM client_platform_tokens
    WHERE client_id = ${clientId}
      AND platform = 'x'
      AND page_id = ${xUserId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error(
      `No X token found for client "${clientId}" user "${xUserId}". ` +
      `Has the X account been connected via /portal/connect?`,
    );
  }

  const accessToken = rows[0].access_token as string;
  const expiresAt = rows[0].expires_at as Date | null;

  // If token expires within 5 minutes, refresh proactively
  if (expiresAt && new Date(expiresAt).getTime() - Date.now() < 5 * 60 * 1000) {
    console.log(
      `[x-poster] X token for ${xUserId} expires soon — refreshing before posting`,
    );
    try {
      return await refreshXAccessToken(clientId, xUserId);
    } catch (refreshErr: any) {
      console.error(
        `[x-poster] X token refresh failed: ${refreshErr.message} — trying existing token`,
      );
      // Fall through to use existing token — it may still be valid
    }
  }

  return accessToken;
}

/**
 * Publish a tweet to a connected X account.
 *
 * Gets the X access token from client_platform_tokens for the given
 * client_id and X user_id, then posts to X API v2.
 *
 * @param clientId - MetroReach client ID (default: "metroreach")
 * @param xUserId - X user ID (stored as page_id in scheduled_posts and client_platform_tokens)
 * @param text - Tweet text (max 280 chars for free tier, longer for paid API tier)
 */
export async function publishToX(
  clientId: string,
  xUserId: string,
  text: string,
): Promise<XPostResult> {
  // Get a valid token (refreshed if needed via getValidXToken)
  const accessToken = await getValidXToken(clientId, xUserId);

  // Validate tweet length — X allows up to 4000 chars for paid API tier
  // but auto-trim to keep under the limit
  if (text.length > 4000) {
    console.warn(
      `[x-poster] Tweet text exceeds 4,000 character limit (${text.length} chars) — truncating`,
    );
    text = text.slice(0, 3997) + "...";
  }

  // Post to X API v2
  const res = await fetch(`${X_API_BASE}/2/tweets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const json = await res.json();

  if (res.status >= 400 || json.errors) {
    const errMsg =
      json.errors?.[0]?.detail ??
      json.detail ??
      json.title ??
      `HTTP ${res.status}`;
    throw new Error(`X API error: ${errMsg}`);
  }

  const tweetId = json.data?.id ?? "unknown";

  return {
    post_id: tweetId,
    platform: "x",
    status: "published",
  };
}
