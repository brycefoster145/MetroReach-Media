/**
 * MCP (Model Context Protocol) route for the Meta Ads API.
 *
 * Implements JSON-RPC 2.0 over HTTP at POST /api/mcp/meta.
 * Wraps the Facebook Graph API v21.0 for ad account and campaign management.
 *
 * Integrated into the MetroReach Media TanStack Start site.
 *
 * Tools exposed:
 *   meta_list_ad_accounts    — list accessible ad accounts
 *   meta_list_campaigns      — list campaigns for an ad account
 *   meta_get_campaign_insights — get performance insights for a campaign
 *   meta_create_campaign     — create a new campaign
 *   meta_list_ad_sets        — list ad sets for an ad account
 */

import { createFileRoute } from "@tanstack/react-router";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";
const META_TOKEN = process.env.META_ACCESS_TOKEN ?? "";
const SERVER_NAME = "mcp-meta";
const SERVER_VERSION = "1.0.0";

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
 */
async function graphApiRequest<T = unknown>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string>,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${path}`);
  url.searchParams.set("access_token", META_TOKEN);

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

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function listAdAccounts() {
  const data = await graphApiRequest<{
    data?: Array<{
      id: string;
      name: string;
      account_status: number;
      currency: string;
    }>;
  }>("GET", "/me/adaccounts", {
    fields: "id,name,account_status,currency",
  });
  return data;
}

async function listCampaigns(args: { ad_account_id: string }) {
  const data = await graphApiRequest<{
    data?: Array<{
      id: string;
      name: string;
      status: string;
      objective: string;
      daily_budget: number;
      lifetime_budget: number;
    }>;
  }>("GET", `/${args.ad_account_id}/campaigns`, {
    fields: "id,name,status,objective,daily_budget,lifetime_budget",
  });
  return data;
}

async function getCampaignInsights(args: { campaign_id: string }) {
  const data = await graphApiRequest<{
    data?: Array<{
      impressions: string;
      clicks: string;
      spend: string;
      cpm: string;
      ctr: string;
      cpc: string;
      reach: string;
      date_start: string;
      date_stop: string;
    }>;
  }>("GET", `/${args.campaign_id}/insights`, {
    date_preset: "last_30d",
    fields: "impressions,clicks,spend,cpm,ctr,cpc,reach",
  });
  return data;
}

async function createCampaign(args: {
  ad_account_id: string;
  name: string;
  objective: string;
  status: string;
  special_ad_categories?: string[];
}) {
  const body: Record<string, unknown> = {
    name: args.name,
    objective: args.objective,
    status: args.status,
    special_ad_categories: args.special_ad_categories ?? [],
  };

  const data = await graphApiRequest<{
    id?: string;
  }>(
    "POST",
    `/${args.ad_account_id}/campaigns`,
    undefined,
    body,
  );
  return data;
}

async function listAdSets(args: { ad_account_id: string }) {
  const data = await graphApiRequest<{
    data?: Array<{
      id: string;
      name: string;
      status: string;
      daily_budget: number;
      optimization_goal: string;
    }>;
  }>("GET", `/${args.ad_account_id}/adsets`, {
    fields: "id,name,status,daily_budget,optimization_goal",
  });
  return data;
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
    name: "meta_list_ad_accounts",
    description:
      "List all ad accounts accessible by the authenticated Meta user. " +
      "Returns account IDs, names, status codes, and currencies. " +
      "Use this to discover which ad accounts are available before querying campaigns or ad sets.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    handler: listAdAccounts,
  },
  {
    name: "meta_list_campaigns",
    description:
      "List all campaigns for a given ad account. " +
      "Returns campaign IDs, names, statuses, objectives, and budget info. " +
      "Requires an ad_account_id (format: act_XXXXXXXXX).",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: {
          type: "string",
          description:
            "The Meta ad account ID (e.g., act_123456789). Obtain from meta_list_ad_accounts.",
        },
      },
      required: ["ad_account_id"],
    },
    handler: listCampaigns,
  },
  {
    name: "meta_get_campaign_insights",
    description:
      "Get performance insights for a specific campaign over the last 30 days. " +
      "Returns impressions, clicks, spend, CPM, CTR, CPC, and reach. " +
      "Requires a campaign_id.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: {
          type: "string",
          description:
            "The Meta campaign ID (numeric string). Obtain from meta_list_campaigns.",
        },
      },
      required: ["campaign_id"],
    },
    handler: getCampaignInsights,
  },
  {
    name: "meta_create_campaign",
    description:
      "Create a new Meta ad campaign in the specified ad account. " +
      "Provide name, objective (e.g., OUTCOME_LEADS, OUTCOME_TRAFFIC), " +
      "status (e.g., PAUSED, ACTIVE), and optional special_ad_categories. " +
      "Returns the new campaign ID on success.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: {
          type: "string",
          description:
            "The Meta ad account ID (e.g., act_123456789).",
        },
        name: {
          type: "string",
          description: "The campaign name.",
        },
        objective: {
          type: "string",
          description:
            "Campaign objective (e.g., OUTCOME_LEADS, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT).",
        },
        status: {
          type: "string",
          description:
            "Campaign status. Typically PAUSED to start, then switch to ACTIVE.",
        },
        special_ad_categories: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional array of special ad category enums (e.g., ['CREDIT', 'EMPLOYMENT']).",
        },
      },
      required: ["ad_account_id", "name", "objective", "status"],
    },
    handler: createCampaign,
  },
  {
    name: "meta_list_ad_sets",
    description:
      "List all ad sets for a given ad account. " +
      "Returns ad set IDs, names, statuses, daily budgets, and optimization goals. " +
      "Requires an ad_account_id.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: {
          type: "string",
          description:
            "The Meta ad account ID (e.g., act_123456789). Obtain from meta_list_ad_accounts.",
        },
      },
      required: ["ad_account_id"],
    },
    handler: listAdSets,
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

export const Route = createFileRoute("/api/mcp/meta")({
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
