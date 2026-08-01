/**
 * MCP (Model Context Protocol) route for the X (Twitter) API.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/x.
 * Wraps the X API v2 for direct posting and account management.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 *
 * Tools exposed:
 *   x_list_accounts  — list connected X accounts
 *   x_create_post     — create and publish a tweet
 */

import { createFileRoute } from "@tanstack/react-router";
import { requireMcpAuth } from "~/lib/mcp-auth";
import { sql } from "~/lib/db";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const X_API_BASE = "https://api.x.com";
const SERVER_NAME = "mcp-x";
const SERVER_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// X API request helper
// ---------------------------------------------------------------------------

/**
 * Make a request to the X (Twitter) API v2.
 */
async function xApiRequest<T = unknown>(
  method: "GET" | "POST",
  path: string,
  accessToken: string,
  body?: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const fetchOpts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(extraHeaders ?? {}),
    },
  };

  if (body && method !== "GET") {
    fetchOpts.headers = {
      ...(fetchOpts.headers as Record<string, string>),
      "Content-Type": "application/json",
    };
    fetchOpts.body = JSON.stringify(body);
  }

  const res = await fetch(`${X_API_BASE}${path}`, fetchOpts);
  const text = await res.text();

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `X API returned non-JSON response (status ${res.status}): ${text.slice(0, 500)}`,
    );
  }

  if (res.status >= 400 || json.errors) {
    const errMsg =
      json.errors?.[0]?.detail ??
      json.detail ??
      json.title ??
      `HTTP ${res.status}`;
    throw new Error(`X API error: ${errMsg}`);
  }

  return json as T;
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
      AND platform = 'x'
    ORDER BY created_at DESC
  `;

  return {
    accounts: rows.map((r: any) => ({
      user_id: r.page_id,
      name: r.account_name,
      connected_at: String(r.created_at),
    })),
  };
}

async function createPost(args: {
  client_id: string;
  user_id: string;
  text: string;
  media_urls?: string[];
}) {
  if (!args.client_id || !args.user_id || !args.text) {
    throw new Error("client_id, user_id, and text are required");
  }

  // Validate tweet length (280 chars for standard, but X now allows longer)
  if (args.text.length > 4000) {
    throw new Error(
      `Tweet text exceeds 4,000 character limit (${args.text.length} chars)`,
    );
  }

  // Look up the client's stored X token
  const rows = await sql`
    SELECT access_token, page_id, account_name
    FROM client_platform_tokens
    WHERE client_id = ${args.client_id}
      AND platform = 'x'
      AND page_id = ${args.user_id}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error(
      `No X token found for client ${args.client_id} user ${args.user_id}. ` +
      `Have they connected via /portal/connect?`,
    );
  }

  const accessToken = rows[0].access_token as string;

  // Build the tweet body
  const postBody: Record<string, unknown> = {
    text: args.text,
  };

  // If media URLs are provided, upload each and collect media IDs
  if (args.media_urls && args.media_urls.length > 0) {
    const mediaIds: string[] = [];

    for (const mediaUrl of args.media_urls) {
      // Step 1: Download the media from the URL
      const mediaRes = await fetch(mediaUrl);
      if (!mediaRes.ok) {
        throw new Error(
          `Failed to fetch media from ${mediaUrl}: HTTP ${mediaRes.status}`,
        );
      }

      const mediaBuffer = Buffer.from(await mediaRes.arrayBuffer());
      const contentType = mediaRes.headers.get("content-type") ?? "application/octet-stream";

      // Step 2: Upload to X using multipart/form-data
      // X media upload endpoint uses multipart/form-data
      const boundary = `----MetroReach${Date.now()}${Math.random().toString(36).slice(2)}`;
      const parts: Buffer[] = [];

      // Part 1: media parameter
      parts.push(
        Buffer.from(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="media"; filename="media.${contentType.split("/")[1] ?? "bin"}"\r\n` +
          `Content-Type: ${contentType}\r\n\r\n`,
        ),
      );
      parts.push(mediaBuffer);
      parts.push(Buffer.from(`\r\n`));

      // Closing boundary
      parts.push(Buffer.from(`--${boundary}--\r\n`));

      const multipartBody = Buffer.concat(parts);

      const uploadRes = await fetch(`${X_API_BASE}/2/media/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: multipartBody,
      });

      const uploadJson = await uploadRes.json();

      if (uploadRes.status >= 400 || uploadJson.errors) {
        const errMsg =
          uploadJson.errors?.[0]?.detail ??
          uploadJson.detail ??
          uploadJson.title ??
          `HTTP ${uploadRes.status}`;
        throw new Error(`X media upload failed: ${errMsg}`);
      }

      const mediaId =
        uploadJson.data?.id ??
        uploadJson.media_id_string ??
        uploadJson.media_id;

      if (!mediaId) {
        throw new Error(
          `X media upload returned no media ID: ${JSON.stringify(uploadJson)}`,
        );
      }

      mediaIds.push(String(mediaId));
    }

    // Attach media IDs to the tweet
    postBody.media = {
      media_ids: mediaIds,
    };
  }

  // Create the tweet
  const result = await xApiRequest<{
    data?: {
      id: string;
      text: string;
    };
  }>("POST", "/2/tweets", accessToken, postBody);

  const tweetId = result.data?.id ?? "unknown";

  return {
    post_id: tweetId,
    platform: "x",
    status: "published",
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
    name: "x_list_accounts",
    description:
      "List all X (Twitter) accounts connected by a client. " +
      "Returns user IDs, names, and connection dates. " +
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
    name: "x_create_post",
    description:
      "Create and publish a tweet directly on a connected X (Twitter) account. " +
      "Uses the client's stored access token (connected via /portal/connect). " +
      "Requires client_id, user_id, and text. Optionally accepts media_urls " +
      "(array of public image URLs to attach). " +
      "Returns the tweet ID, platform, and status.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: {
          type: "string",
          description: "The MetroReach client ID (from clients table).",
        },
        user_id: {
          type: "string",
          description: "The X user ID to post to (from x_list_accounts).",
        },
        text: {
          type: "string",
          description:
            "The tweet text. Must be in MetroReach brand voice.",
        },
        media_urls: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional array of publicly accessible image URLs to attach.",
        },
      },
      required: ["client_id", "user_id", "text"],
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

export const Route = createFileRoute("/api/mcp/x")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireMcpAuth(request);
        if (unauthorized) return unauthorized;
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
            "Access-Control-Allow-Headers": "Content-Type, x-api-key",
          },
        });
      },
    },
  },
});
