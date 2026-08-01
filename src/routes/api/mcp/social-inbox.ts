/**
 * MCP (Model Context Protocol) route for the Social Inbox.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/social-inbox.
 * Wraps the Facebook Graph API v22.0 for comments, reviews, engagement,
 * messages, Instagram comments, and Instagram mentions.
 *
 * Integrated into the MetroReach Media TanStack Start site.
 *
 * Tools exposed:
 *   social_inbox_get_comments   — pull FB page comments
 *   social_inbox_get_reviews    — pull FB page ratings/reviews
 *   social_inbox_get_engagement — pull FB post engagement metrics
 *   social_inbox_get_messages   — pull FB page conversations (may require pages_messaging)
 *   social_inbox_get_ig_comments — pull IG media comments
 *   social_inbox_get_ig_mentions — pull IG tags/mentions
 *   social_inbox_reply_to_comment  — reply to a Facebook comment
 *   social_inbox_reply_to_ig_comment — reply to an Instagram comment
 *   social_inbox_reply              — unified reply across all platforms (FB, IG, X, LinkedIn)
 *   social_inbox_get_linkedin_comments — pull comments on a LinkedIn post
 *   social_inbox_get_linkedin_posts    — pull recent LinkedIn posts
 */

import { createFileRoute } from "@tanstack/react-router";
import { requireMcpAuth } from "~/lib/mcp-auth";
import { replyToTweet } from "~/lib/x-reply";
import { replyToLinkedInComment } from "~/lib/linkedin-reply";
import { sql } from "~/lib/db";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";
const META_TOKEN = process.env.META_ACCESS_TOKEN ?? "";
const SERVER_NAME = "mcp-social-inbox";
const SERVER_VERSION = "1.0.0";

// Default page/IG identifiers — can be overridden via tool arguments
const DEFAULT_PAGE_ID = "623055204204992";
const DEFAULT_IG_USER_ID = "17841472858895937";
const DEFAULT_LIMIT = 10;

// ---------------------------------------------------------------------------
// LinkedIn REST API config
// ---------------------------------------------------------------------------
const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_VERSION = "202501";

/**
 * Look up the LinkedIn access token and person_id for a given MetroReach
 * client from the client_platform_tokens table.
 */
