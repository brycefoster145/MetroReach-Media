/**
 * MCP (Model Context Protocol) route for the Buffer API.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/buffer.
 * Wraps the Buffer Publishing API (https://buffer.com/developers/api)
 * for scheduling and managing social media posts across connected channels.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 *
 * Tools exposed:
 *   buffer_get_user             — verify the Buffer connection and return the account profile
 *   buffer_list_profiles        — list all connected social accounts (channels)
 *   buffer_create_post          — schedule or publish a post to one or more profiles
 *   buffer_list_pending_updates — list pending scheduled updates
 *   buffer_delete_update        — delete/destroy a scheduled update
 */

import { createFileRoute } from "@tanstack/react-router";
import { requireMcpAuth } from "~/lib/mcp-auth";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BUFFER_API_BASE = "https://api.bufferapp.com";
const SERVER_NAME = "mcp-buffer";
const SERVER_VERSION = "1.0.0";

/**
 * Resolve the Buffer access token from the environment.
 * Throws a clear, actionable error when it is missing so tool calls
 * fail with an obvious message instead of a confusing 401.
 */
function getBufferAccessToken(): string {
  const token = process.env.BUFFER_ACCESS_TOKEN ?? "";
  if (!token) {
    throw new Error(
      "BUFFER_ACCESS_TOKEN is not set in the environment. " +
        "Add it to the Vercel environment variables (Buffer OAuth access token " +
        "for the MetroReach Buffer account) before using the Buffer MCP tools."
    );
  }
  return token;
}

// ---------------------------------------------------------------------------
// Buffer API request helper
// ---------------------------------------------------------------------------

/**
 * Flatten a params object into key/value string pairs the way Buffer's
 * form-encoded API expects:
 *   - arrays become repeated `key[]=` params (e.g. profile_ids[])
 *   - nested objects become `key[sub]=` params (e.g. media[link])
 */
function flattenParams(
  params: Record<string, unknown>,
): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        entries.push([`${key}[]`, String(item)]);
      }
    } else if (typeof value === "object") {
      for (const [subKey, subVal] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (subVal === undefined || subVal === null) continue;
        entries.push([`${key}[${subKey}]`, String(subVal)]);
      }
    } else {
      entries.push([key, String(value)]);
    }
  }
  return entries;
}

/**
 * Convert a tool argument into a Buffer-compatible scheduled_at unix timestamp.
 * Accepts ISO 8601 strings ("2026-08-05T14:00:00Z"), unix second numbers,
 * or numeric strings — all normalized to whole unix seconds.
 */
