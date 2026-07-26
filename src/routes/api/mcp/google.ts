/**
 * MCP (Model Context Protocol) route for Google APIs.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/google.
 * Wraps Google My Business API v4 and YouTube Data API v3.
 *
 * MetroReach Digital — Premium Social Media Marketing Agency
 *
 * Tools exposed:
 *   google_list_accounts         — list connected GMB + YouTube accounts
 *   google_create_gmb_post       — create a Google My Business post
 *   google_create_youtube_post   — upload a video to YouTube
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMB_API_BASE = "https://mybusinessbusinessinformation.googleapis.com";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3";
const SERVER_NAME = "mcp-google";
const SERVER_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Token refresh helper
// ---------------------------------------------------------------------------

/**
 * Refresh an expired Google access token using the stored refresh token.
 */
async function refreshGoogleToken(clientId: string): Promise<string> {
  const rows = await sql`
    SELECT access_token, page_id
    FROM client_platform_tokens
    WHERE client_id = ${clientId}
      AND platform = 'google'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error(
      `No Google token found for client ${clientId}. Have they connected via /portal/connect?`
    );
  }

  const refreshToken = rows[0].page_id as string; // stored in page_id for google platform
  if (!refreshToken || refreshToken === "primary") {
    // Token was stored without a refresh token; use existing access token
    return rows[0].access_token as string;
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const json = await res.json();
  if (json.error) {
    throw new Error(
      `Google token refresh failed: ${json.error_description || json.error}`
    );
  }

  const newToken = json.access_token;
  const expiresIn = json.expires_in ?? 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Update stored access token
  await sql`
    UPDATE client_platform_tokens
    SET access_token = ${newToken},
        expires_at = ${expiresAt.toISOString()}
    WHERE client_id = ${clientId}
      AND platform = 'google'
      AND page_id = ${refreshToken}
  `;

  // Also update tokens for all sub-platforms (gmb, youtube)
  await sql`
    UPDATE client_platform_tokens
    SET access_token = ${newToken},
        expires_at = ${expiresAt.toISOString()}
    WHERE client_id = ${clientId}
      AND platform IN ('google_gmb', 'google_youtube')
  `;

  return newToken;
}

/**
 * Get a valid access token for a client (refreshing if needed).
 */
async function getValidAccessToken(clientId: string): Promise<string> {
  const rows = await sql`
    SELECT access_token
    FROM client_platform_tokens
    WHERE client_id = ${clientId}
      AND platform = 'google'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error(
      `No Google token found for client ${clientId}. Have they connected via /portal/connect?`
    );
  }

  try {
    // Try to refresh — if the token is still valid, the refresh will just give a new one
    return await refreshGoogleToken(clientId);
  } catch {
    // Fall back to stored token
    return rows[0].access_token as string;
  }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function listAccounts(args: { client_id: string }) {
  if (!args.client_id) {
    throw new Error("client_id is required");
  }

  const rows = await sql`
    SELECT platform, page_id, account_name, created_at
    FROM client_platform_tokens
    WHERE client_id = ${args.client_id}
      AND platform IN ('google_gmb', 'google_youtube')
    ORDER BY platform, created_at DESC
  `;

  const gmbAccounts: any[] = [];
  const youtubeAccounts: any[] = [];

  for (const r of rows) {
    const entry = {
      id: r.page_id,
      name: r.account_name,
      connected_at: String(r.created_at),
    };
    if (r.platform === "google_gmb") {
      gmbAccounts.push(entry);
    } else if (r.platform === "google_youtube") {
      youtubeAccounts.push(entry);
    }
  }

  return {
    google_my_business: gmbAccounts,
    youtube: youtubeAccounts,
  };
}

/**
 * Create a Google My Business post (text + optional image + CTA).
 *
 * Uses the My Business Business Information API v1.
 * The GMB account ID is in the format "accounts/123456" from list_accounts.
 */
