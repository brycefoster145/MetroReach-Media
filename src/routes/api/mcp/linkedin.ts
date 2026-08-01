/**
 * MCP (Model Context Protocol) route for the LinkedIn API.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/linkedin.
 * Wraps the LinkedIn REST API for organization/page management and posting.
 *
 * MetroReach Media — Premium Social Media Marketing Agency
 *
 * Tools exposed:
 *   linkedin_list_organizations  — list connected company pages
 *   linkedin_create_post          — create a post on a LinkedIn company page
 */

import { createFileRoute } from "@tanstack/react-router";
import { requireMcpAuth } from "~/lib/mcp-auth";
import { sql } from "~/lib/db";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_VERSION = "202501";
const SERVER_NAME = "mcp-linkedin";
const SERVER_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// LinkedIn API request helper
// ---------------------------------------------------------------------------

/**
 * Make a request to the LinkedIn REST API.
 */
async function linkedinApiRequest<T = unknown>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  accessToken: string,
  body?: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const fetchOpts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
      "Accept": "application/json",
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

  const res = await fetch(`${LINKEDIN_API_BASE}${path}`, fetchOpts);
  const text = await res.text();

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `LinkedIn API returned non-JSON response (status ${res.status}): ${text.slice(0, 500)}`
    );
  }

  if (res.status >= 400 || json.error) {
    const errMsg =
      json.message ||
      json.error_description ||
      json.error ||
      `HTTP ${res.status}`;
    throw new Error(`LinkedIn API error: ${errMsg}`);
  }

  return json as T;
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function listOrganizations(args: { client_id: string }) {
  if (!args.client_id) {
    throw new Error("client_id is required");
  }

  const rows = await sql`
    SELECT page_id, account_name, created_at
    FROM client_platform_tokens
    WHERE client_id = ${args.client_id}
      AND platform = 'linkedin'
    ORDER BY created_at DESC
  `;

  return {
    organizations: rows.map((r: any) => ({
      organization_id: r.page_id,
      name: r.account_name,
      connected_at: String(r.created_at),
    })),
  };
}

async function createPost(args: {
  client_id: string;
  organization_id: string;
  text: string;
  media_urls?: string[];
  scheduled_at?: string;
}) {
  if (!args.client_id || !args.organization_id || !args.text) {
    throw new Error("client_id, organization_id, and text are required");
  }

  // Look up the client's stored LinkedIn token
  const rows = await sql`
    SELECT access_token, page_id, account_name
    FROM client_platform_tokens
    WHERE client_id = ${args.client_id}
      AND platform = 'linkedin'
      AND page_id = ${args.organization_id}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error(
      `No LinkedIn token found for client ${args.client_id} organization ${args.organization_id}. ` +
      `Have they connected via /portal/connect?`
    );
  }

  const accessToken = rows[0].access_token as string;

  // Build the post body per LinkedIn REST API spec
  const postBody: Record<string, unknown> = {
    author: `urn:li:organization:${args.organization_id.split(":").pop()}`,
    commentary: args.text,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: args.scheduled_at ? "DRAFT" : "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  // If media is provided, use the content field
  if (args.media_urls && args.media_urls.length > 0) {
    const media = args.media_urls.map((url) => ({
      status: "READY",
      description: { text: args.text },
      media: url,
      title: { text: "" },
    }));
    postBody.content = {
      media: {
        images: media,
      },
    };
  }

  const result = await linkedinApiRequest<{
    id?: string;
    xLinkedInId?: string;
    lifecycleState?: string;
  }>("POST", "/rest/posts", accessToken, postBody);

  const postId = result.id || result.xLinkedInId || "unknown";

  return {
    post_id: postId,
    platform: "linkedin",
    status: args.scheduled_at ? "draft" : "published",
    organization_name: rows[0].account_name,
    lifecycle_state: result.lifecycleState,
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
    name: "linkedin_list_organizations",
    description:
      "List all LinkedIn company pages connected by a client. " +
      "Returns organization IDs, names, and connection dates. " +
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
    handler: listOrganizations,
  },
  {
    name: "linkedin_create_post",
    description:
      "Create and publish a post directly to a connected LinkedIn company page. " +
      "Uses the client's stored access token (connected via /portal/connect). " +
      "Requires client_id, organization_id, and text. Optionally accepts media_urls " +
      "(array of public image URLs) and scheduled_at (ISO 8601 timestamp for drafts). " +
      "Returns the post ID, platform, and status.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: {
          type: "string",
          description: "The MetroReach client ID (from clients table).",
        },
        organization_id: {
          type: "string",
          description: "The LinkedIn organization URN or ID to post to.",
        },
        text: {
          type: "string",
          description: "The post text. Must be in MetroReach brand voice.",
        },
        media_urls: {
          type: "array",
          items: { type: "string" },
          description: "Optional array of publicly accessible image URLs to attach.",
        },
        scheduled_at: {
          type: "string",
          description: "Optional ISO 8601 timestamp for scheduling as draft. If omitted, post is published immediately.",
        },
      },
      required: ["client_id", "organization_id", "text"],
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

export const Route = createFileRoute("/api/mcp/linkedin")({
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