function toUnixSeconds(value: string | number): number {
  if (typeof value === "number") return Math.floor(value);
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Math.floor(Number(trimmed));
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid scheduled_at: "${value}" — expected an ISO 8601 timestamp or unix seconds.`
    );
  }
  return Math.floor(ms / 1000);
}

/**
 * Make a request to the Buffer API. Auth is passed as an access_token query
 * parameter (Buffer's documented auth pattern). POST bodies are sent as
 * application/x-www-form-urlencoded, which is what Buffer's create/destroy
 * endpoints expect.
 */
async function bufferApiRequest<T = unknown>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const url = new URL(`${BUFFER_API_BASE}${path}`);
  url.searchParams.set("access_token", getBufferAccessToken());

  const fetchOpts: RequestInit = {
    method,
    headers: { Accept: "application/json" },
  };

  if (method === "POST" && params) {
    const body = new URLSearchParams();
    for (const [key, value] of flattenParams(params)) {
      body.append(key, value);
    }
    fetchOpts.headers = {
      ...(fetchOpts.headers as Record<string, string>),
      "Content-Type": "application/x-www-form-urlencoded",
    };
    fetchOpts.body = body.toString();
  } else if (params) {
    for (const [key, value] of flattenParams(params)) {
      url.searchParams.append(key, value);
    }
  }

  const res = await fetch(url.toString(), fetchOpts);
  const text = await res.text();

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `Buffer API returned non-JSON response (status ${res.status}): ${text.slice(0, 500)}`
    );
  }

  if (res.status >= 400 || json.error || json.success === false) {
    const errMsg =
      json.error ||
      json.message ||
      json.code ||
      `HTTP ${res.status}`;
    throw new Error(`Buffer API error: ${errMsg}`);
  }

  return json as T;
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

/** GET /1/user.json — verify the connection and return the Buffer account. */
async function getUser() {
  const data = await bufferApiRequest<Record<string, unknown>>(
    "GET",
    "/1/user.json",
  );
  return {
    user: data,
    connected: true,
    message:
      "Buffer connection verified. Token is valid and maps to the account above.",
  };
}

/** GET /1/profiles.json — list all connected social accounts (channels). */
async function listProfiles() {
  const data = await bufferApiRequest<{
    total?: number;
    profiles?: Array<Record<string, unknown>>;
  }>("GET", "/1/profiles.json");

  const profiles = data.profiles ?? data ?? [];
  return {
    total: Array.isArray(profiles) ? profiles.length : 0,
    profiles,
  };
}

/** POST /1/updates/create.json — schedule (or immediately publish) a post. */
async function createPost(args: {
  profile_ids: string[];
  text: string;
  media_link?: string;
  media_title?: string;
  media_description?: string;
  media_picture?: string;
  scheduled_at?: string | number;
  now?: boolean;
  top?: boolean;
  shorten_links?: boolean;
}) {
  if (!args.profile_ids || args.profile_ids.length === 0) {
    throw new Error("profile_ids is required and must contain at least one profile ID");
  }
  if (!args.text || !args.text.trim()) {
    throw new Error("text is required");
  }

  const body: Record<string, unknown> = {
    profile_ids: args.profile_ids,
    text: args.text,
  };

  // Buffer nests media fields under media[link], media[title], etc.
  const media: Record<string, unknown> = {};
  if (args.media_link) media.link = args.media_link;
  if (args.media_title) media.title = args.media_title;
  if (args.media_description) media.description = args.media_description;
  if (args.media_picture) media.picture = args.media_picture;
  if (Object.keys(media).length > 0) body.media = media;

  if (args.scheduled_at !== undefined && args.scheduled_at !== null) {
    // Buffer schedules in UTC unix seconds. `now: true` forces immediate
    // publishing instead (Buffer rejects scheduled_at combined with now).
    body.scheduled_at = toUnixSeconds(args.scheduled_at);
  } else if (args.now) {
    body.now = true;
  }
  if (args.top) body.top = true;
  if (args.shorten_links !== undefined) body.shorten_links = args.shorten_links;

  const data = await bufferApiRequest<{
    success?: boolean;
    buffer_count?: number;
    updates?: Array<Record<string, unknown>>;
  }>("POST", "/1/updates/create.json", body);

  return {
    success: data.success ?? true,
    buffer_count: data.buffer_count ?? 0,
    updates: data.updates ?? [],
    profiles: args.profile_ids,
    scheduled_at: body.scheduled_at ?? (args.now ? "immediate" : "next_in_queue"),
  };
}

/** GET /1/updates/pending.json — list pending scheduled updates. */
async function listPendingUpdates(args: {
  profile_ids?: string[];
  count?: number;
  since?: string | number;
  utc?: boolean;
}) {
  const params: Record<string, unknown> = {};
  if (args.profile_ids && args.profile_ids.length > 0) {
    params.profile_ids = args.profile_ids;
  }
  if (args.count !== undefined) params.count = args.count;
  if (args.since !== undefined && args.since !== null) {
    params.since = toUnixSeconds(args.since);
  }
  if (args.utc !== undefined) params.utc = args.utc;

  const data = await bufferApiRequest<{
    total?: number;
    updates?: Array<Record<string, unknown>>;
  }>("GET", "/1/updates/pending.json", params);

  return {
    total: data.total ?? (Array.isArray(data.updates) ? data.updates.length : 0),
    updates: data.updates ?? [],
  };
}

/** POST /1/updates/:id/destroy.json — delete a scheduled update. */
async function deleteUpdate(args: { update_id: string }) {
  if (!args.update_id) {
    throw new Error("update_id is required");
  }
  const data = await bufferApiRequest<{ success?: boolean }>(
    "POST",
    `/1/updates/${args.update_id}/destroy.json`,
  );
  return {
    success: data.success ?? true,
    update_id: args.update_id,
    deleted: true,
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
    name: "buffer_get_user",
    description:
      "Verify the Buffer connection and return the authenticated Buffer account profile. " +
      "Use this as a health check before any other Buffer tool — it confirms the " +
      "BUFFER_ACCESS_TOKEN is valid and reports which account is connected.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: getUser,
  },
  {
    name: "buffer_list_profiles",
    description:
      "List all social media accounts (channels) connected to the Buffer account. " +
      "Returns each profile's ID, service (facebook, instagram, twitter, linkedin, etc.), " +
      "username, avatar, and stats. Use profile IDs from this tool as the profile_ids " +
      "argument for buffer_create_post.",
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
      "Schedule a post to one or more Buffer-connected profiles. " +
      "Requires profile_ids (array of profile IDs from buffer_list_profiles) and text. " +
      "Optionally accepts media_link (public image URL, mapped to Buffer's media[link]), " +
      "media_title, media_description, media_picture, and scheduled_at " +
      "(ISO 8601 timestamp or unix seconds — if omitted, the post goes to the top of the queue " +
      "or publishes immediately when now=true). Returns the created update(s) and buffer count.",
    inputSchema: {
      type: "object",
      properties: {
        profile_ids: {
          type: "array",
          items: { type: "string" },
          description: "Buffer profile IDs to post to (from buffer_list_profiles).",
        },
        text: {
          type: "string",
          description: "The post text. Must be in MetroReach Media brand voice.",
        },
        media_link: {
          type: "string",
          description: "Optional publicly accessible image URL to attach to the post.",
        },
        media_title: {
          type: "string",
          description: "Optional media title (e.g. for link previews).",
        },
        media_description: {
          type: "string",
          description: "Optional media description (e.g. for link previews).",
        },
        media_picture: {
          type: "string",
          description: "Optional media picture URL (e.g. for link previews).",
        },
        scheduled_at: {
          type: "string",
          description:
            "Optional ISO 8601 timestamp or unix seconds to schedule the post. If omitted, the post goes to the top of the queue (or publishes immediately with now=true).",
        },
        now: {
          type: "boolean",
          description: "If true, publish the post immediately instead of scheduling.",
        },
        top: {
          type: "boolean",
          description: "If true, put the post at the top of the buffer queue.",
        },
        shorten_links: {
          type: "boolean",
          description: "If true, automatically shorten links in the post text.",
        },
      },
      required: ["profile_ids", "text"],
    },
    handler: createPost,
  },
  {
    name: "buffer_list_pending_updates",
    description:
      "List pending (scheduled, not yet published) updates in the Buffer queue. " +
      "Optionally filter by profile_ids and limit with count. " +
      "Returns the total pending count and each update's ID, text, status, and scheduled time. " +
      "Use the returned update IDs with buffer_delete_update to cancel posts.",
    inputSchema: {
      type: "object",
      properties: {
        profile_ids: {
          type: "array",
          items: { type: "string" },
          description: "Optional Buffer profile IDs to filter pending updates by.",
        },
        count: {
          type: "number",
          description: "Maximum number of updates to return. Default: all pending.",
        },
        since: {
          type: "string",
          description: "Optional ISO 8601 timestamp or unix seconds — only return updates scheduled after this time.",
        },
        utc: {
          type: "boolean",
          description: "If true, return timestamps in UTC.",
        },
      },
      required: [],
    },
    handler: listPendingUpdates,
  },
  {
    name: "buffer_delete_update",
    description:
      "Delete (destroy) a scheduled update from the Buffer queue so it never publishes. " +
      "Requires the update_id (obtain from buffer_list_pending_updates). " +
      "Returns confirmation of deletion.",
    inputSchema: {
      type: "object",
      properties: {
        update_id: {
          type: "string",
          description: "The Buffer update ID to delete (from buffer_list_pending_updates).",
        },
      },
      required: ["update_id"],
    },
    handler: deleteUpdate,
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

export const Route = createFileRoute("/api/mcp/buffer")({
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