async function createGMBPost(args: {
  client_id: string;
  account_id: string;
  location_id: string;
  summary: string;
  image_url?: string;
  cta_type?: string;
  cta_url?: string;
}) {
  if (!args.client_id || !args.account_id || !args.location_id || !args.summary) {
    throw new Error(
      "client_id, account_id, location_id, and summary are required"
    );
  }

  if (args.summary.length > 1500) {
    throw new Error(
      `GMB post summary exceeds 1,500 character limit (${args.summary.length} chars)`
    );
  }

  const accessToken = await getValidAccessToken(args.client_id);

  // Validate the caller has this account connected
  const rows = await sql`
    SELECT account_name
    FROM client_platform_tokens
    WHERE client_id = ${args.client_id}
      AND platform = 'google_gmb'
      AND page_id = ${args.account_id}
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error(
      `No GMB account ${args.account_id} found for client ${args.client_id}. ` +
      `Use google_list_accounts to see connected accounts.`
    );
  }

  const locationPath = `${args.account_id}/locations/${args.location_id}`;

  const postBody: Record<string, unknown> = {
    summary: args.summary,
    topicType: "STANDARD",
    languageCode: "en-US",
  };

  // Optional call-to-action
  if (args.cta_type && args.cta_url) {
    const validCTAs = [
      "LEARN_MORE", "BOOK", "ORDER", "SHOP", "SIGN_UP", "CALL",
    ];
    const cta = validCTAs.includes(args.cta_type.toUpperCase())
      ? args.cta_type.toUpperCase()
      : "LEARN_MORE";

    postBody.callToAction = {
      actionType: cta,
      url: args.cta_url,
    };
  }

  // Optional media
  if (args.image_url) {
    // For GMB local posts, we reference a media item
    // First upload the media, then attach it
    const mediaItem = await uploadGMBMedia(accessToken, args.account_id, args.location_id, args.image_url);
    if (mediaItem) {
      postBody.media = [mediaItem];
    }
  }

  const res = await fetch(
    `${GMB_API_BASE}/v1/${locationPath}/localPosts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
    }
  );

  const json = await res.json();
  if (json.error) {
    throw new Error(
      `GMB post creation failed: ${json.error.message || JSON.stringify(json.error)}`
    );
  }

  return {
    post_id: json.name ?? "unknown",
    platform: "google_my_business",
    status: "published",
    account_name: rows[0].account_name,
  };
}

/**
 * Upload media to GMB for use in a local post.
 */
async function uploadGMBMedia(
  accessToken: string,
  accountId: string,
  locationId: string,
  imageUrl: string,
): Promise<{ mediaFormat: string; sourceUrl: string } | null> {
  try {
    // Fetch the image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const locationPath = `${accountId}/locations/${locationId}`;

    // GMB media upload
    const uploadRes = await fetch(
      `${GMB_API_BASE}/v1/${locationPath}/media?alt=media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": contentType,
          "X-Goog-Upload-Protocol": "raw",
        },
        body: buffer,
      }
    );

    const uploadJson = await uploadRes.json();
    if (uploadJson.error) return null;

    const mediaName = uploadJson.name ?? "";
    if (!mediaName) return null;

    // Return a media reference for the localPost
    return {
      mediaFormat: "PHOTO",
      sourceUrl: `https://mybusinessbusinessinformation.googleapis.com/v1/${mediaName}`,
    };
  } catch {
    return null; // Media upload is optional; post still publishes without it
  }
}

/**
 * Upload a video to YouTube.
 *
 * Uses the YouTube Data API v3 resumable upload.
 * Video must be fetched from a public URL.
 */
