/**
 * X (Twitter) reply utility.
 *
 * Replies directly to tweets via the X API v2 using the client's stored
 * OAuth access token. Uses the same token management as x-poster.ts.
 *
 * No third-party middleware — direct X API v2 calls.
 */
import { getValidXToken } from "~/lib/x-poster";

const X_API_BASE = "https://api.x.com";

export interface XReplyResult {
  reply_id: string;
  platform: "x";
  status: string;
}

/**
 * Reply to a tweet on a connected X account.
 *
 * Gets the X access token via getValidXToken (same as posting), then
 * POSTs to X API v2 with `in_reply_to_tweet_id` to create a threaded reply.
 *
 * @param tweetId - The tweet ID to reply to
 * @param text - Reply text (max 280 chars for free tier, longer for paid API tier)
 * @param clientId - MetroReach client ID (default: "metroreach")
 * @param xUserId - X user ID for token lookup
 */
export async function replyToTweet(
  tweetId: string,
  text: string,
  clientId: string = "metroreach",
  xUserId: string = "",
): Promise<XReplyResult> {
  // If no xUserId provided, try to look it up — use default
  const resolvedUserId = xUserId || "1852950918553346048";

  const accessToken = await getValidXToken(clientId, resolvedUserId);

  // Validate and trim tweet length
  if (text.length > 4000) {
    console.warn(
      `[x-reply] Reply text exceeds 4,000 character limit (${text.length} chars) — truncating`,
    );
    text = text.slice(0, 3997) + "...";
  }

  // Post reply to X API v2
  const res = await fetch(`${X_API_BASE}/2/tweets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      text,
      reply: {
        in_reply_to_tweet_id: tweetId,
      },
    }),
  });

  const json = await res.json();

  if (res.status >= 400 || json.errors) {
    const errMsg =
      json.errors?.[0]?.detail ??
      json.detail ??
      json.title ??
      `HTTP ${res.status}`;
    throw new Error(`X API reply error: ${errMsg}`);
  }

  const replyId = json.data?.id ?? "unknown";

  return {
    reply_id: replyId,
    platform: "x",
    status: "published",
  };
}
