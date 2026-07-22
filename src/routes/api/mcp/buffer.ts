/**
 * MCP (Model Context Protocol) route for the Buffer API.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/buffer.
 * Wraps the Buffer REST API (https://api.bufferapp.com/1/).
 *
 * Integrated into the MetroReach Media TanStack Start site.
 *
 * Tools exposed:
 *   buffer_list_profiles      — list connected social media profiles
 *   buffer_create_post        — create/schedule a post
 *   buffer_get_post           — get a specific post by ID
 *   buffer_list_pending_posts — list pending/scheduled posts
 *   buffer_get_analytics      — get analytics for a post or profile
 */

import { createFileRoute } from "@tanstack/react-router";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BUFFER_BASE = "https://api.bufferapp.com/1";
const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN ?? "";
const SERVER_NAME = "mcp-buffer";
const SERVER_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Thin wrapper around Buffer API requests. */
async function bufferRequest<T = unknown>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${BUFFER_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${BUFFER_TOKEN}`,
    Accept: "application/json",
  };

  const init: RequestInit = { method, headers };

  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) {
        if (Array.isArray(v)) {
          for (const item of v) params.append(k, String(item));
        } else {
          params.append(k, String(v));
        }
      }
    }
    init.body = params.toString();
  }

  const res = await fetch(url, init);
  const data = (await res.json()) as T & { error?: string; message?: string };

  if (!res.ok || (data as any).error) {
    const msg =
      (data as any).error ?? (data as any).message ?? `HTTP ${res.status}`;
    throw new Error(`Buffer API error: ${msg}`);
  }

  return data;
}

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

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function listProfiles() {
  const data = await bufferRequest("GET", "/profiles.json");
  return data;
}

async function createPost(args: {
  profile_id: string;
  text: string;
  media_urls?: string[];
  scheduled_at?: string;
}) {
  const body: Record<string, unknown> = {
    "profile_ids[]": [args.profile_id],
    text: args.text,
  };
  if (args.scheduled_at) body.scheduled_at = args.scheduled_at;

  // Buffer legacy API: media is attached via media[link], media[photo], etc.
  if (args.media_urls?.length) {
    if (args.media_urls.length === 1) {
      const url = args.media_urls[0];
      const ext = url.split(".").pop()?.toLowerCase();
      if (ext && ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
        body["media[photo]"] = url;
      } else if (ext && ["mp4", "mov", "avi"].includes(ext)) {
        body["media[video]"] = url;
      } else {
        body["media[link]"] = url;
      }
    }
  }

  return bufferRequest("POST", "/updates/create.json", body);
}

async function getPost(args: { post_id: string }) {
  return bufferRequest("GET", `/updates/${args.post_id}.json`);
}

async function listPendingPosts(args: { profile_id: string }) {
  return bufferRequest(
    "GET",
    `/profiles/${args.profile_id}/updates/pending.json`,
  );
}

async function getAnalytics(args: { post_id?: string; profile_id?: string }) {
  if (args.post_id) {
    const data = await bufferRequest(
      "GET",
      `/updates/${args.post_id}/interactions.json`,
    );
    return data;
  }
  if (args.profile_id) {
    const data = await bufferRequest(
      "GET",
      `/profiles/${args.profile_id}/updates/sent.json?count=50`,
    );
    return data;
  }
  throw new Error("Either post_id or profile_id is required for analytics");
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
    name: "buffer_list_profiles",
    description:
      "List all social media profiles connected to your Buffer account. " +
      "Returns profile IDs, service types (twitter, facebook, instagram, etc.), " +
      "and formatted usernames.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: listProfiles,
  },
  {
    name: "buffer_create_post",
    description:
      "Create and optionally schedule a social media post via Buffer. " +
      "Provide profile_id, the text content, optional media_urls (images/videos/links), " +
      "and an optional scheduled_at timestamp (ISO 8601) to schedule the post for later. " +
      "Returns the created post with its Buffer ID and status.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: {
          type: "string",
          description:
            "The Buffer profile ID to post to (from buffer_list_profiles).",
        },
        text: {
          type: "string",
          description: "The post text / caption.",
        },
        media_urls: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional list of media URLs to attach (images, videos, or links).",
        },
        scheduled_at: {
          type: "string",
          description:
            "Optional ISO 8601 datetime string to schedule the post. Omit for immediate posting.",
        },
      },
      required: ["profile_id", "text"],
    },
    handler: createPost,
  },
  {
    name: "buffer_get_post",
    description:
      "Retrieve a single Buffer post by its ID. Returns full post details " +
      "including status, text, scheduled time, and attached media.",
    inputSchema: {
      type: "object",
      properties: {
        post_id: {
          type: "string",
          description: "The Buffer update/post ID.",
        },
      },
      required: ["post_id"],
    },
    handler: getPost,
  },
  {
    name: "buffer_list_pending_posts",
    description:
      "List all pending (scheduled but not yet published) posts for a given " +
      "Buffer profile.",
    inputSchema: {
      type: "object",
      properties: {
        profile_id: {
          type: "string",
          description: "The Buffer profile ID (from buffer_list_profiles).",
        },
      },
      required: ["profile_id"],
    },
    handler: listPendingPosts,
  },
  {
    name: "buffer_get_analytics",
    description:
      "Get analytics data from Buffer. Pass post_id to get interactions " +
      "(clicks, retweets, likes, comments, etc.) for a specific post. " +
      "Pass profile_id to get recent sent posts with their stats. " +
      "At least one of post_id or profile_id is required.",
    inputSchema: {
      type: "object",
      properties: {
        post_id: {
          type: "string",
          description: "Buffer update/post ID to get analytics for.",
        },
        profile_id: {
          type: "string",
          description:
            "Buffer profile ID to get recent posts with analytics for.",
        },
      },
    },
    handler: getAnalytics,
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

export const Route = createFileRoute("/api/mcp/buffer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      },
    },
  },
});