async function createYouTubePost(args: {
  client_id: string;
  channel_id: string;
  title: string;
  description?: string;
  video_url: string;
  tags?: string[];
  privacy_status?: string;
}) {
  if (!args.client_id || !args.channel_id || !args.title || !args.video_url) {
    throw new Error(
      "client_id, channel_id, title, and video_url are required"
    );
  }

  if (args.title.length > 100) {
    throw new Error(
      `YouTube title exceeds 100 character limit (${args.title.length} chars)`
    );
  }

  const accessToken = await getValidAccessToken(args.client_id);

  // Validate the caller has this channel connected
  const rows = await sql`
    SELECT account_name
    FROM client_platform_tokens
    WHERE client_id = ${args.client_id}
      AND platform = 'google_youtube'
      AND page_id = ${args.channel_id}
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error(
      `No YouTube channel ${args.channel_id} found for client ${args.client_id}. ` +
      `Use google_list_accounts to see connected channels.`
    );
  }

  // Step 1: Download the video from the public URL
  const videoRes = await fetch(args.video_url);
  if (!videoRes.ok) {
    throw new Error(
      `Failed to fetch video from ${args.video_url}: HTTP ${videoRes.status}`
    );
  }

  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
  const videoContentType = videoRes.headers.get("content-type") ?? "video/mp4";

  // Step 2: Build the video metadata
  const snippet: Record<string, unknown> = {
    title: args.title,
    description: args.description ?? "",
  };

  if (args.tags && args.tags.length > 0) {
    snippet.tags = args.tags.slice(0, 500); // YouTube max 500 tags
  }

  const privacy = args.privacy_status ?? "private";
  const validPrivacy = ["private", "unlisted", "public"];
  const statusPrivacy = validPrivacy.includes(privacy) ? privacy : "private";

  const metadata = {
    snippet,
    status: {
      privacyStatus: statusPrivacy,
      selfDeclaredMadeForKids: false,
    },
  };

  // Step 3: Multipart upload
  const boundary = `----MetroReachYT${Date.now()}${Math.random().toString(36).slice(2)}`;
  const parts: Buffer[] = [];

  // Part 1: metadata
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n`
    )
  );

  // Part 2: video
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Type: ${videoContentType}\r\n\r\n`
    )
  );
  parts.push(videoBuffer);
  parts.push(Buffer.from(`\r\n`));

  // Closing boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const multipartBody = Buffer.concat(parts);

  const uploadRes = await fetch(
    `${YOUTUBE_UPLOAD_BASE}/videos?part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  const uploadJson = await uploadRes.json();
  if (uploadJson.error) {
    throw new Error(
      `YouTube upload failed: ${uploadJson.error.message || JSON.stringify(uploadJson.error)}`
    );
  }

  const videoId = uploadJson.id ?? "unknown";

  return {
    post_id: videoId,
    platform: "youtube",
    status: "uploaded",
    privacy: statusPrivacy,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    account_name: rows[0].account_name,
  };
}

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
    name: "google_list_accounts",
    description:
      "List all Google My Business accounts and YouTube channels connected by a client. " +
      "Returns account IDs, names, and connection dates. " +
      "Requires a client_id.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: {
          type: "string",
          description: "The MetroReach client ID (from clients table).",
        },
      },
      required: ["client_id"],
    },
    handler: listAccounts,
  },
  {
    name: "google_create_gmb_post",
    description:
      "Create and publish a post on a connected Google My Business listing. " +
      "Uses the client's stored access token (connected via /portal/connect). " +
      "Requires client_id, account_id, location_id, and summary. " +
      "Optionally accepts image_url, cta_type (LEARN_MORE, BOOK, ORDER, SHOP, SIGN_UP, CALL), " +
      "and cta_url. Returns the post ID, platform, and status.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: {
          type: "string",
          description: "The MetroReach client ID (from clients table).",
        },
        account_id: {
          type: "string",
          description:
            "The GMB account ID (e.g., 'accounts/123456') from google_list_accounts.",
        },
        location_id: {
          type: "string",
          description:
            "The GMB location ID (numeric) for the specific business location.",
        },
        summary: {
          type: "string",
          description:
            "The post text. Max 1,500 characters. Must be in MetroReach brand voice.",
        },
        image_url: {
          type: "string",
          description:
            "Optional public image URL to attach to the post.",
        },
        cta_type: {
          type: "string",
          description:
            "Optional call-to-action type. One of: LEARN_MORE, BOOK, ORDER, SHOP, SIGN_UP, CALL.",
        },
        cta_url: {
          type: "string",
          description:
            "Optional URL for the call-to-action button.",
        },
      },
      required: ["client_id", "account_id", "location_id", "summary"],
    },
    handler: createGMBPost,
  },
  {
    name: "google_create_youtube_post",
    description:
      "Upload a video to a connected YouTube channel. " +
      "Downloads the video from a public URL and uploads it via the YouTube Data API v3. " +
      "Requires client_id, channel_id, title, and video_url. " +
      "Optionally accepts description, tags, and privacy_status (private, unlisted, public). " +
      "Videos default to 'private' for safety. Returns the video ID, platform, status, and URL.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: {
          type: "string",
          description: "The MetroReach client ID (from clients table).",
        },
        channel_id: {
          type: "string",
          description:
            "The YouTube channel ID from google_list_accounts.",
        },
        title: {
          type: "string",
          description:
            "The video title. Max 100 characters. Must be in MetroReach brand voice.",
        },
        description: {
          type: "string",
          description:
            "Optional video description.",
        },
        video_url: {
          type: "string",
          description:
            "Public URL of the video file to upload (must be publicly accessible).",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional array of tags for the video (max 500 tags).",
        },
        privacy_status: {
          type: "string",
          description:
            "Optional privacy status. One of: private, unlisted, public. Defaults to private.",
        },
      },
      required: ["client_id", "channel_id", "title", "video_url"],
    },
    handler: createYouTubePost,
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
      return null;
    }

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

export const Route = createFileRoute("/api/mcp/google")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      },
    },
  },
});
