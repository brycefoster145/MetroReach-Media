/**
 * LinkedIn Personal Profile direct posting utility.
 *
 * Posts directly via the LinkedIn REST API using the client's stored
 * OAuth access token. Used by the posting scheduler to publish
 * scheduled LinkedIn posts at exact times.
 *
 * Personal profiles use `author: "urn:li:person:{person_id}"` —
 * this is the personal-profile equivalent of the MCP's company-page
 * publisher which uses `urn:li:organization:{org_id}`.
 *
 * No third-party middleware — direct LinkedIn REST API calls.
 */
import { sql } from "~/lib/db";

const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_VERSION = "202501";

export interface LinkedInPostResult {
  post_id: string;
  platform: "linkedin";
  status: string;
}

/**
 * Publish a post to a connected LinkedIn personal profile.
 *
 * Looks up the LinkedIn access token from client_platform_tokens for
 * the given client_id and platform='linkedin', then posts to the
 * LinkedIn REST API with `author: "urn:li:person:{person_id}"`.
 *
 * The person_id is derived from the page_id column — it may be stored
 * as a full URN ("urn:li:person:abc123") or a raw person ID ("abc123").
 *
 * @param clientId - MetroReach client ID (default: "metroreach")
 * @param text - Post text (commentary)
 */
export async function publishToLinkedIn(
  clientId: string,
  text: string,
): Promise<LinkedInPostResult> {
  // ── 1. Look up the LinkedIn access token + person ID ──
  const rows = await sql`
    SELECT access_token, page_id, account_name, expires_at
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

  // ── 2. Resolve the person URN ──
  // page_id may be a full URN ("urn:li:person:abc123") or a raw ID ("abc123").
  let author: string;
  if (rawPageId.startsWith("urn:li:")) {
    // Already a URN — use as-is (handles person, organization, or other)
    author = rawPageId;
  } else {
    // Raw ID — wrap as personal profile URN
    author = `urn:li:person:${rawPageId}`;
  }

  // ── 3. Build the post body per LinkedIn REST API spec ──
  const postBody = {
    author,
    commentary: text,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  // ── 4. Post to LinkedIn REST API ──
  const res = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(postBody),
  });

  const json = await res.json();

  if (res.status >= 400 || json.error) {
    const errMsg =
      json.message ||
      json.error_description ||
      json.error ||
      `HTTP ${res.status}`;
    throw new Error(`LinkedIn API error: ${errMsg}`);
  }

  const postId = json.id || json.xLinkedInId || "unknown";

  return {
    post_id: postId,
    platform: "linkedin",
    status: "published",
  };
}
