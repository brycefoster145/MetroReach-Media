/**
 * MCP (Model Context Protocol) route for the TikTok API.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/tiktok.
 * Wraps the TikTok Content Posting API for direct video publishing.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 *
 * Tools exposed:
 *   tiktok_list_accounts  — list connected TikTok accounts
 *   tiktok_create_post     — create/publish a video post on TikTok
 */

import { createFileRoute } from "@tanstack/react-router";
import { sql } from "~/lib/db";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TIKTOK_API_BASE = "https://open.tiktokapis.com";
const SERVER_NAME = "mcp-tiktok";
const SERVER_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// TikTok API request helper
// ---------------------------------------------------------------------------

/**
 * Make a request to the TikTok Open API.
 */
async function tiktokApiRequest<T = unknown>(
  method: "GET" | "POST" | "PUT",
  path: string,
  accessToken: string,
  body?: Record<string, unknown> | Buffer,
  contentType?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  if (body && (method === "POST" || method === "PUT")) {
    headers["Content-Type"] = contentType ?? "application/json";
  }

  const fetchOpts: RequestInit = {
    method,
    headers,
  };

  if (body) {
    if (contentType === "application/octet-stream" || contentType?.includes("video")) {
      fetchOpts.body = body as Buffer;
    } else {
      fetchOpts.body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${TIKTOK_API_BASE}${path}`, fetchOpts);
  const text = await res.text();

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `TikTok API returned non-JSON response (status ${res.status}): ${text.slice(0, 500)}`
    );
  }

  // TikTok wraps responses in { data: {...}, error: {...} }
  if (json.error && json.error.code !== "ok") {
    const errMsg =
      json.error.message ||
      json.error.description ||
      `TikTok API error code: ${json.error.code}`;
    throw new Error(`TikTok API error: ${errMsg}`);
  }

  return (json.data ?? json) as T;
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function listAccounts(args: { client_id: string }) {
  if (!args.client_id) {
    throw new Error("client_id is required");
  }

  const rows = await sql`
    SELECT page_id, account_name, created_at
    FROM client_platform_tokens
    WHERE client_id = ${args.client_id}
      AND platform = 'tiktok'
    ORDER BY created_at DESC
  `;

  return {
    accounts: rows.map((r: any) => ({
      open_id: r.page_id,
      display_name: r.account_name,
      connected_at: String(r.created_at),
    })),
  };
}

/**
 * Download a file from a URL into a Buffer.
 */
async function downloadMedia(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download media from ${url}: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  return { buffer, contentType };
}

async function createPost(args: {
  client_id: string;
  text: string;
  media_urls?: string[];
  privacy_level?: string;
  disable_comment?: boolean;
}) {
  if (!args.client_id || !args.text) {
    throw new Error("client_id and text are required");
  }

  if (!args.media_urls || args.media_urls.length === 0) {
    throw new Error("At least one media_url (video) is required for TikTok posts");
  }

  // Look up the client's stored TikTok token
  const rows = await sql`
    SELECT access_token, page_id, account_name
    FROM client_platform_tokens
    WHERE client_id = ${args.client_id}
      AND platform = 'tiktok'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error(
      `No TikTok token found for client ${args.client_id}. ` +
      `Have they connected via /portal/connect?`
    );
  }

  const accessToken = rows[0].access_token as string;
  const openId = rows[0].page_id as string;

  // Step 1: Download the video
  const videoUrl = args.media_urls[0];
  const { buffer: videoBuffer, contentType } = await downloadMedia(videoUrl);

  // Step 2: Initialize the content post
  const initBody: Record<string, unknown> = {
    post_info: {
      title: args.text.slice(0, 2200), // TikTok title/caption limit
      privacy_level: args.privacy_level ?? "PUBLIC_TO_EVERYONE",
      disable_comment: args.disable_comment ?? false,
      auto_add_music: false,
    },
    source_info: {
      source: "PULL_FROM_URL",
      video_url: videoUrl,
    },
    post_mode: "DIRECT_POST",
  };

  const initResult = await tiktokApiRequest<{
    publish_id: string;
    upload_url?: string;
  }>(
    "POST",
    "/v2/post/publish/content/init/",
    accessToken,
    initBody,
  );

  const publishId = initResult.publish_id;

  // Step 3: If upload_url is provided, upload the video directly
  if (initResult.upload_url) {
    await fetch(initResult.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(videoBuffer.length),
      },
      body: videoBuffer,
    });
  }

  return {
    post_id: publishId,
    platform: "tiktok",
    status: "published",
    account_name: rows[0].account_name,
    open_id: openId,
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
    name: "tiktok_list_accounts",
    description:
      "List all TikTok accounts connected by a client. " +
      "Returns open IDs, display names, and connection dates. " +
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
    name: "tiktok_create_post",
    description:
      "Create and publish a video post directly to a connected TikTok account. " +
      "Uses the client's stored access token (connected via /portal/connect). " +
      "Requires client_id, text (caption), and media_urls (at least one video URL). " +
      "Optionally accepts privacy_level (PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, " +
      "SELF_ONLY) and disable_comment (boolean). " +
      "Returns the publish_id, platform, and status.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: {
          type: "string",
          description: "The MetroReach client ID (from clients table).",
        },
        text: {
          type: "string",
          description: "The post caption/title. Must be in MetroReach brand voice. Max ~2200 chars.",
        },
        media_urls: {
          type: "array",
          items: { type: "string" },
          description: "Array of publicly accessible video URLs. At least one required for TikTok.",
        },
        privacy_level: {
          type: "string",
          description: "Privacy setting. Default: PUBLIC_TO_EVERYONE. Options: MUTUAL_FOLLOW_FRIENDS, SELF_ONLY.",
        },
        disable_comment: {
          type: "boolean",
          description: "Whether to disable comments on the post. Default: false.",
        },
      },
      required: ["client_id", "text", "media_urls"],
    },
    handler: createPost,
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

export const Route = createFileRoute("/api/mcp/tiktok")({
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
