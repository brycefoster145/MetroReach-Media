/**
 * X (Twitter) direct posting utility.
 *
 * Posts directly via the X API v2 using the client's stored OAuth access token.
 * Used by the posting scheduler to publish scheduled tweets at exact times.
 *
 * No third-party middleware — direct X API v2 calls.
 */
import { sql } from "~/lib/db";

const X_API_BASE = "https://api.x.com";

export interface XPostResult {
  post_id: string;
  platform: "x";
  status: string;
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
  // Look up the stored X access token
  const rows = await sql`
    SELECT access_token, page_id, account_name
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