async function getLinkedInCredentials(
  clientId: string,
): Promise<{ accessToken: string; personId: string } | null> {
  const rows = await sql`
    SELECT access_token, page_id
    FROM client_platform_tokens
    WHERE client_id = ${clientId}
      AND platform = 'linkedin'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const accessToken = rows[0].access_token as string;
  let rawPageId = (rows[0].page_id as string) || "";

  // page_id may be a full URN ("urn:li:person:abc123") or a raw ID ("abc123").
  let personId: string;
  if (rawPageId.startsWith("urn:li:")) {
    personId = rawPageId;
  } else {
    personId = `urn:li:person:${rawPageId}`;
  }

  return { accessToken, personId };
}

// ---------------------------------------------------------------------------
// Facebook Graph API request helper
// ---------------------------------------------------------------------------

interface GraphApiError {
  error?: {
    message: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Make a request to the Facebook Graph API.
 * The access_token is appended as a query parameter (Facebook auth pattern).
 * Pass an optional tokenOverride to use a page access token instead of META_TOKEN.
 */
async function graphApiRequest<T = unknown>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string>,
  body?: Record<string, unknown>,
  tokenOverride?: string,
): Promise<T> {
  const token = tokenOverride || META_TOKEN;
  const url = new URL(`${GRAPH_API_BASE}${path}`);
  url.searchParams.set("access_token", token);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const fetchOpts: RequestInit = {
    method,
    headers: {
      "Accept": "application/json",
    },
  };

  if (method === "POST" && body) {
    fetchOpts.headers = {
      ...(fetchOpts.headers as Record<string, string>),
      "Content-Type": "application/json",
    };
    fetchOpts.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), fetchOpts);
  const json = await res.json();

  // Check for Facebook Graph API-level errors
  const errJson = json as GraphApiError;
  if (errJson.error) {
    throw new Error(
      `Facebook Graph API error: ${errJson.error.message}` +
        (errJson.error.code ? ` (code ${errJson.error.code})` : ""),
    );
  }

  return json as T;
}

/** Cache for the page access token so we don't fetch it on every request. */
let cachedPageToken: string | null = null;

/**
 * Exchanges the user access token for a page access token via GET /me/accounts.
 * Returns the page token for the given pageId, or null if not found / not permitted.
 */
async function getPageAccessToken(pageId: string): Promise<string | null> {
  if (cachedPageToken) return cachedPageToken;

  try {
    const data = await graphApiRequest<{
      data?: Array<{ id: string; access_token: string }>;
    }>("GET", "/me/accounts", { fields: "id,access_token" });

    const page = data.data?.find((p) => p.id === pageId);
    if (page?.access_token) {
      cachedPageToken = page.access_token;
      return page.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function getComments(args: { pageId?: string; limit?: number; since?: string }) {
  const pageId = args.pageId || DEFAULT_PAGE_ID;
  const limit = args.limit ?? DEFAULT_LIMIT;

  const data = await graphApiRequest<{
    data?: Array<{
      id: string;
      comments?: {
        data?: Array<{
          id: string;
          message?: string;
          created_time: string;
          from?: { name: string; id: string };
          like_count?: number;
          comment_count?: number;
        }>;
      };
    }>;
  }>(
    "GET",
    `/${pageId}/posts`,
    {
      fields: "comments{id,message,created_time,from{name,id},like_count,comment_count}",
      limit: String(limit),
    },
  );
  return data;
}

async function getReviews(args: { pageId?: string; limit?: number }) {
  const pageId = args.pageId || DEFAULT_PAGE_ID;
  const limit = args.limit ?? DEFAULT_LIMIT;

  try {
    // /ratings requires a page access token, not a user token.
    // Try to exchange the user token for a page token first.
    const pageToken = await getPageAccessToken(pageId);
    if (!pageToken) {
      return {
        error: true,
        message: "Unable to fetch reviews: could not obtain a page access token. The current user token may not have pages_read_engagement or pages_show_list permission.",
        missing_permission: "pages_read_engagement / pages_show_list",
        hint: "Reviews require a page access token. Ensure the app has pages_read_engagement and pages_show_list permissions, and the page is connected to the authenticated user.",
      };
    }

    const data = await graphApiRequest<{
      data?: Array<{
        reviewer?: { name: string; id: string };
        rating?: number;
        review_text?: string;
        created_time: string;
        has_review?: boolean;
        open_graph_story?: unknown;
      }>;
    }>(
      "GET",
      `/${pageId}/ratings`,
      {
        fields: "reviewer{name,id},rating,review_text,created_time,has_review,open_graph_story",
        limit: String(limit),
      },
      undefined,
      pageToken,
    );
    return data;
  } catch (err: any) {
    const message = err.message ?? String(err);
    return {
      error: true,
      message: `Unable to fetch reviews: ${message}`,
      missing_permission: "pages_read_engagement",
      hint: "The /ratings endpoint requires a page access token with pages_read_engagement permission.",
    };
  }
}

async function getEngagement(args: { pageId?: string; postId?: string; limit?: number }) {
  const pageId = args.pageId || DEFAULT_PAGE_ID;
  const limit = args.limit ?? DEFAULT_LIMIT;

  // If a specific post ID is provided, query that post only
  if (args.postId) {
    const data = await graphApiRequest<{
      id?: string;
      likes?: { summary?: { total_count: number } };
      shares?: { count?: number };
      reactions?: { summary?: { total_count: number } };
    }>(
      "GET",
      `/${args.postId}`,
      {
        fields: "likes.summary(true),shares,reactions.summary(true)",
      },
    );
    return data;
  }

  // Otherwise query all posts on the page
  const data = await graphApiRequest<{
    data?: Array<{
      id: string;
      likes?: { summary?: { total_count: number } };
      shares?: { count?: number };
      reactions?: { summary?: { total_count: number } };
    }>;
  }>(
    "GET",
    `/${pageId}/posts`,
    {
      fields: "likes.summary(true),shares,reactions.summary(true)",
      limit: String(limit),
    },
  );
  return data;
}

async function getMessages(args: { pageId?: string; limit?: number }) {
  const pageId = args.pageId || DEFAULT_PAGE_ID;
  const limit = args.limit ?? DEFAULT_LIMIT;

  try {
    // Conversations may require a page access token — try to exchange first
    const pageToken = await getPageAccessToken(pageId);
    const token = pageToken || META_TOKEN;

    const data = await graphApiRequest<{
      data?: Array<{
        id: string;
        messages?: {
          data?: Array<{
            message?: string;
            from?: { name: string; id: string };
            created_time: string;
          }>;
        };
      }>;
    }>(
      "GET",
      `/${pageId}/conversations`,
      {
        fields: "messages{message,from,created_time}",
        limit: String(limit),
      },
      undefined,
      token,
    );
    return data;
  } catch (err: any) {
    // Messages commonly fails due to missing pages_messaging permission.
    // Return a structured error message so the caller knows what's missing.
    const message = err.message ?? String(err);
    return {
      error: true,
      message: `Unable to fetch messages: ${message}`,
      missing_permission: "pages_messaging",
      hint: "The current access token does not include the pages_messaging permission, which is required to read page conversations/DMs.",
    };
  }
}

async function getIgComments(args: { igUserId?: string; limit?: number }) {
  const igUserId = args.igUserId || DEFAULT_IG_USER_ID;
  const limit = args.limit ?? DEFAULT_LIMIT;

  try {
    const data = await graphApiRequest<{
      data?: Array<{
        id: string;
        comments?: {
          data?: Array<{
            id: string;
            text?: string;
            timestamp: string;
            username?: string;
            like_count?: number;
          }>;
        };
      }>;
    }>(
      "GET",
      `/${igUserId}/media`,
      {
        fields: "comments{id,text,timestamp,username,like_count}",
        limit: String(limit),
      },
    );
    return data;
  } catch (err: any) {
    const message = err.message ?? String(err);
    return {
      error: true,
      message: `Unable to fetch Instagram comments: ${message}`,
      missing_permission: "instagram_basic, instagram_manage_comments",
      hint: "Instagram media comments require instagram_basic and instagram_manage_comments permissions, and the Instagram Business Account must be linked to the Facebook Page.",
    };
  }
}

async function getIgMentions(args: { igUserId?: string; limit?: number }) {
  const igUserId = args.igUserId || DEFAULT_IG_USER_ID;
  const limit = args.limit ?? DEFAULT_LIMIT;

  try {
    const data = await graphApiRequest<{
      data?: Array<{
        id: string;
        caption?: string;
        media_type?: string;
        timestamp: string;
      }>;
    }>(
      "GET",
      `/${igUserId}/tags`,
      {
        fields: "id,caption,media_type,timestamp",
        limit: String(limit),
      },
    );
    return data;
  } catch (err: any) {
    const message = err.message ?? String(err);
    return {
      error: true,
      message: `Unable to fetch Instagram mentions: ${message}`,
      missing_permission: "instagram_basic",
      hint: "Instagram mentions/tags require instagram_basic permission and the Instagram Business Account must be linked to the Facebook Page.",
    };
  }
}

// ---------------------------------------------------------------------------
// Reply tool implementations
// ---------------------------------------------------------------------------

async function replyToFacebookComment(args: { comment_id: string; message: string }) {
  if (!args.comment_id || !args.message) {
    throw new Error("Both comment_id and message are required");
  }

  const data = await graphApiRequest<{ id?: string }>(
    "POST",
    `/${args.comment_id}/comments`,
    { message: args.message },
  );
  return { reply_id: data.id ?? "unknown", platform: "facebook", status: "published" };
}

async function replyToIGComment(args: { comment_id: string; message: string }) {
  if (!args.comment_id || !args.message) {
    throw new Error("Both comment_id and message are required");
  }

  const data = await graphApiRequest<{ id?: string }>(
    "POST",
    `/${args.comment_id}/replies`,
    { message: args.message },
  );
  return { reply_id: data.id ?? "unknown", platform: "instagram", status: "published" };
}

async function unifiedReply(args: {
  platform: string;
  comment_id: string;
  message: string;
  client_id?: string;
  x_user_id?: string;
}) {
  const { platform, comment_id, message, client_id, x_user_id } = args;

  if (!platform || !comment_id || !message) {
    throw new Error("platform, comment_id, and message are all required");
  }

  switch (platform.toLowerCase()) {
    case "facebook":
      return replyToFacebookComment({ comment_id, message });
    case "instagram":
      return replyToIGComment({ comment_id, message });
    case "x":
    case "twitter":
      return replyToTweet(
        comment_id,
        message,
        client_id ?? "metroreach",
        x_user_id ?? "",
      );
    case "linkedin":
      return replyToLinkedInComment(
        comment_id,
        message,
        client_id ?? "metroreach",
      );
    default:
      throw new Error(
        `Unsupported platform: "${platform}". Supported: facebook, instagram, x, linkedin`,
      );
  }
}

// LinkedIn comment + post tools
// ---------------------------------------------------------------------------

/**
 * Resolve a post ID argument to a URN.
 * Handles both full URNs ("urn:li:activity:123456789") and raw IDs ("123456789").
 */
function resolvePostUrn(postId: string): string {
  if (postId.startsWith("urn:li:")) return postId;
  return `urn:li:activity:${postId}`;
}

async function getLinkedInComments(args: {
  post_id: string;
  client_id?: string;
  limit?: number;
}) {
  const clientId = args.client_id ?? "metroreach";
  const limit = args.limit ?? DEFAULT_LIMIT;
  const postUrn = resolvePostUrn(args.post_id);

  const creds = await getLinkedInCredentials(clientId);
  if (!creds) {
    return {
      error: true,
      message: `No LinkedIn token found for client "${clientId}". Ensure the LinkedIn account is connected via the client portal.`,
    };
  }

  const encodedUrn = encodeURIComponent(postUrn);
  const url = `${LINKEDIN_API_BASE}/rest/socialActions/${encodedUrn}/comments`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "LinkedIn-Version": LINKEDIN_VERSION,
        Accept: "application/json",
      },
    });

    if (res.status === 404) {
      return {
        error: true,
        message: `Post ${postUrn} not found or has no comments. The post may have been deleted, or the post_id may be incorrect.`,
      };
    }

    const json = await res.json();

    if (res.status >= 400 || json.error) {
      const errMsg =
        json.message ||
        json.error_description ||
        json.error ||
        `HTTP ${res.status}`;
      return {
        error: true,
        message: `LinkedIn API error: ${errMsg}`,
      };
    }

    // Normalise the response — LinkedIn returns { elements: [...] }
    const elements: any[] = json.elements ?? [];

    const comments = elements.map((el: any) => ({
      comment_id: el.id ?? "unknown",
      author: el.author
        ? `${el.author.firstName ?? ""} ${el.author.lastName ?? ""}`.trim()
        : "Unknown",
      author_id: el.author?.id ?? null,
      text: el.message ?? "",
      created_at: el.created?.time ?? el.createdAt ?? null,
      parent_comment_id: el.parentComment ?? null,
      like_count: el.likesSummary?.totalLikes ?? 0,
    }));

    return {
      post_id: postUrn,
      total: json.paging?.total ?? comments.length,
      comments: comments.slice(0, limit),
    };
  } catch (err: any) {
    const message = err.message ?? String(err);
    return {
      error: true,
      message: `LinkedIn API request failed: ${message}`,
    };
  }
}

async function getLinkedInPosts(args: { client_id?: string; limit?: number }) {
  const clientId = args.client_id ?? "metroreach";
  const limit = args.limit ?? DEFAULT_LIMIT;

  const creds = await getLinkedInCredentials(clientId);
  if (!creds) {
    return {
      error: true,
      message: `No LinkedIn token found for client "${clientId}". Ensure the LinkedIn account is connected via the client portal.`,
    };
  }

  const url = `${LINKEDIN_API_BASE}/rest/posts?author=${encodeURIComponent(creds.personId)}&q=author&count=${limit}&sortBy=LAST_MODIFIED`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "LinkedIn-Version": LINKEDIN_VERSION,
        Accept: "application/json",
      },
    });

    if (res.status === 404) {
      return {
        error: true,
        message: `No posts found for ${creds.personId}. The author may have no published posts, or the token does not have r_liteprofile / w_member_social permissions.`,
      };
    }

    const json = await res.json();

    if (res.status >= 400 || json.error) {
      const errMsg =
        json.message ||
        json.error_description ||
        json.error ||
        `HTTP ${res.status}`;
      return {
        error: true,
        message: `LinkedIn API error: ${errMsg}`,
      };
    }

    const elements: any[] = json.elements ?? [];

    const posts = elements.map((el: any) => {
      const commentary = el.commentary ?? "";
      const textPreview =
        typeof commentary === "string"
          ? commentary.slice(0, 200)
          : commentary.text?.slice(0, 200) ?? "(media post)";

      return {
        post_id: el.id ?? "unknown",
        text: textPreview,
        created_at: el.created?.time ?? el.createdAt ?? null,
        comment_count: el.commentarySummary?.count ??
          el.socialDetail?.totalSocialActivityCounts?.numComments ??
          0,
        like_count: el.socialDetail?.totalSocialActivityCounts?.numLikes ?? 0,
        share_count: el.socialDetail?.totalSocialActivityCounts?.numShares ?? 0,
        visibility: el.visibility ?? "PUBLIC",
      };
    });

    return {
      author: creds.personId,
      total: json.paging?.total ?? posts.length,
      posts: posts.slice(0, limit),
    };
  } catch (err: any) {
    const message = err.message ?? String(err);
    return {
      error: true,
      message: `LinkedIn API request failed: ${message}`,
    };
  }
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tool registry (MCP tools/list schema)
// ---------------------------------------------------------------------------

interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: any) => Promise<unknown>;
}

const tools: ToolDef[] = [
  {
    name: "social_inbox_get_comments",
    description:
      "Pull comments from the MetroReach Media Facebook Page feed. " +
      "Returns post IDs with their associated comments including message text, " +
      "author name/ID, created time, like count, and comment count. " +
      "Optionally filter by a `since` date (ISO 8601).",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description:
            "Facebook Page ID. Defaults to MetroReach Media (623055204204992).",
        },
        limit: {
          type: "number",
          description: "Number of posts to fetch (default: 10).",
        },
        since: {
          type: "string",
          description: "Optional ISO 8601 date to filter posts created after this time.",
        },
      },
    },
    handler: getComments,
  },
  {
    name: "social_inbox_get_reviews",
    description:
      "Pull ratings and reviews from the MetroReach Media Facebook Page. " +
      "Returns reviewer name/ID, star rating, review text, and created time. " +
      "Use this to monitor and respond to customer reviews.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description:
            "Facebook Page ID. Defaults to MetroReach Media (623055204204992).",
        },
        limit: {
          type: "number",
          description: "Number of reviews to fetch (default: 10).",
        },
      },
    },
    handler: getReviews,
  },
  {
    name: "social_inbox_get_engagement",
    description:
      "Pull post engagement metrics from the MetroReach Media Facebook Page. " +
      "Returns like counts (summary), share counts, and reaction counts (summary) per post. " +
      "Pass a `postId` to get engagement for a single post; otherwise returns all recent posts.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description:
            "Facebook Page ID. Defaults to MetroReach Media (623055204204992).",
        },
        postId: {
          type: "string",
          description:
            "Optional specific post ID to get engagement for. If omitted, returns all recent posts.",
        },
        limit: {
          type: "number",
          description: "Number of posts to fetch when postId is not set (default: 10).",
        },
      },
    },
    handler: getEngagement,
  },
  {
    name: "social_inbox_get_messages",
    description:
      "Pull page conversations (DMs) from the MetroReach Media Facebook Page. " +
      "WARNING: This requires the `pages_messaging` permission which may not be " +
      "granted on the current access token. Returns a clear error if permission is missing.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description:
            "Facebook Page ID. Defaults to MetroReach Media (623055204204992).",
        },
        limit: {
          type: "number",
          description: "Number of conversations to fetch (default: 10).",
        },
      },
    },
    handler: getMessages,
  },
  {
    name: "social_inbox_get_ig_comments",
    description:
      "Pull comments from the MetroReach Media Instagram Business Account's media. " +
      "Returns media IDs with associated comments including text, username, " +
      "timestamp, and like count. Requires the Instagram Business Account to be " +
      "linked to the Facebook Page.",
    inputSchema: {
      type: "object",
      properties: {
        igUserId: {
          type: "string",
          description:
            "Instagram Business Account ID. Defaults to MetroReach Media (17841472858895937).",
        },
        limit: {
          type: "number",
          description: "Number of media items to fetch (default: 10).",
        },
      },
    },
    handler: getIgComments,
  },
  {
    name: "social_inbox_get_ig_mentions",
    description:
      "Pull Instagram tags/mentions for the MetroReach Media Instagram Business Account. " +
      "Returns tagged media IDs with captions, media type, and timestamps. " +
      "Use this to discover when other accounts tag or mention MetroReach Media.",
    inputSchema: {
      type: "object",
      properties: {
        igUserId: {
          type: "string",
          description:
            "Instagram Business Account ID. Defaults to MetroReach Media (17841472858895937).",
        },
        limit: {
          type: "number",
          description: "Number of tags to fetch (default: 10).",
        },
      },
    },
    handler: getIgMentions,
  },
  {
    name: "social_inbox_reply_to_comment",
    description:
      "Reply to a comment on a Facebook Page post. " +
      "Posts a reply as the Page to the given comment ID. " +
      "Returns the new reply comment ID.",
    inputSchema: {
      type: "object",
      properties: {
        comment_id: {
          type: "string",
          description: "The Facebook comment ID to reply to.",
        },
        message: {
          type: "string",
          description: "The reply text to post.",
        },
      },
      required: ["comment_id", "message"],
    },
    handler: replyToFacebookComment,
  },
  {
    name: "social_inbox_reply_to_ig_comment",
    description:
      "Reply to a comment on an Instagram media item. " +
      "Posts a reply as the Instagram Business Account to the given comment ID. " +
      "Returns the new reply ID.",
    inputSchema: {
      type: "object",
      properties: {
        comment_id: {
          type: "string",
          description: "The Instagram comment ID to reply to.",
        },
        message: {
          type: "string",
          description: "The reply text to post.",
        },
      },
      required: ["comment_id", "message"],
    },
    handler: replyToIGComment,
  },
  {
    name: "social_inbox_reply",
    description:
      "Unified reply tool — reply to a comment on any supported platform. " +
      "Routes to the correct platform-specific reply function. " +
      "Supports: facebook, instagram, x (twitter), linkedin. " +
      "For X, provide x_user_id for token lookup. " +
      "For LinkedIn, provide client_id if not default metroreach.",
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          description:
            "Platform to reply on: facebook, instagram, x, twitter, or linkedin.",
        },
        comment_id: {
          type: "string",
          description:
            "The comment/tweet ID to reply to. For Facebook/IG: comment ID. For X: tweet ID. For LinkedIn: comment URN.",
        },
        message: {
          type: "string",
          description: "The reply text.",
        },
        client_id: {
          type: "string",
          description:
            "MetroReach client ID (default: metroreach). Used for X and LinkedIn token lookup.",
        },
        x_user_id: {
          type: "string",
          description:
            "X user ID for token lookup when replying on X. Defaults to MetroReach's X account.",
        },
      },
      required: ["platform", "comment_id", "message"],
    },
    handler: unifiedReply,
  },
  {
    name: "social_inbox_get_linkedin_comments",
    description:
      "Pull comments from a specific LinkedIn post for a MetroReach Media client. " +
      "Looks up the client's stored LinkedIn OAuth token from client_platform_tokens, " +
      "then retrieves comments via the LinkedIn REST API. " +
      "Post ID can be a full URN (urn:li:activity:...) or a raw numeric ID. " +
      "Returns comment_id, author name, text, created_at, and like_count for each comment.",
    inputSchema: {
      type: "object",
      properties: {
        post_id: {
          type: "string",
          description:
            "LinkedIn post URN (e.g. urn:li:activity:123456789) or raw numeric post ID.",
        },
        client_id: {
          type: "string",
          description:
            "MetroReach client ID. Defaults to \"metroreach\" (the agency's own LinkedIn account).",
        },
        limit: {
          type: "number",
          description: "Maximum number of comments to return (default: 10).",
        },
      },
      required: ["post_id"],
    },
    handler: getLinkedInComments,
  },
  {
    name: "social_inbox_get_linkedin_posts",
    description:
      "Pull recent LinkedIn posts for a MetroReach Media client. " +
      "Looks up the client's stored LinkedIn OAuth token from client_platform_tokens, " +
      "then retrieves posts via the LinkedIn REST API using the author URN. " +
      "Use this to discover post IDs, which can then be passed to " +
      "social_inbox_get_linkedin_comments to fetch comments on specific posts. " +
      "Returns post_id, text preview (first 200 chars), created_at, comment_count, " +
      "like_count, share_count, and visibility.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: {
          type: "string",
          description:
            "MetroReach client ID. Defaults to \"metroreach\" (the agency's own LinkedIn account).",
        },
        limit: {
          type: "number",
          description: "Maximum number of posts to return (default: 10).",
        },
      },
    },
    handler: getLinkedInPosts,
  },
];

// ---------------------------------------------------------------------------
// JSON-RPC dispatcher
// ---------------------------------------------------------------------------

type RpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

/** Return a JSON-RPC 2.0 error response. */
function jsonRpcError(
  id: unknown,
  code: number,
  message: string,
): Record<string, unknown> {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message },
  };
}

async function dispatch(req: RpcRequest): Promise<unknown> {
  const { method, params, id } = req;

  switch (method) {
    // --- MCP lifecycle ---
    case "initialize": {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
        },
      };
    }

    case "notifications/initialized": {
      // No response required per MCP spec
      return null;
    }

    // --- MCP tools ---
    case "tools/list": {
      const toolList = tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      return { jsonrpc: "2.0", id, result: { tools: toolList } };
    }

    case "tools/call": {
      const toolName = params?.name as string | undefined;
      const toolArgs = (params?.arguments ?? {}) as Record<string, unknown>;

      if (!toolName) {
        return jsonRpcError(id, -32602, 'Missing required param "name"');
      }

      const tool = tools.find((t) => t.name === toolName);
      if (!tool) {
        return jsonRpcError(id, -32601, `Unknown tool: ${toolName}`);
      }

      try {
        const result = await tool.handler(toolArgs);
        const text =
          typeof result === "string" ? result : JSON.stringify(result, null, 2);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text }],
          },
        };
      } catch (err: any) {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `Error: ${err.message ?? String(err)}`,
              },
            ],
            isError: true,
          },
        };
      }
    }

    default:
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
  }
}

// ---------------------------------------------------------------------------
// TanStack Start API route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/api/mcp/social-inbox")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireMcpAuth(request);
        if (unauthorized) return unauthorized;
        // Validate Content-Type
        const ct = request.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          return new Response(
            JSON.stringify(
              jsonRpcError(null, -32700, "Content-Type must be application/json"),
            ),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Parse body
        let body: RpcRequest;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify(jsonRpcError(null, -32700, "Parse error")),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const result = await dispatch(body);

        // null result means no response (e.g., notifications/initialized)
        if (result === null) {
          return new Response(null, { status: 204 });
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },

      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-api-key",
          },
        });
      },
    },
  },
});
