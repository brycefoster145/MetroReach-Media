/**
 * LinkedIn comment reply utility.
 *
 * Replies directly to comments on LinkedIn posts via the LinkedIn REST API
 * using the client's stored OAuth access token. Uses the same token lookup
 * pattern as linkedin-poster.ts.
 *
 * No third-party middleware — direct LinkedIn REST API calls.
 */
import { sql } from "~/lib/db";

const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_VERSION = "202501";

export interface LinkedInReplyResult {
  reply_id: string;
  platform: "linkedin";
  status: string;
}

/**
 * Reply to a comment on LinkedIn.
 *
 * Looks up the LinkedIn access token from client_platform_tokens for
 * the given client_id and platform='linkedin', then POSTs to the
 * LinkedIn REST API socialActions endpoint to create a reply.
 *
 * @param commentUrn - The LinkedIn comment URN to reply to (e.g. "urn:li:comment:(activity:123,456)")
 * @param text - Reply text
 * @param clientId - MetroReach client ID (default: "metroreach")
 */
export async function replyToLinkedInComment(
  commentUrn: string,
  text: string,
  clientId: string = "metroreach",
): Promise<LinkedInReplyResult> {
  // ── 1. Look up the LinkedIn access token + person ID ──
  const rows = await sql`
    SELECT access_token, page_id
    FROM client_platform_tokens
    WHERE client_id = ${clientId}
      AND platform = 'linkedin'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error(`No LinkedIn token found for client "${clientId}"`);
  }

  const accessToken = rows[0].access_token as string;
  const rawPageId = (rows[0].page_id as string) || "";

  // ── 2. Resolve the person URN for the actor ──
  let actor: string;
  if (rawPageId.startsWith("urn:li:")) {
    actor = rawPageId;
  } else {
    actor = `urn:li:person:${rawPageId}`;
  }

  // ── 3. URL-encode the comment URN for the API path ──
  // LinkedIn URNs contain colons and parentheses that must be encoded
  const encodedUrn = encodeURIComponent(commentUrn);

  // ── 4. Build the reply body ──
  const replyBody = {
    actor,
    message: text,
    object: commentUrn,
  };

  // ── 5. POST to LinkedIn REST API ──
  const res = await fetch(
    `${LINKEDIN_API_BASE}/rest/socialActions/${encodedUrn}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "LinkedIn-Version": LINKEDIN_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(replyBody),
    },
  );

  const json = await res.json();

  if (res.status >= 400 || json.error) {
    const errMsg =
      json.message ||
      json.error_description ||
      json.error ||
      `HTTP ${res.status}`;
    throw new Error(`LinkedIn reply API error: ${errMsg}`);
  }

  const replyId = json.id || json.xLinkedInId || "unknown";

  return {
    reply_id: replyId,
    platform: "linkedin",
    status: "published",
  };
}
